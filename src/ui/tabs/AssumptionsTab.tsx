import { useMemo, type ReactNode } from 'react';
import { useFleet } from '../../state/store';
import { getPath, leafPaths } from '../../model/config';
import { sourceFor } from '../../model/defaults';
import { PANELS, BATTERIES, ACCELERATORS, TERMINALS, PLANS, THRUSTERS, GHI_ANCHORS, type Sourced } from '../../presets';
import { PARAM_LABELS } from '../panelDefs';

export const MODEL_NOTES = [
  "Irradiance is calibrated so each month's average matches NASA POWER all-sky climatology (2001 to 2025) at the swarm's distance from shore. ERA5 is not used for levels because it overstates summer sun here by up to about 25%.",
  'The marine layer follows the sourced June hourly clearness profile, scaled by month. Day-to-day weather draws clear, partly cloudy and overcast days in the sourced proportions.',
  'Cloud-seeking assumes a perfect forecast over its planning horizon, so its gain is an upper bound.',
  "GPU-hours are equivalents: delivered dense FP16/BF16 TFLOP divided by the card's dense TFLOPS. A card capped to half its power delivers about half a GPU-hour per hour here, which is conservative because real cards are more efficient when capped.",
  'Firm capacity is billed at the firm price and interruptible capacity at the spot price. Firm hours missed below the SLA target incur a penalty.',
  'Starlink data counts both directions against the plan cap. Without overage purchases, links throttle to the post-cap rate for the rest of the month.',
  'Capex is amortized over the horizon at the discount rate. Accelerator refresh and battery wear are also charged each year, which double counts some hardware and keeps costs conservative.',
  'Panels on water run cooler than on land: cell temperature is water temperature plus a rise proportional to irradiance.',
  'Values marked EST have no direct source and need vendor quotes. Reseller prices for Starlink plans and GPUs should be confirmed before investor use.',
];

const URL_RE = /https?:\/\/[^\s;)]+/g;

function SourceLinks({ source }: { source: string }) {
  const urls = source.match(URL_RE) ?? [];
  if (!urls.length) return <span>{source}</span>;
  const rest = source.replace(URL_RE, '').replace(/[();]/g, ' ').replace(/\s+/g, ' ').trim();
  const links: ReactNode[] = [];
  urls.forEach((u, i) => {
    let host = u;
    try {
      host = new URL(u).hostname.replace(/^www\./, '');
    } catch {
      // keep the raw URL text
    }
    if (i) links.push(', ');
    links.push(<a key={u} href={u} target="_blank" rel="noreferrer">{host}</a>);
  });
  return (
    <span>
      {links}
      {rest && <span className="muted"> {rest}</span>}
    </span>
  );
}

const fmtVal = (v: number) => Number(v.toPrecision(5)).toLocaleString('en-US', { maximumFractionDigits: 6 });

type Catalog = { title: string; items: { id: string; name: string }[]; fields: [string, string][] };

const CATALOGS: Catalog[] = [
  { title: 'Solar panels', items: PANELS, fields: [['efficiency', 'Efficiency'], ['usdPerW', 'Price'], ['kgPerM2', 'Areal mass'], ['tempCoeffPerC', 'Temperature coefficient']] },
  { title: 'Batteries', items: BATTERIES, fields: [['usdPerKwh', 'Price'], ['whPerKg', 'Specific energy'], ['rte', 'Round trip'], ['cycleLife', 'Cycle life']] },
  { title: 'Accelerators', items: ACCELERATORS, fields: [['tdpW', 'TDP'], ['denseTflops', 'Dense TFLOPS'], ['priceUsd', 'Price'], ['firmUsdPerGpuH', 'Firm price'], ['spotUsdPerGpuH', 'Spot price']] },
  { title: 'Starlink terminals', items: TERMINALS, fields: [['terminalW', 'Power'], ['usd', 'Price'], ['downMbps', 'Down'], ['upMbps', 'Up']] },
  { title: 'Starlink plans', items: PLANS, fields: [['usdPerMonth', 'Price'], ['capGB', 'Cap'], ['overageUsdPerGB', 'Overage']] },
  { title: 'Thrusters', items: THRUSTERS, fields: [['thrustN', 'Thrust'], ['maxElecW', 'Power'], ['usd', 'Price']] },
];

function PresetTable({ title, items, fields }: Catalog) {
  return (
    <div className="table-scroll">
      <h3>{title}</h3>
      <table className="data">
        <thead>
          <tr>
            <th>Option</th>
            {fields.map(([, label]) => (
              <th key={label} className="num">{label}</th>
            ))}
            <th>Sources</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => {
            const rec = it as unknown as Record<string, Sourced | null>;
            const sources = [...new Set(fields.map(([k]) => rec[k]?.source).filter((x): x is string => !!x))].join(' ; ');
            return (
              <tr key={it.id}>
                <td>{it.name}</td>
                {fields.map(([k]) => {
                  const s = rec[k];
                  return (
                    <td key={k} className="num" title={s ? `${s.source}${s.note ? `. ${s.note}` : ''}` : ''}>
                      {s ? `${fmtVal(s.value)} ${s.unit}` : 'n/a'}
                      {s?.estimate && <span className="badge est">EST</span>}
                    </td>
                  );
                })}
                <td><SourceLinks source={sources} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function AssumptionsTab() {
  const cfg = useFleet((s) => s.cfg);
  const rows = useMemo(
    () =>
      leafPaths(cfg)
        .filter((p) => p !== 'version' && typeof getPath(cfg, p) === 'number')
        .map((path) => {
          const value = getPath(cfg, path) as number;
          const src = sourceFor(cfg, path);
          const custom = !!src && src.unit !== '' && Math.abs(src.value - value) > 1e-9 * Math.max(1, Math.abs(value));
          return { path, value, src, custom };
        }),
    [cfg],
  );
  return (
    <div className="tab-body">
      <section className="card">
        <h2>How to read these numbers</h2>
        <ul className="notes">
          {MODEL_NOTES.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </section>
      <section className="card">
        <h2>Current scenario inputs</h2>
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>Parameter</th>
                <th className="num">Value</th>
                <th>Unit</th>
                <th>Source</th>
                <th>Accessed</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.path}>
                  <td>
                    {PARAM_LABELS[r.path] ?? r.path}
                    <div className="muted mono">{r.path}</div>
                  </td>
                  <td className="num">{fmtVal(r.value)}</td>
                  <td>{r.src?.unit ?? ''}</td>
                  <td>
                    <SourceLinks source={r.src?.source ?? 'Not sourced'} />
                    {r.src?.note && <div className="muted">{r.src.note}</div>}
                  </td>
                  <td>{r.src?.date ?? ''}</td>
                  <td>
                    {r.src?.estimate && <span className="badge est">EST</span>}
                    {r.custom && <span className="badge custom">CUSTOM</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card">
        <h2>Vendor catalogs</h2>
        {CATALOGS.map((c) => (
          <PresetTable key={c.title} {...c} />
        ))}
      </section>
      <section className="card">
        <h2>Southern California sunlight, NASA POWER all-sky GHI (kWh/m²/day)</h2>
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>Location</th>
                {MONTHS.map((m) => (
                  <th key={m} className="num">{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {GHI_ANCHORS.map((a) => (
                <tr key={a.km}>
                  <td>{a.label}<div className="muted">modeled at {a.km} km offshore</div></td>
                  {a.monthly.map((v, i) => (
                    <td key={i} className="num">{v.toFixed(2)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="note">Source: <SourceLinks source={GHI_ANCHORS[0].source} />. Full research tables: docs/research/2026-10-15-default-parameters.md.</p>
      </section>
    </div>
  );
}
