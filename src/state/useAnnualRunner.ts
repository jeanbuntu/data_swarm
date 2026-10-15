import { useEffect, useRef } from 'react';
import { useFleet } from './store';
import type { AnnualResponse } from '../workers/protocol';

/** Re-runs the 365-day model in a worker 350 ms after the config stops changing. */
export function useAnnualRunner(): void {
  const cfg = useFleet((s) => s.cfg);
  const workerRef = useRef<Worker | null>(null);
  const reqRef = useRef(0);
  const busyRef = useRef(false);

  useEffect(
    () => () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    },
    [],
  );

  useEffect(() => {
    const handle = setTimeout(() => {
      if (busyRef.current && workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      if (!workerRef.current) {
        const w = new Worker(new URL('../workers/annual.worker.ts', import.meta.url), { type: 'module' });
        w.onmessage = (e: MessageEvent<AnnualResponse>) => {
          const r = e.data;
          if (r.id !== reqRef.current) return;
          busyRef.current = false;
          if ('error' in r) useFleet.getState().setRunError(r.error);
          else useFleet.getState().setResults(r.annual, r.econ);
        };
        w.onerror = (e) => {
          busyRef.current = false;
          useFleet.getState().setRunError(e.message || 'Annual model failed');
        };
        workerRef.current = w;
      }
      const id = ++reqRef.current;
      busyRef.current = true;
      useFleet.getState().setRunning(true);
      workerRef.current.postMessage({ id, cfg });
    }, 350);
    return () => clearTimeout(handle);
  }, [cfg]);
}
