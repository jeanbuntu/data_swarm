import { useMemo, useState } from 'react';
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { useFleet } from '../../state/store';
import { useOptimizer } from '../../state/useOptimizer';
import { AXIS_OPTIONS, RANGE_OPTIONS, METRICS, metricValue, applyAxis, type Metric, type Evaluation } from '../../model/optimizer';
import { setPath } from '../../model/config';
import { PRESET_LISTS } from '../../model/defaults';
import { PARAM_LABELS, SLIDER_BOUNDS } from '../panelDefs';
import { fmtCompact, fmtMonths, fmtNum, fmtUsd, fmtUsdCompact } from '../format';
import { AXIS_PROPS, GRID_PROPS } from '../chartTheme';

function fmtMetric(ev: Evaluation, m: Metric): string {
  switch (m) {
    case 'pflopHours': return `${fmtCompact(ev.pflopHours)} PFLOP-h`;
    case 'costPerGpuHour': return fmtUsd(ev.costPerGpuHour, 2);
    case 'marginPerGpuHour': return fmtUsd(ev.marginPerGpuHour, 2);
    case 'marginYear': return fmtUsdCompact(ev.marginYear);
    case 'marginAfterCapitalYear': return fmtUsdCompact(ev.marginAfterCapitalYear);
    case 'paybackMonths': return fmtMonths(ev.paybackMonths);
  }
}

function valueLabel(axisIdx: number, v: number | string): string {
  const a = AXIS_OPTIONS[axisIdx];
  if (a.kind === 'preset') return PRESET_LISTS[a.preset].find((p) => p.id === v)?.name ?? String(v);
  return typeof v === 'number' ? fmtNum(v, Number.isInteger(v) ? 0 : 2) : v;
}

function SweepPanel() {
  const cfg = useFleet((s) => s.cfg);
  const opt = useOptimizer();
  const [xi, setXi] = useState(0);
  const [yi, setYi] = useState(1);
  const [metric, setMetric] = useState<Metric>('marginPerGpuHour');
  const [ran, setRan] = useState<{ xi: number; yi: number } | null>(null);
  const result = opt.response?.kind === 'sweep' ? opt.response.result : null;
  const better = METRICS.find((m) => m.id === metric)!.better;

  const scale = useMemo(() => {
    if (!result) return null;
    const vals = result.cells.flat().filter((e) => e.feasible).map((e) => metricValue(e, metric)).filter(Number.isFinite);
    return vals.length ? { lo: Math.min(...vals), hi: Math.max(...vals) } : null;
  }, [result, metric]);

  const best = useMemo(() => {
    if (!result) return null;
    let b: [number, number] | null = null;
    let bv = better === 'high' ? -Infinity : Infinity;
    result.cells.forEach((row, y) =>
      row.forEach((ev, x) => {
        const v = metricValue(ev, metric);
        if (!ev.feasible || !Number.isFinite(v)) return;
        if (better === 'high' ? v > bv : v < bv) {
          bv = v;
          b = [x, y];
        }
      }),
    );
    return b as [number, number] | null;
  }, [result, metric, better]);

  const color = (ev: Evaluation): string | undefined => {
    if (!ev.feasible || !scale) return undefined;
    const v = metricValue(ev, metric);
    if (!Number.isFinite(v)) return undefined;
    let t = scale.hi > scale.lo ? (v - scale.lo) / (scale.hi - scale.lo) : 1;
    if (better === 'low') t = 1 - t;
    return `color-mix(in oklab, var(--c1) ${Math.round(12 + t * 88)}%, var(--panel))`;
  };

  const apply = (x: number, y: number) => {
    if (!result || !ran) return;
    const ax = AXIS_OPTIONS[ran.xi], ay = AXIS_OPTIONS[ran.yi];
    useFleet.getState().replace(applyAxis(applyAxis(cfg, ax, result.xs[x]), ay, result.ys[y]));
    useFleet.getState().setNotice(`Applied ${ax.label} = ${valueLabel(ran.xi, result.xs[x])} and ${ay.label} = ${valueLabel(ran.yi, result.ys[y])}.`);
  };

  return (
    <section className="card">
      <h2>Two-parameter sweep</h2>
      <div className="controls-row">
        <label className="field">
          <span>X axis</span>
          <select value={xi} onChange={(e) => setXi(Number(e.target.value))}>
            {AXIS_OPTIONS.map((a, i) => (
              <option key={a.label} value={i} disabled={i === yi}>{a.label}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Y axis</span>
          <select value={yi} onChange={(e) => setYi(Number(e.target.value))}>
            {AXIS_OPTIONS.map((a, i) => (
              <option key={a.label} value={i} disabled={i === xi}>{a.label}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Color by</span>
          <select value={metric} onChange={(e) => setMetric(e.target.value as Metric)}>
            {METRICS.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </label>
        <button
          className="primary"
          disabled={opt.busy}
          onClick={() => {
            opt.run({ kind: 'sweep', cfg, ax: AXIS_OPTIONS[xi], ay: AXIS_OPTIONS[yi] });
            setRan({ xi, yi });
          }}
        >
          {opt.busy ? 'Running' : 'Run sweep'}
        </button>
        {opt.progress && <span className="muted">{opt.progress[0]} of {opt.progress[1]} configurations</span>}
      </div>
      {opt.error && <p className="error-text">{opt.error}</p>}
      {result && ran && (
        <div className="table-scroll">
          <div className="heatmap" style={{ gridTemplateColumns: `minmax(120px, auto) repeat(${result.xs.length}, minmax(72px, 1fr))` }}>
            <div className="hm-corner">{AXIS_OPTIONS[ran.yi].label} by {AXIS_OPTIONS[ran.xi].label}</div>
            {result.xs.map((x, i) => (
              <div key={`x${i}`} className="hm-head">{valueLabel(ran.xi, x)}</div>
            ))}
            {result.cells.map((row, y) => [
              <div key={`y${y}`} className="hm-head hm-row">{valueLabel(ran.yi, result.ys[y])}</div>,
              ...row.map((ev, x) => {
                const isBest = !!best && best[0] === x && best[1] === y;
                return (
                  <button
                    key={`${x}-${y}`}
                    className={`hm-cell${ev.feasible ? '' : ' infeasible'}${isBest ? ' best' : ''}`}
                    style={{ background: color(ev) }}
                    title={`${fmtMetric(ev, metric)}${ev.feasible ? '' : ', fails a feasibility check'}. Click to load.`}
                    onClick={() => apply(x, y)}
                  >
                    {fmtMetric(ev, metric)}
                  </button>
                );
              }),
            ])}
          </div>
        </div>
      )}
      <p className="note">Each cell runs the representative-day model (36 days, 4 sampled modules). Hatched cells fail a feasibility check. The outlined cell is the best feasible one. Click a cell to load it into the sliders.</p>
    </section>
  );
}

interface Pt { i: number; capex: number; pflop: number; margin: number; feasible: boolean; values: Record<string, number> }

function ParetoTip({ active, payload }: { active?: boolean; payload?: { payload: Pt }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="tip">
      <div>Capex {fmtUsdCompact(p.capex)}</div>
      <div>{fmtCompact(p.pflop)} PFLOP-h per year</div>
      <div>Margin {fmtUsd(p.margin, 2)} per GPU-hour</div>
      {Object.entries(p.values).map(([k, v]) => (
        <div key={k} className="muted">{PARAM_LABELS[k] ?? k}: {fmtNum(v, 2)}</div>
      ))}
    </div>
  );
}

function ParetoPanel() {
  const cfg = useFleet((s) => s.cfg);
  const opt = useOptimizer();
  const [ranges, setRanges] = useState(RANGE_OPTIONS.map((r) => ({ ...r, on: ['battery.kwh', 'compute.cards', 'hull.petalLengthM'].includes(r.path) })));
  const [n, setN] = useState(200);
  const result = opt.response?.kind === 'pareto' ? opt.response.result : null;
  const front = new Set(result?.frontier ?? []);
  const pts: Pt[] = result
    ? result.points.map((p, i) => ({ i, capex: p.ev.capexTotal, pflop: p.ev.pflopHours, margin: p.ev.marginPerGpuHour, feasible: p.ev.feasible, values: p.values }))
    : [];
  const apply = (raw: unknown) => {
    const pt = ((raw as { payload?: Pt })?.payload ?? raw) as Pt | undefined;
    if (!pt?.values) return;
    let c = cfg;
    for (const [k, v] of Object.entries(pt.values)) c = setPath(c, k, v);
    useFleet.getState().replace(c);
    useFleet.getState().setNotice('Loaded the selected configuration into the sliders.');
  };
  const setRange = (k: number, patch: Partial<(typeof ranges)[number]>) =>
    setRanges((rs) =>
      rs.map((x, j) => {
        if (j !== k) return x;
        const next = { ...x, ...patch };
        const [lo, hi] = SLIDER_BOUNDS[x.path] ?? [-Infinity, Infinity];
        const clamp = (v: number) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : x.min);
        return { ...next, min: clamp(next.min), max: clamp(next.max) };
      }),
    );

  return (
    <section className="card">
      <h2>Best trade-offs: capex against delivered compute</h2>
      <div className="range-grid">
        {ranges.map((r, k) => (
          <div key={r.path} className="range-row">
            <label className="toggle-field">
              <input type="checkbox" checked={r.on} onChange={(e) => setRange(k, { on: e.target.checked })} /> {r.label}
            </label>
            <input type="number" step="any" value={r.min} aria-label={`${r.label} minimum`} onChange={(e) => setRange(k, { min: Number(e.target.value) })} />
            <span className="muted">to</span>
            <input type="number" step="any" value={r.max} aria-label={`${r.label} maximum`} onChange={(e) => setRange(k, { max: Number(e.target.value) })} />
          </div>
        ))}
      </div>
      <div className="controls-row">
        <label className="field">
          <span>Samples</span>
          <input type="number" min={20} max={1000} step={10} value={n} onChange={(e) => setN(Math.max(20, Math.min(1000, Number(e.target.value) || 200)))} />
        </label>
        <button
          className="primary"
          disabled={opt.busy || !ranges.some((r) => r.on && r.max > r.min)}
          onClick={() => opt.run({ kind: 'pareto', cfg, ranges: ranges.filter((r) => r.on && r.max > r.min).map(({ on: _on, ...r }) => r), n, seed: cfg.seed })}
        >
          {opt.busy ? 'Running' : 'Sample configurations'}
        </button>
        {opt.progress && <span className="muted">{opt.progress[0]} of {opt.progress[1]}</span>}
      </div>
      {opt.error && <p className="error-text">{opt.error}</p>}
      {result && (
        <ResponsiveContainer width="100%" height={380}>
          <ScatterChart margin={{ top: 8, right: 24, bottom: 24, left: 8 }}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis type="number" dataKey="capex" name="Swarm capex" tickFormatter={(v) => fmtUsdCompact(Number(v))} {...AXIS_PROPS} label={{ value: 'Swarm capex', position: 'insideBottom', offset: -12, fill: 'var(--muted)' }} />
            <YAxis type="number" dataKey="pflop" name="PFLOP-h per year" tickFormatter={(v) => fmtCompact(Number(v))} {...AXIS_PROPS} />
            <ZAxis range={[40, 40]} />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<ParetoTip />} />
            <Legend />
            <Scatter name="Feasible" data={pts.filter((p) => p.feasible && !front.has(p.i))} fill="var(--c6)" fillOpacity={0.5} onClick={apply} isAnimationActive={false} />
            <Scatter name="Infeasible" data={pts.filter((p) => !p.feasible)} fill="var(--c5)" fillOpacity={0.35} isAnimationActive={false} />
            <Scatter name="Best trade-offs" data={pts.filter((p) => front.has(p.i)).sort((a, b) => a.capex - b.capex)} fill="var(--c1)" line={{ stroke: 'var(--c1)' }} onClick={apply} isAnimationActive={false} />
          </ScatterChart>
        </ResponsiveContainer>
      )}
      <p className="note">Blue points joined by a line are the best trade-offs: no other sampled configuration delivers more compute for less capital. Click a point to load it into the sliders.</p>
    </section>
  );
}

export function OptimizerTab() {
  return (
    <div className="tab-body">
      <SweepPanel />
      <ParetoPanel />
    </div>
  );
}
