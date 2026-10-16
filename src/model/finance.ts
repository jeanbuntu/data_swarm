/** Capital recovery factor, NPV, IRR and payback helpers. */
export const crf = (r: number, n: number): number => (r === 0 ? 1 / n : (r * (1 + r) ** n) / ((1 + r) ** n - 1));

export const npv = (r: number, flows: number[]): number => flows.reduce((a, f, i) => a + f / (1 + r) ** i, 0);

export function irr(flows: number[]): number | null {
  let lo = -0.99, hi = 10;
  let flo = npv(lo, flows);
  const fhi = npv(hi, flows);
  if (!Number.isFinite(flo) || !Number.isFinite(fhi) || flo * fhi > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fm = npv(mid, flows);
    if (Math.abs(fm) < 1e-9) return mid;
    if (flo * fm < 0) hi = mid;
    else {
      lo = mid;
      flo = fm;
    }
  }
  return (lo + hi) / 2;
}

export function paybackMonths(flows: number[]): number | null {
  let cum = flows[0];
  if (cum >= 0) return 0;
  for (let y = 1; y < flows.length; y++) {
    const next = cum + flows[y];
    if (next >= 0) return (y - 1) * 12 + (-cum / flows[y]) * 12;
    cum = next;
  }
  return null;
}
