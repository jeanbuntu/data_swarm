import type { LivePoint } from '../../model/live';
import type { AnnualResult } from '../../model/annual';
import { monthOfDoy } from '../../model/time';

export interface DayEnergy {
  pvKwh: number;
  loadsKwh: number;
  propulsionKwh: number;
  computeKwh: number;
  chargeKwh: number;
  dischargeKwh: number;
  curtailedKwh: number;
}

export function dayEnergy(history: LivePoint[], dtS: number): DayEnergy {
  const k = dtS / 3600 / 1000;
  const e: DayEnergy = { pvKwh: 0, loadsKwh: 0, propulsionKwh: 0, computeKwh: 0, chargeKwh: 0, dischargeKwh: 0, curtailedKwh: 0 };
  for (const p of history) {
    const prop = Math.min(p.propulsionW, p.essentialW);
    e.pvKwh += p.pvW * k;
    e.propulsionKwh += prop * k;
    e.loadsKwh += (p.essentialW - prop) * k;
    e.computeKwh += p.computeW * k;
    e.chargeKwh += p.chargeW * k;
    e.dischargeKwh += p.dischargeW * k;
    e.curtailedKwh += p.curtailedW * k;
  }
  return e;
}

export function sankeyData(e: DayEnergy): { nodes: { name: string }[]; links: { source: number; target: number; value: number }[] } {
  const names = ['Solar', 'Battery out', 'Power bus', 'Avionics and Starlink', 'Propulsion', 'Compute', 'Battery in', 'Curtailed'];
  const raw: [number, number, number][] = [
    [0, 2, e.pvKwh - e.curtailedKwh],
    [1, 2, e.dischargeKwh],
    [2, 3, e.loadsKwh],
    [2, 4, e.propulsionKwh],
    [2, 5, e.computeKwh],
    [2, 6, e.chargeKwh],
    [0, 7, e.curtailedKwh],
  ];
  const kept = raw.filter(([, , v]) => v > 0.005);
  const used = [...new Set(kept.flatMap(([a, b]) => [a, b]))].sort((a, b) => a - b);
  const remap = new Map(used.map((old, i) => [old, i]));
  return {
    nodes: used.map((i) => ({ name: names[i] })),
    links: kept.map(([a, b, v]) => ({ source: remap.get(a)!, target: remap.get(b)!, value: Number(v.toFixed(3)) })),
  };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function monthlySeries(a: AnnualResult): { month: string; pv: number; compute: number; curtailed: number; ghi: number }[] {
  const acc = Array.from({ length: 12 }, () => ({ w: 0, pv: 0, compute: 0, curtailed: 0, ghi: 0 }));
  for (const d of a.days) {
    const x = acc[monthOfDoy(d.doy)];
    x.w += d.weight;
    x.pv += d.pvKwh * d.weight;
    x.compute += d.computeKwh * d.weight;
    x.curtailed += d.curtailedKwh * d.weight;
    x.ghi += d.ghiKwhM2 * d.weight;
  }
  return acc.map((x, m) => ({
    month: MONTHS[m],
    pv: x.w ? x.pv / x.w / a.modules : 0,
    compute: x.w ? x.compute / x.w / a.modules : 0,
    curtailed: x.w ? x.curtailed / x.w / a.modules : 0,
    ghi: x.w ? x.ghi / x.w : 0,
  }));
}
