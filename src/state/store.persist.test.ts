import { describe, it, expect, beforeAll } from 'vitest';

const mem = new Map<string, string>();

beforeAll(() => {
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  };
});

describe('store persistence', () => {
  it('persists only valid configs', async () => {
    const { useFleet } = await import('./store');
    useFleet.getState().update('battery.kwh', 12);
    expect(JSON.parse(mem.get('fleet.current.v1')!).battery.kwh).toBe(12);
    useFleet.getState().update('name', '');
    expect(JSON.parse(mem.get('fleet.current.v1')!).name).toBe('Baseline 20-module swarm');
    useFleet.getState().saveScenario('x');
    expect(useFleet.getState().notice).toMatch(/invalid/);
  });
});
