import { useCallback, useEffect, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, AreaChart, Area, ReferenceLine, CartesianGrid, Legend } from 'recharts';
import type { Econ } from '../../model/economics';
import type { SimConfig } from '../../model/config';
import { useOptimizer } from '../../state/useOptimizer';
import { Stat } from '../controls';
import { fmtCompact, fmtMonths, fmtNum, fmtPct, fmtUsd, fmtUsdCompact } from '../format';
import { TOOLTIP_STYLE, AXIS_PROPS, GRID_PROPS } from '../chartTheme';

export function EconomicsHeadline({ econ, cfg }: { econ: Econ; cfg: SimConfig }) {
  return (
    <div className="stats-row">
      <Stat label="Revenue per year" value={fmtUsdCompact(econ.revenue.total)} sub={`${fmtUsdCompact(econ.revenue.firm)} firm, ${fmtUsdCompact(econ.revenue.spot)} spot`} />
      <Stat label="Opex per year" value={fmtUsdCompact(econ.opexTotal)} />
      <Stat label="Gross margin per year" value={fmtUsdCompact(econ.grossMargin)} tone={econ.grossMargin >= 0 ? 'good' : 'bad'} />
      <Stat label="Cost per GPU-hour" value={fmtUsd(econ.costPerGpuHour, 2)} sub={`Market ${fmtUsd(econ.marketFirm, 2)} firm, ${fmtUsd(econ.marketSpot, 2)} spot`} />
      <Stat label="Margin per GPU-hour" value={fmtUsd(econ.marginPerGpuHour, 2)} sub="After amortized capital" tone={econ.marginPerGpuHour >= 0 ? 'good' : 'bad'} />
      <Stat label="Delivered GPU-hours" value={fmtCompact(econ.gpuHours)} sub={`${fmtCompact(econ.firmGpuHours)} firm, ${fmtCompact(econ.spotGpuHours)} spot`} />
      <Stat label="Capex per module" value={fmtUsd(econ.capex.perModule)} />
      <Stat label="Swarm capex" value={fmtUsdCompact(econ.capex.total)} sub={`${fmtNum(econ.capex.fleetModules, 1)} modules incl. spares`} />
      <Stat label="NPV" value={fmtUsdCompact(econ.npv)} sub={`${fmtPct(cfg.econ.discountRate)} over ${cfg.econ.horizonYears} years`} tone={econ.npv >= 0 ? 'good' : 'bad'} />
      <Stat label="IRR" value={econ.irr === null ? 'n/a' : fmtPct(econ.irr, 1)} />
      <Stat label="Payback" value={fmtMonths(econ.paybackMonths)} />
      <Stat label="Firm availability" value={econ.availability === null ? 'No firm tier' : fmtPct(econ.availability, 1)} sub={`Target ${fmtPct(cfg.econ.slaTarget, 1)}`} />
      <Stat label="Levelized cost of compute" value={`${fmtUsd(econ.lcocPerPflopHour, 2)} / PFLOP-h`} />
    </div>
  );
}

export function CapexChart({ econ }: { econ: Econ }) {
  const data = [...econ.moduleCapex.lines]
    .filter((l) => l.usd > 0)
    .sort((a, b) => b.usd - a.usd)
    .map((l) => ({ label: l.label, usd: Math.round(l.usd), estimate: l.estimate }));
  return (
    <section className="card">
      <h2>Capex per module: {fmtUsd(econ.moduleCapex.total)}</h2>
      <ResponsiveContainer width="100%" height={Math.max(240, data.length * 28)}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 56, bottom: 4, left: 8 }}>
          <XAxis type="number" tickFormatter={(v) => fmtUsdCompact(Number(v))} {...AXIS_PROPS} />
          <YAxis type="category" dataKey="label" width={190} {...AXIS_PROPS} />
          <Tooltip {...TOOLTIP_STYLE} formatter={(v) => fmtUsd(Number(v))} />
          <Bar dataKey="usd" name="Cost" isAnimationActive={false} label={{ position: 'right', formatter: (v: unknown) => fmtUsdCompact(Number(v)), fill: 'var(--muted)', fontSize: 11 }}>
            {data.map((d) => (
              <Cell key={d.label} fill={d.estimate ? 'var(--c3)' : 'var(--c1)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="note">Blue bars use sourced prices. Yellow bars are estimates that need vendor quotes.</p>
    </section>
  );
}

export function CashflowChart({ econ }: { econ: Econ }) {
  const data: { year: number; cum: number }[] = [];
  econ.flows.forEach((f, i) => data.push({ year: i, cum: (i ? data[i - 1].cum : 0) + f }));
  return (
    <section className="card">
      <h2>Cumulative cash, payback {fmtMonths(econ.paybackMonths)}</h2>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 12, right: 16, bottom: 4, left: 8 }}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="year" {...AXIS_PROPS} label={{ value: 'Year', position: 'insideBottomRight', offset: -2, fill: 'var(--muted)' }} />
          <YAxis tickFormatter={(v) => fmtUsdCompact(Number(v))} {...AXIS_PROPS} />
          <Tooltip {...TOOLTIP_STYLE} formatter={(v) => fmtUsd(Number(v))} labelFormatter={(y) => `Year ${y}`} />
          <ReferenceLine y={0} stroke="var(--text)" />
          <Area type="monotone" dataKey="cum" name="Cumulative cash" stroke="var(--c2)" fill="var(--c2)" fillOpacity={0.15} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </section>
  );
}

export function PnlTable({ econ, cfg }: { econ: Econ; cfg: SimConfig }) {
  const n = cfg.swarm.count;
  const rows: [string, number, boolean?][] = [
    ['Firm revenue', econ.revenue.firm],
    ['Spot revenue', econ.revenue.spot],
    ['SLA penalty', -econ.revenue.slaPenalty],
    ['Revenue', econ.revenue.total, true],
    ...econ.opexLines.map((l) => [l.label, -l.usd] as [string, number]),
    ['Opex', -econ.opexTotal, true],
    ['Gross margin', econ.grossMargin, true],
    ['Capital recovery (capex amortized, accelerators over their refresh life)', -econ.annualCapital],
    ['Margin after capital', econ.grossMargin - econ.annualCapital, true],
  ];
  return (
    <section className="card">
      <h2>Annual P&amp;L</h2>
      <div className="table-scroll">
        <table className="data">
          <thead>
            <tr>
              <th>Item</th>
              <th className="num">Swarm per year</th>
              <th className="num">Per module per year</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, v, strong]) => (
              <tr key={label} className={strong ? 'strong' : undefined}>
                <td>{label}</td>
                <td className="num">{fmtUsd(v)}</td>
                <td className="num">{fmtUsd(v / n)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function TornadoPanel({ cfg }: { cfg: SimConfig }) {
  const opt = useOptimizer();
  const [ranFor, setRanFor] = useState<SimConfig | null>(null);
  const { run } = opt;
  const start = useCallback(() => {
    run({ kind: 'tornado', cfg });
    setRanFor(cfg);
  }, [cfg, run]);
  useEffect(() => {
    if (!ranFor) start();
    // Run once when the panel first appears; later runs are on request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const result = opt.response?.kind === 'tornado' ? opt.response.result : null;
  const stale = ranFor !== null && ranFor !== cfg;
  const data = result ? result.rows.map((r) => ({ label: r.label, low: r.low - result.base, high: r.high - result.base })) : [];
  return (
    <section className="card">
      <div className="row-between">
        <h2>Sensitivity: margin per GPU-hour when each input moves 20%</h2>
        <button onClick={start} disabled={opt.busy}>{opt.busy ? 'Running' : stale ? 'Re-run for current inputs' : 'Re-run'}</button>
      </div>
      {opt.progress && <p className="muted">{opt.progress[0]} of {opt.progress[1]} model runs</p>}
      {opt.error && <p className="error-text">{opt.error}</p>}
      {result && (
        <>
          <p className="note">Baseline {fmtUsd(result.base, 2)} per GPU-hour from the faster representative-day model, so it can differ slightly from the headline figure. Bars show the change from baseline.{stale ? ' Inputs changed since this run.' : ''}</p>
          <ResponsiveContainer width="100%" height={Math.max(260, data.length * 30)}>
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }}>
              <CartesianGrid {...GRID_PROPS} />
              <XAxis type="number" tickFormatter={(v) => fmtUsd(Number(v), 2)} {...AXIS_PROPS} />
              <YAxis type="category" dataKey="label" width={150} {...AXIS_PROPS} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v) => fmtUsd(Number(v), 3)} />
              <Legend />
              <ReferenceLine x={0} stroke="var(--text)" />
              <Bar dataKey="low" name="Input 20% lower" fill="var(--c5)" isAnimationActive={false} />
              <Bar dataKey="high" name="Input 20% higher" fill="var(--c1)" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </>
      )}
    </section>
  );
}
