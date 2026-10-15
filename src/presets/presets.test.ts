import { describe, it, expect } from 'vitest';
import { ALL_PRESET_DATA, collectSourced, ACCELERATORS, WORKLOADS, GHI_ANCHORS, COAST } from './index';

describe('presets', () => {
  const all = collectSourced(ALL_PRESET_DATA);
  it('collects a large set of sourced values', () => {
    expect(all.length).toBeGreaterThan(120);
  });
  it('every value has a source, date and unit', () => {
    for (const v of all) {
      expect(v.source.length).toBeGreaterThan(0);
      expect(v.date).toBe('2026-10-15');
      expect(v.unit.length).toBeGreaterThan(0);
      expect(Number.isFinite(v.value)).toBe(true);
    }
  });
  it('estimates are flagged exactly when the source is ESTIMATE', () => {
    for (const v of all) expect(!!v.estimate).toBe(v.source === 'ESTIMATE');
  });
  it('accelerator ids are unique and L4 is present', () => {
    const ids = ACCELERATORS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('l4');
  });
  it('workloads are in fixed order', () => {
    expect(WORKLOADS.map((w) => w.id)).toEqual(['inference', 'training', 'dataHeavy']);
  });
  it('GHI anchors have 12 months and ascending distance', () => {
    for (const a of GHI_ANCHORS) expect(a.monthly).toHaveLength(12);
    expect(GHI_ANCHORS.map((a) => a.km)).toEqual([10, 120, 300]);
  });
  it('coastline runs north to south', () => {
    expect(COAST[0][0]).toBeGreaterThan(COAST[COAST.length - 1][0]);
  });
});
