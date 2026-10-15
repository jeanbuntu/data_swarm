import type { SimConfig } from './config';
import { RHO_SEA, ELECTRONICS_KG, HOST_VOLUME_L, HX_VOLUME_L, NIGHT_RESERVE_H } from './constants';
import { hexSlots } from './swarm';
import { mixStats, MixStats } from './jobs';
import { WORKLOADS } from '../presets';

export interface Derived {
  hullTopM2: number;
  petalM2: number;
  pvAreaM2: number;
  spanM: number;
  peakPvW: number;
  cardsMaxW: number;
  overheadFactor: number;
  maxComputeElecW: number;
  tflopsPerElecW: number;
  firmComputeElecW: number;
  terminals: number;
  starlinkWPerModule: number;
  essentialW: number;
  frontalAreaM2: number;
  maxThrustN: number;
  maxPropElecW: number;
  maxWaterSpeedMs: number;
  batteryKg: number;
  massKg: number;
  displacementKg: number;
  podNeedL: number;
  petalOverlap: boolean;
  formationRadiusM: number;
  batteryUsableKwh: number;
  socMinKwh: number;
  reserveKwh: number;
  mix: MixStats;
}

export function derive(cfg: SimConfig): Derived {
  const h = cfg.hull, c = cfg.compute, p = cfg.propulsion, b = cfg.battery;
  const hullTopM2 = h.sideM ** 2;
  const petalM2 = h.petalCount * h.petalLengthM * h.petalWidthM;
  const pvAreaM2 = hullTopM2 + petalM2;
  const cardsMaxW = c.cards * c.tdpW;
  const overheadFactor = 1 + c.coolingOverhead + (cardsMaxW > 0 ? c.hostW / cardsMaxW : 0);
  const maxComputeElecW = c.denseTflops > 0 ? cardsMaxW * overheadFactor : 0;
  const tflopsPerElecW = cardsMaxW > 0 ? c.denseTflops / c.tdpW / overheadFactor : 0;
  const terminals = Math.ceil(cfg.swarm.count / cfg.comms.modulesPerTerminal);
  const shared = cfg.comms.modulesPerTerminal > 1;
  const starlinkWPerModule = (terminals * cfg.comms.terminalW) / cfg.swarm.count;
  const essentialW = cfg.loads.avionicsW + starlinkWPerModule + (shared ? cfg.comms.radioW : 0);
  const frontalAreaM2 = h.sideM * h.draftM;
  const maxThrustN = p.count * p.thrustN;
  const maxPropElecW = p.count * p.maxElecW;
  const dragK = RHO_SEA * h.dragCd * frontalAreaM2;
  const vThrust = Math.sqrt((2 * maxThrustN) / dragK);
  const vPower = Math.cbrt((2 * maxPropElecW * p.propEff) / dragK);
  const batteryKg = (b.kwh * 1000) / b.whPerKg;
  const slots = hexSlots(cfg.swarm.count, cfg.swarm.spacingM);
  const socMinKwh = b.kwh * (1 - b.dod);
  const etaD = Math.sqrt(b.rte);
  return {
    hullTopM2,
    petalM2,
    pvAreaM2,
    spanM: h.sideM + 2 * h.petalLengthM,
    peakPvW: pvAreaM2 * cfg.panel.efficiency * 1000,
    cardsMaxW,
    overheadFactor,
    maxComputeElecW,
    tflopsPerElecW,
    firmComputeElecW: Math.min(c.firmComputeW, maxComputeElecW),
    terminals,
    starlinkWPerModule,
    essentialW,
    frontalAreaM2,
    maxThrustN,
    maxPropElecW,
    maxWaterSpeedMs: Math.min(vThrust, vPower),
    batteryKg,
    massKg:
      h.massKg + h.podMassKg + pvAreaM2 * cfg.panel.kgPerM2 + batteryKg + c.cards * c.massKg + p.count * p.massKg +
      (cfg.comms.terminalMassKg * terminals) / cfg.swarm.count + ELECTRONICS_KG,
    displacementKg: RHO_SEA * hullTopM2 * h.draftM,
    podNeedL: c.cards * c.volumeL + HOST_VOLUME_L + HX_VOLUME_L,
    petalOverlap: h.petalCount * h.petalWidthM > 2 * Math.PI * (h.sideM / 2 + h.petalLengthM / 2),
    formationRadiusM: Math.max(0, ...slots.map((s) => Math.hypot(s.x, s.y))),
    batteryUsableKwh: b.kwh * b.dod,
    socMinKwh,
    reserveKwh: Math.min(b.kwh, socMinKwh + (essentialW * NIGHT_RESERVE_H) / 1000 / etaD),
    mix: mixStats(cfg.jobs, WORKLOADS),
  };
}
