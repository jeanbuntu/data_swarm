import { useFleet } from '../../state/store';
import { BUILTIN_VARIANTS } from '../../presets/variants';
import { BINDING_LABEL, fmtMonths, fmtPct, fmtUsd, fmtUsdCompact } from '../format';

const POLICY: Record<string, string> = { firm: 'firm 24/7 + spot', daylight: 'daylight only', max: 'max throughput' };

export function VariantsTable() {
  const st = useFleet.getState;
  return (
    <section className="card">
      <h2>Pricing variants: $0.05 per GPU-hour under the competitor</h2>
      <p className="note">
        Each row is the best configuration found for that card (cards per module, battery, policy and firm commitment) when priced five cents below the
        benchmark. Gas means a modeled land data center on its own gas generation; cloud means sourced rental rates. Load a row to explore it.
      </p>
      <div className="table-scroll">
        <table className="data">
          <thead>
            <tr>
              <th>Variant</th>
              <th>Configuration</th>
              <th className="num">Competitor firm price</th>
              <th className="num">Our firm price</th>
              <th className="num">Our cost per GPU-h</th>
              <th className="num">Margin per GPU-h</th>
              <th className="num">Margin after capital per year</th>
              <th className="num">Payback</th>
              <th>Limited by</th>
              <th className="num">Card use</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {BUILTIN_VARIANTS.map((v) => (
              <tr key={v.id}>
                <td>{v.name}</td>
                <td>
                  {v.config.compute.cards} cards, {v.config.battery.kwh} kWh, {POLICY[v.config.compute.policy]}
                  {v.config.comms.hubMode ? `, 1 Starlink per ${v.config.comms.modulesPerTerminal} nodes (${v.config.comms.planId})` : ''}
                  {v.config.compute.policy === 'firm' ? ` ${v.config.compute.firmComputeW} W` : ''}
                </td>
                <td className="num">{fmtUsd(v.metrics.benchmarkFirm, 2)}</td>
                <td className="num">{fmtUsd(v.metrics.priceFirm, 2)}</td>
                <td className="num">{fmtUsd(v.metrics.costPerGpuHour, 2)}</td>
                <td className="num">{fmtUsd(v.metrics.marginPerGpuHour, 2)}</td>
                <td className="num">{fmtUsdCompact(v.metrics.marginAfterCapitalYear)}</td>
                <td className="num">{fmtMonths(v.metrics.paybackMonths)}</td>
                <td>{BINDING_LABEL[v.metrics.binding]}</td>
                <td className="num">{fmtPct(v.metrics.cardUtilization)}</td>
                <td>
                  <button onClick={() => st().loadScenario(v.name)}>Load</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
