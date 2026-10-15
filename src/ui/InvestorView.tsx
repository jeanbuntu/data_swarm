import { useMemo } from 'react';
import { useFleet } from '../state/store';
import { derive } from '../model/derive';
import { feasibility } from '../model/feasibility';
import { createEnvironment } from '../model/environment';
import { ACCELERATORS } from '../presets';
import { EconomicsHeadline, CapexChart, CashflowChart, PnlTable } from './tabs/econParts';
import { fmtNum, fmtUsd } from './format';

export function InvestorView() {
  const cfg = useFleet((s) => s.cfg);
  const econ = useFleet((s) => s.econ);
  const annual = useFleet((s) => s.annual);
  const d = useMemo(() => derive(cfg), [cfg]);
  const km = useMemo(() => createEnvironment(cfg).offshoreKm(0, 0), [cfg]);
  const flags = feasibility(cfg, d, annual, econ);
  const accel = ACCELERATORS.find((a) => a.id === cfg.compute.presetId)?.name ?? 'custom accelerators';
  const estimates = econ ? econ.moduleCapex.lines.filter((l) => l.estimate && l.usd > 0).sort((a, b) => b.usd - a.usd).slice(0, 5) : [];
  return (
    <div className="tab-body investor-view">
      <section className="card hero">
        <p className="eyebrow">Fleet scenario</p>
        <h1>{cfg.name}</h1>
        <p className="lede">
          {cfg.swarm.count} solar-powered compute modules, each with {fmtNum(d.pvAreaM2, 1)} m² of panels and {cfg.compute.cards} x {accel}, operating about {fmtNum(km)} km off
          Southern California and selling compute as a service over Starlink.
        </p>
      </section>
      {econ ? (
        <>
          <EconomicsHeadline econ={econ} cfg={cfg} />
          <div className="grid2">
            <CapexChart econ={econ} />
            <CashflowChart econ={econ} />
          </div>
          <PnlTable econ={econ} cfg={cfg} />
        </>
      ) : (
        <section className="card">
          <p className="muted">Calculating the annual run.</p>
        </section>
      )}
      <section className="card">
        <h2>Open items before relying on these numbers</h2>
        <ul>
          {flags.map((f) => (
            <li key={f.id}>{f.message}</li>
          ))}
          {estimates.map((l) => (
            <li key={l.key}>
              {l.label} ({fmtUsd(l.usd)} per module) is an estimate to confirm with quotes or engineering costing.
            </li>
          ))}
          <li>Starlink plan prices and GPU prices come from resellers and should be confirmed with vendor quotes.</li>
        </ul>
      </section>
    </div>
  );
}
