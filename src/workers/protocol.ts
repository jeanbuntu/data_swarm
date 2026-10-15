import type { SimConfig } from '../model/config';
import type { AnnualResult } from '../model/annual';
import type { Econ } from '../model/economics';
import type { Axis, Range, SweepResult, ParetoResult, TornadoResult } from '../model/optimizer';

export interface AnnualRequest { id: number; cfg: SimConfig }
export type AnnualResponse = { id: number; annual: AnnualResult; econ: Econ } | { id: number; error: string };

export type OptRequest =
  | { id: number; kind: 'sweep'; cfg: SimConfig; ax: Axis; ay: Axis }
  | { id: number; kind: 'pareto'; cfg: SimConfig; ranges: Range[]; n: number; seed: number }
  | { id: number; kind: 'tornado'; cfg: SimConfig };

export type OptResult =
  | { id: number; kind: 'sweep'; result: SweepResult }
  | { id: number; kind: 'pareto'; result: ParetoResult }
  | { id: number; kind: 'tornado'; result: TornadoResult };

export type OptResponse = OptResult | { id: number; kind: 'progress'; done: number; total: number } | { id: number; kind: 'error'; error: string };

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type OptJob = DistributiveOmit<OptRequest, 'id'>;
