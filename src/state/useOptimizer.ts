import { useCallback, useEffect, useRef, useState } from 'react';
import type { OptJob, OptResponse, OptResult } from '../workers/protocol';

interface OptState {
  busy: boolean;
  progress: [number, number] | null;
  response: OptResult | null;
  error: string | null;
}

/** Runs one optimizer job at a time in a fresh worker; starting a new job cancels the old one. */
export function useOptimizer() {
  const workerRef = useRef<Worker | null>(null);
  const idRef = useRef(0);
  const [state, setState] = useState<OptState>({ busy: false, progress: null, response: null, error: null });

  useEffect(
    () => () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    },
    [],
  );

  const run = useCallback((job: OptJob) => {
    workerRef.current?.terminate();
    const w = new Worker(new URL('../workers/optimizer.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = w;
    const id = ++idRef.current;
    w.onmessage = (e: MessageEvent<OptResponse>) => {
      const m = e.data;
      if (m.id !== idRef.current) return;
      if (m.kind === 'progress') setState((s) => ({ ...s, progress: [m.done, m.total] }));
      else if (m.kind === 'error') setState({ busy: false, progress: null, response: null, error: m.error });
      else setState({ busy: false, progress: null, response: m, error: null });
    };
    w.onerror = (e) => setState((s) => ({ ...s, busy: false, error: e.message || 'Optimizer failed' }));
    setState((s) => ({ ...s, busy: true, progress: null, error: null }));
    w.postMessage({ ...job, id });
  }, []);

  return { ...state, run };
}
