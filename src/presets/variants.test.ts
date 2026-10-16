import { describe, it, expect } from 'vitest';
import { BUILTIN_VARIANTS } from './variants';
import { runAnnual } from '../model/annual';
import { economics } from '../model/economics';
import { evaluate } from '../model/optimizer';

describe('built-in pricing variants', () => {
  it('ships eight valid configs priced $0.05 under a benchmark', () => {
    expect(BUILTIN_VARIANTS).toHaveLength(8);
    for (const v of BUILTIN_VARIANTS) {
      expect(v.config.market.priceMode).toBe('undercut');
      expect(v.config.market.undercutUsd).toBe(0.05);
      expect(v.config.market.benchmark).toBe(v.benchmark);
      expect(v.config.compute.presetId).toBe(v.accelerator);
    }
  });

  it('stored metrics reproduce from the configs (regenerate with npm run variants if this fails)', () => {
    for (const v of BUILTIN_VARIANTS) {
      const e = economics(v.config, runAnnual(v.config, 'full'));
      expect(e.costPerGpuHour, v.id).toBeCloseTo(v.metrics.costPerGpuHour, 6);
      expect(e.priceFirm, v.id).toBeCloseTo(v.metrics.priceFirm, 9);
      expect(e.marketFirm - e.priceFirm, v.id).toBeCloseTo(0.05, 9);
    }
  });

  it('every variant passes the feasibility checks', () => {
    for (const v of BUILTIN_VARIANTS) expect(evaluate(v.config).feasible, v.id).toBe(true);
  });
});
