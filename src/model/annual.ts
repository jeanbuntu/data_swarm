import type { SimConfig } from './config';
import { payOverage } from './defaults';
import { derive, Derived } from './derive';
import { dispatch, StepFlows } from './module';
import { createEnvironment, dayTypeProbs, DayType, Env } from './environment';
import { swarmParams, initSwarm, stepSwarm, SwarmParams, SwarmState } from './swarm';
import { poaIrradiance, pvPowerW } from './solar';
import { aggregateStep, Binding } from './jobs';
import { dayStartMs, monthOfDoy, midMonthDoy, DAYS_IN_MONTH } from './time';
import { mulberry32, hashSeed } from './rng';

export interface Totals {
  pvKwh: number;
  essentialKwh: number;
  propulsionKwh: number;
  computeKwh: number;
  curtailedKwh: number;
  unmetKwh: number;
  chargeKwh: number;
  dischargeKwh: number;
  tflop: number;
  firmTflop: number;
  spotTflop: number;
  firmCommittedTflop: number;
  downGB: number;
  upGB: number;
  stowedH: number;
  hours: number;
  bindingH: Record<Binding, number>;
}

export interface DaySummary extends Totals {
  doy: number;
  weight: number;
  ghiKwhM2: number;
  offshoreKm: number;
}

export interface AnnualResult {
  mode: 'full' | 'representative';
  days: DaySummary[];
  totals: Totals;
  gbPerTerminalMonthly: number[];
  batteryCyclesPerModule: number;
  availability: number | null;
  modules: number;
  terminals: number;
}

export function emptyTotals(): Totals {
  return {
    pvKwh: 0, essentialKwh: 0, propulsionKwh: 0, computeKwh: 0, curtailedKwh: 0, unmetKwh: 0, chargeKwh: 0, dischargeKwh: 0,
    tflop: 0, firmTflop: 0, spotTflop: 0, firmCommittedTflop: 0, downGB: 0, upGB: 0, stowedH: 0, hours: 0,
    bindingH: { power: 0, bandwidth: 0, demand: 0 },
  };
}

function addInto(a: Totals, b: Totals, w: number): void {
  for (const k of Object.keys(a) as (keyof Totals)[]) {
    if (k === 'bindingH') continue;
    (a[k] as number) += (b[k] as number) * w;
  }
  a.bindingH.power += b.bindingH.power * w;
  a.bindingH.bandwidth += b.bindingH.bandwidth * w;
  a.bindingH.demand += b.bindingH.demand * w;
}

interface Ctx {
  cfg: SimConfig;
  d: Derived;
  params: SwarmParams;
  dtS: number;
  idx: number[];
  scale: number;
  demandTflops: number;
}

function simulateDay(
  ctx: Ctx,
  env: Env,
  doy: number,
  sw: SwarmState,
  soc: number[],
  isThrottled: () => boolean,
  addGB: (perTerminalGB: number) => void,
): DaySummary {
  const { cfg, d, params, dtS, idx, scale } = ctx;
  const dtH = dtS / 3600;
  const day: DaySummary = { ...emptyTotals(), doy, weight: 1, ghiKwhM2: 0, offshoreKm: 0 };
  const t0 = dayStartMs(doy);
  const rng = mulberry32(hashSeed(cfg.seed, doy, 99));
  const steps = Math.round(86400 / dtS);
  const firmTflopsPerModule = cfg.compute.policy === 'firm' ? d.firmComputeElecW * d.tflopsPerElecW : 0;

  for (let k = 0; k < steps; k++) {
    const t = t0 + k * dtS * 1000;
    const out = stepSwarm(sw, params, env, t, dtS, rng);
    const stowed = env.stowed(t);
    const sun = env.sun(t);
    const tracking = !stowed && cfg.hull.tracking !== 'flat' && sun.elevationDeg > 0;
    const area = stowed ? d.hullTopM2 : d.pvAreaM2;
    const pvs: number[] = [];
    const pass1: StepFlows[] = [];
    let potential = 0;
    let online = 0;
    for (const i of idx) {
      const pos = sw.modules[i].pos;
      const poa = poaIrradiance(env.ghi(t, pos.x, pos.y), sun, cfg.hull.tracking, cfg.hull.fixedTiltDeg, cfg.hull.maxTiltDeg, doy);
      const pvW = pvPowerW(poa, area, cfg);
      pvs.push(pvW);
      const f = dispatch(cfg, d, { pvW, propulsionW: out.propulsionW[i], trackingActive: tracking, socKwh: soc[i], dtH });
      pass1.push(f);
      potential += f.tflops * scale;
      if (f.online) online += scale;
    }
    const throttled = isThrottled();
    const termOnline = d.terminals * Math.min(1, online / cfg.swarm.count);
    const down = termOnline * (throttled ? cfg.comms.throttleDownMbps : cfg.comms.downMbps);
    const up = termOnline * (throttled ? cfg.comms.throttleUpMbps : cfg.comms.upMbps);
    const agg = aggregateStep(potential, down, up, ctx.demandTflops, d.mix.inMBPerTflop, d.mix.outMBPerTflop);
    const frac = potential > 0 ? agg.tflops / potential : 0;

    idx.forEach((i, j) => {
      let f = pass1[j];
      if (frac < 1 - 1e-9) {
        f = dispatch(cfg, d, {
          pvW: pvs[j], propulsionW: out.propulsionW[i], trackingActive: tracking, socKwh: soc[i], dtH, computeCapElecW: f.computeElecW * frac,
        });
      }
      soc[i] = f.socKwh;
      const e = (w: number) => (w * dtH * scale) / 1000;
      day.pvKwh += e(f.pvW);
      day.essentialKwh += e(f.essentialW);
      day.propulsionKwh += e(out.propulsionW[i]);
      day.computeKwh += e(f.computeElecW);
      day.curtailedKwh += e(f.curtailedW);
      day.unmetKwh += e(f.unmetW);
      day.chargeKwh += e(f.chargeW);
      day.dischargeKwh += e(f.dischargeW);
      day.tflop += f.tflops * dtS * scale;
      day.firmTflop += f.firmTflops * dtS * scale;
      day.spotTflop += f.spotTflops * dtS * scale;
      day.firmCommittedTflop += firmTflopsPerModule * dtS * scale;
    });
    const downGB = (agg.downMBps * dtS) / 1000;
    const upGB = (agg.upMBps * dtS) / 1000;
    day.downGB += downGB;
    day.upGB += upGB;
    addGB((downGB + upGB) / d.terminals);
    day.bindingH[agg.binding] += dtH;
    day.stowedH += stowed ? dtH : 0;
    day.hours += dtH;
    day.ghiKwhM2 += (env.ghi(t, sw.centroid.x, sw.centroid.y) * dtH) / 1000;
  }
  day.offshoreKm = env.offshoreKm(sw.centroid.x, sw.centroid.y);
  return day;
}

export function runAnnual(cfg: SimConfig, mode: 'full' | 'representative', opts: { sampleModules?: number } = {}): AnnualResult {
  const d = derive(cfg);
  const params = swarmParams(cfg, d);
  const n = cfg.swarm.count;
  const sample = Math.max(1, Math.min(n, opts.sampleModules ?? n));
  const idx = Array.from({ length: sample }, (_, k) => Math.floor((k * n) / sample));
  const ctx: Ctx = { cfg, d, params, dtS: 900, idx, scale: n / sample, demandTflops: (cfg.jobs.arrivalsPerHour / 3600) * d.mix.meanTflop };
  const capGB = cfg.comms.planCapGB;
  const paying = payOverage(cfg);
  const days: DaySummary[] = [];
  const gbMonthly = new Array(12).fill(0);
  const startSoc = () => new Array(n).fill(cfg.battery.kwh * 0.5);

  if (mode === 'full') {
    const env = createEnvironment(cfg);
    const sw = initSwarm(params);
    const soc = startSoc();
    for (let doy = 1; doy <= 365; doy++) {
      const m = monthOfDoy(doy);
      days.push(simulateDay(ctx, env, doy, sw, soc, () => !paying && gbMonthly[m] >= capGB, (gb) => { gbMonthly[m] += gb; }));
    }
  } else {
    const types: DayType[] = ['clear', 'partial', 'cloudy'];
    for (let m = 0; m < 12; m++) {
      const doy = midMonthDoy(m);
      const probs = dayTypeProbs(m);
      const runSet = (throttled: boolean) =>
        types.map((type) => {
          const env = createEnvironment(cfg, { forcedDayType: type });
          const sw = initSwarm(params);
          const soc = startSoc();
          simulateDay(ctx, env, doy, sw, soc, () => throttled, () => {});
          let gb = 0;
          const day = simulateDay(ctx, env, doy, sw, soc, () => throttled, (g) => { gb += g; });
          return { type, day, gb };
        });
      const open = runSet(false);
      const monthGB = open.reduce((a, r) => a + r.gb * probs[r.type] * DAYS_IN_MONTH[m], 0);
      const f = !paying && monthGB > capGB ? 1 - capGB / monthGB : 0;
      const thr = f > 0 ? runSet(true) : [];
      for (const r of open) {
        r.day.weight = DAYS_IN_MONTH[m] * probs[r.type] * (1 - f);
        gbMonthly[m] += r.gb * r.day.weight;
        days.push(r.day);
      }
      for (const r of thr) {
        r.day.weight = DAYS_IN_MONTH[m] * probs[r.type] * f;
        gbMonthly[m] += r.gb * r.day.weight;
        days.push(r.day);
      }
    }
  }

  const totals = emptyTotals();
  for (const day of days) addInto(totals, day, day.weight);
  const usable = cfg.battery.kwh * cfg.battery.dod;
  return {
    mode,
    days,
    totals,
    gbPerTerminalMonthly: gbMonthly,
    batteryCyclesPerModule: usable > 0 ? totals.dischargeKwh / n / usable : 0,
    availability: cfg.compute.policy === 'firm' && totals.firmCommittedTflop > 0 ? totals.firmTflop / totals.firmCommittedTflop : null,
    modules: n,
    terminals: d.terminals,
  };
}
