import { describe, it, expect } from 'vitest';
import { paretoFrontier, axisValues, applyAxis, sweep, tornado, pareto, evaluate, metricValue, AXIS_OPTIONS, RANGE_OPTIONS } from './optimizer';
import { defaultConfig } from './defaults';
import { getPath } from './config';

const small = () => {
  const c = defaultConfig();
  c.swarm.count = 2;
  return c;
};

describe('optimizer', () => {
  it('finds the Pareto frontier (min x, max y)', () => {
    const pts = [
      { x: 1, y: 1, ok: true }, { x: 2, y: 3, ok: true }, { x: 3, y: 2, ok: true }, { x: 0.5, y: 5, ok: false }, { x: 4, y: 4, ok: true },
    ];
    expect(paretoFrontier(pts)).toEqual([0, 1, 4]);
  });
  it('generates axis values', () => {
    expect(axisValues({ kind: 'number', path: 'battery.kwh', label: '', min: 2, max: 30, steps: 8 })).toHaveLength(8);
    expect(axisValues({ kind: 'number', path: 'compute.cards', label: '', min: 1, max: 16, steps: 8, integer: true })).toEqual([1, 3, 5, 7, 10, 12, 14, 16]);
    expect(axisValues({ kind: 'enum', path: 'swarm.strategy', label: '', values: ['station', 'seek'] })).toEqual(['station', 'seek']);
  });
  it('applies number, preset and enum axes', () => {
    const c = defaultConfig();
    expect(applyAxis(c, { kind: 'preset', preset: 'accelerator', label: '', ids: [] }, 'l40s').compute.tdpW).toBe(350);
    expect(applyAxis(c, { kind: 'enum', path: 'swarm.strategy', label: '', values: [] }, 'seek').swarm.strategy).toBe('seek');
    expect(applyAxis(c, { kind: 'number', path: 'battery.kwh', label: '', min: 0, max: 1, steps: 2 }, 3).battery.kwh).toBe(3);
  });
  it('every axis and range option points at a real config path', () => {
    const c = defaultConfig();
    for (const a of AXIS_OPTIONS) if (a.kind !== 'preset') expect(getPath(c, a.path)).not.toBeUndefined();
    for (const r of RANGE_OPTIONS) expect(typeof getPath(c, r.path)).toBe('number');
  });
  it('sweeps a 2x2 grid', () => {
    let calls = 0;
    const r = sweep(small(), { kind: 'number', path: 'battery.kwh', label: '', min: 4, max: 12, steps: 2 }, { kind: 'enum', path: 'compute.policy', label: '', values: ['firm', 'max'] }, () => calls++);
    expect(r.cells).toHaveLength(2);
    expect(r.cells[0]).toHaveLength(2);
    expect(calls).toBe(4);
    for (const row of r.cells) for (const ev of row) expect(ev.pflopHours).toBeGreaterThan(0);
  });
  it('tornado rows are sorted by spread', () => {
    const t = tornado(small());
    expect(Number.isFinite(t.base)).toBe(true);
    expect(t.rows.length).toBeGreaterThan(5);
    for (let i = 1; i < t.rows.length; i++) {
      expect(Math.abs(t.rows[i - 1].high - t.rows[i - 1].low)).toBeGreaterThanOrEqual(Math.abs(t.rows[i].high - t.rows[i].low));
    }
  });
  it('pareto samples within ranges', () => {
    const r = pareto(small(), [{ path: 'battery.kwh', label: '', min: 2, max: 20 }], 4, 1);
    expect(r.points).toHaveLength(4);
    for (const p of r.points) {
      expect(p.values['battery.kwh']).toBeGreaterThanOrEqual(2);
      expect(p.values['battery.kwh']).toBeLessThanOrEqual(20);
    }
    for (const i of r.frontier) expect(r.points[i]).toBeDefined();
  });
  it('reports evaluate runtime', () => {
    const t0 = performance.now();
    evaluate(defaultConfig());
    console.log(`evaluate: ${(performance.now() - t0).toFixed(0)} ms`);
  });
  it('100-module evaluation stays finite', () => {
    const c = defaultConfig();
    c.swarm.count = 100;
    const ev = evaluate(c);
    expect(Number.isFinite(ev.pflopHours)).toBe(true);
    expect(Number.isFinite(metricValue(ev, 'marginPerGpuHour'))).toBe(true);
  });
  it('the default scenario is feasible in the optimizer', () => {
    expect(evaluate(defaultConfig()).feasible).toBe(true);
  });
});
