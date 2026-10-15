import type { SimConfig } from './config';
import { payOverage } from './defaults';
import { derive } from './derive';
import type { AnnualResult } from './annual';

export interface CostLine {
  key: string;
  label: string;
  usd: number;
  estimate: boolean;
}

export function moduleCapex(cfg: SimConfig): { lines: CostLine[]; total: number } {
  const d = derive(cfg);
  const e = cfg.econ;
  const shared = cfg.comms.modulesPerTerminal > 1;
  const base: CostLine[] = [
    { key: 'panels', label: 'Solar panels', usd: d.peakPvW * cfg.panel.usdPerW, estimate: false },
    { key: 'petals', label: 'Petal frames and actuators', usd: d.petalM2 * e.petalUsdPerM2, estimate: true },
    { key: 'hull', label: 'Hull', usd: e.hullUsd, estimate: true },
    { key: 'pod', label: 'Compute pod', usd: e.podUsd, estimate: true },
    { key: 'heatExchanger', label: 'Seawater heat exchanger', usd: e.heatExchangerUsd, estimate: true },
    { key: 'battery', label: 'Battery (integrated)', usd: cfg.battery.kwh * cfg.battery.usdPerKwh * e.batteryIntegrationUplift, estimate: false },
    { key: 'mppt', label: 'MPPT controllers', usd: d.peakPvW * e.mpptUsdPerW, estimate: false },
    { key: 'accelerators', label: 'Accelerators', usd: cfg.compute.cards * cfg.compute.priceUsd, estimate: false },
    { key: 'host', label: 'Host board and network', usd: cfg.compute.cards > 0 ? e.hostUsd : 0, estimate: true },
    { key: 'starlink', label: 'Starlink terminal share', usd: cfg.comms.terminalUsd / cfg.comms.modulesPerTerminal + (shared ? cfg.comms.radioUsd : 0), estimate: false },
    { key: 'thrusters', label: 'Thrusters', usd: cfg.propulsion.count * cfg.propulsion.usd, estimate: false },
    { key: 'avionics', label: 'GNSS and avionics', usd: e.gnssUsd + e.avionicsUsd, estimate: true },
  ];
  const sub = base.reduce((a, l) => a + l.usd, 0);
  const integration = sub * e.integrationPct;
  const contingency = (sub + integration) * e.contingencyPct;
  const lines = [
    ...base,
    { key: 'integration', label: 'Integration and assembly', usd: integration, estimate: true },
    { key: 'contingency', label: 'Contingency', usd: contingency, estimate: true },
  ];
  return { lines, total: lines.reduce((a, l) => a + l.usd, 0) };
}

export function swarmCapex(cfg: SimConfig): { perModule: number; fleetModules: number; deployment: number; total: number } {
  const perModule = moduleCapex(cfg).total;
  const fleetModules = cfg.swarm.count * (1 + cfg.econ.sparesPct);
  const deployment = cfg.econ.deploymentVesselDays * cfg.econ.vesselDayUsd;
  return { perModule, fleetModules, deployment, total: perModule * fleetModules + deployment };
}

export const crf = (r: number, n: number): number => (r === 0 ? 1 / n : (r * (1 + r) ** n) / ((1 + r) ** n - 1));

export const npv = (r: number, flows: number[]): number => flows.reduce((a, f, i) => a + f / (1 + r) ** i, 0);

export function irr(flows: number[]): number | null {
  let lo = -0.99, hi = 10;
  let flo = npv(lo, flows);
  const fhi = npv(hi, flows);
  if (!Number.isFinite(flo) || !Number.isFinite(fhi) || flo * fhi > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fm = npv(mid, flows);
    if (Math.abs(fm) < 1e-9) return mid;
    if (flo * fm < 0) hi = mid;
    else {
      lo = mid;
      flo = fm;
    }
  }
  return (lo + hi) / 2;
}

export function paybackMonths(flows: number[]): number | null {
  let cum = flows[0];
  if (cum >= 0) return 0;
  for (let y = 1; y < flows.length; y++) {
    const next = cum + flows[y];
    if (next >= 0) return (y - 1) * 12 + (-cum / flows[y]) * 12;
    cum = next;
  }
  return null;
}

export interface Econ {
  moduleCapex: { lines: CostLine[]; total: number };
  capex: { perModule: number; fleetModules: number; deployment: number; total: number };
  gpuHours: number;
  firmGpuHours: number;
  spotGpuHours: number;
  committedFirmGpuHours: number;
  availability: number | null;
  revenue: { firm: number; spot: number; slaPenalty: number; total: number };
  opexLines: CostLine[];
  opexTotal: number;
  grossMargin: number;
  costPerGpuHour: number;
  marginPerGpuHour: number;
  lcocPerPflopHour: number;
  marketFirm: number;
  marketSpot: number;
  flows: number[];
  npv: number;
  irr: number | null;
  paybackMonths: number | null;
  annualPflopHours: number;
}

export function economics(cfg: SimConfig, annual: AnnualResult): Econ {
  const e = cfg.econ;
  const t = annual.totals;
  const mc = moduleCapex(cfg);
  const capex = swarmCapex(cfg);
  const gpuUnit = cfg.compute.denseTflops * 3600;
  const toGpuH = (tflop: number) => (gpuUnit > 0 ? tflop / gpuUnit : 0);
  const gpuHours = toGpuH(t.tflop);
  const firmGpuHours = toGpuH(t.firmTflop);
  const spotGpuHours = toGpuH(t.spotTflop);
  const committedFirmGpuHours = toGpuH(t.firmCommittedTflop);
  const availability = annual.availability;
  const slaPenalty =
    availability !== null && availability < e.slaTarget ? (e.slaTarget - availability) * committedFirmGpuHours * e.firmUsdPerGpuH * e.slaPenaltyMultiple : 0;
  const revenueFirm = firmGpuHours * e.firmUsdPerGpuH;
  const revenueSpot = spotGpuHours * e.spotUsdPerGpuH;
  const revenue = { firm: revenueFirm, spot: revenueSpot, slaPenalty, total: revenueFirm + revenueSpot - slaPenalty };

  const n = cfg.swarm.count;
  const terminals = annual.terminals;
  const overageRate = cfg.comms.overageUsdPerGB ?? 0;
  const dataOverage = payOverage(cfg)
    ? annual.gbPerTerminalMonthly.reduce((a, gb) => a + Math.max(0, gb - cfg.comms.planCapGB), 0) * overageRate * terminals
    : 0;
  const batteryLine = mc.lines.find((l) => l.key === 'battery')!.usd;
  const opexLines: CostLine[] = [
    { key: 'starlinkPlans', label: 'Starlink plans', usd: terminals * cfg.comms.planUsdPerMonth * 12, estimate: false },
    { key: 'dataOverage', label: 'Data beyond plan cap', usd: dataOverage, estimate: false },
    { key: 'maintenance', label: 'Service visits', usd: e.maintenanceVisitsPerYear * e.visitUsd, estimate: true },
    { key: 'insurance', label: 'Insurance', usd: e.insurancePct * capex.total, estimate: true },
    { key: 'moduleLosses', label: 'Module losses', usd: e.moduleLossRate * n * capex.perModule, estimate: true },
    {
      key: 'batteryWear', label: 'Battery wear',
      usd: n * batteryLine * Math.min(1, annual.batteryCyclesPerModule / cfg.battery.cycleLife), estimate: false,
    },
    { key: 'acceleratorRefresh', label: 'Accelerator refresh', usd: (n * cfg.compute.cards * cfg.compute.priceUsd) / e.acceleratorRefreshYears, estimate: true },
  ];
  const opexTotal = opexLines.reduce((a, l) => a + l.usd, 0);
  const annualCost = capex.total * crf(e.discountRate, e.horizonYears) + opexTotal;
  const grossMargin = revenue.total - opexTotal;
  const flows = [-capex.total, ...new Array(e.horizonYears).fill(grossMargin)];
  const annualPflopHours = t.tflop / 3.6e6;
  return {
    moduleCapex: mc,
    capex,
    gpuHours,
    firmGpuHours,
    spotGpuHours,
    committedFirmGpuHours,
    availability,
    revenue,
    opexLines,
    opexTotal,
    grossMargin,
    costPerGpuHour: gpuHours > 0 ? annualCost / gpuHours : Infinity,
    marginPerGpuHour: gpuHours > 0 ? (revenue.total - annualCost) / gpuHours : 0,
    lcocPerPflopHour: annualPflopHours > 0 ? annualCost / annualPflopHours : Infinity,
    marketFirm: e.firmUsdPerGpuH,
    marketSpot: e.spotUsdPerGpuH,
    flows,
    npv: npv(e.discountRate, flows),
    irr: irr(flows),
    paybackMonths: paybackMonths(flows),
    annualPflopHours,
  };
}
