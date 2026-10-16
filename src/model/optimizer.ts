import type { SimConfig } from './config';
import { setPath, getPath } from './config';
import { applyPreset, PresetKind } from './defaults';
import { runAnnual } from './annual';
import { economics } from './economics';
import { derive } from './derive';
import { feasibility } from './feasibility';
import { mulberry32 } from './rng';
import { ACCELERATORS, PANELS, PLANS } from '../presets';

export type Metric = 'pflopHours' | 'costPerGpuHour' | 'marginYear' | 'marginAfterCapitalYear' | 'marginPerGpuHour' | 'paybackMonths';

export const METRICS: { id: Metric; label: string; better: 'high' | 'low' }[] = [
  { id: 'marginPerGpuHour', label: 'Margin per GPU-hour (USD)', better: 'high' },
  { id: 'marginAfterCapitalYear', label: 'Margin after capital per year (USD)', better: 'high' },
  { id: 'marginYear', label: 'Gross margin per year (USD)', better: 'high' },
  { id: 'pflopHours', label: 'Delivered PFLOP-hours per year', better: 'high' },
  { id: 'costPerGpuHour', label: 'Cost per GPU-hour (USD)', better: 'low' },
  { id: 'paybackMonths', label: 'Payback (months)', better: 'low' },
];

export interface Evaluation {
  pflopHours: number;
  costPerGpuHour: number;
  marginYear: number;
  marginPerGpuHour: number;
  paybackMonths: number | null;
  capexTotal: number;
  /** Revenue minus opex minus amortized capital, per year. */
  marginAfterCapitalYear: number;
  feasible: boolean;
}

export function evaluate(cfg: SimConfig, sampleModules = 4): Evaluation {
  const annual = runAnnual(cfg, 'representative', { sampleModules });
  const e = economics(cfg, annual);
  const flags = feasibility(cfg, derive(cfg), annual, e);
  return {
    pflopHours: e.annualPflopHours,
    costPerGpuHour: e.costPerGpuHour,
    marginYear: e.grossMargin,
    marginPerGpuHour: e.marginPerGpuHour,
    paybackMonths: e.paybackMonths,
    capexTotal: e.capex.total,
    marginAfterCapitalYear: e.grossMargin - e.annualCapital,
    feasible: !flags.some((f) => f.severity === 'error'),
  };
}

export function metricValue(ev: Evaluation, m: Metric): number {
  if (m === 'paybackMonths') return ev.paybackMonths ?? Infinity;
  const v = ev[m];
  if (Number.isFinite(v)) return v;
  // No delivered compute: rank it as the worst outcome rather than as break-even.
  return METRICS.find((x) => x.id === m)!.better === 'high' ? -Infinity : Infinity;
}

export type Axis =
  | { kind: 'number'; path: string; label: string; min: number; max: number; steps: number; integer?: boolean }
  | { kind: 'preset'; preset: PresetKind; label: string; ids: string[] }
  | { kind: 'enum'; path: string; label: string; values: string[] };

export function axisValues(a: Axis): (number | string)[] {
  if (a.kind === 'preset') return a.ids;
  if (a.kind === 'enum') return a.values;
  const out: number[] = [];
  for (let i = 0; i < a.steps; i++) {
    const v = a.steps === 1 ? a.min : a.min + ((a.max - a.min) * i) / (a.steps - 1);
    out.push(a.integer ? Math.round(v) : Number(v.toPrecision(6)));
  }
  return [...new Set(out)];
}

export function applyAxis(cfg: SimConfig, a: Axis, v: number | string): SimConfig {
  if (a.kind === 'preset') return applyPreset(cfg, a.preset, String(v));
  return setPath(cfg, a.path, v);
}

export interface SweepResult {
  xs: (number | string)[];
  ys: (number | string)[];
  cells: Evaluation[][];
}

export function sweep(cfg: SimConfig, ax: Axis, ay: Axis, onProgress?: (done: number, total: number) => void, sampleModules = 4): SweepResult {
  const xs = axisValues(ax);
  const ys = axisValues(ay);
  const total = xs.length * ys.length;
  let done = 0;
  const cells = ys.map((y) =>
    xs.map((x) => {
      const ev = evaluate(applyAxis(applyAxis(cfg, ax, x), ay, y), sampleModules);
      onProgress?.(++done, total);
      return ev;
    }),
  );
  return { xs, ys, cells };
}

export interface Range {
  path: string;
  label: string;
  min: number;
  max: number;
  integer?: boolean;
}

export interface ParetoPoint {
  values: Record<string, number>;
  ev: Evaluation;
}

export interface ParetoResult {
  points: ParetoPoint[];
  frontier: number[];
}

/** Indices of feasible points not dominated on (lower x, higher y), ordered by x. */
export function paretoFrontier(pts: { x: number; y: number; ok: boolean }[]): number[] {
  const order = pts
    .map((_, i) => i)
    .filter((i) => pts[i].ok && Number.isFinite(pts[i].x) && Number.isFinite(pts[i].y))
    .sort((a, b) => pts[a].x - pts[b].x || pts[b].y - pts[a].y);
  const out: number[] = [];
  let best = -Infinity;
  for (const i of order) {
    if (pts[i].y > best) {
      out.push(i);
      best = pts[i].y;
    }
  }
  return out;
}

export function pareto(cfg: SimConfig, ranges: Range[], n: number, seed: number, onProgress?: (done: number, total: number) => void, sampleModules = 4): ParetoResult {
  const rng = mulberry32(seed);
  const points: ParetoPoint[] = [];
  for (let k = 0; k < n; k++) {
    const values: Record<string, number> = {};
    let c = cfg;
    for (const r of ranges) {
      let v = r.min + rng() * (r.max - r.min);
      if (r.integer) v = Math.round(v);
      values[r.path] = v;
      c = setPath(c, r.path, v);
    }
    points.push({ values, ev: evaluate(c, sampleModules) });
    onProgress?.(k + 1, n);
  }
  const frontier = paretoFrontier(points.map((p) => ({ x: p.ev.capexTotal, y: p.ev.pflopHours, ok: p.ev.feasible })));
  return { points, frontier };
}

export const TORNADO_KEYS: { path: string; label: string }[] = [
  { path: 'panel.efficiency', label: 'Panel efficiency' },
  { path: 'hull.petalLengthM', label: 'Petal length' },
  { path: 'battery.kwh', label: 'Battery capacity' },
  { path: 'battery.usdPerKwh', label: 'Battery price' },
  { path: 'compute.cards', label: 'Accelerator count' },
  { path: 'compute.priceUsd', label: 'Accelerator price' },
  { path: 'econ.firmUsdPerGpuH', label: 'Firm price' },
  { path: 'econ.spotUsdPerGpuH', label: 'Spot price' },
  { path: 'comms.planUsdPerMonth', label: 'Starlink plan price' },
  { path: 'econ.hullUsd', label: 'Hull cost' },
  { path: 'econ.integrationPct', label: 'Integration uplift' },
  { path: 'env.currentMs', label: 'Current speed' },
];

export interface TornadoRow {
  path: string;
  label: string;
  lowValue: number;
  highValue: number;
  low: number;
  high: number;
}

export interface TornadoResult {
  base: number;
  rows: TornadoRow[];
}

/** Margin per GPU-hour when each input moves -20% and +20%. */
export function tornado(cfg: SimConfig, onProgress?: (done: number, total: number) => void, sampleModules = 4): TornadoResult {
  const metric: Metric = 'marginPerGpuHour';
  const total = 1 + TORNADO_KEYS.length * 2;
  let done = 0;
  const base = metricValue(evaluate(cfg, sampleModules), metric);
  onProgress?.(++done, total);
  const rows = TORNADO_KEYS.map(({ path, label }) => {
    const v = getPath(cfg, path) as number;
    const isInt = path === 'compute.cards';
    const lowValue = isInt ? Math.max(0, Math.round(v * 0.8)) : v * 0.8;
    const highValue = isInt ? Math.round(v * 1.2) : v * 1.2;
    const low = metricValue(evaluate(setPath(cfg, path, lowValue), sampleModules), metric);
    onProgress?.(++done, total);
    const high = metricValue(evaluate(setPath(cfg, path, highValue), sampleModules), metric);
    onProgress?.(++done, total);
    return { path, label, lowValue, highValue, low, high };
  });
  rows.sort((a, b) => Math.abs(b.high - b.low) - Math.abs(a.high - a.low));
  return { base, rows };
}

export const AXIS_OPTIONS: Axis[] = [
  { kind: 'number', path: 'battery.kwh', label: 'Battery capacity (kWh)', min: 2, max: 30, steps: 8 },
  { kind: 'number', path: 'compute.cards', label: 'Accelerator cards', min: 1, max: 16, steps: 8, integer: true },
  { kind: 'number', path: 'compute.firmComputeW', label: 'Firm commitment (W)', min: 0, max: 800, steps: 8 },
  { kind: 'number', path: 'hull.petalLengthM', label: 'Petal length (m)', min: 0.4, max: 2, steps: 7 },
  { kind: 'number', path: 'comms.modulesPerTerminal', label: 'Modules per Starlink terminal', min: 1, max: 8, steps: 8, integer: true },
  { kind: 'preset', preset: 'accelerator', label: 'Accelerator', ids: ACCELERATORS.map((a) => a.id) },
  { kind: 'preset', preset: 'panel', label: 'Solar panel', ids: PANELS.map((p) => p.id) },
  { kind: 'preset', preset: 'plan', label: 'Starlink plan', ids: PLANS.map((p) => p.id) },
  { kind: 'enum', path: 'compute.policy', label: 'Operating policy', values: ['daylight', 'firm', 'max'] },
  { kind: 'enum', path: 'swarm.strategy', label: 'Swarm strategy', values: ['station', 'drift', 'seek'] },
  { kind: 'enum', path: 'hull.tracking', label: 'Sun tracking', values: ['flat', 'yaw', 'dual'] },
];

export const RANGE_OPTIONS: Range[] = [
  { path: 'battery.kwh', label: 'Battery capacity (kWh)', min: 2, max: 30 },
  { path: 'compute.cards', label: 'Accelerator cards', min: 1, max: 16, integer: true },
  { path: 'compute.firmComputeW', label: 'Firm commitment (W)', min: 0, max: 800 },
  { path: 'hull.petalLengthM', label: 'Petal length (m)', min: 0.4, max: 2 },
  { path: 'hull.petalCount', label: 'Petal count', min: 4, max: 12, integer: true },
  { path: 'comms.modulesPerTerminal', label: 'Modules per terminal', min: 1, max: 8, integer: true },
];
