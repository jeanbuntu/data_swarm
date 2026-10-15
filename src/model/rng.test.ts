import { describe, it, expect } from 'vitest';
import { mulberry32, normal, poisson, hashSeed, pickIndex } from './rng';

describe('rng', () => {
  it('is deterministic for a seed', () => {
    const a = mulberry32(42), b = mulberry32(42);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });
  it('produces uniform values in [0, 1) with mean near 0.5', () => {
    const r = mulberry32(1);
    let sum = 0;
    for (let i = 0; i < 20000; i++) { const v = r(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); sum += v; }
    expect(sum / 20000).toBeCloseTo(0.5, 1);
  });
  it('normal has mean 0 and std 1', () => {
    const r = mulberry32(7);
    const xs = Array.from({ length: 20000 }, () => normal(r));
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
    expect(Math.abs(mean)).toBeLessThan(0.03);
    expect(Math.abs(sd - 1)).toBeLessThan(0.03);
  });
  it('poisson matches its mean for small and large lambda', () => {
    const r = mulberry32(3);
    for (const lambda of [0.5, 4, 120]) {
      let sum = 0;
      for (let i = 0; i < 5000; i++) sum += poisson(r, lambda);
      expect(sum / 5000).toBeGreaterThan(lambda * 0.95);
      expect(sum / 5000).toBeLessThan(lambda * 1.05);
    }
    expect(poisson(r, 0)).toBe(0);
  });
  it('hashSeed differs by input and is stable', () => {
    expect(hashSeed(1, 2)).toBe(hashSeed(1, 2));
    expect(hashSeed(1, 2)).not.toBe(hashSeed(2, 1));
  });
  it('pickIndex follows weights', () => {
    const r = mulberry32(9);
    const counts = [0, 0, 0];
    for (let i = 0; i < 10000; i++) counts[pickIndex(r, [0.7, 0.2, 0.1])]++;
    expect(counts[0] / 10000).toBeCloseTo(0.7, 1);
    expect(counts[2] / 10000).toBeCloseTo(0.1, 1);
    expect(pickIndex(r, [0, 0, 1])).toBe(2);
  });
});
