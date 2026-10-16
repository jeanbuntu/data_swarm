import { useMemo, useState } from 'react';
import { useFleet } from '../state/store';
import { derive } from '../model/derive';
import { feasibility } from '../model/feasibility';
import { BINDING_LABEL, fmtCompact, fmtMonths, fmtPct, fmtUsd, fmtUsdCompact, topBinding } from './format';

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className={`kpi ${tone ?? ''}`}>
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      {sub && <span className="kpi-sub">{sub}</span>}
    </div>
  );
}

export function KpiStrip() {
  const cfg = useFleet((s) => s.cfg);
  const annual = useFleet((s) => s.annual);
  const econ = useFleet((s) => s.econ);
  const runError = useFleet((s) => s.runError);
  const [open, setOpen] = useState(false);
  const d = useMemo(() => derive(cfg), [cfg]);
  const flags = useMemo(() => feasibility(cfg, d, annual, econ), [cfg, d, annual, econ]);
  const binding = annual ? topBinding(annual.totals.bindingH) : null;
  const pending = 'Calculating';
  const hasError = flags.some((f) => f.severity === 'error');

  return (
    <div className="kpi-wrap">
      <div className="kpis">
        <Kpi label="Compute delivered" value={econ ? `${fmtCompact(econ.annualPflopHours)} PFLOP-h/yr` : pending} sub={econ ? `${fmtCompact(econ.gpuHours)} GPU-hours` : undefined} />
        <Kpi label="Binding constraint" value={binding ? BINDING_LABEL[binding.key] : pending} sub={binding ? `${fmtPct(binding.share)} of hours` : undefined} tone={binding ? `bind-${binding.key}` : undefined} />
        <Kpi label="Cost per GPU-hour" value={econ ? fmtUsd(econ.costPerGpuHour, 2) : pending} sub={econ ? `We charge ${fmtUsd(econ.priceFirm, 2)} firm; ${econ.benchmarkLabel} ${fmtUsd(econ.marketFirm, 2)}` : undefined} />
        <Kpi label="Gross margin per year" value={econ ? fmtUsdCompact(econ.grossMargin) : pending} sub={econ ? `${fmtUsd(econ.marginPerGpuHour, 2)} per GPU-hour after capital` : undefined} tone={econ && econ.grossMargin < 0 ? 'negative' : undefined} />
        <Kpi label="Payback" value={econ ? fmtMonths(econ.paybackMonths) : pending} sub={econ ? `Capex ${fmtUsdCompact(econ.capex.total)}` : undefined} />
        <button className={`kpi flags ${hasError ? 'has-error' : flags.length ? 'has-warn' : 'clear'}`} onClick={() => setOpen(!open)} aria-expanded={open}>
          <span className="kpi-label">Feasibility</span>
          <span className="kpi-value">{flags.length ? `${flags.length} flag${flags.length > 1 ? 's' : ''}` : 'All clear'}</span>
          <span className="kpi-sub">{flags.length ? 'Show details' : 'No red flags'}</span>
        </button>
      </div>
      {open && flags.length > 0 && (
        <ul className="flag-list">
          {flags.map((f) => (
            <li key={f.id} className={f.severity}>
              <strong>{f.severity === 'error' ? 'Error' : 'Warning'}:</strong> {f.message}
            </li>
          ))}
        </ul>
      )}
      {runError && <div className="run-error">Annual run failed: {runError}. Showing the last good results.</div>}
    </div>
  );
}
