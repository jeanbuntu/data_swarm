import type { Vec } from './vec';
import { RAD } from './constants';
import type { GhiAnchor } from '../presets';

export const M_PER_DEG_LAT = 110540;

export interface Projection {
  toXY(lat: number, lon: number): Vec;
  toLatLon(p: Vec): { lat: number; lon: number };
}

/** Local equirectangular projection in meters around an origin. */
export function makeProjection(lat0: number, lon0: number): Projection {
  const kx = 111320 * Math.cos(lat0 * RAD);
  return {
    toXY: (lat, lon) => ({ x: (lon - lon0) * kx, y: (lat - lat0) * M_PER_DEG_LAT }),
    toLatLon: (p) => ({ lat: lat0 + p.y / M_PER_DEG_LAT, lon: lon0 + p.x / kx }),
  };
}

export function distToSegment(p: Vec, a: Vec, b: Vec): number {
  const abx = b.x - a.x, aby = b.y - a.y;
  const l2 = abx * abx + aby * aby;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / l2)) : 0;
  return Math.hypot(p.x - (a.x + t * abx), p.y - (a.y + t * aby));
}

export function distToPolyline(p: Vec, pts: Vec[]): number {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) best = Math.min(best, distToSegment(p, pts[i], pts[i + 1]));
  return best;
}

/** Linear interpolation of monthly GHI between distance anchors, clamped at the ends. */
export function interpAnchors(km: number, anchors: GhiAnchor[], month0: number): number {
  if (km <= anchors[0].km) return anchors[0].monthly[month0];
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i], b = anchors[i + 1];
    if (km <= b.km) {
      const t = (km - a.km) / (b.km - a.km);
      return a.monthly[month0] + t * (b.monthly[month0] - a.monthly[month0]);
    }
  }
  return anchors[anchors.length - 1].monthly[month0];
}
