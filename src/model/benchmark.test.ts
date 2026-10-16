import { describe, it, expect } from 'vitest';
import { benchmarkPrices, effectivePrices } from './benchmark';
import { defaultConfig, applyPreset } from './defaults';
import { crf, economics } from './economics';
import { emptyTotals, type AnnualResult } from './annual';
import type { SimConfig } from './config';

const withGas = (c: SimConfig): SimConfig => ({
  ...c,
  market: {
    ...c.market,
    benchmark: 'gas',
    gasUsdPerMMBtu: 4,
    heatRateBtuPerKwh: 9000,
    gasOmUsdPerMWh: 10,
    genCapexUsdPerKw: 1500,
    genLifeYears: 20,
    pue: 1.2,
    facilityUsdPerKwMonth: 150,
    serverOverheadW: 200,
    serverOverheadUsd: 5000,
    gpuLifeYears: 5,
    benchmarkUtilization: 0.7,
    operatorMargin: 0.3,
    competitorWacc: 0.09,
  },
});

describe('gas-powered benchmark', () => {
  it('matches a hand calculation for an H100', () => {
    const c = withGas(applyPreset(defaultConfig(), 'accelerator', 'h100-sxm'));
    const r = 0.09;
    const kw = (700 + 200) / 1000;
    const hours = 8760 * 0.7;
    const energy = kw * 1.2 * ((4 * 9000) / 1e6 + 10 / 1000);
    const gen = (1500 * kw * 1.2 * crf(r, 20)) / hours;
    const facility = (150 * 12 * kw) / hours;
    const hardware = ((28000 + 5000) * crf(r, 5)) / hours;
    expect(benchmarkPrices(c).firm).toBeCloseTo((energy + gen + facility + hardware) * 1.3, 9);
  });

  it('keeps the card spot-to-firm ratio for the spot tier', () => {
    const c = withGas(applyPreset(defaultConfig(), 'accelerator', 'h100-sxm'));
    const b = benchmarkPrices(c);
    expect(b.spot / b.firm).toBeCloseTo(2.69 / 6.16, 9);
  });

  it('rises with the gas price', () => {
    const c = withGas(defaultConfig());
    const hi = { ...c, market: { ...c.market, gasUsdPerMMBtu: 12 } };
    expect(benchmarkPrices(hi).firm).toBeGreaterThan(benchmarkPrices(c).firm);
  });
});

describe('cloud benchmark', () => {
  it('uses the sourced rental prices even after manual price edits', () => {
    const c = applyPreset(defaultConfig(), 'accelerator', 'h100-sxm');
    c.market.benchmark = 'cloud';
    c.econ.firmUsdPerGpuH = 99;
    const b = benchmarkPrices(c);
    expect(b.firm).toBe(6.16);
    expect(b.spot).toBe(2.69);
  });
});

describe('effective prices', () => {
  it('manual mode uses the editable prices', () => {
    const c = defaultConfig();
    c.market.priceMode = 'manual';
    expect(effectivePrices(c)).toEqual({ firm: c.econ.firmUsdPerGpuH, spot: c.econ.spotUsdPerGpuH });
  });

  it('undercut mode prices a fixed amount below the benchmark, never below zero', () => {
    const c = withGas(defaultConfig());
    c.market.priceMode = 'undercut';
    c.market.undercutUsd = 0.05;
    const b = benchmarkPrices(c);
    const p = effectivePrices(c);
    expect(p.firm).toBeCloseTo(b.firm - 0.05, 12);
    expect(p.spot).toBeCloseTo(b.spot - 0.05, 12);
    c.market.undercutUsd = 100;
    expect(effectivePrices(c)).toEqual({ firm: 0, spot: 0 });
  });

  it('economics bills at the effective prices and reports the benchmark as the market', () => {
    const c = withGas(defaultConfig());
    c.market.priceMode = 'undercut';
    c.compute.policy = 'max';
    const unit = c.compute.denseTflops * 3600;
    const a: AnnualResult = {
      mode: 'full', days: [], totals: { ...emptyTotals(), hours: 8760, tflop: 1000 * unit, spotTflop: 1000 * unit },
      gbPerTerminalMonthly: new Array(12).fill(0), batteryCyclesPerModule: 0, availability: null, modules: 20, terminals: 20,
    };
    const e = economics(c, a);
    const p = effectivePrices(c);
    expect(e.revenue.total).toBeCloseTo(1000 * p.spot, 6);
    expect(e.marketFirm).toBeCloseTo(benchmarkPrices(c).firm, 12);
  });
});
