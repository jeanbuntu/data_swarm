import { runAnnual } from '../model/annual';
import { economics } from '../model/economics';
import type { AnnualRequest, AnnualResponse } from './protocol';

const ctx = self as unknown as { postMessage(m: AnnualResponse): void; onmessage: ((e: MessageEvent<AnnualRequest>) => void) | null };

ctx.onmessage = (e) => {
  const { id, cfg } = e.data;
  try {
    const annual = runAnnual(cfg, 'full');
    ctx.postMessage({ id, annual, econ: economics(cfg, annual) });
  } catch (err) {
    ctx.postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};
