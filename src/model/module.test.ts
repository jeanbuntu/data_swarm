import { describe, it, expect } from 'vitest';
import { derive } from './derive';
import { dispatch, StepFlows } from './module';
import { hexSlots } from './swarm';
import { mixStats } from './jobs';
import { defaultConfig } from './defaults';
import { WORKLOADS } from '../presets';
import type { SimConfig } from './config';

const balance = (f: StepFlows) => f.pvW + f.dischargeW - (f.essentialW + f.computeElecW + f.chargeW + f.curtailedW);

describe('hexSlots', () => {
  it('builds a hex lattice with minimum spacing', () => {
    expect(hexSlots(1, 100)).toEqual([{ x: 0, y: 0 }]);
    const s7 = hexSlots(7, 100);
    expect(s7).toHaveLength(7);
    for (let i = 1; i < 7; i++) expect(Math.hypot(s7[i].x, s7[i].y)).toBeCloseTo(100, 6);
    const s20 = hexSlots(20, 150);
    for (let i = 0; i < 20; i++) for (let j = i + 1; j < 20; j++) {
      expect(Math.hypot(s20[i].x - s20[j].x, s20[i].y - s20[j].y)).toBeGreaterThan(149.9);
    }
  });
});

describe('mixStats', () => {
  it('weights workloads and normalizes', () => {
    const m = mixStats({ arrivalsPerHour: 1, mixInference: 2, mixTraining: 0, mixDataHeavy: 0, checkpointMin: 15 }, WORKLOADS);
    expect(m.weights).toEqual([1, 0, 0]);
    expect(m.meanTflop).toBe(14000);
    expect(m.inMBPerTflop).toBeCloseTo(2 / 14000, 12);
    const z = mixStats({ arrivalsPerHour: 1, mixInference: 0, mixTraining: 0, mixDataHeavy: 0, checkpointMin: 15 }, WORKLOADS);
    expect(z.weights).toEqual([1, 0, 0]);
  });
});

describe('derive', () => {
  it('computes default module geometry and limits', () => {
    const d = derive(defaultConfig());
    expect(d.hullTopM2).toBeCloseTo(2.3104, 4);
    expect(d.pvAreaM2).toBeCloseTo(2.3104 + 8 * 1.0 * 0.9, 4);
    expect(d.spanM).toBeCloseTo(3.52, 6);
    expect(d.terminals).toBe(20);
    expect(d.maxWaterSpeedMs).toBeGreaterThan(0.4);
    expect(d.maxWaterSpeedMs).toBeLessThan(0.5);
    expect(d.massKg).toBeLessThan(d.displacementKg);
    expect(d.petalOverlap).toBe(false);
    expect(d.tflopsPerElecW).toBeGreaterThan(1.4);
    expect(d.tflopsPerElecW).toBeLessThan(121 / 72);
  });
  it('shares terminals across modules', () => {
    const c = defaultConfig();
    c.comms.modulesPerTerminal = 4;
    const d = derive(c);
    expect(d.terminals).toBe(5);
    expect(d.starlinkWPerModule).toBeCloseTo((5 * c.comms.terminalW) / 20, 9);
    expect(d.essentialW).toBeCloseTo(c.loads.avionicsW + d.starlinkWPerModule + c.comms.radioW, 9);
  });
  it('handles zero cards and zero thrusters', () => {
    const c = defaultConfig();
    c.compute.cards = 0;
    c.propulsion.count = 0;
    const d = derive(c);
    expect(d.maxComputeElecW).toBe(0);
    expect(d.tflopsPerElecW).toBe(0);
    expect(d.maxWaterSpeedMs).toBe(0);
  });
});

describe('dispatch', () => {
  const base = (mut?: (c: SimConfig) => void) => {
    const c = defaultConfig();
    mut?.(c);
    return { c, d: derive(c) };
  };

  it('conserves energy under every policy, day and night', () => {
    for (const policy of ['daylight', 'firm', 'max'] as const) {
      const { c, d } = base((c) => { c.compute.policy = policy; });
      for (const pvW of [0, 150, 900, 2500]) {
        for (const soc of [0.8, 4, 8]) {
          const f = dispatch(c, d, { pvW, propulsionW: 20, trackingActive: pvW > 0, socKwh: soc, dtH: 0.25 });
          expect(Math.abs(balance(f))).toBeLessThan(1e-6);
          expect(f.socKwh).toBeGreaterThanOrEqual(0);
          expect(f.socKwh).toBeLessThanOrEqual(c.battery.kwh + 1e-9);
        }
      }
    }
  });

  it('daylight policy never discharges the battery for compute', () => {
    const { c, d } = base((c) => { c.compute.policy = 'daylight'; });
    const f = dispatch(c, d, { pvW: 0, propulsionW: 0, trackingActive: false, socKwh: 8, dtH: 0.25 });
    expect(f.computeElecW).toBe(0);
    expect(f.dischargeW).toBeCloseTo(d.essentialW, 6);
  });

  it('firm policy runs firm compute from the battery at night and keeps the reserve', () => {
    const { c, d } = base();
    const f = dispatch(c, d, { pvW: 0, propulsionW: 0, trackingActive: false, socKwh: 8, dtH: 0.25 });
    expect(f.firmElecW).toBeCloseTo(d.firmComputeElecW, 6);
    expect(f.spotElecW).toBe(0);
    const low = dispatch(c, d, { pvW: 0, propulsionW: 0, trackingActive: false, socKwh: d.reserveKwh, dtH: 0.25 });
    expect(low.firmElecW).toBe(0);
    expect(low.online).toBe(true);
  });

  it('caps compute when asked', () => {
    const { c, d } = base();
    const f = dispatch(c, d, { pvW: 2500, propulsionW: 0, trackingActive: true, socKwh: 4, dtH: 0.25, computeCapElecW: 100 });
    expect(f.computeElecW).toBeLessThanOrEqual(100 + 1e-9);
    expect(Math.abs(balance(f))).toBeLessThan(1e-6);
  });

  it('marks the module offline and records unmet load when the battery is empty at night', () => {
    const { c, d } = base();
    const f = dispatch(c, d, { pvW: 0, propulsionW: 50, trackingActive: false, socKwh: d.socMinKwh, dtH: 0.25 });
    expect(f.online).toBe(false);
    expect(f.unmetW).toBeGreaterThan(0);
    expect(f.computeElecW).toBe(0);
  });

  it('works with a zero-capacity battery', () => {
    const { c, d } = base((c) => { c.battery.kwh = 0; });
    const f = dispatch(c, d, { pvW: 1000, propulsionW: 0, trackingActive: true, socKwh: 0, dtH: 0.25 });
    expect(Math.abs(balance(f))).toBeLessThan(1e-6);
    expect(f.chargeW).toBe(0);
  });
});
