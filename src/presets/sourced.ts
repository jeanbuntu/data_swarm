export interface Sourced {
  value: number;
  unit: string;
  source: string;
  date: string;
  estimate?: boolean;
  note?: string;
}

export const ACCESSED = '2026-10-15';

export const s = (value: number, unit: string, source: string, note?: string): Sourced => ({
  value,
  unit,
  source,
  date: ACCESSED,
  ...(note ? { note } : {}),
});

export const est = (value: number, unit: string, note: string): Sourced => ({
  value,
  unit,
  source: 'ESTIMATE',
  date: ACCESSED,
  estimate: true,
  note,
});

/** FX assumptions used to convert EUR and GBP prices. */
export const EUR_USD = est(1.1, 'USD/EUR', 'FX assumption for EUR prices; update to the current rate');
export const GBP_USD = est(1.27, 'USD/GBP', 'FX assumption for GBP prices; update to the current rate');
