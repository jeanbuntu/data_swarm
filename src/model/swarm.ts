import type { Vec } from './vec';

const HEX_DIRS: [number, number][] = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

/** Slots on a hexagonal lattice, filled ring by ring from the center. */
export function hexSlots(n: number, spacingM: number): Vec[] {
  const axial: [number, number][] = [[0, 0]];
  for (let k = 1; axial.length < n; k++) {
    let q = -k, r = k;
    for (let side = 0; side < 6; side++) {
      for (let j = 0; j < k; j++) {
        axial.push([q, r]);
        q += HEX_DIRS[side][0];
        r += HEX_DIRS[side][1];
      }
    }
  }
  return axial.slice(0, n).map(([q, r]) => ({ x: spacingM * (q + r / 2), y: spacingM * ((Math.sqrt(3) / 2) * r) }));
}
