/** Simulation year 2027 (not a leap year), starting at local midnight PST (UTC-8). */
export const YEAR_START_MS = Date.UTC(2027, 0, 1, 8, 0, 0);
export const DAY_MS = 86400000;
export const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function dayStartMs(doy: number): number {
  return YEAR_START_MS + (doy - 1) * DAY_MS;
}

export function doyOf(t: number): number {
  const d = Math.floor((t - YEAR_START_MS) / DAY_MS);
  return (((d % 365) + 365) % 365) + 1;
}

export function monthOfDoy(doy: number): number {
  let acc = 0;
  for (let m = 0; m < 12; m++) {
    acc += DAYS_IN_MONTH[m];
    if (doy <= acc) return m;
  }
  return 11;
}

export function midMonthDoy(m: number): number {
  let acc = 0;
  for (let i = 0; i < m; i++) acc += DAYS_IN_MONTH[i];
  return acc + 15;
}

export function localSolarHour(t: number, lonDeg: number): number {
  const h = (t / 3600000 + lonDeg / 15) % 24;
  return (h + 24) % 24;
}

export function dateLabel(doy: number): string {
  const m = monthOfDoy(doy);
  let acc = 0;
  for (let i = 0; i < m; i++) acc += DAYS_IN_MONTH[i];
  return `${MONTH_NAMES[m]} ${doy - acc}`;
}
