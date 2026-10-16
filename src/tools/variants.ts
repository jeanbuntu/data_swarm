import type { SimConfig, Policy } from '../model/config';
import { applyPreset, defaultConfig } from '../model/defaults';
import { evaluate, type Evaluation } from '../model/optimizer';

export interface VariantSpec {
  id: string;
  accelerator: string;
  benchmark: 'gas' | 'cloud';
  /** One master node with Starlink and the cluster computer per 10 nodes. */
  hub?: boolean;
}

const ACCELS = ['l4', 'l40s', 'h100-sxm', 'b200'];

export const VARIANT_SPECS: VariantSpec[] = [
  ...ACCELS.flatMap((accelerator) => (['gas', 'cloud'] as const).map((benchmark) => ({ id: `${accelerator}-${benchmark}`, accelerator, benchmark }))),
  ...(['gas', 'cloud'] as const).map((benchmark) => ({ id: `l4-${benchmark}-hub`, accelerator: 'l4', benchmark, hub: true })),
];

export interface Grid {
  cards: number[];
  batteries: number[];
  firmW: number[];
  policies: readonly Policy[];
  /** Starlink plan presets to try; omitted means keep the base plan. */
  plans?: string[];
}

/** Search grid per accelerator: card counts span roughly what one module's solar budget can run. */
function GRIDS_BASE_L4(): Grid {
  return { cards: [1, 2, 3, 4, 6, 8], batteries: [4, 8, 12, 20, 30], firmW: [0, 100, 200, 400], policies: ['firm', 'daylight', 'max'] };
}

export const GRIDS: Record<string, Grid> = {
  l4: { cards: [1, 2, 3, 4, 6, 8, 10, 12, 16], batteries: [4, 8, 12, 20, 30], firmW: [0, 100, 200, 400, 800], policies: ['firm', 'daylight', 'max'] },
  l40s: { cards: [1, 2, 3, 4, 6], batteries: [4, 8, 12, 20, 30], firmW: [0, 100, 200, 400, 800], policies: ['firm', 'daylight', 'max'] },
  'h100-sxm': { cards: [1, 2, 3], batteries: [4, 8, 12, 20, 30], firmW: [0, 100, 200, 400, 800], policies: ['firm', 'daylight', 'max'] },
  b200: { cards: [1, 2], batteries: [4, 8, 12, 20, 30], firmW: [0, 100, 200, 400, 800], policies: ['firm', 'daylight', 'max'] },
};

export const HUB_CLUSTER_SIZE = 10;

export function variantBase(accelerator: string, benchmark: 'gas' | 'cloud', undercutUsd: number, hub = false): SimConfig {
  let c = applyPreset(defaultConfig(), 'accelerator', accelerator);
  if (hub) {
    c = applyPreset(c, 'terminal', 'performance-gen3');
    c = { ...c, comms: { ...c.comms, hubMode: true, modulesPerTerminal: HUB_CLUSTER_SIZE } };
  }
  return { ...c, market: { ...c.market, priceMode: 'undercut', benchmark, undercutUsd } };
}

/** Grid for hub variants: the shared terminal carries ten nodes' traffic, so the data plan is searched too. */
export const HUB_GRID: Grid = { ...GRIDS_BASE_L4(), plans: ['gp-1tb', 'gp-2tb'] };

export function candidateConfigs(base: SimConfig, grid: Grid): SimConfig[] {
  const out: SimConfig[] = [];
  for (const plan of grid.plans ?? [null]) {
    const b = plan ? applyPreset(base, 'plan', plan) : base;
    for (const cards of grid.cards) {
      for (const kwh of grid.batteries) {
        for (const policy of grid.policies) {
          // Firm commitment only matters under the firm policy.
          const firms = policy === 'firm' ? grid.firmW : [0];
          for (const firmComputeW of firms) {
            out.push({ ...b, battery: { ...b.battery, kwh }, compute: { ...b.compute, cards, policy, firmComputeW } });
          }
        }
      }
    }
  }
  return out;
}

/** Best feasible configuration by yearly margin after capital, using the fast representative-day model. */
export function searchVariant(base: SimConfig, grid: Grid, onProgress?: (done: number, total: number) => void): { config: SimConfig; evaluation: Evaluation } {
  const candidates = candidateConfigs(base, grid);
  let best: { config: SimConfig; evaluation: Evaluation } | null = null;
  candidates.forEach((config, i) => {
    const evaluation = evaluate(config);
    onProgress?.(i + 1, candidates.length);
    if (!evaluation.feasible) return;
    if (!best || evaluation.marginAfterCapitalYear > best.evaluation.marginAfterCapitalYear) best = { config, evaluation };
  });
  if (!best) throw new Error(`No feasible configuration for ${base.compute.presetId}`);
  return best;
}
