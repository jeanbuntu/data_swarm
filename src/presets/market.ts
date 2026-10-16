import { Sourced, s, est } from './sourced';

const STEO = 'https://www.eia.gov/outlooks/steo/report/natgas.php';
const EIA_CAPCOST = 'https://www.eia.gov/analysis/studies/powerplants/capitalcost/pdf/capital_cost_AEO2020.pdf';
const COLO = 'https://inflect.com/blog/colocation-pricing-what-to-expect-for-racks-cabinets-and-cages-in-2026';
const META_TCO = 'https://pytorchtoatoms.substack.com/p/metas-24k-h100-cluster-capextco-and';
const AMAZON_LIFE = 'https://deepquarry.substack.com/p/amazon-revises-server-lifespan-amid';
const COREWEAVE_10K = 'https://www.sec.gov/Archives/edgar/data/1769628/000176962826000104/crwv-20251231.htm';

/** Defaults for the gas-powered land data center benchmark. Full tables: docs/research/2026-10-15-gas-benchmark.md */
export const MARKET_DEFAULTS: Record<string, Sourced> = {
  undercutUsd: s(0.05, 'USD/GPU-h', 'Founder brief, 2026-10-15', 'a few cents below the competitor'),
  gasUsdPerMMBtu: s(3.48, 'USD/MMBtu', STEO, 'Henry Hub 2026 average (STEO, 2026-10-06); California industrial is 12.09 USD/MMBtu'),
  heatRateBtuPerKwh: s(8295, 'Btu/kWh HHV', EIA_CAPCOST, 'EIA reference reciprocating engine plant'),
  gasOmUsdPerMWh: s(10.2, 'USD/MWh', EIA_CAPCOST, 'derived: variable O&M 5.69 plus fixed 35.16 USD/kW-yr at 90% capacity factor'),
  genCapexUsdPerKw: est(2262, 'USD/kW', 'EIA reciprocating engine 1,810 USD/kW (2019 USD) times 1.25 installed redundancy (redundancy is an estimate)'),
  genLifeYears: est(20, 'years', 'generation asset life'),
  pue: est(1.2, 'ratio', 'new AI facility, between Google fleet 1.09 and the Uptime survey average 1.54'),
  facilityUsdPerKwMonth: s(195.94, 'USD/kW-month', COLO, 'US colocation average base rate, CBRE H2 2025 via Inflect; excludes energy'),
  gpuLifeYears: s(5, 'years', AMAZON_LIFE, 'Amazon shortened part of its server fleet to 5 years; Meta 5.5, CoreWeave and Microsoft 6'),
  benchmarkUtilization: est(0.8, 'fraction', 'share of GPU-hours a land operator sells'),
  operatorMargin: s(0.25, 'fraction markup', COREWEAVE_10K, 'derived: CoreWeave about 27% margin after server depreciation and Oracle about 14% imply a 1.15 to 1.4x markup'),
  competitorWacc: s(0.0933, 'fraction/year', META_TCO, 'cost of capital used in the Meta 24k H100 cluster TCO analysis'),
};

/** Non-numeric market defaults. The baseline keeps manual prices; the built-in variants use undercut pricing. */
export const MARKET_MODE_DEFAULTS = { priceMode: 'manual' as const, benchmark: 'gas' as const };

export const META_TCO_URL = META_TCO;
