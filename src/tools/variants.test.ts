import { describe, it, expect } from 'vitest';
import { variantBase, candidateConfigs, searchVariant, VARIANT_SPECS } from './variants';
import { evaluate } from '../model/optimizer';

describe('pricing variants', () => {
  it('covers four accelerators against both benchmarks', () => {
    expect(VARIANT_SPECS).toHaveLength(8);
    expect(new Set(VARIANT_SPECS.map((v) => v.accelerator))).toEqual(new Set(['l4', 'l40s', 'h100-sxm', 'b200']));
    expect(new Set(VARIANT_SPECS.map((v) => v.benchmark))).toEqual(new Set(['gas', 'cloud']));
  });

  it('sets undercut pricing against the chosen benchmark', () => {
    const c = variantBase('h100-sxm', 'gas', 0.05);
    expect(c.compute.presetId).toBe('h100-sxm');
    expect(c.market).toMatchObject({ priceMode: 'undercut', benchmark: 'gas', undercutUsd: 0.05 });
  });

  it('builds the candidate grid without redundant firm settings for spot-only policies', () => {
    const grid = { cards: [1, 2], batteries: [8, 20], firmW: [0, 200], policies: ['firm', 'daylight', 'max'] as const };
    const c = candidateConfigs(variantBase('b200', 'cloud', 0.05), grid);
    expect(c).toHaveLength(2 * 2 * (2 + 1 + 1));
    expect(c.filter((x) => x.compute.policy !== 'firm').every((x) => x.compute.firmComputeW === 0)).toBe(true);
  });

  it('picks the feasible candidate with the highest margin after capital', () => {
    const grid = { cards: [1, 3], batteries: [8, 20], firmW: [0, 200], policies: ['firm', 'max'] as const };
    const base = variantBase('l4', 'cloud', 0.05);
    const best = searchVariant(base, grid);
    const scores = candidateConfigs(base, grid)
      .map((c) => evaluate(c))
      .filter((e) => e.feasible)
      .map((e) => e.marginAfterCapitalYear);
    expect(best.evaluation.marginAfterCapitalYear).toBeCloseTo(Math.max(...scores), 6);
    expect(best.evaluation.feasible).toBe(true);
  });
});
