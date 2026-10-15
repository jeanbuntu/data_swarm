import type { Vec } from './vec';
import { add, sub, scale, len, unit } from './vec';
import { normal, Rng } from './rng';
import { RHO_SEA, CONTROL_TAU_S } from './constants';
import type { SimConfig, Strategy } from './config';
import type { Derived } from './derive';

const HEX_DIRS: [number, number][] = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

/** Slots on a hexagonal lattice, filled ring by ring from the center. */
export function hexSlots(n: number, spacingM: number): Vec[] {
  const axial: [number, number][] = [[0, 0]];
  for (let k = 1; axial.length < n; k++) {
    let q = -k, r = k;
    for (let side = 0; side < 6; side++) {
      for (let j = 0; j < k; j++) {
        axial.push([q, r]);
        q += HEX_DIRS[side][0];
        r += HEX_DIRS[side][1];
      }
    }
  }
  return axial.slice(0, n).map(([q, r]) => ({ x: spacingM * (q + r / 2), y: spacingM * ((Math.sqrt(3) / 2) * r) }));
}

export interface SwarmEnv {
  ghi(t: number, x: number, y: number): number;
  current(t: number): Vec;
  offshoreKm(x: number, y: number): number;
}

export interface SwarmParams {
  slots: Vec[];
  toleranceM: number;
  breakawayM: number;
  disturbanceMs: number;
  strategy: Strategy;
  cruiseMs: number;
  horizonH: number;
  replanMin: number;
  minOffshoreKm: number;
  maxOffshoreKm: number;
  maxWaterSpeedMs: number;
  maxPropElecW: number;
  cd: number;
  areaM2: number;
  propEff: number;
  /** PV watts per W/m2 of irradiance for one module. */
  pvYieldW: number;
}

export interface ModuleKin {
  pos: Vec;
  stray: boolean;
}

export interface SwarmState {
  centroid: Vec;
  centroidVel: Vec;
  modules: ModuleKin[];
  nextReplanT: number;
  seekTarget: Vec | null;
  trail: Vec[];
}

export interface SwarmStepOut {
  waterSpeedMs: number[];
  propulsionW: number[];
}

const TRAIL_MAX = 2000;

export function propulsionPowerW(vWater: number, cd: number, areaM2: number, eta: number): number {
  return (0.5 * RHO_SEA * cd * areaM2 * Math.abs(vWater) ** 3) / eta;
}

export function swarmParams(cfg: SimConfig, d: Derived): SwarmParams {
  const s = cfg.swarm;
  return {
    slots: hexSlots(s.count, s.spacingM),
    toleranceM: s.toleranceM,
    breakawayM: s.breakawayM,
    disturbanceMs: cfg.env.disturbanceMs,
    strategy: s.strategy,
    cruiseMs: s.cruiseMs,
    horizonH: s.horizonH,
    replanMin: s.replanMin,
    minOffshoreKm: s.minOffshoreKm,
    maxOffshoreKm: s.maxOffshoreKm,
    maxWaterSpeedMs: d.maxWaterSpeedMs,
    maxPropElecW: d.maxPropElecW,
    cd: cfg.hull.dragCd,
    areaM2: d.frontalAreaM2,
    propEff: cfg.propulsion.propEff,
    pvYieldW: d.pvAreaM2 * cfg.panel.efficiency * cfg.pv.mpptEff,
  };
}

export function initSwarm(p: SwarmParams, centroid: Vec = { x: 0, y: 0 }): SwarmState {
  return {
    centroid: { ...centroid },
    centroidVel: { x: 0, y: 0 },
    modules: p.slots.map((slot) => ({ pos: add(centroid, slot), stray: false })),
    nextReplanT: -Infinity,
    seekTarget: null,
    trail: [{ ...centroid }],
  };
}

function fenceCorrect(c: Vec, v: Vec, p: SwarmParams, env: SwarmEnv, dtS: number): Vec {
  const next = add(c, scale(v, dtS));
  const dk = env.offshoreKm(next.x, next.y);
  if (dk >= p.minOffshoreKm && dk <= p.maxOffshoreKm) return v;
  const h = 500;
  const g = unit({
    x: (env.offshoreKm(c.x + h, c.y) - env.offshoreKm(c.x - h, c.y)) / (2 * h),
    y: (env.offshoreKm(c.x, c.y + h) - env.offshoreKm(c.x, c.y - h)) / (2 * h),
  });
  const sp = Math.max(p.cruiseMs, 0.05);
  return dk < p.minOffshoreKm ? scale(g, sp) : scale(g, -sp);
}

function replanSeek(s: SwarmState, p: SwarmParams, env: SwarmEnv, t: number): void {
  const H = p.horizonH * 3600;
  const K = 6;
  const score = (q: Vec) => {
    let sum = 0;
    for (let k = 1; k <= K; k++) sum += env.ghi(t + (k * H * 1000) / K, q.x, q.y);
    return (sum * (H / K)) / 3600;
  };
  const base = score(s.centroid);
  let best: Vec | null = null;
  let bestScore = base;
  const reach = p.cruiseMs * H;
  for (let a = 0; a < 8; a++) {
    const q = add(s.centroid, { x: reach * Math.cos((a * Math.PI) / 4), y: reach * Math.sin((a * Math.PI) / 4) });
    const dk = env.offshoreKm(q.x, q.y);
    if (dk < p.minOffshoreKm || dk > p.maxOffshoreKm) continue;
    const sc = score(q);
    if (sc > bestScore) {
      best = q;
      bestScore = sc;
    }
  }
  const n = p.slots.length;
  // Benefit accrues gradually during the transit, so count half of the endpoint gain.
  const gainWh = (bestScore - base) * p.pvYieldW * n * 0.5;
  const costWh = n * propulsionPowerW(p.cruiseMs, p.cd, p.areaM2, p.propEff) * p.horizonH;
  s.seekTarget = best && gainWh > costWh ? best : null;
}

export function stepSwarm(s: SwarmState, p: SwarmParams, env: SwarmEnv, t: number, dtS: number, rng: Rng): SwarmStepOut {
  const cur = env.current(t);
  if (p.strategy === 'seek' && t >= s.nextReplanT) {
    s.nextReplanT = t + p.replanMin * 60000;
    replanSeek(s, p, env, t);
  }
  let vel: Vec = { x: 0, y: 0 };
  if (p.strategy === 'drift') vel = cur;
  else if (p.strategy === 'seek' && s.seekTarget) {
    const to = sub(s.seekTarget, s.centroid);
    const d = len(to);
    vel = d < 1 ? { x: 0, y: 0 } : scale(unit(to), Math.min(p.cruiseMs, d / dtS));
    if (d < 1) s.seekTarget = null;
  }
  vel = fenceCorrect(s.centroid, vel, p, env, dtS);
  s.centroidVel = vel;
  s.centroid = add(s.centroid, scale(vel, dtS));
  s.trail.push({ ...s.centroid });
  if (s.trail.length > TRAIL_MAX) s.trail.splice(0, s.trail.length - TRAIL_MAX);

  const waterSpeedMs: number[] = [];
  const propulsionW: number[] = [];
  const jitter = p.disturbanceMs * Math.sqrt(dtS * 60);
  s.modules.forEach((m, i) => {
    const target = add(s.centroid, p.slots[i]);
    const e = sub(target, m.pos);
    const d = len(e);
    if (d > p.breakawayM) m.stray = true;
    else if (d <= p.toleranceM) m.stray = false;
    let vw: Vec = { x: 0, y: 0 };
    // Where the module would sit relative to its slot after this step if it coasted.
    const coastErr = len(sub(e, scale(sub(cur, vel), dtS)));
    if (d > p.toleranceM || m.stray || coastErr > p.toleranceM) {
      const aim = Math.max(0, d - p.toleranceM * 0.5);
      // Close the gap over CONTROL_TAU_S rather than in one step: drag power grows with speed cubed,
      // so gentle corrections cost far less than sprinting back at full thrust.
      const desired = add(vel, scale(unit(e), Math.min(p.maxWaterSpeedMs, aim / Math.max(dtS, CONTROL_TAU_S))));
      vw = sub(desired, cur);
      const sp = len(vw);
      if (sp > p.maxWaterSpeedMs) vw = scale(vw, p.maxWaterSpeedMs / sp);
    }
    const ground = add(cur, vw);
    m.pos = add(m.pos, scale(ground, dtS));
    if (jitter > 0) m.pos = add(m.pos, { x: normal(rng) * jitter, y: normal(rng) * jitter });
    const speed = len(vw);
    waterSpeedMs.push(speed);
    propulsionW.push(p.maxWaterSpeedMs > 0 ? Math.min(p.maxPropElecW, propulsionPowerW(speed, p.cd, p.areaM2, p.propEff)) : 0);
  });
  return { waterSpeedMs, propulsionW };
}
