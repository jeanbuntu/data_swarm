import { useEffect, useRef } from 'react';
import type { LiveSim } from '../../model/live';
import { add, type Vec } from '../../model/vec';
import { moduleRole } from '../../model/derive';
import { cssVar, setupCanvas } from './canvasUtil';

function niceMeters(v: number): number {
  const p = 10 ** Math.floor(Math.log10(Math.max(1, v)));
  const m = v / p;
  return (m >= 5 ? 5 : m >= 2 ? 2 : 1) * p;
}

function arrow(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: string) {
  const a = Math.atan2(y1 - y0, x1 - x0);
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.stroke();
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x1 - 8 * Math.cos(a - 0.4), y1 - 8 * Math.sin(a - 0.4));
  g.lineTo(x1 - 8 * Math.cos(a + 0.4), y1 - 8 * Math.sin(a + 0.4));
  g.closePath();
  g.fill();
}

function drawFlower(g: CanvasRenderingContext2D, x: number, y: number, r: number, petals: number, stowed: boolean, color: string) {
  g.save();
  g.translate(x, y);
  g.fillStyle = color;
  const pr = stowed ? r * 0.45 : r;
  g.globalAlpha = 0.85;
  for (let k = 0; k < petals; k++) {
    g.save();
    g.rotate((2 * Math.PI * k) / petals);
    g.beginPath();
    g.ellipse(pr * 0.55, 0, pr * 0.45, Math.max(1, pr * 0.18), 0, 0, 2 * Math.PI);
    g.fill();
    g.restore();
  }
  g.globalAlpha = 1;
  const s = Math.max(3, r * 0.45);
  g.fillRect(-s / 2, -s / 2, s, s);
  g.restore();
}

export function FormationCanvas({ sim, frame }: { sim: LiveSim; frame: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = setupCanvas(ref.current);
    if (!ctx) return;
    const { g, W, H } = ctx;
    const { swarm, params, cfg, flows } = sim;
    const c0 = swarm.centroid;
    const radius = Math.max(1, ...params.slots.map((s) => Math.hypot(s.x, s.y)));
    const extent = Math.max(radius + cfg.swarm.breakawayM * 1.2, 100);
    const k = Math.min(W, H) / (2 * extent);
    const toPx = (p: Vec) => ({ x: W / 2 + (p.x - c0.x) * k, y: H / 2 - (p.y - c0.y) * k });

    g.fillStyle = cssVar('--panel-2');
    g.fillRect(0, 0, W, H);

    g.setLineDash([4, 4]);
    g.globalAlpha = 0.6;
    g.strokeStyle = cssVar('--warn');
    g.lineWidth = 1;
    g.beginPath();
    g.arc(W / 2, H / 2, (radius + cfg.swarm.breakawayM) * k, 0, 2 * Math.PI);
    g.stroke();
    g.globalAlpha = 1;
    g.strokeStyle = cssVar('--border');
    for (const s of params.slots) {
      const q = toPx(add(c0, s));
      g.beginPath();
      g.arc(q.x, q.y, Math.max(2, cfg.swarm.toleranceM * k), 0, 2 * Math.PI);
      g.stroke();
    }
    g.setLineDash([]);

    const recent = sim.jobs.recentDone.filter((r) => sim.t - r.t <= sim.dtS * 2000);
    g.strokeStyle = cssVar('--c2');
    g.globalAlpha = 0.55;
    g.lineWidth = 1;
    for (const r of recent) {
      const m = swarm.modules[r.module];
      if (!m) continue;
      const q = toPx(m.pos);
      g.beginPath();
      g.moveTo(q.x, q.y);
      g.lineTo(q.x + 12, 0);
      g.stroke();
    }
    g.globalAlpha = 1;

    const accent = cssVar('--accent'), warn = cssVar('--warn'), muted = cssVar('--muted');
    const glyph = Math.max(5, (cfg.hull.sideM / 2 + cfg.hull.petalLengthM) * k);
    swarm.modules.forEach((m, i) => {
      const q = toPx(m.pos);
      const f = flows[i];
      const color = f && !f.online ? muted : m.stray ? warn : accent;
      drawFlower(g, q.x, q.y, glyph, cfg.hull.petalCount, sim.stowed, color);
      if (moduleRole(cfg, i) === 'master') {
        // Masters carry Starlink: mark them with a ring.
        g.strokeStyle = cssVar('--text');
        g.lineWidth = 1.5;
        g.beginPath();
        g.arc(q.x, q.y, glyph + 4, 0, 2 * Math.PI);
        g.stroke();
      }
    });

    const cur = sim.env.current(sim.t);
    const sp = Math.hypot(cur.x, cur.y);
    const L = Math.min(60, sp * 150);
    const ax = 60, ay = H - 44;
    if (sp > 0) arrow(g, ax, ay, ax + (cur.x / sp) * L, ay - (cur.y / sp) * L, cssVar('--accent-2'));
    g.font = `12px ${cssVar('--font')}`;
    g.fillStyle = cssVar('--text');
    g.fillText(`Current ${sp.toFixed(2)} m/s`, 16, H - 12);

    const nice = niceMeters(extent / 2);
    const bar = nice * k;
    g.strokeStyle = cssVar('--text');
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(W - 20 - bar, H - 20);
    g.lineTo(W - 20, H - 20);
    g.stroke();
    g.fillText(`${nice} m`, W - 20 - bar, H - 26);
    g.fillStyle = cssVar('--muted');
    g.fillText(cfg.comms.hubMode ? 'Ringed nodes are masters with Starlink. Lines to the top edge: jobs returned' : 'Lines to the top edge: jobs returned over Starlink', 16, 18);
  }, [sim, frame]);

  return <canvas ref={ref} className="formation-canvas" role="img" aria-label="Zoomed view of the formation, tolerance rings, strays and returning jobs" />;
}
