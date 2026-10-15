import { describe, it, expect } from 'vitest';
import { runAnnual, Totals } from './annual';
import { defaultConfig, applyPreset } from './defaults';

const finite = (t: Totals) =>
  Object.entries(t).every(([, v]) => (typeof v === 'number' ? Number.isFinite(v) : Object.values(v).every(Number.isFinite)));

describe('annual', () => {
  const full = runAnnual(defaultConfig(), 'full');

  it('reports full-year runtime', () => {
    const t0 = performance.now();
    runAnnual(defaultConfig(), 'full');
    const ms = performance.now() - t0;
    console.log(`runAnnual full: ${ms.toFixed(0)} ms`);
    expect(ms).toBeLessThan(30000);
  });

  it('covers a full year with finite totals', () => {
    expect(full.days).toHaveLength(365);
    expect(Math.abs(full.totals.hours - 8760)).toBeLessThan(1);
    expect(finite(full.totals)).toBe(true);
    expect(full.totals.tflop).toBeGreaterThan(0);
  });

  it('conserves energy over the year', () => {
    const t = full.totals;
    const lhs = t.pvKwh + t.dischargeKwh;
    const rhs = t.essentialKwh + t.computeKwh + t.chargeKwh + t.curtailedKwh;
    expect(Math.abs(lhs - rhs) / lhs).toBeLessThan(1e-6);
  });

  it('splits compute into firm and spot and reports availability', () => {
    const t = full.totals;
    expect(Math.abs(t.firmTflop + t.spotTflop - t.tflop) / t.tflop).toBeLessThan(1e-9);
    expect(full.availability).not.toBeNull();
    expect(full.availability!).toBeGreaterThan(0);
    expect(full.availability!).toBeLessThanOrEqual(1 + 1e-9);
  });

  it('binding hours sum to total hours', () => {
    const b = full.totals.bindingH;
    expect(Math.abs(b.power + b.bandwidth + b.demand - full.totals.hours)).toBeLessThan(1e-6);
  });

  it('representative days with 4 sampled modules agree with the full run', () => {
    const rep = runAnnual(defaultConfig(), 'representative', { sampleModules: 4 });
    expect(Math.abs(rep.totals.pvKwh - full.totals.pvKwh) / full.totals.pvKwh).toBeLessThan(0.05);
    expect(Math.abs(rep.totals.tflop - full.totals.tflop) / full.totals.tflop).toBeLessThan(0.07);
    expect(Math.abs(rep.totals.hours - 8760)).toBeLessThan(1);
  });

  it('throttles after a small data cap and loses compute to bandwidth', () => {
    const c = applyPreset(defaultConfig(), 'plan', 'gp-50');
    const r = runAnnual(c, 'representative', { sampleModules: 4 });
    expect(r.totals.bindingH.bandwidth).toBeGreaterThan(0);
    const open = runAnnual(applyPreset(defaultConfig(), 'plan', 'gp-2tb'), 'representative', { sampleModules: 4 });
    expect(r.totals.tflop).toBeLessThan(open.totals.tflop);
  });

  it('degenerate config: no cards, no battery, no thrusters, no petals', () => {
    const c = defaultConfig();
    c.compute.cards = 0;
    c.battery.kwh = 0;
    c.propulsion.count = 0;
    c.hull.petalCount = 0;
    const r = runAnnual(c, 'representative', { sampleModules: 2 });
    expect(finite(r.totals)).toBe(true);
    expect(r.totals.tflop).toBe(0);
    expect(r.batteryCyclesPerModule).toBe(0);
  });

  it('single module runs', () => {
    const c = defaultConfig();
    c.swarm.count = 1;
    const r = runAnnual(c, 'representative');
    expect(finite(r.totals)).toBe(true);
    expect(r.terminals).toBe(1);
  });
  it('low demand is not penalized as a firm-capacity shortfall', () => {
    const c = defaultConfig();
    c.jobs.arrivalsPerHour = 100;
    const r = runAnnual(c, 'representative', { sampleModules: 4 });
    expect(r.availability!).toBeGreaterThan(0.9);
  });

  it('representative mode agrees with the full year on unmet essential load', () => {
    const rep = runAnnual(defaultConfig(), 'representative', { sampleModules: 4 });
    expect(full.totals.unmetKwh).toBeLessThan(0.01);
    expect(rep.totals.unmetKwh).toBeLessThan(0.01);
  });
});
