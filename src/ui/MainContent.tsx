import { useFleet, type TabId } from '../state/store';
import { Tabs } from './Tabs';
import { SwarmMapTab } from './tabs/SwarmMapTab';
import { ModuleTab } from './tabs/ModuleTab';
import { EnergyTab } from './tabs/EnergyTab';
import { EconomicsTab } from './tabs/EconomicsTab';
import { InvestorView } from './InvestorView';
import { OptimizerTab } from './tabs/OptimizerTab';

function Pending({ what }: { what: string }) {
  return (
    <section className="card">
      <p className="muted">{what} is not built yet.</p>
    </section>
  );
}

function renderTab(tab: TabId) {
  switch (tab) {
    case 'map':
      return <SwarmMapTab />;
    case 'module':
      return <ModuleTab />;
    case 'energy':
      return <EnergyTab />;
    case 'economics':
      return <EconomicsTab />;
    case 'optimizer':
      return <OptimizerTab />;
    default:
      return <Pending what="This view" />;
  }
}

export function MainContent() {
  const tab = useFleet((s) => s.tab);
  const investor = useFleet((s) => s.investor);
  if (investor) return <InvestorView />;
  return (
    <>
      <Tabs />
      <div className="tab-body">{renderTab(tab)}</div>
    </>
  );
}
