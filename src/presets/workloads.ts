import { Sourced, est } from './sourced';

export interface Workload { id: 'inference' | 'training' | 'dataHeavy'; name: string; tflopPerJob: Sourced; inMB: Sourced; outMB: Sourced }

export const WORKLOADS: Workload[] = [
  {
    id: 'inference', name: 'Batch AI inference',
    tflopPerJob: est(14000, 'TFLOP', '7B model, 1,000 prompts x 1,000 tokens, 2 FLOP per parameter per token'),
    inMB: est(2, 'MB', 'prompts'), outMB: est(4, 'MB', 'about 1M output tokens of text'),
  },
  {
    id: 'training', name: 'Fine-tune chunk',
    tflopPerJob: est(217800, 'TFLOP', 'one L4-hour at 50% utilization: 121 x 0.5 x 3600'),
    inMB: est(100, 'MB', 'data shard'), outMB: est(50, 'MB', 'adapter checkpoint'),
  },
  {
    id: 'dataHeavy', name: 'Data-heavy batch (rendering, science)',
    tflopPerJob: est(50000, 'TFLOP', 'render or simulation chunk'),
    inMB: est(2000, 'MB', 'scene or dataset'), outMB: est(200, 'MB', 'results'),
  },
];
