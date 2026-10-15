import type { SimConfig } from './config';
import type { AnnualResult } from './annual';
import type { Binding } from './jobs';

export interface Utilization {
  bindingShare: Record<Binding, number>;
  /** Delivered compute over nameplate dense compute of every card, all year. */
  cardUtilization: number;
  /** Data moved over unthrottled Starlink capacity (both directions), all year. */
  linkUtilization: number;
}

export function utilization(cfg: SimConfig, a: AnnualResult): Utilization {
  const t = a.totals;
  const hours = Math.max(1e-9, t.bindingH.power + t.bindingH.bandwidth + t.bindingH.demand);
  const nameplate = cfg.swarm.count * cfg.compute.cards * cfg.compute.denseTflops * t.hours * 3600;
  const linkMB = a.terminals * ((cfg.comms.downMbps + cfg.comms.upMbps) / 8) * t.hours * 3600;
  return {
    bindingShare: { power: t.bindingH.power / hours, bandwidth: t.bindingH.bandwidth / hours, demand: t.bindingH.demand / hours },
    cardUtilization: nameplate > 0 ? t.tflop / nameplate : 0,
    linkUtilization: linkMB > 0 ? ((t.downGB + t.upGB) * 1000) / linkMB : 0,
  };
}
