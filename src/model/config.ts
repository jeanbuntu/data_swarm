import { z } from 'zod';
import { MARKET_DEFAULTS, MARKET_MODE_DEFAULTS } from '../presets/market';
import { ACCELERATORS } from '../presets/hardware';
import { COSTS } from '../presets/costs';

const n = (min: number, max: number) => z.number().finite().min(min).max(max);
const int = (min: number, max: number) => z.number().int().min(min).max(max);

export const TrackingSchema = z.enum(['flat', 'yaw', 'dual']);
export const PolicySchema = z.enum(['daylight', 'firm', 'max']);
export const StrategySchema = z.enum(['station', 'drift', 'seek']);
export type Tracking = z.infer<typeof TrackingSchema>;
export type Policy = z.infer<typeof PolicySchema>;
export type Strategy = z.infer<typeof StrategySchema>;
export const PriceModeSchema = z.enum(['manual', 'undercut']);
export const BenchmarkSchema = z.enum(['gas', 'cloud']);

export const ConfigSchema = z.object({
  version: z.literal(3),
  name: z.string().min(1).max(80),
  seed: int(0, 2147483647),
  hull: z.object({
    sideM: n(0.5, 5), draftM: n(0.1, 3), massKg: n(10, 3000), podVolumeL: n(5, 3000), podMassKg: n(1, 1000),
    petalCount: int(0, 16), petalLengthM: n(0, 3), petalWidthM: n(0.1, 2),
    tracking: TrackingSchema, fixedTiltDeg: n(0, 60), maxTiltDeg: n(0, 80), dragCd: n(0.3, 2.5),
  }),
  panel: z.object({ presetId: z.string(), efficiency: n(0.05, 0.5), usdPerW: n(0, 20), kgPerM2: n(0.5, 30), tempCoeffPerC: n(-0.01, 0) }),
  pv: z.object({ mpptEff: n(0.8, 1), waterTempC: n(0, 35), cellTempRiseC: n(0, 40) }),
  battery: z.object({ presetId: z.string(), kwh: n(0, 200), usdPerKwh: n(0, 2000), whPerKg: n(20, 400), rte: n(0.5, 1), cycleLife: n(100, 20000), dod: n(0.1, 1), followerExtraKwh: n(0, 100) }),
  compute: z.object({
    presetId: z.string(), cards: int(0, 64), tdpW: n(1, 2000), denseTflops: n(0, 5000), priceUsd: n(0, 100000),
    massKg: n(0, 50), volumeL: n(0, 50), hostW: n(0, 1000), coolingOverhead: n(0, 0.5), policy: PolicySchema, firmComputeW: n(0, 100000),
  }),
  loads: z.object({ avionicsW: n(0, 500), actuatorW: n(0, 500), masterAvionicsW: n(0, 500), followerAvionicsW: n(0, 500) }),
  comms: z.object({
    terminalId: z.string(), terminalW: n(0, 500), terminalUsd: n(0, 20000), terminalMassKg: n(0, 50), downMbps: n(0, 2000), upMbps: n(0, 500),
    planId: z.string(), planUsdPerMonth: n(0, 50000), planCapGB: n(0, 100000), throttleDownMbps: n(0, 100), throttleUpMbps: n(0, 100),
    overageUsdPerGB: n(0, 100).nullable(), buyOverage: z.boolean(), modulesPerTerminal: int(1, 100), hubMode: z.boolean(),
    radioW: n(0, 100), radioUsd: n(0, 10000), radioRangeM: n(10, 50000),
  }),
  propulsion: z.object({ thrusterId: z.string(), count: int(0, 8), thrustN: n(0, 2000), maxElecW: n(0, 5000), usd: n(0, 20000), massKg: n(0, 50), propEff: n(0.05, 0.9) }),
  env: z.object({
    originLat: n(-80, 80), originLon: n(-180, 180), currentMs: n(0, 3), currentHeadingDeg: n(0, 360), currentVariabilityMs: n(0, 1), tidalMs: n(0, 1),
    windMeanMs: n(0, 25), stowWindMs: n(0, 40), cloudCellKm: n(1, 300), cloudCellAmp: n(0, 0.6), cloudDriftMs: n(0, 30), cloudDriftHeadingDeg: n(0, 360),
    dayVariability: n(0, 1.5), marineLayerStrength: n(0, 1.5), disturbanceMs: n(0, 1),
  }),
  swarm: z.object({
    count: int(1, 100), spacingM: n(10, 5000), toleranceM: n(1, 2000), breakawayM: n(5, 20000), strategy: StrategySchema,
    cruiseMs: n(0, 3), horizonH: n(0.5, 12), replanMin: n(5, 360), minOffshoreKm: n(0, 500), maxOffshoreKm: n(1, 1000),
  }),
  jobs: z.object({ arrivalsPerHour: n(0, 1e6), mixInference: n(0, 1), mixTraining: n(0, 1), mixDataHeavy: n(0, 1), checkpointMin: n(1, 240) }),
  econ: z.object({
    firmUsdPerGpuH: n(0, 100), spotUsdPerGpuH: n(0, 100), slaTarget: n(0, 1), slaPenaltyMultiple: n(0, 10),
    hullUsd: n(0, 1e6), podUsd: n(0, 1e6), heatExchangerUsd: n(0, 1e5), petalUsdPerM2: n(0, 1e4), mpptUsdPerW: n(0, 5),
    gnssUsd: n(0, 1e4), avionicsUsd: n(0, 1e5), masterAvionicsUsd: n(0, 1e5), followerAvionicsUsd: n(0, 1e5), hostUsd: n(0, 1e5), batteryIntegrationUplift: n(1, 5),
    integrationPct: n(0, 2), contingencyPct: n(0, 2), sparesPct: n(0, 1), deploymentVesselDays: n(0, 365), vesselDayUsd: n(0, 1e6),
    maintenanceVisitsPerYear: n(0, 52), visitUsd: n(0, 1e7), insurancePct: n(0, 0.5), moduleLossRate: n(0, 1),
    acceleratorRefreshYears: n(1, 20), discountRate: n(0, 1), horizonYears: int(1, 30),
  }),
  market: z.object({
    priceMode: PriceModeSchema, benchmark: BenchmarkSchema, undercutUsd: n(0, 5),
    gasUsdPerMMBtu: n(0, 50), heatRateBtuPerKwh: n(5000, 15000), gasOmUsdPerMWh: n(0, 100), genCapexUsdPerKw: n(0, 5000), genLifeYears: n(1, 40),
    pue: n(1, 2.5), facilityUsdPerKwMonth: n(0, 500), serverOverheadW: n(0, 2000), serverOverheadUsd: n(0, 100000),
    gpuLifeYears: n(1, 10), benchmarkUtilization: n(0.05, 1), operatorMargin: n(0, 3), competitorWacc: n(0, 0.5),
  }),
});

export type SimConfig = z.infer<typeof ConfigSchema>;
export type ParseResult = { ok: true; config: SimConfig } | { ok: false; errors: string[] };

/** Upgrades saved scenarios from earlier versions before validation. */
function migrate(raw: unknown): unknown {
  let r = raw as Record<string, unknown> | null;
  if (!r || typeof r !== 'object') return raw;
  if (r.version === 1) {
    const accel = (r as { compute?: { presetId?: string } }).compute?.presetId;
    r = { ...r, version: 2, market: defaultMarket(accel) };
  }
  if (r.version === 2) {
    // Version 3 added master/follower hub clusters; existing scenarios keep the old behavior.
    const obj = (k: string) => (r![k] && typeof r![k] === 'object' ? (r![k] as Record<string, unknown>) : {});
    r = {
      ...r,
      version: 3,
      comms: { ...obj('comms'), hubMode: false },
      loads: { ...obj('loads'), masterAvionicsW: COSTS.masterAvionicsW.value, followerAvionicsW: COSTS.followerAvionicsW.value },
      battery: { ...obj('battery'), followerExtraKwh: 0 },
      econ: { ...obj('econ'), masterAvionicsUsd: COSTS.masterAvionicsUsd.value, followerAvionicsUsd: COSTS.followerAvionicsUsd.value },
    };
  }
  return r;
}

export function parseConfig(raw: unknown): ParseResult {
  const r = ConfigSchema.safeParse(migrate(raw));
  if (r.success) return { ok: true, config: r.data };
  return { ok: false, errors: r.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`) };
}

export function getPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>(
    (o, k) => (o !== null && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined),
    obj,
  );
}

export function setPath<T>(obj: T, path: string, value: unknown): T {
  const out = structuredClone(obj);
  const keys = path.split('.');
  let o = out as unknown as Record<string, unknown>;
  for (let i = 0; i < keys.length - 1; i++) {
    const next = o[keys[i]];
    if (next === null || typeof next !== 'object') throw new Error(`Unknown config path: ${path}`);
    o = next as Record<string, unknown>;
  }
  const last = keys[keys.length - 1];
  if (!(last in o)) throw new Error(`Unknown config path: ${path}`);
  o[last] = value;
  return out;
}

export function leafPaths(obj: unknown, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return prefix ? [prefix] : [];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => leafPaths(v, prefix ? `${prefix}.${k}` : k));
}

export type MarketConfig = SimConfig['market'];

/** Default market settings from the sourced presets; server overhead follows the accelerator. */
export function defaultMarket(acceleratorId?: string): MarketConfig {
  const accel = ACCELERATORS.find((a) => a.id === acceleratorId) ?? ACCELERATORS[0];
  const numeric = Object.fromEntries(Object.entries(MARKET_DEFAULTS).map(([k, v]) => [k, v.value]));
  return { ...MARKET_MODE_DEFAULTS, ...numeric, serverOverheadW: accel.serverW.value, serverOverheadUsd: accel.serverUsd.value } as MarketConfig;
}
