import { describe, it, expect } from 'vitest';
import { useFleet } from './store';
import { defaultConfig } from '../model/defaults';

describe('store', () => {
  it('loads without localStorage', () => {
    expect((globalThis as { localStorage?: unknown }).localStorage).toBeUndefined();
    expect(useFleet.getState().cfg).toEqual(defaultConfig());
  });
  it('updates, applies presets, saves and loads scenarios', () => {
    const st = useFleet.getState;
    st().update('battery.kwh', 12);
    expect(st().cfg.battery.kwh).toBe(12);
    st().preset('accelerator', 'l40s');
    expect(st().cfg.compute.tdpW).toBe(350);
    st().saveScenario('Big battery');
    st().reset();
    expect(st().cfg.battery.kwh).toBe(8);
    st().loadScenario('Big battery');
    expect(st().cfg.battery.kwh).toBe(12);
    st().saveScenario('   ');
    expect(st().notice).toMatch(/name/);
    st().deleteScenario('Big battery');
    expect(st().scenarios['Big battery']).toBeUndefined();
  });
});
