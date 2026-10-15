import { describe, it, expect } from 'vitest';
import { fmtNum, fmtUsd, fmtCompact, fmtPct, fmtMonths, fmtHour, topBinding } from './format';

describe('format', () => {
  it('formats numbers and handles non-finite values', () => {
    expect(fmtNum(1234.567, 1)).toBe('1,234.6');
    expect(fmtUsd(-1234.4)).toBe('-$1,234');
    expect(fmtUsd(Infinity)).toBe('n/a');
    expect(fmtNum(NaN)).toBe('n/a');
    expect(fmtCompact(1234567)).toBe('1.2M');
    expect(fmtPct(0.123, 1)).toBe('12.3%');
  });
  it('formats months and hours', () => {
    expect(fmtMonths(null)).toBe('Never');
    expect(fmtMonths(10.4)).toBe('10 mo');
    expect(fmtMonths(30)).toBe('2.5 yr');
    expect(fmtHour(13.5)).toBe('13:30');
  });
  it('finds the top binding constraint', () => {
    expect(topBinding({ power: 10, bandwidth: 30, demand: 0 })).toEqual({ key: 'bandwidth', share: 0.75 });
  });
});
