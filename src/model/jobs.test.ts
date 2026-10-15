import { describe, it, expect } from 'vitest';
import { aggregateStep, initJobs, stepJobs, mixStats } from './jobs';
import { mulberry32 } from './rng';
import { WORKLOADS } from '../presets';

const mix = (i: number, t: number, d: number) =>
  mixStats({ arrivalsPerHour: 0, mixInference: i, mixTraining: t, mixDataHeavy: d, checkpointMin: 15 }, WORKLOADS);

describe('aggregateStep', () => {
  it('identifies the binding constraint', () => {
    const m = mix(1, 0, 0);
    expect(aggregateStep(500, 100, 15, 4000, m.inMBPerTflop, m.outMBPerTflop).binding).toBe('power');
    expect(aggregateStep(500, 100, 15, 100, m.inMBPerTflop, m.outMBPerTflop).binding).toBe('demand');
    const h = mix(0, 0, 1);
    const r = aggregateStep(500, 100, 100, 4000, h.inMBPerTflop, h.outMBPerTflop);
    expect(r.binding).toBe('bandwidth');
    expect(r.tflops).toBeCloseTo(12.5 / (2000 / 50000), 6);
    expect(r.downMBps).toBeCloseTo(12.5, 6);
  });
  it('reports power as binding when nothing can run', () => {
    expect(aggregateStep(0, 100, 15, 4000, 0.001, 0.001)).toEqual({ tflops: 0, binding: 'power', downMBps: 0, upMBps: 0 });
  });
});

describe('discrete jobs', () => {
  const runDay = (weights: number[], caps: { tflops: number; downMbps: number; upMbps: number }) => {
    const s = initJobs(0);
    const rng = mulberry32(4);
    for (let k = 0; k < 288; k++) stepJobs(s, [caps], 1000, weights, WORKLOADS, 15, 64, 300, rng);
    return s;
  };

  it('agrees with the aggregate model when power binds', () => {
    const s = runDay([1, 0, 0], { tflops: 500, downMbps: 100, upMbps: 15 });
    const m = mix(1, 0, 0);
    const agg = aggregateStep(500, 100, 15, (1000 / 3600) * m.meanTflop, m.inMBPerTflop, m.outMBPerTflop).tflops * 86400;
    expect(Math.abs(s.workTflop - agg) / agg).toBeLessThan(0.05);
    expect(s.completed).toBeGreaterThan(2500);
  });

  it('agrees with the aggregate model when bandwidth binds', () => {
    const s = runDay([0, 0, 1], { tflops: 500, downMbps: 100, upMbps: 15 });
    const m = mix(0, 0, 1);
    const agg = aggregateStep(500, 100, 15, (1000 / 3600) * m.meanTflop, m.inMBPerTflop, m.outMBPerTflop).tflops * 86400;
    expect(Math.abs(s.workTflop - agg) / agg).toBeLessThan(0.05);
  });

  it('rolls jobs back to the last checkpoint when power is lost', () => {
    const s = initJobs(0);
    const rng = mulberry32(5);
    // A 240-minute checkpoint interval guarantees no checkpoint lands inside this hour.
    for (let k = 0; k < 12; k++) stepJobs(s, [{ tflops: 100, downMbps: 100, upMbps: 15 }], 20, [0, 1, 0], WORKLOADS, 240, 8, 300, rng);
    const before = s.workTflop;
    expect(before).toBeGreaterThan(0);
    stepJobs(s, [{ tflops: 0, downMbps: 0, upMbps: 0 }], 0, [0, 1, 0], WORKLOADS, 240, 8, 300, rng);
    expect(s.rolledBackTflop).toBeGreaterThan(0);
    expect(s.workTflop).toBeLessThan(before);
    expect(s.workTflop).toBeGreaterThanOrEqual(0);
  });

  it('caps the queue and counts rejections', () => {
    const s = initJobs(0);
    const rng = mulberry32(6);
    for (let k = 0; k < 10; k++) stepJobs(s, [{ tflops: 0, downMbps: 0, upMbps: 0 }], 100000, [1, 0, 0], WORKLOADS, 15, 8, 300, rng);
    expect(s.queue.length).toBeLessThanOrEqual(2000);
    expect(s.rejected).toBeGreaterThan(0);
  });

  it('returns per-module compute used within the budget', () => {
    const s = initJobs(0);
    const rng = mulberry32(7);
    const used = stepJobs(s, [{ tflops: 100, downMbps: 100, upMbps: 15 }, { tflops: 0, downMbps: 0, upMbps: 0 }], 5000, [1, 0, 0], WORKLOADS, 15, 64, 300, rng);
    expect(used[0]).toBeLessThanOrEqual(100 * 300 + 1e-6);
    expect(used[1]).toBe(0);
  });
});
