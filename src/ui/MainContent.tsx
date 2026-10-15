import { useFleet, type TabId } from '../state/store';
import { Tabs } from './Tabs';
import { SwarmMapTab } from './tabs/SwarmMapTab';
import { ModuleTab } from './tabs/ModuleTab';
import { EnergyTab } from './tabs/EnergyTab';

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
    default:
      return <Pending what="This view" />;
  }
}

export function MainContent() {
  const tab = useFleet((s) => s.tab);
  const investor = useFleet((s) => s.investor);
  if (investor) return <Pending what="The investor view" />;
  return (
    <>
      <Tabs />
      <div className="tab-body">{renderTab(tab)}</div>
    </>
  );
}
