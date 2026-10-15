import { describe, it, expect } from 'vitest';
import { PANEL_DEFS } from './panelDefs';
import { defaultConfig } from '../model/defaults';
import { ConfigSchema, getPath, setPath } from '../model/config';

describe('panel definitions', () => {
  const cfg = defaultConfig();
  const sliders = PANEL_DEFS.flatMap((p) => p.items).filter((i) => i.kind === 'slider');

  it('every slider points at a numeric config path', () => {
    for (const s of sliders) if (s.kind === 'slider') expect(typeof getPath(cfg, s.path)).toBe('number');
  });
  it('default values sit inside slider ranges', () => {
    for (const s of sliders) {
      if (s.kind !== 'slider') continue;
      const v = (getPath(cfg, s.path) as number) * (s.scale ?? 1);
      expect(v, s.path).toBeGreaterThanOrEqual(s.min - 1e-9);
      expect(v, s.path).toBeLessThanOrEqual(s.max + 1e-9);
    }
  });
  it('slider endpoints are valid config values', () => {
    for (const s of sliders) {
      if (s.kind !== 'slider') continue;
      for (const end of [s.min, s.max]) {
        const r = ConfigSchema.safeParse(setPath(cfg, s.path, end / (s.scale ?? 1)));
        expect(r.success, `${s.path}=${end}`).toBe(true);
      }
    }
  });
});
