import { describe, it, expect } from 'vitest';
import { moduleCapex, swarmCapex, crf, npv, irr, paybackMonths, economics } from './economics';
import { emptyTotals, AnnualResult } from './annual';
import { defaultConfig } from './defaults';
import { derive } from './derive';

const fakeAnnual = (over: Partial<ReturnType<typeof emptyTotals>>, availability: number | null): AnnualResult => ({
  mode: 'full', days: [], totals: { ...emptyTotals(), hours: 8760, ...over }, gbPerTerminalMonthly: new Array(12).fill(100),
  batteryCyclesPerModule: 300, availability, modules: 20, terminals: 20,
});

describe('finance helpers', () => {
  it('npv, irr, crf and payback', () => {
    expect(npv(0.1, [-100, 50, 60])).toBeCloseTo(-100 + 50 / 1.1 + 60 / 1.21, 9);
    expect(irr([-100, 110])!).toBeCloseTo(0.1, 6);
    expect(irr([-100, -10])).toBeNull();
    expect(crf(0.1, 10)).toBeCloseTo((0.1 * 1.1 ** 10) / (1.1 ** 10 - 1), 12);
    expect(crf(0, 4)).toBe(0.25);
    expect(paybackMonths([-100, 40, 40, 40])).toBeCloseTo(30, 9);
    expect(paybackMonths([-100, 10, 10])).toBeNull();
  });
});

describe('capex', () => {
  it('module capex lines sum with integration and contingency', () => {
    const c = defaultConfig();
    const d = derive(c);
    const m = moduleCapex(c);
    const panels = m.lines.find((l) => l.key === 'panels')!;
    expect(panels.usd).toBeCloseTo(d.peakPvW * c.panel.usdPerW, 6);
    const accel = m.lines.find((l) => l.key === 'accelerators')!;
    expect(accel.usd).toBe(8 * 3995);
    const sum = m.lines.reduce((a, l) => a + l.usd, 0);
    expect(m.total).toBeCloseTo(sum, 6);
    const sub = m.lines.filter((l) => l.key !== 'integration' && l.key !== 'contingency').reduce((a, l) => a + l.usd, 0);
    expect(m.lines.find((l) => l.key === 'integration')!.usd).toBeCloseTo(sub * c.econ.integrationPct, 6);
  });
  it('swarm capex adds spares and deployment', () => {
    const c = defaultConfig();
    const s = swarmCapex(c);
    expect(s.fleetModules).toBeCloseTo(22, 9);
    expect(s.total).toBeCloseTo(s.perModule * 22 + 3 * 15000, 6);
  });
});

describe('economics', () => {
  it('prices spot-only output at the spot price', () => {
    const c = defaultConfig();
    c.compute.policy = 'max';
    const gpuH = 1000;
    const tflop = 121 * 3600 * gpuH;
    const e = economics(c, fakeAnnual({ tflop, spotTflop: tflop }, null));
    expect(e.gpuHours).toBeCloseTo(gpuH, 9);
    expect(e.revenue.total).toBeCloseTo(gpuH * c.econ.spotUsdPerGpuH, 9);
    expect(e.revenue.slaPenalty).toBe(0);
  });
  it('applies the SLA penalty when firm availability misses the target', () => {
    const c = defaultConfig();
    const unit = 121 * 3600;
    const e = economics(c, fakeAnnual({ tflop: 1000 * unit, firmTflop: 600 * unit, spotTflop: 400 * unit, firmCommittedTflop: 700 * unit }, 600 / 700));
    const penalty = (0.99 - 600 / 700) * 700 * c.econ.firmUsdPerGpuH * c.econ.slaPenaltyMultiple;
    expect(e.revenue.slaPenalty).toBeCloseTo(penalty, 6);
    expect(e.revenue.total).toBeCloseTo(600 * c.econ.firmUsdPerGpuH + 400 * c.econ.spotUsdPerGpuH - penalty, 6);
  });
  it('builds opex lines and cash flows', () => {
    const c = defaultConfig();
    const unit = 121 * 3600;
    const e = economics(c, fakeAnnual({ tflop: 100000 * unit, spotTflop: 100000 * unit }, null));
    const plans = e.opexLines.find((l) => l.key === 'starlinkPlans')!;
    expect(plans.usd).toBe(20 * 1150 * 12);
    expect(e.opexLines.find((l) => l.key === 'dataOverage')!.usd).toBe(0);
    expect(e.flows).toHaveLength(c.econ.horizonYears + 1);
    expect(e.flows[0]).toBeCloseTo(-e.capex.total, 6);
    expect(e.costPerGpuHour).toBeCloseTo((e.capex.total * crf(c.econ.discountRate, c.econ.horizonYears) + e.opexTotal) / e.gpuHours, 6);
    expect(e.annualPflopHours).toBeCloseTo((100000 * unit) / 3.6e6, 6);
  });
  it('charges data overage when paying per GB', () => {
    const c = defaultConfig();
    c.comms.buyOverage = true;
    const a = fakeAnnual({}, null);
    a.gbPerTerminalMonthly = new Array(12).fill(1500);
    const e = economics(c, a);
    expect(e.opexLines.find((l) => l.key === 'dataOverage')!.usd).toBeCloseTo(12 * 500 * 2 * 20, 6);
  });
  it('handles zero GPU-hours without NaN', () => {
    const c = defaultConfig();
    const e = economics(c, fakeAnnual({}, null));
    expect(e.gpuHours).toBe(0);
    expect(e.costPerGpuHour).toBe(Infinity);
    expect(Number.isNaN(e.marginPerGpuHour)).toBe(false);
    expect(e.paybackMonths).toBeNull();
  });
});
