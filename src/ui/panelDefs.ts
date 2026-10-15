import type { PresetKind } from '../model/defaults';

export type ParamItem =
  | { kind: 'slider'; path: string; label: string; min: number; max: number; step: number; unit?: string; scale?: number }
  | { kind: 'preset'; preset: PresetKind; label: string }
  | { kind: 'select'; path: string; label: string; options: { value: string; label: string }[] }
  | { kind: 'toggle'; path: string; label: string };

export interface PanelDef {
  title: string;
  items: ParamItem[];
}

const sl = (path: string, label: string, min: number, max: number, step: number, unit?: string, scale?: number): ParamItem => ({
  kind: 'slider', path, label, min, max, step, unit, scale,
});

export const PANEL_DEFS: PanelDef[] = [
  {
    title: 'Hull and petals',
    items: [
      sl('hull.sideM', 'Hull side', 0.5, 5, 0.01, 'm'),
      sl('hull.draftM', 'Draft', 0.1, 3, 0.05, 'm'),
      sl('hull.petalCount', 'Petal count', 0, 16, 1),
      sl('hull.petalLengthM', 'Petal length', 0, 3, 0.05, 'm'),
      sl('hull.petalWidthM', 'Petal width', 0.1, 2, 0.05, 'm'),
      {
        kind: 'select', path: 'hull.tracking', label: 'Sun tracking',
        options: [
          { value: 'flat', label: 'Flat (no tracking)' },
          { value: 'yaw', label: 'Rotate hull to face the sun, fixed tilt' },
          { value: 'dual', label: 'Rotate and tilt petals (two-axis)' },
        ],
      },
      sl('hull.fixedTiltDeg', 'Fixed tilt', 0, 60, 1, 'deg'),
      sl('hull.maxTiltDeg', 'Max petal tilt', 0, 80, 1, 'deg'),
      sl('hull.dragCd', 'Hull drag coefficient', 0.3, 2.5, 0.05),
      sl('hull.massKg', 'Hull mass', 10, 1000, 5, 'kg'),
      sl('hull.podVolumeL', 'Pod volume', 5, 1000, 5, 'L'),
      sl('hull.podMassKg', 'Pod mass', 1, 500, 1, 'kg'),
      sl('loads.avionicsW', 'Avionics power', 0, 200, 1, 'W'),
      sl('loads.actuatorW', 'Tracking actuator power', 0, 200, 1, 'W'),
    ],
  },
  {
    title: 'Solar',
    items: [
      { kind: 'preset', preset: 'panel', label: 'Panel' },
      sl('panel.efficiency', 'Efficiency', 5, 50, 0.1, '%', 100),
      sl('panel.usdPerW', 'Price', 0, 15, 0.01, '$/W'),
      sl('panel.kgPerM2', 'Areal mass', 0.5, 30, 0.1, 'kg/m²'),
      sl('panel.tempCoeffPerC', 'Temperature coefficient', -1, 0, 0.01, '%/°C', 100),
      sl('pv.mpptEff', 'MPPT efficiency', 80, 100, 0.5, '%', 100),
      sl('pv.waterTempC', 'Water temperature', 0, 35, 0.5, '°C'),
      sl('pv.cellTempRiseC', 'Cell temperature rise', 0, 40, 1, '°C'),
    ],
  },
  {
    title: 'Battery',
    items: [
      { kind: 'preset', preset: 'battery', label: 'Battery' },
      sl('battery.kwh', 'Capacity', 0, 60, 0.5, 'kWh'),
      sl('battery.usdPerKwh', 'Price', 0, 1000, 1, '$/kWh'),
      sl('battery.whPerKg', 'Specific energy', 20, 400, 1, 'Wh/kg'),
      sl('battery.rte', 'Round-trip efficiency', 50, 100, 0.5, '%', 100),
      sl('battery.cycleLife', 'Cycle life', 100, 20000, 100, 'cycles'),
      sl('battery.dod', 'Usable depth of discharge', 10, 100, 1, '%', 100),
    ],
  },
  {
    title: 'Compute',
    items: [
      { kind: 'preset', preset: 'accelerator', label: 'Accelerator' },
      sl('compute.cards', 'Cards per module', 0, 32, 1),
      {
        kind: 'select', path: 'compute.policy', label: 'Operating policy',
        options: [
          { value: 'firm', label: 'Firm 24/7 plus spot surplus' },
          { value: 'daylight', label: 'Daylight only (spot)' },
          { value: 'max', label: 'Max throughput (spot)' },
        ],
      },
      sl('compute.firmComputeW', 'Firm commitment', 0, 3000, 10, 'W'),
      sl('compute.tdpW', 'Card TDP', 1, 1200, 1, 'W'),
      sl('compute.denseTflops', 'Dense TFLOPS per card', 0, 2500, 1, 'TFLOPS'),
      sl('compute.priceUsd', 'Card price', 0, 60000, 50, '$'),
      sl('compute.hostW', 'Host power', 0, 500, 1, 'W'),
      sl('compute.coolingOverhead', 'Cooling overhead', 0, 50, 0.5, '%', 100),
    ],
  },
  {
    title: 'Starlink and network',
    items: [
      { kind: 'preset', preset: 'terminal', label: 'Terminal' },
      { kind: 'preset', preset: 'plan', label: 'Data plan' },
      sl('comms.modulesPerTerminal', 'Modules per terminal', 1, 20, 1),
      sl('comms.terminalW', 'Terminal power', 0, 200, 0.5, 'W'),
      sl('comms.downMbps', 'Downlink per terminal', 0, 300, 1, 'Mbps'),
      sl('comms.upMbps', 'Uplink per terminal', 0, 60, 0.5, 'Mbps'),
      sl('comms.planCapGB', 'Plan data cap', 0, 5000, 10, 'GB/mo'),
      sl('comms.planUsdPerMonth', 'Plan price', 0, 5000, 10, '$/mo'),
      { kind: 'toggle', path: 'comms.buyOverage', label: 'Buy data beyond the cap instead of throttling' },
      sl('comms.radioW', 'In-swarm radio power', 0, 50, 0.5, 'W'),
      sl('comms.radioRangeM', 'In-swarm radio range', 10, 20000, 10, 'm'),
    ],
  },
  {
    title: 'Propulsion',
    items: [
      { kind: 'preset', preset: 'thruster', label: 'Thruster' },
      sl('propulsion.count', 'Thrusters per module', 0, 8, 1),
      sl('propulsion.propEff', 'Propulsive efficiency', 5, 90, 1, '%', 100),
    ],
  },
  {
    title: 'Environment (offshore Los Angeles)',
    items: [
      sl('env.currentMs', 'Mean current', 0, 1.5, 0.01, 'm/s'),
      sl('env.currentHeadingDeg', 'Current heading (toward)', 0, 360, 1, 'deg'),
      sl('env.currentVariabilityMs', 'Current variability', 0, 0.6, 0.01, 'm/s'),
      sl('env.tidalMs', 'Tidal current', 0, 0.5, 0.01, 'm/s'),
      sl('env.windMeanMs', 'Mean wind', 0, 15, 0.1, 'm/s'),
      sl('env.stowWindMs', 'Petal stow wind', 0, 30, 0.1, 'm/s'),
      sl('env.marineLayerStrength', 'Marine layer strength', 0, 1.5, 0.05, 'x'),
      sl('env.dayVariability', 'Day-to-day variability', 0, 1.5, 0.05, 'x'),
      sl('env.cloudCellKm', 'Cloud cell size', 1, 200, 1, 'km'),
      sl('env.cloudCellAmp', 'Cloud cell strength', 0, 60, 1, '%', 100),
      sl('env.cloudDriftMs', 'Cloud drift speed', 0, 20, 0.1, 'm/s'),
      sl('env.cloudDriftHeadingDeg', 'Cloud drift heading', 0, 360, 1, 'deg'),
      sl('env.disturbanceMs', 'Wave drift disturbance', 0, 0.3, 0.005, 'm/s'),
      sl('seed', 'Random seed', 0, 9999, 1),
    ],
  },
  {
    title: 'Swarm',
    items: [
      sl('swarm.count', 'Modules', 1, 100, 1),
      {
        kind: 'select', path: 'swarm.strategy', label: 'Swarm strategy',
        options: [
          { value: 'station', label: 'Hold position' },
          { value: 'drift', label: 'Drift with the current' },
          { value: 'seek', label: 'Seek sunlight (cloud avoidance)' },
        ],
      },
      sl('swarm.spacingM', 'Spacing', 10, 2000, 5, 'm'),
      sl('swarm.toleranceM', 'Tolerance radius', 1, 500, 1, 'm'),
      sl('swarm.breakawayM', 'Breakaway distance', 5, 3000, 5, 'm'),
      sl('swarm.cruiseMs', 'Swarm cruise speed', 0, 1, 0.01, 'm/s'),
      sl('swarm.horizonH', 'Seek horizon', 0.5, 12, 0.5, 'h'),
      sl('swarm.replanMin', 'Seek replan interval', 5, 360, 5, 'min'),
      sl('swarm.minOffshoreKm', 'Min distance offshore', 0, 300, 1, 'km'),
      sl('swarm.maxOffshoreKm', 'Max distance offshore', 1, 400, 1, 'km'),
    ],
  },
  {
    title: 'Jobs and demand',
    items: [
      sl('jobs.arrivalsPerHour', 'Job arrivals (swarm)', 0, 20000, 10, 'jobs/h'),
      sl('jobs.mixInference', 'Batch inference share', 0, 100, 1, '%', 100),
      sl('jobs.mixTraining', 'Fine-tune share', 0, 100, 1, '%', 100),
      sl('jobs.mixDataHeavy', 'Data-heavy share', 0, 100, 1, '%', 100),
      sl('jobs.checkpointMin', 'Checkpoint interval', 1, 240, 1, 'min'),
    ],
  },
  {
    title: 'Pricing and economics',
    items: [
      sl('econ.firmUsdPerGpuH', 'Firm price', 0, 20, 0.01, '$/GPU-h'),
      sl('econ.spotUsdPerGpuH', 'Spot price', 0, 20, 0.01, '$/GPU-h'),
      sl('econ.slaTarget', 'Firm SLA target', 0, 100, 0.1, '%', 100),
      sl('econ.slaPenaltyMultiple', 'SLA penalty multiple', 0, 10, 0.1, 'x'),
      sl('econ.hullUsd', 'Hull cost', 0, 100000, 100, '$'),
      sl('econ.podUsd', 'Pod cost', 0, 50000, 50, '$'),
      sl('econ.heatExchangerUsd', 'Heat exchanger cost', 0, 10000, 50, '$'),
      sl('econ.petalUsdPerM2', 'Petal structure cost', 0, 2000, 10, '$/m²'),
      sl('econ.mpptUsdPerW', 'MPPT cost', 0, 1, 0.001, '$/W'),
      sl('econ.gnssUsd', 'GNSS cost', 0, 2000, 1, '$'),
      sl('econ.avionicsUsd', 'Avionics cost', 0, 10000, 10, '$'),
      sl('econ.hostUsd', 'Host board cost', 0, 20000, 50, '$'),
      sl('econ.batteryIntegrationUplift', 'Battery integration uplift', 1, 5, 0.05, 'x'),
      sl('econ.integrationPct', 'Integration uplift', 0, 100, 1, '%', 100),
      sl('econ.contingencyPct', 'Contingency', 0, 100, 1, '%', 100),
      sl('econ.sparesPct', 'Spare modules', 0, 100, 1, '%', 100),
      sl('econ.deploymentVesselDays', 'Deployment vessel days', 0, 60, 1, 'days'),
      sl('econ.vesselDayUsd', 'Vessel day rate', 0, 100000, 500, '$/day'),
      sl('econ.maintenanceVisitsPerYear', 'Service visits per year', 0, 52, 1, '/yr'),
      sl('econ.visitUsd', 'Cost per service visit', 0, 200000, 500, '$'),
      sl('econ.insurancePct', 'Insurance', 0, 50, 0.5, '%/yr', 100),
      sl('econ.moduleLossRate', 'Module loss rate', 0, 100, 0.5, '%/yr', 100),
      sl('econ.acceleratorRefreshYears', 'Accelerator refresh', 1, 20, 1, 'yr'),
      sl('econ.discountRate', 'Discount rate', 0, 100, 0.5, '%', 100),
      sl('econ.horizonYears', 'Horizon', 1, 30, 1, 'yr'),
    ],
  },
];

/** Slider bounds in config units, used to clamp optimizer range inputs. */
export const SLIDER_BOUNDS: Record<string, [number, number]> = Object.fromEntries(
  PANEL_DEFS.flatMap((p) => p.items.flatMap((i) => (i.kind === 'slider' ? [[i.path, [i.min / (i.scale ?? 1), i.max / (i.scale ?? 1)]] as [string, [number, number]]] : []))),
);

export const PARAM_LABELS: Record<string, string> = Object.fromEntries(
  PANEL_DEFS.flatMap((p) => p.items.flatMap((i) => (i.kind === 'preset' ? [] : [[i.path, i.label] as [string, string]]))),
);
