import { describe, it, expect } from 'vitest';
import { createLiveSim, stepLive, runLiveDay, kickModule } from './live';
import { defaultConfig } from './defaults';

describe('live simulation', () => {
  const sim = runLiveDay(defaultConfig(), 172);

  it('steps a full day at 5-minute resolution', () => {
    expect(sim.history).toHaveLength(288);
    expect(sim.done).toBe(true);
    expect(sim.history[0].hour).toBe(0);
    expect(sim.history[287].hour).toBeCloseTo(23 + 55 / 60, 9);
  });

  it('balances energy at every step and keeps battery in range', () => {
    for (const p of sim.history) {
      expect(Math.abs(p.pvW + p.dischargeW - (p.essentialW + p.computeW + p.chargeW + p.curtailedW))).toBeLessThan(1e-6);
      expect(p.socFrac).toBeGreaterThanOrEqual(0);
      expect(p.socFrac).toBeLessThanOrEqual(1 + 1e-9);
    }
  });

  it('completes jobs and produces solar at midday', () => {
    expect(sim.jobs.completed).toBeGreaterThan(0);
    const noon = sim.history[144];
    expect(noon.pvW).toBeGreaterThan(200);
    expect(noon.sunElevationDeg).toBeGreaterThan(60);
  });

  it('a kicked module becomes a stray', () => {
    const s = createLiveSim(defaultConfig(), 172);
    stepLive(s);
    kickModule(s, 5);
    stepLive(s);
    expect(s.swarm.modules[5].stray).toBe(true);
  });

  it('stepLive does nothing after the day ends', () => {
    const before = sim.history.length;
    stepLive(sim);
    expect(sim.history.length).toBe(before);
  });
});
