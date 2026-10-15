import type { SimConfig } from './config';
import type { Workload } from '../presets';
import { poisson, pickIndex, Rng } from './rng';

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

export type Binding = 'power' | 'bandwidth' | 'demand';

/** Delivered compute is the minimum of power-limited, bandwidth-limited and demand-limited rates. */
export function aggregateStep(
  powerTflops: number,
  downMbps: number,
  upMbps: number,
  demandTflops: number,
  inMBPerTflop: number,
  outMBPerTflop: number,
): { tflops: number; binding: Binding; downMBps: number; upMBps: number } {
  if (powerTflops <= 0) return { tflops: 0, binding: 'power', downMBps: 0, upMBps: 0 };
  const downLimit = inMBPerTflop > 0 ? downMbps / 8 / inMBPerTflop : Infinity;
  const upLimit = outMBPerTflop > 0 ? upMbps / 8 / outMBPerTflop : Infinity;
  const bandwidthTflops = Math.min(downLimit, upLimit);
  let tflops = powerTflops;
  let binding: Binding = 'power';
  if (bandwidthTflops < tflops) {
    tflops = bandwidthTflops;
    binding = 'bandwidth';
  }
  if (demandTflops < tflops) {
    tflops = demandTflops;
    binding = 'demand';
  }
  tflops = Math.max(0, tflops);
  return { tflops, binding, downMBps: tflops * inMBPerTflop, upMBps: tflops * outMBPerTflop };
}

export interface Job {
  id: number;
  kind: number;
  tflop: number;
  inMB: number;
  outMB: number;
  phase: 'down' | 'compute' | 'up';
  module: number;
  left: number;
  done: number;
  ckpt: number;
  ckptT: number;
  arrivedT: number;
}

export interface JobState {
  t: number;
  nextId: number;
  queue: Job[];
  active: Job[];
  completed: number;
  rejected: number;
  workTflop: number;
  rolledBackTflop: number;
  turnaroundSumS: number;
  recentDone: { module: number; t: number; kind: number }[];
}

export interface ModuleCapacity {
  tflops: number;
  downMbps: number;
  upMbps: number;
}

export const MAX_QUEUE = 2000;
const EPS = 1e-9;

export function initJobs(t0: number): JobState {
  return { t: t0, nextId: 1, queue: [], active: [], completed: 0, rejected: 0, workTflop: 0, rolledBackTflop: 0, turnaroundSumS: 0, recentDone: [] };
}

/**
 * Advances jobs by one step using per-module budgets: download MB, compute TFLOP and upload MB.
 * Jobs are served first-in first-out within each module, so throughput matches the aggregate model.
 */
export function stepJobs(
  s: JobState,
  caps: ModuleCapacity[],
  arrivalsPerHour: number,
  weights: number[],
  workloads: Workload[],
  checkpointMin: number,
  maxPerModule: number,
  dtS: number,
  rng: Rng,
): number[] {
  const arrivals = poisson(rng, (arrivalsPerHour * dtS) / 3600);
  for (let k = 0; k < arrivals; k++) {
    if (s.queue.length >= MAX_QUEUE) {
      s.rejected++;
      continue;
    }
    const kind = pickIndex(rng, weights);
    const w = workloads[kind];
    s.queue.push({
      id: s.nextId++, kind, tflop: w.tflopPerJob.value, inMB: w.inMB.value, outMB: w.outMB.value,
      phase: 'down', module: -1, left: w.inMB.value, done: 0, ckpt: 0, ckptT: s.t, arrivedT: s.t,
    });
  }

  const counts = caps.map(() => 0);
  for (const j of s.active) counts[j.module]++;
  while (s.queue.length) {
    let best = -1;
    for (let m = 0; m < caps.length; m++) {
      if (caps[m].tflops > 0 && counts[m] < maxPerModule && (best < 0 || counts[m] < counts[best])) best = m;
    }
    if (best < 0) break;
    const j = s.queue.shift()!;
    j.module = best;
    counts[best]++;
    s.active.push(j);
  }

  const budC = caps.map((c) => c.tflops * dtS);
  const budD = caps.map((c) => (c.downMbps / 8) * dtS);
  const budU = caps.map((c) => (c.upMbps / 8) * dtS);
  const used = caps.map(() => 0);
  const tEnd = s.t + dtS * 1000;
  const still: Job[] = [];

  for (const j of s.active) {
    const m = j.module;
    if (j.phase === 'down') {
      const u = Math.min(j.left, budD[m]);
      j.left -= u;
      budD[m] -= u;
      if (j.left <= EPS) {
        j.phase = 'compute';
        j.ckptT = s.t;
      }
    }
    if (j.phase === 'compute') {
      if (caps[m].tflops <= 0) {
        if (j.done > j.ckpt) {
          s.rolledBackTflop += j.done - j.ckpt;
          s.workTflop -= j.done - j.ckpt;
          j.done = j.ckpt;
        }
      } else {
        const u = Math.min(j.tflop - j.done, budC[m]);
        j.done += u;
        budC[m] -= u;
        used[m] += u;
        s.workTflop += u;
        if (tEnd - j.ckptT >= checkpointMin * 60000) {
          j.ckpt = j.done;
          j.ckptT = tEnd;
        }
        if (j.done >= j.tflop - EPS) {
          j.phase = 'up';
          j.left = j.outMB;
        }
      }
    }
    if (j.phase === 'up') {
      const u = Math.min(j.left, budU[m]);
      j.left -= u;
      budU[m] -= u;
      if (j.left <= EPS) {
        s.completed++;
        s.turnaroundSumS += (tEnd - j.arrivedT) / 1000;
        s.recentDone.push({ module: m, t: tEnd, kind: j.kind });
        continue;
      }
    }
    still.push(j);
  }
  s.active = still;
  if (s.recentDone.length > 200) s.recentDone.splice(0, s.recentDone.length - 200);
  s.t = tEnd;
  return used;
}
