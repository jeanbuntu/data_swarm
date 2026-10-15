import { describe, it, expect } from 'vitest';
import { dayEnergy, sankeyData, monthlySeries } from './dayEnergy';
import { runLiveDay } from '../../model/live';
import { runAnnual } from '../../model/annual';
import { defaultConfig } from '../../model/defaults';
import { DAYS_IN_MONTH } from '../../model/time';

describe('day energy and sankey', () => {
  const sim = runLiveDay(defaultConfig(), 172);
  const e = dayEnergy(sim.history, sim.dtS);

  it('balances the power bus', () => {
    const inBus = e.pvKwh - e.curtailedKwh + e.dischargeKwh;
    const outBus = e.loadsKwh + e.propulsionKwh + e.computeKwh + e.chargeKwh;
    expect(Math.abs(inBus - outBus)).toBeLessThan(1e-3);
    expect(e.pvKwh).toBeGreaterThan(1);
  });

  it('builds sankey links that reference existing nodes', () => {
    const s = sankeyData(e);
    expect(s.links.length).toBeGreaterThan(2);
    for (const l of s.links) {
      expect(s.nodes[l.source]).toBeDefined();
      expect(s.nodes[l.target]).toBeDefined();
      expect(l.value).toBeGreaterThan(0);
    }
    const used = new Set(s.links.flatMap((l) => [l.source, l.target]));
    expect(used.size).toBe(s.nodes.length);
  });

  it('monthly series sums back to the annual total', () => {
    const a = runAnnual(defaultConfig(), 'full');
    const m = monthlySeries(a);
    expect(m).toHaveLength(12);
    const sum = m.reduce((acc, x, i) => acc + x.pv * DAYS_IN_MONTH[i] * a.modules, 0);
    expect(Math.abs(sum - a.totals.pvKwh) / a.totals.pvKwh).toBeLessThan(1e-9);
  });
});
