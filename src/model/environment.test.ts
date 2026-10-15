import { describe, it, expect } from 'vitest';
import { createEnvironment, dayTypeProbs, marineDiurnal } from './environment';
import { makeProjection, distToPolyline, interpAnchors } from './geo';
import { defaultConfig } from './defaults';
import { dayStartMs, DAYS_IN_MONTH, monthOfDoy } from './time';
import { GHI_ANCHORS, COAST } from '../presets';

describe('geo', () => {
  it('projection round-trips', () => {
    const p = makeProjection(33, -119);
    const xy = p.toXY(33.5, -118.5);
    const ll = p.toLatLon(xy);
    expect(ll.lat).toBeCloseTo(33.5, 9);
    expect(ll.lon).toBeCloseTo(-118.5, 9);
    expect(xy.y).toBeCloseTo(0.5 * 110540, 3);
  });
  it('distance to a polyline', () => {
    expect(distToPolyline({ x: 0, y: 5 }, [{ x: -10, y: 0 }, { x: 10, y: 0 }])).toBeCloseTo(5, 9);
    expect(distToPolyline({ x: 13, y: 4 }, [{ x: -10, y: 0 }, { x: 10, y: 0 }])).toBeCloseTo(5, 9);
  });
  it('interpolates GHI anchors by distance and clamps', () => {
    expect(interpAnchors(10, GHI_ANCHORS, 6)).toBe(6.55);
    expect(interpAnchors(65, GHI_ANCHORS, 6)).toBeCloseTo((6.55 + 6.08) / 2, 9);
    expect(interpAnchors(0, GHI_ANCHORS, 6)).toBe(6.55);
    expect(interpAnchors(999, GHI_ANCHORS, 6)).toBe(4.99);
  });
});

describe('environment', () => {
  const cfg = defaultConfig();
  const env = createEnvironment(cfg);

  it('measures offshore distance', () => {
    const p = env.proj.toXY(COAST[14][0], COAST[14][1]);
    expect(env.offshoreKm(p.x, p.y)).toBeLessThan(0.5);
    const km = env.offshoreKm(0, 0);
    expect(km).toBeGreaterThan(60);
    expect(km).toBeLessThan(140);
  });

  it('day type probabilities sum to 1', () => {
    for (let m = 0; m < 12; m++) {
      const p = dayTypeProbs(m);
      expect(p.clear + p.partial + p.cloudy).toBeCloseTo(1, 9);
    }
  });

  it('marine diurnal factor is 1 when the layer is off and lower at dawn in June', () => {
    expect(marineDiurnal(7, 0, 1)).toBe(1);
    expect(marineDiurnal(7, 5, 1)).toBeLessThan(marineDiurnal(14, 5, 1));
  });

  it('calibrates monthly mean GHI to NASA POWER at the origin', () => {
    const c = defaultConfig();
    c.env.dayVariability = 0;
    c.env.cloudCellAmp = 0;
    const e = createEnvironment(c);
    const km = e.offshoreKm(0, 0);
    let doy = 1;
    for (let m = 0; m < 12; m++) {
      let kwh = 0;
      for (let d = 0; d < DAYS_IN_MONTH[m]; d++, doy++) {
        for (let k = 0; k < 96; k++) kwh += (e.ghi(dayStartMs(doy) + k * 900000, 0, 0) * 0.25) / 1000;
      }
      const mean = kwh / DAYS_IN_MONTH[m];
      const target = e.monthlyTargetGhi(m, km);
      expect(Math.abs(mean - target) / target).toBeLessThan(0.03);
    }
  });

  it('is deterministic for a seed and varies by seed', () => {
    const t = dayStartMs(172) + 12 * 3600000;
    expect(createEnvironment(cfg).ghi(t, 1000, 2000)).toBe(env.ghi(t, 1000, 2000));
    const other = createEnvironment({ ...cfg, seed: 7 });
    const days = Array.from({ length: 30 }, (_, i) => other.dayType(i + 1) === env.dayType(i + 1));
    expect(days.some((same) => !same)).toBe(true);
  });

  it('forced day type overrides the draw', () => {
    const e = createEnvironment(cfg, { forcedDayType: 'cloudy' });
    for (let d = 1; d < 30; d++) expect(e.dayType(d)).toBe('cloudy');
  });

  it('annual mean current matches the configured drift', () => {
    let u = 0, v = 0, n = 0;
    for (let h = 0; h < 8760; h += 1) {
      const c = env.current(dayStartMs(1) + h * 3600000);
      u += c.x; v += c.y; n++;
    }
    const hd = (cfg.env.currentHeadingDeg * Math.PI) / 180;
    expect(Math.abs(u / n - cfg.env.currentMs * Math.sin(hd))).toBeLessThan(0.02);
    expect(Math.abs(v / n - cfg.env.currentMs * Math.cos(hd))).toBeLessThan(0.02);
  });

  it('stows petals when wind exceeds the threshold', () => {
    const c = defaultConfig();
    c.env.stowWindMs = 0;
    expect(createEnvironment(c).stowed(dayStartMs(10))).toBe(true);
    c.env.stowWindMs = 40;
    expect(createEnvironment(c).stowed(dayStartMs(10))).toBe(false);
  });

  it('GHI is zero at night and never exceeds 1.05x clear-sky', () => {
    const t = dayStartMs(172) + 2 * 3600000;
    expect(env.ghi(t, 0, 0)).toBe(0);
    for (let k = 0; k < 96; k++) {
      const tt = dayStartMs(172) + k * 900000;
      const sun = env.sun(tt);
      if (sun.elevationDeg > 0) expect(env.ghi(tt, 0, 0)).toBeLessThanOrEqual(1.05 * 1098 * Math.cos((sun.zenithDeg * Math.PI) / 180) + 1e-6);
    }
    expect(monthOfDoy(172)).toBe(5);
  });
});
