import { useDeferredValue, useMemo, useState } from 'react';
import { ResponsiveContainer, ComposedChart, LineChart, BarChart, Area, Line, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { useFleet } from '../../state/store';
import { runLiveDay } from '../../model/live';
import { dateLabel } from '../../model/time';
import { dayEnergy, monthlySeries } from './dayEnergy';
import { utilization } from '../../model/metrics';
import { Stat } from '../controls';
import { fmtHour, fmtNum, fmtPct } from '../format';
import { TOOLTIP_STYLE, AXIS_PROPS, GRID_PROPS } from '../chartTheme';

const HOUR_TICKS = [0, 3, 6, 9, 12, 15, 18, 21, 24];
const hourAxis = { dataKey: 'hour', type: 'number' as const, domain: [0, 24], ticks: HOUR_TICKS, tickFormatter: (h: number) => fmtHour(Number(h)) };

export function EnergyTab() {
  const cfg = useDeferredValue(useFleet((s) => s.cfg));
  const annual = useFleet((s) => s.annual);
  const [doy, setDoy] = useState(172);
  const sim = useMemo(() => runLiveDay(cfg, doy), [cfg, doy]);
  const e = dayEnergy(sim.history, sim.dtS);
  const data = sim.history.map((p) => ({
    hour: Number(p.hour.toFixed(3)),
    pv: p.pvW,
    loads: Math.max(0, p.essentialW - p.propulsionW),
    propulsion: p.propulsionW,
    compute: p.computeW,
    curtailed: p.curtailedW,
    ghi: p.ghi,
    soc: p.socFrac * 100,
  }));
  const monthly = annual ? monthlySeries(annual) : null;
  const util = annual ? utilization(cfg, annual) : null;

  return (
    <div className="tab-body">
      <section className="card">
        <div className="row-between">
          <h2>One day, average module ({dateLabel(doy)})</h2>
          <label className="field">
            <span>Day {dateLabel(doy)}</span>
            <input type="range" min={1} max={365} value={doy} onChange={(ev) => setDoy(Number(ev.target.value))} />
          </label>
        </div>
        <div className="stats-row">
          <Stat label="Solar" value={`${fmtNum(e.pvKwh, 2)} kWh`} />
          <Stat label="Compute" value={`${fmtNum(e.computeKwh, 2)} kWh`} />
          <Stat label="Avionics and Starlink" value={`${fmtNum(e.loadsKwh, 2)} kWh`} />
          <Stat label="Propulsion" value={`${fmtNum(e.propulsionKwh, 3)} kWh`} />
          <Stat label="Curtailed" value={`${fmtNum(e.curtailedKwh, 2)} kWh`} />
        </div>
        <h3>Power per module (W)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis {...hourAxis} {...AXIS_PROPS} />
            <YAxis {...AXIS_PROPS} />
            <Tooltip {...TOOLTIP_STYLE} labelFormatter={(h) => fmtHour(Number(h))} formatter={(v) => `${fmtNum(Number(v))} W`} />
            <Legend />
            <Area type="monotone" dataKey="pv" name="Solar" stroke="var(--c3)" fill="var(--c3)" fillOpacity={0.18} strokeWidth={2} isAnimationActive={false} />
            <Line type="monotone" dataKey="compute" name="Compute" stroke="var(--c1)" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="loads" name="Avionics and Starlink" stroke="var(--c6)" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="propulsion" name="Propulsion" stroke="var(--c4)" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="curtailed" name="Curtailed" stroke="var(--c5)" strokeWidth={2} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="grid2">
          <div>
            <h3>Sunlight reaching the swarm (W/m²)</h3>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
                <CartesianGrid {...GRID_PROPS} />
                <XAxis {...hourAxis} {...AXIS_PROPS} />
                <YAxis {...AXIS_PROPS} />
                <Tooltip {...TOOLTIP_STYLE} labelFormatter={(h) => fmtHour(Number(h))} formatter={(v) => `${fmtNum(Number(v))} W/m²`} />
                <Line type="monotone" dataKey="ghi" name="Irradiance" stroke="var(--c2)" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div>
            <h3>Average battery charge (%)</h3>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
                <CartesianGrid {...GRID_PROPS} />
                <XAxis {...hourAxis} {...AXIS_PROPS} />
                <YAxis domain={[0, 100]} {...AXIS_PROPS} />
                <Tooltip {...TOOLTIP_STYLE} labelFormatter={(h) => fmtHour(Number(h))} formatter={(v) => `${fmtNum(Number(v))}%`} />
                <Line type="monotone" dataKey="soc" name="Battery" stroke="var(--c1)" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
      <section className="card">
        <h2>Across the year (average module, average day in each month)</h2>
        {util && (
          <div className="stats-row">
            <Stat label="Card utilization" value={fmtPct(util.cardUtilization)} sub="Delivered compute over every card at full power, all year" />
            <Stat label="Starlink link utilization" value={fmtPct(util.linkUtilization)} sub="Data moved over unthrottled link capacity" />
            <Stat label="Hours limited by power" value={fmtPct(util.bindingShare.power)} />
            <Stat label="Hours limited by bandwidth" value={fmtPct(util.bindingShare.bandwidth)} />
            <Stat label="Hours limited by demand" value={fmtPct(util.bindingShare.demand)} />
          </div>
        )}
        {monthly ? (
          <>
            <h3>Energy per module per day (kWh)</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthly} margin={{ top: 8, right: 16, bottom: 4, left: 8 }} barGap={2}>
                <CartesianGrid {...GRID_PROPS} />
                <XAxis dataKey="month" {...AXIS_PROPS} />
                <YAxis {...AXIS_PROPS} />
                <Tooltip {...TOOLTIP_STYLE} formatter={(v) => `${fmtNum(Number(v), 2)} kWh`} />
                <Legend />
                <Bar dataKey="pv" name="Solar" fill="var(--c3)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="compute" name="Compute" fill="var(--c1)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="curtailed" name="Curtailed" fill="var(--c5)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
            <h3>Sunlight at the swarm (kWh/m² per day)</h3>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={monthly} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
                <CartesianGrid {...GRID_PROPS} />
                <XAxis dataKey="month" {...AXIS_PROPS} />
                <YAxis {...AXIS_PROPS} />
                <Tooltip {...TOOLTIP_STYLE} formatter={(v) => `${fmtNum(Number(v), 2)} kWh/m²`} />
                <Line type="monotone" dataKey="ghi" name="Irradiance" stroke="var(--c2)" strokeWidth={2} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </>
        ) : (
          <p className="muted">Calculating the annual run.</p>
        )}
      </section>
    </div>
  );
}
