import { describe, it, expect } from 'vitest';
import { derive, moduleRole, nodeParams } from './derive';
import { dispatch } from './module';
import { runAnnual } from './annual';
import { runLiveDay } from './live';
import { economics, moduleCapex } from './economics';
import { defaultConfig, applyPreset } from './defaults';
import type { SimConfig } from './config';

const hub = (mut?: (c: SimConfig) => void): SimConfig => {
  const c = applyPreset(defaultConfig(), 'terminal', 'performance-gen3');
  c.comms.hubMode = true;
  c.comms.modulesPerTerminal = 10;
  mut?.(c);
  return c;
};

describe('hub clusters: roles and loads', () => {
  it('makes the first node of each cluster the master', () => {
    const c = hub();
    expect([0, 1, 9, 10, 11, 19].map((i) => moduleRole(c, i))).toEqual(['master', 'follower', 'follower', 'master', 'follower', 'follower']);
    expect(moduleRole(defaultConfig(), 0)).toBe('uniform');
  });

  it('master carries the terminal and heavy avionics; followers carry a light controller and the radio', () => {
    const c = hub((c) => { c.battery.followerExtraKwh = 3; });
    const d = derive(c);
    const m = nodeParams(c, d, 'master');
    const f = nodeParams(c, d, 'follower');
    expect(m.essentialW).toBeCloseTo(c.loads.masterAvionicsW + c.comms.terminalW + c.comms.radioW, 9);
    expect(f.essentialW).toBeCloseTo(c.loads.followerAvionicsW + c.comms.radioW, 9);
    expect(m.batteryKwh).toBe(c.battery.kwh);
    expect(f.batteryKwh).toBe(c.battery.kwh + 3);
  });

  it('total Starlink power is one terminal per cluster', () => {
    const c = hub();
    const d = derive(c);
    const total = Array.from({ length: c.swarm.count }, (_, i) => nodeParams(c, d, moduleRole(c, i)).essentialW).reduce((a, b) => a + b, 0);
    const expected = 2 * (c.loads.masterAvionicsW + c.comms.terminalW) + 18 * c.loads.followerAvionicsW + 20 * c.comms.radioW;
    expect(total).toBeCloseTo(expected, 9);
    expect(d.terminals).toBe(2);
  });

  it('dispatch uses the node budget it is given', () => {
    const c = hub();
    const d = derive(c);
    const m = dispatch(c, d, { pvW: 0, propulsionW: 0, trackingActive: false, socKwh: 8, dtH: 0.25 }, nodeParams(c, d, 'master'));
    const f = dispatch(c, d, { pvW: 0, propulsionW: 0, trackingActive: false, socKwh: 8, dtH: 0.25 }, nodeParams(c, d, 'follower'));
    expect(m.essentialW).toBeGreaterThan(f.essentialW);
  });
});

describe('hub clusters: simulation', () => {
  it('weighted sampling matches simulating every module', () => {
    const c = hub();
    const sampled = runAnnual(c, 'representative', { sampleModules: 4 });
    const all = runAnnual(c, 'representative', { sampleModules: c.swarm.count });
    expect(Math.abs(sampled.totals.essentialKwh - all.totals.essentialKwh) / all.totals.essentialKwh).toBeLessThan(0.03);
    expect(Math.abs(sampled.totals.tflop - all.totals.tflop) / all.totals.tflop).toBeLessThan(0.05);
  });

  it('masters deliver less compute than followers over a day', () => {
    const c = hub();
    const s = runLiveDay(c, 172);
    const master = s.moduleTflop[0];
    const followers = s.moduleTflop.filter((_, i) => moduleRole(c, i) === 'follower');
    expect(master).toBeLessThan(followers.reduce((a, b) => a + b, 0) / followers.length);
  });
});

describe('hub clusters: costs', () => {
  it('prices one terminal per cluster and role-specific avionics', () => {
    const c = hub();
    const lines = Object.fromEntries(moduleCapex(c).lines.map((l) => [l.key, l.usd]));
    expect(lines.starlink).toBeCloseTo((2 * c.comms.terminalUsd) / 20 + c.comms.radioUsd, 6);
    expect(lines.avionics).toBeCloseTo(c.econ.gnssUsd + (2 * c.econ.masterAvionicsUsd + 18 * c.econ.followerAvionicsUsd) / 20, 6);
  });

  it('pays one data plan per cluster', () => {
    const c = hub();
    const e = economics(c, runAnnual(c, 'representative', { sampleModules: 4 }));
    expect(e.opexLines.find((l) => l.key === 'starlinkPlans')!.usd).toBe(2 * c.comms.planUsdPerMonth * 12);
  });
});
