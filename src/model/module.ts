import type { SimConfig } from './config';
import type { Derived, NodeParams } from './derive';

export interface DispatchInput {
  pvW: number;
  propulsionW: number;
  trackingActive: boolean;
  socKwh: number;
  dtH: number;
  computeCapElecW?: number;
}

export interface StepFlows {
  pvW: number;
  essentialW: number;
  computeElecW: number;
  firmElecW: number;
  spotElecW: number;
  tflops: number;
  firmTflops: number;
  spotTflops: number;
  chargeW: number;
  dischargeW: number;
  curtailedW: number;
  unmetW: number;
  socKwh: number;
  online: boolean;
}

/**
 * One timestep of power dispatch. Priority: essential loads (avionics, Starlink, actuators, propulsion),
 * then compute per policy, then battery charging, then curtailment.
 * - daylight: battery charges first, compute uses only remaining solar.
 * - firm: firm compute from solar then battery (down to the reserve), battery charges, spot compute uses surplus solar.
 * - max: compute from solar then battery (down to the reserve), battery charges with what is left.
 */
export function dispatch(cfg: SimConfig, d: Derived, inp: DispatchInput, node: NodeParams = d.nodes.uniform): StepFlows {
  const etaC = Math.sqrt(cfg.battery.rte);
  const etaD = etaC;
  const cap = node.batteryKwh;
  const dtH = inp.dtH;
  let soc = Math.min(cap, Math.max(0, inp.socKwh));
  let pv = Math.max(0, inp.pvW);
  let charge = 0;
  let discharge = 0;

  const draw = (wantW: number, floorKwh: number): number => {
    if (wantW <= 0) return 0;
    const fromPv = Math.min(pv, wantW);
    pv -= fromPv;
    const rest = wantW - fromPv;
    let fromBat = 0;
    if (rest > 0 && dtH > 0) {
      const availW = Math.max(0, ((soc - floorKwh) * etaD * 1000) / dtH);
      fromBat = Math.min(rest, availW);
      soc -= ((fromBat / etaD) * dtH) / 1000;
      discharge += fromBat;
    }
    return fromPv + fromBat;
  };

  const chargeFromPv = () => {
    if (dtH <= 0 || cap <= 0) return;
    const roomW = Math.max(0, ((cap - soc) * 1000) / (etaC * dtH));
    const c = Math.min(pv, roomW);
    pv -= c;
    soc += (c * etaC * dtH) / 1000;
    charge += c;
  };

  const essentialWant = node.essentialW + (inp.trackingActive ? cfg.loads.actuatorW : 0) + Math.max(0, inp.propulsionW);
  const served = draw(essentialWant, node.socMinKwh);
  const unmetW = Math.max(0, essentialWant - served);
  const online = unmetW < 1e-6;
  const capW = Math.max(0, Math.min(d.maxComputeElecW, inp.computeCapElecW ?? Infinity));

  let firm = 0;
  let spot = 0;
  if (online && capW > 0) {
    if (cfg.compute.policy === 'daylight') {
      chargeFromPv();
      spot = Math.min(pv, capW);
      pv -= spot;
    } else if (cfg.compute.policy === 'firm') {
      firm = draw(Math.min(d.firmComputeElecW, capW), node.reserveKwh);
      chargeFromPv();
      spot = Math.min(pv, capW - firm);
      pv -= spot;
    } else {
      spot = draw(capW, node.reserveKwh);
    }
  }
  chargeFromPv();
  const curtailedW = pv;
  const computeElecW = firm + spot;
  return {
    pvW: Math.max(0, inp.pvW),
    essentialW: served,
    computeElecW,
    firmElecW: firm,
    spotElecW: spot,
    tflops: computeElecW * d.tflopsPerElecW,
    firmTflops: firm * d.tflopsPerElecW,
    spotTflops: spot * d.tflopsPerElecW,
    chargeW: charge,
    dischargeW: discharge,
    curtailedW,
    unmetW,
    socKwh: soc,
    online,
  };
}
