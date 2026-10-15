import { Sourced, s, est } from './sourced';

export const POWER_CLIM = 'https://power.larc.nasa.gov/api/temporal/climatology/point (NASA POWER climatology 2001-2025)';
export const POWER_DAILY = 'https://power.larc.nasa.gov/api/temporal/daily/point (NASA POWER daily 2015-2024, derived)';
export const POWER_HOURLY = 'https://power.larc.nasa.gov/api/temporal/hourly/point (NASA POWER hourly, June 2019-2023, derived)';
export const OM_MARINE = 'https://marine-api.open-meteo.com/v1/marine (Open-Meteo Marine, Meteo-France SMOC, Oct 2023 to Sep 2025)';
export const NDBC = 'https://www.ndbc.noaa.gov/ (NDBC buoys 46025, 46086, 46069, 46047, 2020-2024)';

/** Coastline from north of Point Conception to the Mexico border, [lat, lon]. */
export const COAST: [number, number][] = [
  [34.9, -120.65], [34.76, -120.64], [34.58, -120.65], [34.449, -120.471], [34.47, -120.22], [34.41, -119.85],
  [34.4, -119.7], [34.39, -119.52], [34.27, -119.29], [34.15, -119.2], [34.09, -119.06], [34.04, -118.92],
  [34.0, -118.81], [34.03, -118.68], [34.01, -118.5], [33.92, -118.43], [33.8, -118.4], [33.74, -118.41],
  [33.71, -118.29], [33.75, -118.2], [33.7, -118.05], [33.65, -118.0], [33.6, -117.88], [33.54, -117.78],
  [33.46, -117.7], [33.42, -117.62], [33.3, -117.47], [33.19, -117.38], [33.0, -117.28], [32.85, -117.27],
  [32.75, -117.25], [32.67, -117.24], [32.53, -117.12], [32.3, -117.06],
];

export const LAND_POLYGON: [number, number][] = [...COAST, [32.2, -117.0], [32.2, -116.8], [35.0, -116.8], [35.0, -120.7]];

export const MAP_BOUNDS = { latMin: 32.3, latMax: 34.9, lonMin: -121.0, lonMax: -116.9 };

export const ISLANDS = [
  { name: 'San Miguel', lat: 34.04, lon: -120.37, rxKm: 6, ryKm: 4 },
  { name: 'Santa Rosa', lat: 33.96, lon: -120.1, rxKm: 12, ryKm: 8 },
  { name: 'Santa Cruz', lat: 34.01, lon: -119.75, rxKm: 18, ryKm: 6 },
  { name: 'Anacapa', lat: 34.01, lon: -119.4, rxKm: 4, ryKm: 1 },
  { name: 'Santa Barbara', lat: 33.48, lon: -119.04, rxKm: 2, ryKm: 2 },
  { name: 'San Nicolas', lat: 33.25, lon: -119.5, rxKm: 7, ryKm: 3 },
  { name: 'Santa Catalina', lat: 33.38, lon: -118.42, rxKm: 17, ryKm: 6 },
  { name: 'San Clemente', lat: 32.9, lon: -118.5, rxKm: 6, ryKm: 16 },
];

export interface GhiAnchor { km: number; label: string; monthly: number[]; source: string }

/** Monthly all-sky GHI, kWh/m2/day, by distance offshore. */
export const GHI_ANCHORS: GhiAnchor[] = [
  { km: 10, label: 'Inner Bight / LA cell (33.95, -118.45)', monthly: [3.14, 4.01, 5.17, 6.32, 6.55, 6.29, 6.55, 6.34, 5.47, 4.31, 3.4, 2.83], source: POWER_CLIM },
  { km: 120, label: 'Outer Bight (33.3, -119.5)', monthly: [3.19, 4.06, 5.19, 6.4, 6.58, 6.13, 6.08, 5.84, 5.28, 4.27, 3.43, 2.88], source: POWER_CLIM },
  { km: 300, label: '300 km offshore (32.5, -121.5)', monthly: [3.15, 3.89, 5.04, 6.0, 6.14, 5.92, 4.99, 4.82, 4.91, 4.15, 3.36, 2.81], source: POWER_CLIM },
];

/** Day-type shares. Summer means May to July. */
export const DAY_TYPE = {
  summer: {
    clear: s(0.26, 'fraction', POWER_DAILY, 'May to Jul outer Bight, clearness K >= 0.9'),
    cloudy: s(0.26, 'fraction', POWER_DAILY, 'May to Jul outer Bight, clearness K < 0.6'),
  },
  other: {
    clear: est(0.53, 'fraction', 'derived from the 46% full-year clear share after removing summer months'),
    cloudy: est(0.1, 'fraction', 'no direct source for non-summer cloudy share'),
  },
};

/** Daily irradiance relative to a clear day, by day type. */
export const DAY_K = {
  clear: s(1.0, 'relative', POWER_DAILY, 'clear days deliver 0.96 to 0.97 of clear-sky; normalized to 1'),
  partial: est(0.8, 'relative', 'between clear and cloudy'),
  cloudy: s(0.5, 'relative', POWER_DAILY, 'cloudy days deliver about 0.48 to 0.50 of clear-sky'),
};

/** June hourly clearness profile in the outer Bight, [local solar hour, K]. */
export const MARINE_PROFILE: [number, number][] = [[5, 0.5], [6, 0.54], [9, 0.64], [12, 0.76], [14, 0.8], [20, 0.8]];
export const MARINE_PROFILE_SOURCE = s(0.8, 'K at peak', POWER_HOURLY, 'June outer Bight: 0.54 at 06, 0.64 at 09, 0.76 at 12, 0.80 at 14 LST; values before 06 and after 14 are held');

/** Marine layer strength by month, 0 to 1 (June is the cloudiest month in SoCal). */
export const MARINE_MONTHLY_STRENGTH = [0, 0, 0, 0.2, 0.7, 1, 0.8, 0.5, 0.3, 0, 0, 0];
export const MARINE_MONTHLY_SOURCE = est(1, 'relative', 'seasonal shape from sources noting June as the cloudiest SoCal month; month weights are estimates');

export const SOCAL_ENV: Record<string, Sourced> = {
  originLat: s(33.05, 'deg', POWER_CLIM, 'design choice inside the outer Bight cell, between Santa Catalina and San Nicolas islands'),
  originLon: s(-118.95, 'deg', POWER_CLIM, 'design choice inside the outer Bight cell'),
  currentMs: s(0.15, 'm/s', OM_MARINE, 'vector-mean drift at 33.3, -119.5'),
  currentHeadingDeg: s(141, 'deg toward', OM_MARINE, 'vector-mean drift direction'),
  currentVariabilityMs: est(0.12, 'm/s', 'chosen so speed p90 approaches the sourced 0.39 m/s'),
  tidalMs: est(0.08, 'm/s', 'tidal amplitude; SMOC total includes tides'),
  windMeanMs: s(5.0, 'm/s', POWER_CLIM, 'WS10M outer Bight'),
  stowWindMs: s(13.9, 'm/s', NDBC, '27 kt; threshold choice is ours, buoys show 1 to 13% of days exceed it'),
  cloudCellKm: s(30, 'km', 'https://par.nsf.gov/servlets/purl/10286039', 'marine stratocumulus cells are 10 to 100 km'),
  cloudCellAmp: est(0.15, 'fraction', 'cloud cell irradiance swing'),
  cloudDriftMs: est(5.7, 'm/s', 'boundary-layer wind, POWER WS50M outer Bight'),
  cloudDriftHeadingDeg: est(135, 'deg toward', 'northwest winds carry clouds toward the southeast'),
  dayVariability: est(1, 'x', 'scales day-to-day variation; 1 uses sourced day-type shares'),
  marineLayerStrength: est(1, 'x', 'scales the marine layer diurnal cycle'),
  disturbanceMs: est(0.02, 'm/s', 'wave and wind random drift'),
};
