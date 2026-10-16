import { describe, it, expect } from 'vitest';
import { ConfigSchema, parseConfig, getPath, setPath, leafPaths } from './config';
import { defaultConfig, applyPreset, sourceFor, SOURCED_DEFAULTS, payOverage } from './defaults';

describe('config', () => {
  it('default config passes the schema', () => {
    expect(ConfigSchema.safeParse(defaultConfig()).success).toBe(true);
  });
  it('default config uses the spec defaults', () => {
    const c = defaultConfig();
    expect(c.name).toBe('Baseline 20-module swarm');
    expect(c.hull.sideM).toBe(1.52);
    expect(c.swarm.count).toBe(20);
    expect(c.compute.presetId).toBe('l4');
    expect(c.comms.planId).toBe('gp-1tb');
    expect(c.env.originLat).toBe(33.05);
  });
  it('every numeric leaf has a source except version and seed', () => {
    const c = defaultConfig();
    const missing = leafPaths(c)
      .filter((p) => typeof getPath(c, p) === 'number' && p !== 'version' && p !== 'seed')
      .filter((p) => !sourceFor(c, p));
    expect(missing).toEqual([]);
  });
  it('SOURCED_DEFAULTS values match the default config', () => {
    const c = defaultConfig();
    for (const [path, src] of SOURCED_DEFAULTS) expect(getPath(c, path)).toBe(src.value);
  });
  it('getPath and setPath work and setPath does not mutate', () => {
    const c = defaultConfig();
    const d = setPath(c, 'battery.kwh', 12);
    expect(getPath(d, 'battery.kwh')).toBe(12);
    expect(getPath(c, 'battery.kwh')).toBe(8);
    expect(() => setPath(c, 'battery.nope', 1)).toThrow(/Unknown config path/);
  });
  it('applyPreset copies preset values and prices', () => {
    const c = applyPreset(defaultConfig(), 'accelerator', 'h100-sxm');
    expect(c.compute.presetId).toBe('h100-sxm');
    expect(c.compute.tdpW).toBe(700);
    expect(c.econ.firmUsdPerGpuH).toBe(6.16);
    expect(() => applyPreset(c, 'panel', 'nope')).toThrow(/Unknown panel preset/);
  });
  it('applyPreset for plans copies the nullable overage', () => {
    const c = applyPreset(defaultConfig(), 'plan', 'ocean-mode');
    expect(c.comms.overageUsdPerGB).toBe(6);
    expect(c.comms.planCapGB).toBe(0);
    expect(payOverage(c)).toBe(true);
    expect(payOverage(defaultConfig())).toBe(false);
  });
  it('sourceFor reports preset sources and marks custom values', () => {
    const c = defaultConfig();
    expect(sourceFor(c, 'panel.efficiency')?.source).toContain('solarproof');
    expect(sourceFor(c, 'econ.hullUsd')?.estimate).toBe(true);
  });
  it('parseConfig round-trips JSON', () => {
    const c = defaultConfig();
    const r = parseConfig(JSON.parse(JSON.stringify(c)));
    expect(r.ok && r.config).toEqual(c);
  });
  it('parseConfig rejects malformed and out-of-range input with field paths', () => {
    const bad = JSON.parse(JSON.stringify(defaultConfig()));
    bad.battery.rte = 1.7;
    bad.version = 0;
    delete bad.swarm.count;
    const r = parseConfig(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.startsWith('battery.rte'))).toBe(true);
      expect(r.errors.some((e) => e.startsWith('version'))).toBe(true);
      expect(r.errors.some((e) => e.startsWith('swarm.count'))).toBe(true);
    }
    expect(parseConfig('not json object').ok).toBe(false);
  });
  it('migrates version 1 scenarios by adding default market settings', () => {
    const old = JSON.parse(JSON.stringify(defaultConfig()));
    delete old.market;
    old.version = 1;
    const r = parseConfig(old);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.config.version).toBe(3);
      expect(r.config.market).toEqual(defaultConfig().market);
    }
  });
  it('migrates version 2 scenarios by adding hub-cluster settings, off by default', () => {
    const old = JSON.parse(JSON.stringify(defaultConfig()));
    old.version = 2;
    delete old.comms.hubMode;
    delete old.loads.masterAvionicsW;
    delete old.loads.followerAvionicsW;
    delete old.battery.followerExtraKwh;
    delete old.econ.masterAvionicsUsd;
    delete old.econ.followerAvionicsUsd;
    const r = parseConfig(old);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.config).toEqual(defaultConfig());
  });
});
