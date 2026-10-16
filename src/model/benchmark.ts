import type { SimConfig } from './config';
import { crf } from './finance';
import { ACCELERATORS } from '../presets';

export interface Prices {
  firm: number;
  spot: number;
}

/**
 * Competitor price per GPU-hour for the selected card.
 * - cloud: the sourced rental rates for the card's preset (independent of manual price edits).
 * - gas: a land data center on on-site gas generation: fuel and O&M at the card's server power times PUE,
 *   generation capex, facility cost per IT kW, and server hardware, each spread over the hours sold,
 *   plus the operator's margin. The spot tier keeps the card's cloud spot-to-firm ratio.
 */
export function benchmarkPrices(cfg: SimConfig): Prices & { label: string } {
  const preset = ACCELERATORS.find((a) => a.id === cfg.compute.presetId);
  const cloudFirm = preset ? preset.firmUsdPerGpuH.value : cfg.econ.firmUsdPerGpuH;
  const cloudSpot = preset ? preset.spotUsdPerGpuH.value : cfg.econ.spotUsdPerGpuH;
  if (cfg.market.benchmark === 'cloud') return { firm: cloudFirm, spot: cloudSpot, label: 'cloud rental' };
  const m = cfg.market;
  const r = m.competitorWacc;
  const itKw = (cfg.compute.tdpW + m.serverOverheadW) / 1000;
  const soldHours = 8760 * m.benchmarkUtilization;
  const fuelUsdPerKwh = (m.gasUsdPerMMBtu * m.heatRateBtuPerKwh) / 1e6 + m.gasOmUsdPerMWh / 1000;
  const energy = itKw * m.pue * fuelUsdPerKwh;
  const generation = (m.genCapexUsdPerKw * itKw * m.pue * crf(r, m.genLifeYears)) / soldHours;
  const facility = (m.facilityUsdPerKwMonth * 12 * itKw) / soldHours;
  const hardware = ((cfg.compute.priceUsd + m.serverOverheadUsd) * crf(r, m.gpuLifeYears)) / soldHours;
  const firm = (energy + generation + facility + hardware) * (1 + m.operatorMargin);
  const ratio = cloudFirm > 0 ? cloudSpot / cloudFirm : 1;
  return { firm, spot: firm * ratio, label: 'gas-powered land data center' };
}

/** Prices Fleet charges: the manual prices, or the benchmark minus the undercut (never below zero). */
export function effectivePrices(cfg: SimConfig): Prices {
  if (cfg.market.priceMode === 'manual') return { firm: cfg.econ.firmUsdPerGpuH, spot: cfg.econ.spotUsdPerGpuH };
  const b = benchmarkPrices(cfg);
  const u = cfg.market.undercutUsd;
  return { firm: Math.max(0, b.firm - u), spot: Math.max(0, b.spot - u) };
}
