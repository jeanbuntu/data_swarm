import { useFleet, type TabId } from '../state/store';

export const TABS: { id: TabId; label: string }[] = [
  { id: 'map', label: 'Swarm Map' },
  { id: 'module', label: 'Module' },
  { id: 'energy', label: 'Energy' },
  { id: 'economics', label: 'Economics' },
  { id: 'optimizer', label: 'Optimizer' },
  { id: 'assumptions', label: 'Assumptions' },
];

export function Tabs() {
  const tab = useFleet((s) => s.tab);
  return (
    <nav className="tabs" role="tablist">
      {TABS.map((t) => (
        <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'active' : ''} onClick={() => useFleet.getState().setTab(t.id)}>
          {t.label}
        </button>
      ))}
    </nav>
  );
}
