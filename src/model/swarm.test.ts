import { describe, it, expect } from 'vitest';
import { initSwarm, stepSwarm, swarmParams, propulsionPowerW, SwarmEnv, SwarmParams } from './swarm';
import { derive } from './derive';
import { defaultConfig } from './defaults';
import { mulberry32 } from './rng';
import { dist, add } from './vec';

const flatEnv = (cur = { x: 0, y: 0 }, km = 50): SwarmEnv => ({ ghi: () => 500, current: () => cur, offshoreKm: () => km });

const params = (mut?: (p: SwarmParams) => void) => {
  const c = defaultConfig();
  c.env.disturbanceMs = 0;
  const p = swarmParams(c, derive(c));
  p.disturbanceMs = 0;
  mut?.(p);
  return p;
};

const run = (p: SwarmParams, env: SwarmEnv, hours: number, dtS = 60) => {
  const s = initSwarm(p);
  const rng = mulberry32(1);
  let energyWh = 0;
  for (let k = 0; k < (hours * 3600) / dtS; k++) {
    const out = stepSwarm(s, p, env, k * dtS * 1000, dtS, rng);
    energyWh += (out.propulsionW.reduce((a, b) => a + b, 0) * dtS) / 3600;
  }
  return { s, energyWh };
};

describe('swarm', () => {
  it('propulsion power scales with the cube of speed', () => {
    expect(propulsionPowerW(0.4, 1, 0.9, 0.4) / propulsionPowerW(0.2, 1, 0.9, 0.4)).toBeCloseTo(8, 9);
    expect(propulsionPowerW(0, 1, 0.9, 0.4)).toBe(0);
  });

  it('drift strategy with no disturbance uses zero propulsion and keeps formation', () => {
    const p = params((p) => { p.strategy = 'drift'; });
    const { s, energyWh } = run(p, flatEnv({ x: 0.2, y: -0.1 }), 6);
    expect(energyWh).toBe(0);
    s.modules.forEach((m, i) => expect(dist(m.pos, add(s.centroid, p.slots[i]))).toBeLessThan(1e-6));
  });

  it('station keeping against a current costs energy and holds near slots', () => {
    const p = params((p) => { p.strategy = 'station'; });
    const { s, energyWh } = run(p, flatEnv({ x: 0.2, y: 0 }), 6);
    expect(energyWh).toBeGreaterThan(0);
    expect(dist(s.centroid, { x: 0, y: 0 })).toBe(0);
    s.modules.forEach((m, i) => expect(dist(m.pos, p.slots[i])).toBeLessThan(p.toleranceM + 0.2 * 60 + 1));
    expect(s.modules.some((m) => m.stray)).toBe(false);
  });

  it('a displaced module is flagged as a stray and rejoins', () => {
    const p = params((p) => { p.strategy = 'station'; });
    const s = initSwarm(p);
    s.modules[3].pos = add(s.modules[3].pos, { x: 2 * p.breakawayM, y: 0 });
    const rng = mulberry32(2);
    stepSwarm(s, p, flatEnv(), 0, 60, rng);
    expect(s.modules[3].stray).toBe(true);
    for (let k = 1; k < 60; k++) stepSwarm(s, p, flatEnv(), k * 60000, 60, rng);
    expect(dist(s.modules[3].pos, p.slots[3])).toBeLessThanOrEqual(p.toleranceM + 1);
    expect(s.modules[3].stray).toBe(false);
  });

  it('cloud-seeking moves toward better sun when the gain beats the propulsion cost', () => {
    const p = params((p) => { p.strategy = 'seek'; });
    const env: SwarmEnv = { ghi: (_t, x) => 300 + x * 0.05, current: () => ({ x: 0, y: 0 }), offshoreKm: () => 50 };
    const { s } = run(p, env, 3);
    expect(s.centroid.x).toBeGreaterThan(1000);
  });

  it('cloud-seeking holds still when there is no gain', () => {
    const p = params((p) => { p.strategy = 'seek'; });
    const { s } = run(p, flatEnv(), 3);
    expect(dist(s.centroid, { x: 0, y: 0 })).toBe(0);
  });

  it('respects the geofence while drifting toward shore', () => {
    const p = params((p) => { p.strategy = 'drift'; p.minOffshoreKm = 20; });
    const env: SwarmEnv = { ghi: () => 500, current: () => ({ x: 0, y: -0.5 }), offshoreKm: (_x, y) => 50 + y / 1000 };
    const { s } = run(p, env, 48, 300);
    expect(env.offshoreKm(s.centroid.x, s.centroid.y)).toBeGreaterThan(19.5);
  });

  it('stays finite when overpowered by the current and flags strays', () => {
    const p = params((p) => { p.strategy = 'station'; });
    const { s } = run(p, flatEnv({ x: 1.0, y: 0 }), 6);
    for (const m of s.modules) {
      expect(Number.isFinite(m.pos.x)).toBe(true);
      expect(Number.isFinite(m.pos.y)).toBe(true);
    }
    expect(s.modules.some((m) => m.stray)).toBe(true);
  });
});
