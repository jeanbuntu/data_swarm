import type { Binding } from '../model/jobs';

const isNum = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

export function fmtNum(v: number | null | undefined, digits = 0): string {
  return isNum(v) ? v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : 'n/a';
}

export function fmtUsd(v: number | null | undefined, digits = 0): string {
  if (!isNum(v)) return 'n/a';
  const s = fmtNum(Math.abs(v), digits);
  return v < 0 ? `-$${s}` : `$${s}`;
}

export function fmtCompact(v: number | null | undefined): string {
  return isNum(v) ? new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(v) : 'n/a';
}

export function fmtUsdCompact(v: number | null | undefined): string {
  if (!isNum(v)) return 'n/a';
  const s = fmtCompact(Math.abs(v));
  return v < 0 ? `-$${s}` : `$${s}`;
}

export function fmtPct(v: number | null | undefined, digits = 0): string {
  return isNum(v) ? `${(v * 100).toFixed(digits)}%` : 'n/a';
}

export function fmtMonths(m: number | null): string {
  if (m === null || !Number.isFinite(m)) return 'Never';
  return m < 24 ? `${Math.round(m)} mo` : `${(m / 12).toFixed(1)} yr`;
}

export function fmtHour(h: number): string {
  const hh = Math.floor(h) % 24;
  const mm = Math.floor((h - Math.floor(h)) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export const BINDING_LABEL: Record<Binding, string> = { power: 'Power', bandwidth: 'Bandwidth', demand: 'Demand' };

export function topBinding(h: Record<Binding, number>): { key: Binding; share: number } {
  const total = h.power + h.bandwidth + h.demand;
  const key = (Object.keys(h) as Binding[]).reduce((a, b) => (h[b] > h[a] ? b : a), 'power');
  return { key, share: total > 0 ? h[key] / total : 0 };
}
