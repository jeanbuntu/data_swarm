export const cssVar = (name: string): string => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** Sizes the canvas backing store to its CSS size times devicePixelRatio. */
export function setupCanvas(c: HTMLCanvasElement | null): { g: CanvasRenderingContext2D; W: number; H: number } | null {
  if (!c) return null;
  const W = c.clientWidth;
  const H = c.clientHeight;
  if (W === 0 || H === 0) return null;
  const dpr = window.devicePixelRatio || 1;
  const bw = Math.round(W * dpr), bh = Math.round(H * dpr);
  if (c.width !== bw || c.height !== bh) {
    c.width = bw;
    c.height = bh;
  }
  const g = c.getContext('2d');
  if (!g) return null;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { g, W, H };
}
