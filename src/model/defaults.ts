import { ConfigSchema, SimConfig, getPath, setPath } from './config';
import {
  Sourced, s, PANELS, BATTERIES, ACCELERATORS, TERMINALS, PLANS, THRUSTERS, COSTS, SOCAL_ENV, ACCESSED,
} from '../presets';

export type PresetKind = 'panel' | 'battery' | 'accelerator' | 'terminal' | 'plan' | 'thruster';

export const PRESET_FIELDS: Record<PresetKind, { presetPath: string; fields: Record<string, string> }> = {
  panel: { presetPath: 'panel.presetId', fields: { 'panel.efficiency': 'efficiency', 'panel.usdPerW': 'usdPerW', 'panel.kgPerM2': 'kgPerM2', 'panel.tempCoeffPerC': 'tempCoeffPerC' } },
  battery: { presetPath: 'battery.presetId', fields: { 'battery.usdPerKwh': 'usdPerKwh', 'battery.whPerKg': 'whPerKg', 'battery.rte': 'rte', 'battery.cycleLife': 'cycleLife' } },
  accelerator: {
    presetPath: 'compute.presetId',
    fields: {
      'compute.tdpW': 'tdpW', 'compute.denseTflops': 'denseTflops', 'compute.priceUsd': 'priceUsd', 'compute.massKg': 'massKg',
      'compute.volumeL': 'volumeL', 'econ.firmUsdPerGpuH': 'firmUsdPerGpuH', 'econ.spotUsdPerGpuH': 'spotUsdPerGpuH',
    },
  },
  terminal: { presetPath: 'comms.terminalId', fields: { 'comms.terminalW': 'terminalW', 'comms.terminalUsd': 'usd', 'comms.terminalMassKg': 'massKg', 'comms.downMbps': 'downMbps', 'comms.upMbps': 'upMbps' } },
  plan: {
    presetPath: 'comms.planId',
    fields: { 'comms.planUsdPerMonth': 'usdPerMonth', 'comms.planCapGB': 'capGB', 'comms.throttleDownMbps': 'throttleDownMbps', 'comms.throttleUpMbps': 'throttleUpMbps', 'comms.overageUsdPerGB': 'overageUsdPerGB' },
  },
  thruster: { presetPath: 'propulsion.thrusterId', fields: { 'propulsion.thrustN': 'thrustN', 'propulsion.maxElecW': 'maxElecW', 'propulsion.usd': 'usd', 'propulsion.massKg': 'massKg' } },
};

type AnyPreset = { id: string; name: string } & Record<string, unknown>;
const LISTS: Record<PresetKind, AnyPreset[]> = {
  panel: PANELS as unknown as AnyPreset[], battery: BATTERIES as unknown as AnyPreset[], accelerator: ACCELERATORS as unknown as AnyPreset[],
  terminal: TERMINALS as unknown as AnyPreset[], plan: PLANS as unknown as AnyPreset[], thruster: THRUSTERS as unknown as AnyPreset[],
};
export const PRESET_LISTS: Record<PresetKind, { id: string; name: string }[]> = LISTS;

function findPreset(kind: PresetKind, id: string): AnyPreset {
  const p = LISTS[kind].find((x) => x.id === id);
  if (!p) throw new Error(`Unknown ${kind} preset: ${id}`);
  return p;
}

export function applyPreset(cfg: SimConfig, kind: PresetKind, id: string): SimConfig {
  const p = findPreset(kind, id);
  const { presetPath, fields } = PRESET_FIELDS[kind];
  let out = setPath(cfg, presetPath, id);
  for (const [path, field] of Object.entries(fields)) {
    const v = p[field] as Sourced | null;
    out = setPath(out, path, v === null ? null : v.value);
  }
  return out;
}

const brief = (value: number, unit: string, note: string): Sourced => s(value, unit, 'Founder brief, 2026-10-15', note);
const design = (value: number, unit: string, note: string): Sourced => s(value, unit, 'Design default (adjustable)', note);

/** Non-preset defaults with provenance. Values here set the default config. */
export const SOURCED_DEFAULTS: [string, Sourced][] = [
  ['hull.sideM', brief(1.52, 'm', '5 ft hull')],
  ['hull.draftM', COSTS.draftM], ['hull.massKg', COSTS.hullMassKg], ['hull.podVolumeL', COSTS.podVolumeL], ['hull.podMassKg', COSTS.podMassKg],
  ['hull.petalCount', design(8, 'petals', 'flower layout')], ['hull.petalLengthM', design(1.0, 'm', 'gives a 3.52 m span')],
  ['hull.petalWidthM', design(0.9, 'm', 'fits 8 petals without overlap')], ['hull.fixedTiltDeg', design(25, 'deg', 'tilt when rotating to face the sun')],
  ['hull.maxTiltDeg', design(60, 'deg', 'petal hinge limit')], ['hull.dragCd', COSTS.dragCd],
  ['pv.mpptEff', COSTS.mpptEff], ['pv.waterTempC', COSTS.waterTempC], ['pv.cellTempRiseC', COSTS.cellTempRiseC],
  ['battery.kwh', design(8, 'kWh', 'covers about 14 h of loads plus firm compute')], ['battery.dod', design(0.9, 'fraction', 'usable depth of discharge')],
  ['compute.cards', design(8, 'cards', 'sized to the module power budget')], ['compute.hostW', COSTS.hostW], ['compute.coolingOverhead', COSTS.coolingOverhead],
  ['compute.firmComputeW', design(200, 'W', 'firm 24/7 compute commitment per module')],
  ['loads.avionicsW', COSTS.avionicsW], ['loads.actuatorW', COSTS.actuatorW],
  ['comms.modulesPerTerminal', design(1, 'modules', 'one terminal per module')],
  ['comms.radioW', COSTS.radioW], ['comms.radioUsd', COSTS.radioUsd], ['comms.radioRangeM', COSTS.radioRangeM],
  ['propulsion.count', design(2, 'thrusters', 'differential steering')], ['propulsion.propEff', COSTS.propEff],
  ['env.originLat', SOCAL_ENV.originLat], ['env.originLon', SOCAL_ENV.originLon], ['env.currentMs', SOCAL_ENV.currentMs],
  ['env.currentHeadingDeg', SOCAL_ENV.currentHeadingDeg], ['env.currentVariabilityMs', SOCAL_ENV.currentVariabilityMs], ['env.tidalMs', SOCAL_ENV.tidalMs],
  ['env.windMeanMs', SOCAL_ENV.windMeanMs], ['env.stowWindMs', SOCAL_ENV.stowWindMs], ['env.cloudCellKm', SOCAL_ENV.cloudCellKm],
  ['env.cloudCellAmp', SOCAL_ENV.cloudCellAmp], ['env.cloudDriftMs', SOCAL_ENV.cloudDriftMs], ['env.cloudDriftHeadingDeg', SOCAL_ENV.cloudDriftHeadingDeg],
  ['env.dayVariability', SOCAL_ENV.dayVariability], ['env.marineLayerStrength', SOCAL_ENV.marineLayerStrength], ['env.disturbanceMs', SOCAL_ENV.disturbanceMs],
  ['swarm.count', brief(20, 'modules', 'starting swarm size')], ['swarm.spacingM', design(150, 'm', 'formation spacing')],
  ['swarm.toleranceM', design(40, 'm', 'free-drift radius around each slot')], ['swarm.breakawayM', design(300, 'm', 'distance that flags a stray')],
  ['swarm.cruiseMs', design(0.3, 'm/s', 'swarm repositioning speed')], ['swarm.horizonH', design(3, 'h', 'cloud-seeking lookahead')],
  ['swarm.replanMin', design(30, 'min', 'cloud-seeking replan interval')], ['swarm.minOffshoreKm', design(20, 'km', 'stay clear of coastal traffic')],
  ['swarm.maxOffshoreKm', design(150, 'km', 'servicing range')],
  ['jobs.arrivalsPerHour', design(1500, 'jobs/h', 'demand above default capacity')], ['jobs.mixInference', design(0.95, 'fraction', 'job share')],
  ['jobs.mixTraining', design(0.04, 'fraction', 'job share')], ['jobs.mixDataHeavy', design(0.01, 'fraction', 'job share')],
  ['jobs.checkpointMin', design(15, 'min', 'checkpoint interval')],
  ['econ.slaTarget', COSTS.slaTarget], ['econ.slaPenaltyMultiple', COSTS.slaPenaltyMultiple], ['econ.hullUsd', COSTS.hullUsd],
  ['econ.podUsd', COSTS.podUsd], ['econ.heatExchangerUsd', COSTS.heatExchangerUsd], ['econ.petalUsdPerM2', COSTS.petalUsdPerM2],
  ['econ.mpptUsdPerW', COSTS.mpptUsdPerW], ['econ.gnssUsd', COSTS.gnssUsd], ['econ.avionicsUsd', COSTS.avionicsUsd], ['econ.hostUsd', COSTS.hostUsd],
  ['econ.batteryIntegrationUplift', COSTS.batteryIntegrationUplift], ['econ.integrationPct', COSTS.integrationPct],
  ['econ.contingencyPct', COSTS.contingencyPct], ['econ.sparesPct', COSTS.sparesPct], ['econ.deploymentVesselDays', COSTS.deploymentVesselDays],
  ['econ.vesselDayUsd', COSTS.vesselDayUsd], ['econ.maintenanceVisitsPerYear', COSTS.maintenanceVisitsPerYear], ['econ.visitUsd', COSTS.visitUsd],
  ['econ.insurancePct', COSTS.insurancePct], ['econ.moduleLossRate', COSTS.moduleLossRate],
  ['econ.acceleratorRefreshYears', COSTS.acceleratorRefreshYears], ['econ.discountRate', COSTS.discountRate], ['econ.horizonYears', COSTS.horizonYears],
];

const BASE: SimConfig = {
  version: 1, name: 'Baseline 20-module swarm', seed: 42,
  hull: { sideM: 0, draftM: 0, massKg: 0, podVolumeL: 0, podMassKg: 0, petalCount: 0, petalLengthM: 0, petalWidthM: 0, tracking: 'yaw', fixedTiltDeg: 0, maxTiltDeg: 0, dragCd: 0 },
  panel: { presetId: '', efficiency: 0, usdPerW: 0, kgPerM2: 0, tempCoeffPerC: 0 },
  pv: { mpptEff: 0, waterTempC: 0, cellTempRiseC: 0 },
  battery: { presetId: '', kwh: 0, usdPerKwh: 0, whPerKg: 0, rte: 0, cycleLife: 0, dod: 0 },
  compute: { presetId: '', cards: 0, tdpW: 0, denseTflops: 0, priceUsd: 0, massKg: 0, volumeL: 0, hostW: 0, coolingOverhead: 0, policy: 'firm', firmComputeW: 0 },
  loads: { avionicsW: 0, actuatorW: 0 },
  comms: {
    terminalId: '', terminalW: 0, terminalUsd: 0, terminalMassKg: 0, downMbps: 0, upMbps: 0, planId: '', planUsdPerMonth: 0, planCapGB: 0,
    throttleDownMbps: 0, throttleUpMbps: 0, overageUsdPerGB: null, buyOverage: false, modulesPerTerminal: 0, radioW: 0, radioUsd: 0, radioRangeM: 0,
  },
  propulsion: { thrusterId: '', count: 0, thrustN: 0, maxElecW: 0, usd: 0, massKg: 0, propEff: 0 },
  env: {
    originLat: 0, originLon: 0, currentMs: 0, currentHeadingDeg: 0, currentVariabilityMs: 0, tidalMs: 0, windMeanMs: 0, stowWindMs: 0,
    cloudCellKm: 0, cloudCellAmp: 0, cloudDriftMs: 0, cloudDriftHeadingDeg: 0, dayVariability: 0, marineLayerStrength: 0, disturbanceMs: 0,
  },
  swarm: { count: 0, spacingM: 0, toleranceM: 0, breakawayM: 0, strategy: 'station', cruiseMs: 0, horizonH: 0, replanMin: 0, minOffshoreKm: 0, maxOffshoreKm: 0 },
  jobs: { arrivalsPerHour: 0, mixInference: 0, mixTraining: 0, mixDataHeavy: 0, checkpointMin: 0 },
  econ: {
    firmUsdPerGpuH: 0, spotUsdPerGpuH: 0, slaTarget: 0, slaPenaltyMultiple: 0, hullUsd: 0, podUsd: 0, heatExchangerUsd: 0, petalUsdPerM2: 0,
    mpptUsdPerW: 0, gnssUsd: 0, avionicsUsd: 0, hostUsd: 0, batteryIntegrationUplift: 0, integrationPct: 0, contingencyPct: 0, sparesPct: 0,
    deploymentVesselDays: 0, vesselDayUsd: 0, maintenanceVisitsPerYear: 0, visitUsd: 0, insurancePct: 0, moduleLossRate: 0,
    acceleratorRefreshYears: 0, discountRate: 0, horizonYears: 0,
  },
};

const DEFAULT_PRESETS: [PresetKind, string][] = [
  ['panel', 'csi-tophiku6'], ['battery', 'bnef-lfp-pack'], ['accelerator', 'l4'], ['terminal', 'mini'], ['plan', 'gp-1tb'], ['thruster', 't200'],
];

export function defaultConfig(): SimConfig {
  let cfg = structuredClone(BASE);
  for (const [path, src] of SOURCED_DEFAULTS) cfg = setPath(cfg, path, src.value);
  for (const [kind, id] of DEFAULT_PRESETS) cfg = applyPreset(cfg, kind, id);
  return ConfigSchema.parse(cfg);
}

const DEFAULT_MAP = new Map(SOURCED_DEFAULTS);

/** Provenance for a config path: the selected preset's field, or the sourced default. */
export function sourceFor(cfg: SimConfig, path: string): Sourced | null {
  for (const kind of Object.keys(PRESET_FIELDS) as PresetKind[]) {
    const { presetPath, fields } = PRESET_FIELDS[kind];
    const field = fields[path];
    if (!field) continue;
    const p = LISTS[kind].find((x) => x.id === getPath(cfg, presetPath));
    const v = p ? (p[field] as Sourced | null) : null;
    return v ?? { value: 0, unit: '', source: 'Not applicable for this preset', date: ACCESSED };
  }
  return DEFAULT_MAP.get(path) ?? null;
}

/** True when data beyond the plan cap is bought per GB instead of throttled. */
export function payOverage(cfg: SimConfig): boolean {
  return cfg.comms.overageUsdPerGB !== null && (cfg.comms.buyOverage || cfg.comms.planCapGB === 0);
}
