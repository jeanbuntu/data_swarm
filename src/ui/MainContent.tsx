import { useFleet, type TabId } from '../state/store';
import { Tabs } from './Tabs';
import { SwarmMapTab } from './tabs/SwarmMapTab';
import { ModuleTab } from './tabs/ModuleTab';
import { EnergyTab } from './tabs/EnergyTab';
import { EconomicsTab } from './tabs/EconomicsTab';
import { OptimizerTab } from './tabs/OptimizerTab';
import { AssumptionsTab } from './tabs/AssumptionsTab';
import { InvestorView } from './InvestorView';

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
    case 'assumptions':
      return <AssumptionsTab />;
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
