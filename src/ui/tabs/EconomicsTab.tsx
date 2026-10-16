import { useFleet } from '../../state/store';
import { EconomicsHeadline, CapexChart, CashflowChart, PnlTable, TornadoPanel } from './econParts';
import { VariantsTable } from './VariantsTable';

export function EconomicsTab() {
  const econ = useFleet((s) => s.econ);
  const cfg = useFleet((s) => s.cfg);
  if (!econ) {
    return (
      <section className="card">
        <p className="muted">Calculating the annual run.</p>
      </section>
    );
  }
  return (
    <div className="tab-body">
      <EconomicsHeadline econ={econ} cfg={cfg} />
      <div className="grid2">
        <CapexChart econ={econ} />
        <CashflowChart econ={econ} />
      </div>
      <div className="grid2">
        <PnlTable econ={econ} cfg={cfg} />
        <TornadoPanel cfg={cfg} />
      </div>
      <VariantsTable />
    </div>
  );
}
