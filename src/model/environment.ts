import type { SimConfig } from './config';
import { sunPosition, clearSkyGhi, SunPos } from './solar';
import { valueNoise3 } from './noise';
import { mulberry32, hashSeed } from './rng';
import { makeProjection, distToPolyline, interpAnchors, Projection } from './geo';
import type { Vec } from './vec';
import { RAD, TIDAL_AXIS_DEG } from './constants';
import { YEAR_START_MS, doyOf, monthOfDoy, localSolarHour, midMonthDoy, dayStartMs } from './time';
import { COAST, GHI_ANCHORS, DAY_TYPE, DAY_K, MARINE_PROFILE, MARINE_MONTHLY_STRENGTH } from '../presets';

export type DayType = 'clear' | 'partial' | 'cloudy';

export interface Env {
  proj: Projection;
  coastXY: Vec[];
  sun(t: number): SunPos;
  ghi(t: number, x: number, y: number): number;
  current(t: number): Vec;
  wind(t: number): number;
  stowed(t: number): boolean;
  offshoreKm(x: number, y: number): number;
  dayType(doy: number): DayType;
  monthlyTargetGhi(month0: number, offshoreKm: number): number;
}

export function dayTypeProbs(month0: number): Record<DayType, number> {
  const p = month0 >= 4 && month0 <= 6 ? DAY_TYPE.summer : DAY_TYPE.other;
  return { clear: p.clear.value, cloudy: p.cloudy.value, partial: 1 - p.clear.value - p.cloudy.value };
}

function expectedRelative(month0: number): number {
  const p = dayTypeProbs(month0);
  return p.clear * DAY_K.clear.value + p.partial * DAY_K.partial.value + p.cloudy * DAY_K.cloudy.value;
}

const PROFILE_PEAK = Math.max(...MARINE_PROFILE.map(([, k]) => k));

function profileAt(hour: number): number {
  const pts = MARINE_PROFILE;
  if (hour <= pts[0][0]) return pts[0][1];
  for (let i = 0; i < pts.length - 1; i++) {
    const [h0, k0] = pts[i], [h1, k1] = pts[i + 1];
    if (hour <= h1) return k0 + ((hour - h0) / (h1 - h0)) * (k1 - k0);
  }
  return pts[pts.length - 1][1];
}

/** Multiplier for the marine layer at a local solar hour; 1 when the layer is absent. */
export function marineDiurnal(hour: number, month0: number, strength: number): number {
  const s = MARINE_MONTHLY_STRENGTH[month0] * strength;
  if (s <= 0) return 1;
  return Math.max(0.05, 1 - s * (1 - profileAt(hour) / PROFILE_PEAK));
}

const calibrationCache = new Map<string, number[]>();

/** Mean daily clear-sky GHI times the marine diurnal factor, kWh/m2/day, per month. */
function clearDiurnalMeans(lat: number, lon: number, strength: number): number[] {
  const key = `${lat}|${lon}|${strength}`;
  const hit = calibrationCache.get(key);
  if (hit) return hit;
  const out: number[] = [];
  for (let m = 0; m < 12; m++) {
    const t0 = dayStartMs(midMonthDoy(m));
    let kwh = 0;
    for (let k = 0; k < 144; k++) {
      const t = t0 + k * 600000;
      const sun = sunPosition(t, lat, lon);
      kwh += (clearSkyGhi(sun.zenithDeg) * marineDiurnal(localSolarHour(t, lon), m, strength)) / 6 / 1000;
    }
    out.push(kwh);
  }
  calibrationCache.set(key, out);
  return out;
}

export function createEnvironment(cfg: SimConfig, opts: { forcedDayType?: DayType } = {}): Env {
  const e = cfg.env;
  const lat0 = e.originLat, lon0 = e.originLon;
  const proj = makeProjection(lat0, lon0);
  const coastXY = COAST.map(([la, lo]) => proj.toXY(la, lo));
  const cal = clearDiurnalMeans(lat0, lon0, e.marineLayerStrength);
  const dayCache = new Map<number, { type: DayType; factor: number; windMean: number }>();

  const dayInfo = (doy: number) => {
    const hit = dayCache.get(doy);
    if (hit) return hit;
    const rng = mulberry32(hashSeed(cfg.seed, doy));
    const m = monthOfDoy(doy);
    const p = dayTypeProbs(m);
    const u = rng();
    const drawn: DayType = u < p.clear ? 'clear' : u < p.clear + p.partial ? 'partial' : 'cloudy';
    const type = opts.forcedDayType ?? drawn;
    const raw = DAY_K[type].value / expectedRelative(m);
    const factor = 1 + e.dayVariability * (raw - 1);
    const weibullScale = e.windMeanMs / 0.8862;
    const windMean = weibullScale * Math.sqrt(-Math.log(1 - rng()));
    const info = { type, factor, windMean };
    dayCache.set(doy, info);
    return info;
  };

  let lastT = NaN;
  let lastSun: SunPos = { zenithDeg: 90, azimuthDeg: 0, elevationDeg: 0 };
  const sun = (t: number) => {
    if (t !== lastT) {
      lastSun = sunPosition(t, lat0, lon0);
      lastT = t;
    }
    return lastSun;
  };

  const offshoreKm = (x: number, y: number) => distToPolyline({ x, y }, coastXY) / 1000;
  const cloudHeading = e.cloudDriftHeadingDeg * RAD;
  const driftKmH = { x: e.cloudDriftMs * 3.6 * Math.sin(cloudHeading), y: e.cloudDriftMs * 3.6 * Math.cos(cloudHeading) };
  const cloudSeed = (cfg.seed ^ 0x5bd1e995) | 0;

  const ghi = (t: number, x: number, y: number) => {
    const sp = sun(t);
    if (sp.elevationDeg <= 0) return 0;
    const clear = clearSkyGhi(sp.zenithDeg);
    const doy = doyOf(t);
    const m = monthOfDoy(doy);
    const k = interpAnchors(offshoreKm(x, y), GHI_ANCHORS, m) / cal[m];
    const diurnal = marineDiurnal(localSolarHour(t, lon0), m, e.marineLayerStrength);
    const tH = (t - YEAR_START_MS) / 3600000;
    const nz = valueNoise3(cloudSeed, (x / 1000 - driftKmH.x * tH) / e.cloudCellKm, (y / 1000 - driftKmH.y * tH) / e.cloudCellKm, tH / 6);
    const cell = 1 + e.cloudCellAmp * (2 * nz - 1);
    return Math.max(0, Math.min(clear * 1.05, clear * k * diurnal * dayInfo(doy).factor * cell));
  };

  const meanCurrent = { x: e.currentMs * Math.sin(e.currentHeadingDeg * RAD), y: e.currentMs * Math.cos(e.currentHeadingDeg * RAD) };
  const tidalAxis = { x: Math.sin(TIDAL_AXIS_DEG * RAD), y: Math.cos(TIDAL_AXIS_DEG * RAD) };
  const current = (t: number): Vec => {
    const tH = (t - YEAR_START_MS) / 3600000;
    const tide = e.tidalMs * Math.cos((2 * Math.PI * tH) / 12.42);
    const tD = tH / 24 / 2;
    const nu = 2 * valueNoise3(cfg.seed + 11, tD, 0.5, 0.5) - 1;
    const nv = 2 * valueNoise3(cfg.seed + 13, tD, 0.5, 0.5) - 1;
    return {
      x: meanCurrent.x + tide * tidalAxis.x + e.currentVariabilityMs * nu,
      y: meanCurrent.y + tide * tidalAxis.y + e.currentVariabilityMs * nv,
    };
  };

  const wind = (t: number) => {
    const h = localSolarHour(t, lon0);
    return dayInfo(doyOf(t)).windMean * (1 + 0.2 * Math.sin((2 * Math.PI * (h - 9)) / 24));
  };

  return {
    proj,
    coastXY,
    sun,
    ghi,
    current,
    wind,
    stowed: (t) => wind(t) > e.stowWindMs,
    offshoreKm,
    dayType: (doy) => dayInfo(doy).type,
    monthlyTargetGhi: (m, km) => interpAnchors(km, GHI_ANCHORS, m),
  };
}
