import type { SimConfig } from './config';
import { derive, Derived, moduleRole, NodeParams } from './derive';
import { createEnvironment, Env } from './environment';
import { swarmParams, initSwarm, stepSwarm, SwarmParams, SwarmState } from './swarm';
import { poaIrradiance, pvPowerW } from './solar';
import { dispatch, StepFlows } from './module';
import { aggregateStep, initJobs, stepJobs, Binding, JobState } from './jobs';
import { mulberry32, hashSeed, Rng } from './rng';
import { dayStartMs } from './time';
import { add } from './vec';
import { WORKLOADS } from '../presets';

export interface LivePoint {
  t: number;
  hour: number;
  ghi: number;
  sunElevationDeg: number;
  sunAzimuthDeg: number;
  stowed: boolean;
  pvW: number;
  essentialW: number;
  propulsionW: number;
  computeW: number;
  chargeW: number;
  dischargeW: number;
  curtailedW: number;
  socFrac: number;
  tflops: number;
  binding: Binding;
}

export interface LiveSim {
  cfg: SimConfig;
  d: Derived;
  env: Env;
  params: SwarmParams;
  rng: Rng;
  doy: number;
  t: number;
  dayStart: number;
  endT: number;
  dtS: number;
  swarm: SwarmState;
  soc: number[];
  node: NodeParams[];
  /** TFLOP delivered by each module so far today. */
  moduleTflop: number[];
  flows: StepFlows[];
  jobs: JobState;
  history: LivePoint[];
  stowed: boolean;
  binding: Binding;
  sunElevationDeg: number;
  done: boolean;
}

export const LIVE_DT_S = 300;

export function createLiveSim(cfg: SimConfig, doy: number, startSocFrac = 0.5): LiveSim {
  const d = derive(cfg);
  const env = createEnvironment(cfg);
  const params = swarmParams(cfg, d);
  const t0 = dayStartMs(doy);
  return {
    cfg, d, env, params,
    rng: mulberry32(hashSeed(cfg.seed, doy, 7)),
    doy, t: t0, dayStart: t0, endT: t0 + 86400000, dtS: LIVE_DT_S,
    swarm: initSwarm(params),
    node: Array.from({ length: cfg.swarm.count }, (_, i) => d.nodes[moduleRole(cfg, i)]),
    soc: Array.from({ length: cfg.swarm.count }, (_, i) => d.nodes[moduleRole(cfg, i)].batteryKwh * startSocFrac),
    moduleTflop: new Array(cfg.swarm.count).fill(0),
    flows: [],
    jobs: initJobs(t0),
    history: [],
    stowed: false,
    binding: 'power',
    sunElevationDeg: env.sun(t0).elevationDeg,
    done: false,
  };
}

export function stepLive(s: LiveSim): void {
  if (s.done) return;
  const { cfg, d, env, params } = s;
  const dtS = s.dtS;
  const dtH = dtS / 3600;
  const t = s.t;
  const n = cfg.swarm.count;
  const out = stepSwarm(s.swarm, params, env, t, dtS, s.rng);
  const stowed = env.stowed(t);
  const sun = env.sun(t);
  const tracking = !stowed && cfg.hull.tracking !== 'flat' && sun.elevationDeg > 0;
  const area = stowed ? d.hullTopM2 : d.pvAreaM2;
  const pvs: number[] = [];
  const pass1: StepFlows[] = [];
  let ghiSum = 0;
  for (let i = 0; i < n; i++) {
    const pos = s.swarm.modules[i].pos;
    const ghi = env.ghi(t, pos.x, pos.y);
    ghiSum += ghi;
    const pvW = pvPowerW(poaIrradiance(ghi, sun, cfg.hull.tracking, cfg.hull.fixedTiltDeg, cfg.hull.maxTiltDeg, s.doy), area, cfg);
    pvs.push(pvW);
    pass1.push(dispatch(cfg, d, { pvW, propulsionW: out.propulsionW[i], trackingActive: tracking, socKwh: s.soc[i], dtH }, s.node[i]));
  }
  const linkShare = d.terminals / n;
  const caps = pass1.map((f) => ({
    tflops: f.tflops,
    downMbps: f.online ? cfg.comms.downMbps * linkShare : 0,
    upMbps: f.online ? cfg.comms.upMbps * linkShare : 0,
  }));
  const used = stepJobs(s.jobs, caps, cfg.jobs.arrivalsPerHour, d.mix.weights, WORKLOADS, cfg.jobs.checkpointMin, Math.max(32, cfg.compute.cards * 8), dtS, s.rng);
  s.flows = pass1.map((f, i) => {
    const rate = used[i] / dtS;
    if (rate >= f.tflops - 1e-9) return f;
    return dispatch(cfg, d, {
      pvW: pvs[i], propulsionW: out.propulsionW[i], trackingActive: tracking, socKwh: s.soc[i], dtH,
      computeCapElecW: d.tflopsPerElecW > 0 ? rate / d.tflopsPerElecW : 0,
    }, s.node[i]);
  });
  s.flows.forEach((f, i) => {
    s.soc[i] = f.socKwh;
    s.moduleTflop[i] += f.tflops * dtS;
  });
  const potential = pass1.reduce((a, f) => a + f.tflops, 0);
  const down = caps.reduce((a, c) => a + c.downMbps, 0);
  const up = caps.reduce((a, c) => a + c.upMbps, 0);
  s.binding = aggregateStep(potential, down, up, (cfg.jobs.arrivalsPerHour / 3600) * d.mix.meanTflop, d.mix.inMBPerTflop, d.mix.outMBPerTflop).binding;
  const avg = (sel: (f: StepFlows) => number) => s.flows.reduce((a, f) => a + sel(f), 0) / n;
  s.history.push({
    t,
    hour: (t - s.dayStart) / 3600000,
    ghi: ghiSum / n,
    sunElevationDeg: sun.elevationDeg,
    sunAzimuthDeg: sun.azimuthDeg,
    stowed,
    pvW: avg((f) => f.pvW),
    essentialW: avg((f) => f.essentialW),
    propulsionW: out.propulsionW.reduce((a, b) => a + b, 0) / n,
    computeW: avg((f) => f.computeElecW),
    chargeW: avg((f) => f.chargeW),
    dischargeW: avg((f) => f.dischargeW),
    curtailedW: avg((f) => f.curtailedW),
    socFrac: totalCapKwh(s) > 0 ? s.soc.reduce((a, b) => a + b, 0) / totalCapKwh(s) : 0,
    tflops: s.flows.reduce((a, f) => a + f.tflops, 0),
    binding: s.binding,
  });
  s.stowed = stowed;
  s.sunElevationDeg = sun.elevationDeg;
  s.t += dtS * 1000;
  s.done = s.t >= s.endT;
}

const totalCapKwh = (s: LiveSim) => s.node.reduce((a, p) => a + p.batteryKwh, 0);

export function runLiveDay(cfg: SimConfig, doy: number): LiveSim {
  const s = createLiveSim(cfg, doy);
  while (!s.done) stepLive(s);
  return s;
}

/** Pushes one module twice the breakaway distance away in a random direction, to demonstrate rejoin. */
export function kickModule(s: LiveSim, i: number): void {
  const m = s.swarm.modules[i];
  if (!m) return;
  const a = s.rng() * 2 * Math.PI;
  const r = 2 * s.cfg.swarm.breakawayM;
  m.pos = add(m.pos, { x: r * Math.cos(a), y: r * Math.sin(a) });
}
