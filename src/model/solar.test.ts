import { describe, it, expect } from 'vitest';
import { sunPosition, clearSkyGhi, poaIrradiance, pvPowerW, erbsDiffuseFraction } from './solar';
import { defaultConfig } from './defaults';
import { dayStartMs } from './time';

describe('solar', () => {
  it('matches the NREL SPA reference case', () => {
    // NREL SPA paper example: 2003-10-17 12:30:30 local (UTC-7), Golden CO.
    const p = sunPosition(Date.UTC(2003, 9, 17, 19, 30, 30), 39.742476, -105.1786);
    expect(Math.abs(p.zenithDeg - 50.11162)).toBeLessThan(0.05);
    expect(Math.abs(p.azimuthDeg - 194.34024)).toBeLessThan(0.1);
  });
  it('puts the sun overhead at the equator on the equinox at solar noon', () => {
    const p = sunPosition(Date.UTC(2027, 2, 20, 12, 7), 0, 0);
    expect(p.zenithDeg).toBeLessThan(1);
  });
  it('is below the horizon at night in Los Angeles', () => {
    expect(sunPosition(Date.UTC(2027, 5, 21, 8, 0), 33.9, -118.4).elevationDeg).toBeLessThan(0);
  });
  it('clear-sky GHI follows Haurwitz', () => {
    expect(clearSkyGhi(0)).toBeCloseTo(1098 * Math.exp(-0.057), 3);
    expect(clearSkyGhi(90)).toBe(0);
    expect(clearSkyGhi(120)).toBe(0);
  });
  it('Erbs diffuse fraction is bounded', () => {
    for (const kt of [0, 0.2, 0.5, 0.8, 1]) {
      const f = erbsDiffuseFraction(kt);
      expect(f).toBeGreaterThan(0.1);
      expect(f).toBeLessThanOrEqual(1);
    }
  });
  it('flat POA equals GHI and yaw tracking at zero tilt equals GHI', () => {
    const sun = sunPosition(Date.UTC(2027, 5, 21, 20), 33.05, -118.95);
    const ghi = clearSkyGhi(sun.zenithDeg);
    expect(poaIrradiance(ghi, sun, 'flat', 25, 60, 172)).toBeCloseTo(ghi, 6);
    expect(poaIrradiance(ghi, sun, 'yaw', 0, 60, 172)).toBeCloseTo(ghi, 6);
  });
  it('two-axis tracking gains 10 to 60 percent over flat on a clear June day', () => {
    let flat = 0, dual = 0;
    for (let k = 0; k < 288; k++) {
      const t = dayStartMs(172) + k * 300000;
      const sun = sunPosition(t, 33.05, -118.95);
      const ghi = sun.elevationDeg > 0 ? clearSkyGhi(sun.zenithDeg) : 0;
      flat += poaIrradiance(ghi, sun, 'flat', 25, 60, 172);
      dual += poaIrradiance(ghi, sun, 'dual', 25, 60, 172);
    }
    expect(dual / flat).toBeGreaterThan(1.1);
    expect(dual / flat).toBeLessThan(1.6);
  });
  it('POA is zero at night', () => {
    const sun = sunPosition(Date.UTC(2027, 5, 21, 8), 33.05, -118.95);
    expect(poaIrradiance(0, sun, 'dual', 25, 60, 172)).toBe(0);
  });
  it('PV power applies efficiency, temperature and MPPT', () => {
    const cfg = defaultConfig();
    cfg.panel.efficiency = 0.2;
    cfg.panel.tempCoeffPerC = -0.004;
    cfg.pv.waterTempC = 25;
    cfg.pv.cellTempRiseC = 0;
    cfg.pv.mpptEff = 0.97;
    expect(pvPowerW(1000, 1, cfg)).toBeCloseTo(194, 6);
    cfg.pv.cellTempRiseC = 20;
    expect(pvPowerW(800, 1, cfg)).toBeCloseTo(800 * 0.2 * (1 - 0.004 * 20) * 0.97, 6);
    expect(pvPowerW(-5, 1, cfg)).toBe(0);
  });
});
