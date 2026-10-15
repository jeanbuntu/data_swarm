import { describe, it, expect } from 'vitest';
import { dayStartMs, doyOf, monthOfDoy, midMonthDoy, localSolarHour, dateLabel } from './time';

describe('time', () => {
  it('maps day starts to day of year', () => {
    expect(doyOf(dayStartMs(1))).toBe(1);
    expect(doyOf(dayStartMs(365) + 1000)).toBe(365);
    expect(doyOf(dayStartMs(365) + 86400000)).toBe(1);
  });
  it('maps day of year to month', () => {
    expect(monthOfDoy(31)).toBe(0);
    expect(monthOfDoy(32)).toBe(1);
    expect(monthOfDoy(365)).toBe(11);
    expect(midMonthDoy(5)).toBe(166);
  });
  it('computes local solar hour from UTC and longitude', () => {
    expect(localSolarHour(Date.UTC(2027, 0, 1, 20), -120)).toBeCloseTo(12, 6);
    expect(localSolarHour(Date.UTC(2027, 0, 1, 2), -60)).toBeCloseTo(22, 6);
  });
  it('labels dates', () => {
    expect(dateLabel(172)).toBe('Jun 21');
  });
});
