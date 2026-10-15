import type { SimConfig } from './config';
import type { Derived } from './derive';
import type { AnnualResult } from './annual';
import type { Econ } from './economics';
import { BUOYANCY_RESERVE } from './constants';

export interface Flag {
  id: string;
  severity: 'warn' | 'error';
  message: string;
}

const r0 = (v: number) => Math.round(v).toLocaleString('en-US');
const pct = (v: number) => `${(v * 100).toFixed(0)}%`;

export function feasibility(cfg: SimConfig, d: Derived, annual?: AnnualResult | null, econ?: Econ | null): Flag[] {
  const flags: Flag[] = [];
  const warn = (id: string, message: string) => flags.push({ id, severity: 'warn', message });
  const error = (id: string, message: string) => flags.push({ id, severity: 'error', message });

  const limit = d.displacementKg * (1 - BUOYANCY_RESERVE);
  if (d.massKg > limit) {
    error('buoyancy', `Module mass ${r0(d.massKg)} kg exceeds ${r0(limit)} kg, which is 80% of displacement at ${cfg.hull.draftM} m draft. Increase draft or hull size, or cut battery mass.`);
  }
  if (d.podNeedL > cfg.hull.podVolumeL) {
    error('podVolume', `Cards, host and heat exchanger need ${r0(d.podNeedL)} L but the pod holds ${r0(cfg.hull.podVolumeL)} L.`);
  }
  if (d.petalOverlap) warn('petalOverlap', `${cfg.hull.petalCount} petals ${cfg.hull.petalWidthM} m wide overlap when open. Use fewer or narrower petals.`);
  if (cfg.comms.modulesPerTerminal > 1 && 2 * d.formationRadiusM > cfg.comms.radioRangeM) {
    warn('radioRange', `The formation is ${r0(2 * d.formationRadiusM)} m across but the in-swarm radio reaches ${r0(cfg.comms.radioRangeM)} m.`);
  }
  if (2 * cfg.swarm.toleranceM >= cfg.swarm.spacingM) warn('tolerance', 'The tolerance radius is at least half the spacing, so neighboring modules can touch.');
  if (cfg.swarm.breakawayM <= cfg.swarm.toleranceM) warn('breakaway', 'The breakaway distance should be larger than the tolerance radius.');
  const typical = cfg.env.currentMs + cfg.env.currentVariabilityMs;
  if (d.maxWaterSpeedMs < typical) {
    warn('thrust', `Thrusters reach ${d.maxWaterSpeedMs.toFixed(2)} m/s through the water, below typical currents of up to ${typical.toFixed(2)} m/s. Modules will be pushed off station.`);
  }
  if (cfg.swarm.minOffshoreKm >= cfg.swarm.maxOffshoreKm) error('geofence', 'The minimum distance offshore must be less than the maximum.');

  if (annual) {
    const hours = Math.max(1, annual.totals.hours);
    const stow = annual.totals.stowedH / hours;
    if (stow > 0.05) warn('windStow', `Petals are stowed for wind ${pct(stow)} of hours.`);
    if (annual.totals.unmetKwh > 0.01) {
      error('unmet', `Modules ran out of power for essential loads (${r0(annual.totals.unmetKwh)} kWh per year across the swarm). Add battery or panels, or cut loads.`);
    }
    const bw = annual.totals.bindingH.bandwidth / hours;
    if (bw > 0.2) warn('bandwidth', `Starlink bandwidth or the data cap limits compute ${pct(bw)} of hours.`);
    if (annual.availability !== null && annual.availability < cfg.econ.slaTarget) {
      warn('sla', `Firm capacity is available ${pct(annual.availability)} of committed hours, below the ${pct(cfg.econ.slaTarget)} target.`);
    }
  }
  if (econ && econ.gpuHours === 0) warn('noCompute', 'No compute is delivered. Add accelerators or check the power and policy settings.');
  return flags;
}
