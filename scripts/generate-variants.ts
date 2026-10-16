/**
 * Regenerates src/presets/variants.json: for each accelerator and benchmark, the configuration with the best
 * yearly margin after capital when priced a fixed amount below the benchmark. Run: npm run variants
 */
import { writeFileSync } from 'node:fs';
import { VARIANT_SPECS, GRIDS, HUB_GRID, HUB_CLUSTER_SIZE, variantBase, searchVariant } from '../src/tools/variants';
import { runAnnual } from '../src/model/annual';
import { economics } from '../src/model/economics';
import { utilization } from '../src/model/metrics';
import { topBinding } from '../src/ui/format';
import { ACCELERATORS } from '../src/presets';

const UNDERCUT_USD = 0.05;
const out = [];
for (const spec of VARIANT_SPECS) {
  const t0 = Date.now();
  const base = variantBase(spec.accelerator, spec.benchmark, UNDERCUT_USD, spec.hub);
  const { config } = searchVariant(base, spec.hub ? HUB_GRID : GRIDS[spec.accelerator]);
  const accel = ACCELERATORS.find((a) => a.id === spec.accelerator)!;
  const benchName = spec.benchmark === 'gas' ? 'gas data center' : 'cloud rental';
  const hubLabel = spec.hub ? `, hub cluster (1 per ${HUB_CLUSTER_SIZE})` : '';
  const name = `${accel.name.replace(/^NVIDIA /, '').replace(/ \(.*\)$/, '')}${hubLabel} vs ${benchName}, $${UNDERCUT_USD.toFixed(2)} under`;
  const cfg = { ...config, name };
  const annual = runAnnual(cfg, 'full');
  const e = economics(cfg, annual);
  const u = utilization(cfg, annual);
  out.push({
    id: spec.id,
    name,
    accelerator: spec.accelerator,
    benchmark: spec.benchmark,
    config: cfg,
    metrics: {
      benchmarkFirm: e.marketFirm,
      priceFirm: e.priceFirm,
      priceSpot: e.priceSpot,
      costPerGpuHour: e.costPerGpuHour,
      marginPerGpuHour: e.marginPerGpuHour,
      marginAfterCapitalYear: e.grossMargin - e.annualCapital,
      grossMarginYear: e.grossMargin,
      paybackMonths: e.paybackMonths,
      pflopHours: e.annualPflopHours,
      gpuHours: e.gpuHours,
      capexTotal: e.capex.total,
      binding: topBinding(annual.totals.bindingH).key,
      cardUtilization: u.cardUtilization,
    },
  });
  console.log(`${name}: cards ${cfg.compute.cards}, ${cfg.battery.kwh} kWh, ${cfg.compute.policy} ${cfg.compute.firmComputeW} W, margin after capital ${Math.round(e.grossMargin - e.annualCapital)} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
writeFileSync(new URL('../src/presets/variants.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
