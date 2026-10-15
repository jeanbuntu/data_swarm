import { useEffect, useRef } from 'react';
import type { LiveSim } from '../../model/live';
import type { Env } from '../../model/environment';
import { clearSkyGhi } from '../../model/solar';
import { RAD } from '../../model/constants';
import { LAND_POLYGON, ISLANDS, MAP_BOUNDS } from '../../presets';
import { cssVar, setupCanvas } from './canvasUtil';

const GW = 64;
const GH = 44;

export function MapCanvas({ sim, frame }: { sim: LiveSim; frame: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const fence = useRef<{ key: string; mask: Uint8Array } | null>(null);
  const clouds = useRef<{ env: Env; bucket: number; ratio: Float32Array } | null>(null);

  useEffect(() => {
    const ctx = setupCanvas(ref.current);
    if (!ctx) return;
    const { g, W, H } = ctx;
    const B = MAP_BOUNDS;
    const px = (lat: number, lon: number) => ({
      x: ((lon - B.lonMin) / (B.lonMax - B.lonMin)) * W,
      y: ((B.latMax - lat) / (B.latMax - B.latMin)) * H,
    });
    const cellLL = (i: number, j: number) => ({
      lat: B.latMax - ((j + 0.5) * (B.latMax - B.latMin)) / GH,
      lon: B.lonMin + ((i + 0.5) * (B.lonMax - B.lonMin)) / GW,
    });
    const { env, cfg } = sim;

    const fkey = `${cfg.swarm.minOffshoreKm}|${cfg.swarm.maxOffshoreKm}|${cfg.env.originLat}|${cfg.env.originLon}`;
    if (!fence.current || fence.current.key !== fkey) {
      const mask = new Uint8Array(GW * GH);
      for (let j = 0; j < GH; j++) {
        for (let i = 0; i < GW; i++) {
          const ll = cellLL(i, j);
          const p = env.proj.toXY(ll.lat, ll.lon);
          const dk = env.offshoreKm(p.x, p.y);
          mask[j * GW + i] = dk < cfg.swarm.minOffshoreKm || dk > cfg.swarm.maxOffshoreKm ? 1 : 0;
        }
      }
      fence.current = { key: fkey, mask };
    }

    const sun = env.sun(sim.t);
    const bucket = Math.floor(sim.t / 1800000);
    if (!clouds.current || clouds.current.env !== env || clouds.current.bucket !== bucket) {
      const ratio = new Float32Array(GW * GH);
      const clear = clearSkyGhi(sun.zenithDeg);
      for (let j = 0; j < GH; j++) {
        for (let i = 0; i < GW; i++) {
          const ll = cellLL(i, j);
          const p = env.proj.toXY(ll.lat, ll.lon);
          ratio[j * GW + i] = clear > 1 ? env.ghi(sim.t, p.x, p.y) / clear : 0;
        }
      }
      clouds.current = { env, bucket, ratio };
    }

    g.fillStyle = cssVar('--ocean');
    g.fillRect(0, 0, W, H);
    const cw = W / GW, ch = H / GH;
    const cloudRgb = cssVar('--cloud');
    const fenceRgb = cssVar('--fence');
    const day = sun.elevationDeg > 0;
    for (let j = 0; j < GH; j++) {
      for (let i = 0; i < GW; i++) {
        const k = j * GW + i;
        if (day) {
          const a = Math.max(0, Math.min(0.75, (1 - clouds.current.ratio[k]) * 0.9));
          if (a > 0.02) {
            g.fillStyle = `rgba(${cloudRgb},${a.toFixed(3)})`;
            g.fillRect(i * cw, j * ch, cw + 0.5, ch + 0.5);
          }
        }
        if (fence.current.mask[k]) {
          g.fillStyle = `rgba(${fenceRgb},0.10)`;
          g.fillRect(i * cw, j * ch, cw + 0.5, ch + 0.5);
        }
      }
    }
    if (!day) {
      g.fillStyle = 'rgba(0, 0, 20, 0.35)';
      g.fillRect(0, 0, W, H);
    }

    g.beginPath();
    LAND_POLYGON.forEach(([la, lo], idx) => {
      const q = px(la, lo);
      if (idx) g.lineTo(q.x, q.y);
      else g.moveTo(q.x, q.y);
    });
    g.closePath();
    g.fillStyle = cssVar('--land');
    g.fill();
    g.strokeStyle = cssVar('--land-edge');
    g.lineWidth = 1;
    g.stroke();

    const kmX = W / ((B.lonMax - B.lonMin) * 111.32 * Math.cos(33.6 * RAD));
    const kmY = H / ((B.latMax - B.latMin) * 110.54);
    for (const isl of ISLANDS) {
      const q = px(isl.lat, isl.lon);
      g.beginPath();
      g.ellipse(q.x, q.y, Math.max(1.5, isl.rxKm * kmX), Math.max(1.5, isl.ryKm * kmY), 0, 0, 2 * Math.PI);
      g.fill();
      g.stroke();
    }

    const trail = sim.swarm.trail;
    if (trail.length > 1) {
      g.strokeStyle = cssVar('--accent-2');
      g.lineWidth = 1.5;
      g.beginPath();
      trail.forEach((p, idx) => {
        const ll = env.proj.toLatLon(p);
        const q = px(ll.lat, ll.lon);
        if (idx) g.lineTo(q.x, q.y);
        else g.moveTo(q.x, q.y);
      });
      g.stroke();
    }

    const cl = env.proj.toLatLon(sim.swarm.centroid);
    const q = px(cl.lat, cl.lon);
    g.fillStyle = cssVar('--accent');
    g.beginPath();
    g.arc(q.x, q.y, 6, 0, 2 * Math.PI);
    g.fill();
    g.strokeStyle = cssVar('--panel');
    g.lineWidth = 2;
    g.stroke();

    g.font = `12px ${cssVar('--font')}`;
    g.fillStyle = cssVar('--text');
    const label = (text: string, lat: number, lon: number, dx = 6, dy = -6) => {
      const p = px(lat, lon);
      g.fillText(text, p.x + dx, p.y + dy);
    };
    label('Los Angeles', 34.05, -118.24);
    label('San Diego', 32.72, -117.16);
    label('Fleet swarm', cl.lat, cl.lon, 10, 4);
    g.fillStyle = cssVar('--muted');
    g.fillText('White: cloud and marine layer. Red tint: outside the geofence.', 10, H - 10);
  }, [sim, frame]);

  return <canvas ref={ref} className="map-canvas" role="img" aria-label="Map of the swarm position, cloud cover and geofence off Southern California" />;
}
