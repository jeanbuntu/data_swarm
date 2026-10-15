import { describe, it, expect } from 'vitest';
import { valueNoise3 } from './noise';

describe('valueNoise3', () => {
  it('is in [0,1), deterministic, and averages near 0.5', () => {
    let sum = 0;
    for (let i = 0; i < 5000; i++) {
      const v = valueNoise3(5, i * 0.37, i * 0.11, i * 0.05);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      expect(valueNoise3(5, i * 0.37, i * 0.11, i * 0.05)).toBe(v);
      sum += v;
    }
    expect(sum / 5000).toBeGreaterThan(0.45);
    expect(sum / 5000).toBeLessThan(0.55);
  });
  it('is continuous', () => {
    const a = valueNoise3(1, 3.2, 4.7, 0.3);
    const b = valueNoise3(1, 3.2001, 4.7, 0.3);
    expect(Math.abs(a - b)).toBeLessThan(0.01);
  });
  it('depends on the seed', () => {
    expect(valueNoise3(1, 2.5, 2.5, 2.5)).not.toBe(valueNoise3(2, 2.5, 2.5, 2.5));
  });
});
