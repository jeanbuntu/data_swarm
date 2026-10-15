import { describe, it, expect } from 'vitest';
import { feasibility } from './feasibility';
import { derive } from './derive';
import { defaultConfig, applyPreset } from './defaults';
import { emptyTotals, AnnualResult } from './annual';

const ids = (c = defaultConfig(), a: AnnualResult | null = null) => feasibility(c, derive(c), a).map((f) => f.id);

describe('feasibility', () => {
  it('default config has no errors', () => {
    expect(feasibility(defaultConfig(), derive(defaultConfig())).filter((f) => f.severity === 'error')).toEqual([]);
  });
  it('flags buoyancy for a very heavy battery', () => {
    const c = applyPreset(defaultConfig(), 'battery', 'battle-born');
    c.battery.kwh = 150;
    expect(ids(c)).toContain('buoyancy');
  });
  it('flags pod volume for too many large cards', () => {
    const c = applyPreset(defaultConfig(), 'accelerator', 'l40s');
    c.compute.cards = 64;
    expect(ids(c)).toContain('podVolume');
  });
  it('thrust warning when currents exceed thruster speed', () => {
    const c = defaultConfig();
    c.env.currentMs = 1;
    expect(ids(c)).toContain('thrust');
  });
  it('geofence error when min is not below max', () => {
    const c = defaultConfig();
    c.swarm.minOffshoreKm = 200;
    expect(ids(c)).toContain('geofence');
  });
  it('annual-based flags', () => {
    const a: AnnualResult = {
      mode: 'full', days: [], gbPerTerminalMonthly: new Array(12).fill(0), batteryCyclesPerModule: 0, availability: 0.5, modules: 20, terminals: 20,
      totals: { ...emptyTotals(), hours: 8760, stowedH: 1000, unmetKwh: 5, bindingH: { power: 4000, bandwidth: 4000, demand: 760 } },
    };
    const f = ids(defaultConfig(), a);
    expect(f).toEqual(expect.arrayContaining(['windStow', 'unmet', 'bandwidth', 'sla']));
  });
});
