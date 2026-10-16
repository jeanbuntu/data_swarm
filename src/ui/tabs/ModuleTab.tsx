import { useDeferredValue, useMemo, useState } from 'react';
import { ResponsiveContainer, Sankey, Tooltip } from 'recharts';
import { useFleet } from '../../state/store';
import { runLiveDay } from '../../model/live';
import { derive } from '../../model/derive';
import { dateLabel } from '../../model/time';
import { FlowerSvg } from './FlowerSvg';
import { dayEnergy, sankeyData } from './dayEnergy';
import { fmtHour, fmtNum } from '../format';
import { TOOLTIP_STYLE } from '../chartTheme';

interface NodeProps { x: number; y: number; width: number; height: number; payload: { name: string; value: number } }

function SankeyNode({ x, y, width, height, payload }: NodeProps) {
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill="var(--c1)" />
      <text x={x + width + 6} y={y + height / 2} dy="0.35em" fontSize={12} fill="var(--text)">
        {payload.name}: {fmtNum(payload.value, 2)} kWh
      </text>
    </g>
  );
}

export function ModuleTab() {
  const cfg = useDeferredValue(useFleet((s) => s.cfg));
  const [doy, setDoy] = useState(172);
  const [hour, setHour] = useState(12);
  const sim = useMemo(() => runLiveDay(cfg, doy), [cfg, doy]);
  const d = useMemo(() => derive(cfg), [cfg]);
  const point = sim.history[Math.min(sim.history.length - 1, Math.round(hour * 12))];
  const energy = dayEnergy(sim.history, sim.dtS);
  const sankey = sankeyData(energy);
  const rows: [string, string][] = [
    ['Panel area', `${fmtNum(d.pvAreaM2, 2)} m²`],
    ['Open span', `${fmtNum(d.spanM, 2)} m`],
    ['Peak solar', `${fmtNum(d.peakPvW / 1000, 2)} kW`],
    ['Compute efficiency incl. overhead', `${fmtNum(d.tflopsPerElecW, 2)} TFLOPS/W`],
    ['Max compute power', `${fmtNum(d.maxComputeElecW)} W`],
    ...(cfg.comms.hubMode
      ? ([
          ['Master node essential load (Starlink, cluster computer, radio)', `${fmtNum(d.nodes.master.essentialW, 1)} W`],
          ['Follower node essential load (controller, radio)', `${fmtNum(d.nodes.follower.essentialW, 1)} W`],
          ['Follower battery', `${fmtNum(d.nodes.follower.batteryKwh, 1)} kWh`],
        ] as [string, string][])
      : ([['Essential load (avionics, Starlink share)', `${fmtNum(d.essentialW, 1)} W`]] as [string, string][])),
    ['Mass vs displacement', `${fmtNum(d.massKg)} kg of ${fmtNum(d.displacementKg)} kg`],
    ['Pod volume needed vs available', `${fmtNum(d.podNeedL)} L of ${fmtNum(cfg.hull.podVolumeL)} L`],
    ['Max speed through water', `${fmtNum(d.maxWaterSpeedMs, 2)} m/s`],
    ['Battery mass', `${fmtNum(d.batteryKg)} kg`],
  ];
  return (
    <div className="tab-body">
      <div className="grid2">
        <section className="card">
          <h2>One module, top view</h2>
          <div className="controls-row">
            <label className="field">
              <span>Day {dateLabel(doy)}</span>
              <input type="range" min={1} max={365} value={doy} onChange={(e) => setDoy(Number(e.target.value))} />
            </label>
            <label className="field">
              <span>Time {fmtHour(hour)}</span>
              <input type="range" min={0} max={23.9} step={0.25} value={hour} onChange={(e) => setHour(Number(e.target.value))} />
            </label>
          </div>
          {point && <FlowerSvg cfg={cfg} sunElevationDeg={point.sunElevationDeg} sunAzimuthDeg={point.sunAzimuthDeg} stowed={point.stowed} />}
          {point && (
            <p className="note">
              Sun {fmtNum(point.sunElevationDeg)}° up. Solar {fmtNum(point.pvW)} W, compute {fmtNum(point.computeW)} W, battery {fmtNum(point.socFrac * 100)}%.
              {point.stowed ? ' Petals are stowed for wind.' : ''}
            </p>
          )}
        </section>
        <section className="card">
          <h2>Where one day of energy goes (average module, {dateLabel(doy)})</h2>
          <ResponsiveContainer width="100%" height={340}>
            <Sankey data={sankey} nodePadding={28} margin={{ top: 10, right: 190, bottom: 10, left: 10 }} link={{ stroke: 'var(--c2)', strokeOpacity: 0.25 }} node={(p: NodeProps) => <SankeyNode {...p} />}>
              <Tooltip {...TOOLTIP_STYLE} formatter={(v) => `${fmtNum(Number(v), 2)} kWh`} />
            </Sankey>
          </ResponsiveContainer>
        </section>
      </div>
      <section className="card">
        <h2>Module specification</h2>
        <table className="data">
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k}>
                <th>{k}</th>
                <td className="num">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
