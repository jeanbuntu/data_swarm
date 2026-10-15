import { useAnnualRunner } from './state/useAnnualRunner';
import { useFleet } from './state/store';
import { Header } from './ui/Header';
import { KpiStrip } from './ui/KpiStrip';
import { ParamPanels } from './ui/ParamPanels';
import { MainContent } from './ui/MainContent';

export default function App() {
  useAnnualRunner();
  const investor = useFleet((s) => s.investor);
  return (
    <div className="app">
      <Header />
      <KpiStrip />
      <div className={`body${investor ? ' investor' : ''}`}>
        {!investor && (
          <aside className="side" aria-label="Parameters">
            <ParamPanels />
          </aside>
        )}
        <main className="main">
          <MainContent />
        </main>
      </div>
    </div>
  );
}
