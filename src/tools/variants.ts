import type { SimConfig, Policy } from '../model/config';
import { applyPreset, defaultConfig } from '../model/defaults';
import { evaluate, type Evaluation } from '../model/optimizer';

export interface VariantSpec {
  id: string;
  accelerator: string;
  benchmark: 'gas' | 'cloud';
}

const ACCELS = ['l4', 'l40s', 'h100-sxm', 'b200'];

export const VARIANT_SPECS: VariantSpec[] = ACCELS.flatMap((accelerator) =>
  (['gas', 'cloud'] as const).map((benchmark) => ({ id: `${accelerator}-${benchmark}`, accelerator, benchmark })),
);

export interface Grid {
  cards: number[];
  batteries: number[];
  firmW: number[];
  policies: readonly Policy[];
}

/** Search grid per accelerator: card counts span roughly what one module's solar budget can run. */
export const GRIDS: Record<string, Grid> = {
  l4: { cards: [1, 2, 3, 4, 6, 8, 10, 12, 16], batteries: [4, 8, 12, 20, 30], firmW: [0, 100, 200, 400, 800], policies: ['firm', 'daylight', 'max'] },
  l40s: { cards: [1, 2, 3, 4, 6], batteries: [4, 8, 12, 20, 30], firmW: [0, 100, 200, 400, 800], policies: ['firm', 'daylight', 'max'] },
  'h100-sxm': { cards: [1, 2, 3], batteries: [4, 8, 12, 20, 30], firmW: [0, 100, 200, 400, 800], policies: ['firm', 'daylight', 'max'] },
  b200: { cards: [1, 2], batteries: [4, 8, 12, 20, 30], firmW: [0, 100, 200, 400, 800], policies: ['firm', 'daylight', 'max'] },
};

export function variantBase(accelerator: string, benchmark: 'gas' | 'cloud', undercutUsd: number): SimConfig {
  const c = applyPreset(defaultConfig(), 'accelerator', accelerator);
  return { ...c, market: { ...c.market, priceMode: 'undercut', benchmark, undercutUsd } };
}

export function candidateConfigs(base: SimConfig, grid: Grid): SimConfig[] {
  const out: SimConfig[] = [];
  for (const cards of grid.cards) {
    for (const kwh of grid.batteries) {
      for (const policy of grid.policies) {
        // Firm commitment only matters under the firm policy.
        const firms = policy === 'firm' ? grid.firmW : [0];
        for (const firmComputeW of firms) {
          out.push({
            ...base,
            battery: { ...base.battery, kwh },
            compute: { ...base.compute, cards, policy, firmComputeW },
          });
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
