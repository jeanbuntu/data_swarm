import { describe, it, expect } from 'vitest';
import { utilization } from './metrics';
import { runAnnual } from './annual';
import { defaultConfig } from './defaults';

describe('utilization metrics', () => {
  const cfg = defaultConfig();
  const a = runAnnual(cfg, 'representative', { sampleModules: 4 });
  const u = utilization(cfg, a);

  it('binding shares sum to 1', () => {
    expect(u.bindingShare.power + u.bindingShare.bandwidth + u.bindingShare.demand).toBeCloseTo(1, 9);
  });
  it('card utilization is delivered compute over nameplate', () => {
    const nameplate = cfg.swarm.count * cfg.compute.cards * cfg.compute.denseTflops * a.totals.hours * 3600;
    expect(u.cardUtilization).toBeCloseTo(a.totals.tflop / nameplate, 9);
    expect(u.cardUtilization).toBeGreaterThan(0);
    expect(u.cardUtilization).toBeLessThan(1);
  });
  it('link utilization is data moved over unthrottled link capacity', () => {
    const capMB = a.terminals * ((cfg.comms.downMbps + cfg.comms.upMbps) / 8) * a.totals.hours * 3600;
    expect(u.linkUtilization).toBeCloseTo(((a.totals.downGB + a.totals.upGB) * 1000) / capMB, 9);
  });
  it('is zero rather than NaN with no cards', () => {
    const c = defaultConfig();
    c.compute.cards = 0;
    const z = utilization(c, runAnnual(c, 'representative', { sampleModules: 2 }));
    expect(z.cardUtilization).toBe(0);
    expect(z.linkUtilization).toBe(0);
  });
});
