import type { SimConfig } from './config';
import type { Workload } from '../presets';

export interface MixStats {
  weights: number[];
  meanTflop: number;
  inMBPerTflop: number;
  outMBPerTflop: number;
}

export function mixStats(jobs: SimConfig['jobs'], workloads: Workload[]): MixStats {
  const raw = [jobs.mixInference, jobs.mixTraining, jobs.mixDataHeavy].map((w) => Math.max(0, w));
  const sum = raw.reduce((a, b) => a + b, 0);
  const weights = sum > 0 ? raw.map((w) => w / sum) : [1, 0, 0];
  const meanTflop = weights.reduce((a, w, i) => a + w * workloads[i].tflopPerJob.value, 0);
  const meanIn = weights.reduce((a, w, i) => a + w * workloads[i].inMB.value, 0);
  const meanOut = weights.reduce((a, w, i) => a + w * workloads[i].outMB.value, 0);
  return { weights, meanTflop, inMBPerTflop: meanTflop > 0 ? meanIn / meanTflop : 0, outMBPerTflop: meanTflop > 0 ? meanOut / meanTflop : 0 };
}
