import { sweep, pareto, tornado } from '../model/optimizer';
import type { OptRequest, OptResponse } from './protocol';

const ctx = self as unknown as { postMessage(m: OptResponse): void; onmessage: ((e: MessageEvent<OptRequest>) => void) | null };

ctx.onmessage = (e) => {
  const req = e.data;
  const progress = (done: number, total: number) => ctx.postMessage({ id: req.id, kind: 'progress', done, total });
  try {
    if (req.kind === 'sweep') ctx.postMessage({ id: req.id, kind: 'sweep', result: sweep(req.cfg, req.ax, req.ay, progress) });
    else if (req.kind === 'pareto') ctx.postMessage({ id: req.id, kind: 'pareto', result: pareto(req.cfg, req.ranges, req.n, req.seed, progress) });
    else ctx.postMessage({ id: req.id, kind: 'tornado', result: tornado(req.cfg, progress) });
  } catch (err) {
    ctx.postMessage({ id: req.id, kind: 'error', error: err instanceof Error ? err.message : String(err) });
  }
};
