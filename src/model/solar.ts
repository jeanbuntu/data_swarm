import { RAD, SOLAR_CONSTANT, WATER_ALBEDO } from './constants';
import type { SimConfig, Tracking } from './config';

export interface SunPos {
  zenithDeg: number;
  azimuthDeg: number;
  elevationDeg: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** NOAA solar position algorithm with atmospheric refraction. Azimuth is clockwise from north. */
export function sunPosition(utcMs: number, latDeg: number, lonDeg: number): SunPos {
  const jd = utcMs / 86400000 + 2440587.5;
  const T = (jd - 2451545) / 36525;
  const L0 = (((280.46646 + T * (36000.76983 + T * 0.0003032)) % 360) + 360) % 360;
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C =
    Math.sin(M * RAD) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
    Math.sin(2 * M * RAD) * (0.019993 - 0.000101 * T) +
    Math.sin(3 * M * RAD) * 0.000289;
  const omega = 125.04 - 1934.136 * T;
  const lambda = L0 + C - 0.00569 - 0.00478 * Math.sin(omega * RAD);
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(omega * RAD);
  const decl = Math.asin(Math.sin(eps * RAD) * Math.sin(lambda * RAD));
  const y = Math.tan((eps * RAD) / 2) ** 2;
  const eqTime =
    (4 / RAD) *
    (y * Math.sin(2 * L0 * RAD) -
      2 * e * Math.sin(M * RAD) +
      4 * e * y * Math.sin(M * RAD) * Math.cos(2 * L0 * RAD) -
      0.5 * y * y * Math.sin(4 * L0 * RAD) -
      1.25 * e * e * Math.sin(2 * M * RAD));
  const utcMinutes = (((utcMs % 86400000) + 86400000) % 86400000) / 60000;
  const tst = (((utcMinutes + eqTime + 4 * lonDeg) % 1440) + 1440) % 1440;
  let hourAngle = tst / 4 - 180;
  if (hourAngle < -180) hourAngle += 360;
  const latR = latDeg * RAD;
  const cosZ = clamp(Math.sin(latR) * Math.sin(decl) + Math.cos(latR) * Math.cos(decl) * Math.cos(hourAngle * RAD), -1, 1);
  const zenRad = Math.acos(cosZ);
  const zenDeg = zenRad / RAD;
  const azDenom = Math.cos(latR) * Math.sin(zenRad);
  let az: number;
  if (Math.abs(azDenom) < 1e-9) {
    az = latDeg > 0 ? 180 : 0;
  } else {
    const a = clamp((Math.sin(latR) * Math.cos(zenRad) - Math.sin(decl)) / azDenom, -1, 1);
    const acosDeg = Math.acos(a) / RAD;
    az = hourAngle > 0 ? (acosDeg + 180) % 360 : (540 - acosDeg) % 360;
  }
  const elev = 90 - zenDeg;
  let refr = 0;
  if (elev <= 85) {
    const te = Math.tan(elev * RAD);
    if (elev > 5) refr = 58.1 / te - 0.07 / te ** 3 + 0.000086 / te ** 5;
    else if (elev > -0.575) refr = 1735 + elev * (-518.2 + elev * (103.4 + elev * (-12.79 + elev * 0.711)));
    else refr = -20.772 / te;
    refr /= 3600;
  }
  const elevCorr = elev + refr;
  return { zenithDeg: 90 - elevCorr, azimuthDeg: az, elevationDeg: elevCorr };
}

/** Haurwitz clear-sky global horizontal irradiance, W/m2. */
export function clearSkyGhi(zenithDeg: number): number {
  const cz = Math.cos(zenithDeg * RAD);
  if (cz <= 0) return 0;
  return 1098 * cz * Math.exp(-0.057 / cz);
}

export function erbsDiffuseFraction(kt: number): number {
  if (kt <= 0.22) return 1 - 0.09 * kt;
  if (kt <= 0.8) return 0.9511 - 0.1604 * kt + 4.388 * kt ** 2 - 16.638 * kt ** 3 + 12.336 * kt ** 4;
  return 0.165;
}

/**
 * Plane-of-array irradiance. 'yaw' rotates the hull so panels at a fixed tilt face the sun's azimuth;
 * 'dual' also tilts petals toward the sun up to maxTiltDeg.
 */
export function poaIrradiance(ghi: number, sun: SunPos, tracking: Tracking, fixedTiltDeg: number, maxTiltDeg: number, doy: number): number {
  if (ghi <= 0 || sun.elevationDeg <= 0) return 0;
  if (tracking === 'flat') return ghi;
  const z = sun.zenithDeg * RAD;
  const cz = Math.cos(z);
  let dhi: number;
  let dni: number;
  if (cz <= 0.05) {
    dhi = ghi;
    dni = 0;
  } else {
    const i0 = SOLAR_CONSTANT * (1 + 0.033 * Math.cos((2 * Math.PI * doy) / 365));
    const kt = Math.min(1, ghi / (i0 * cz));
    dhi = ghi * erbsDiffuseFraction(kt);
    dni = (ghi - dhi) / cz;
  }
  const tilt = (tracking === 'dual' ? Math.min(sun.zenithDeg, maxTiltDeg) : fixedTiltDeg) * RAD;
  const beam = dni * Math.max(0, Math.cos(z - tilt));
  const diffuse = (dhi * (1 + Math.cos(tilt))) / 2;
  const ground = (ghi * WATER_ALBEDO * (1 - Math.cos(tilt))) / 2;
  return beam + diffuse + ground;
}

/** DC power after temperature derating and MPPT, W. Cell temperature = water + rise scaled by irradiance. */
export function pvPowerW(poaWm2: number, areaM2: number, cfg: Pick<SimConfig, 'panel' | 'pv'>): number {
  if (poaWm2 <= 0 || areaM2 <= 0) return 0;
  const cellC = cfg.pv.waterTempC + (poaWm2 / 800) * cfg.pv.cellTempRiseC;
  const tempFactor = Math.max(0, 1 + cfg.panel.tempCoeffPerC * (cellC - 25));
  return poaWm2 * areaM2 * cfg.panel.efficiency * tempFactor * cfg.pv.mpptEff;
}
