import { create } from 'zustand';
import { ConfigSchema, SimConfig, setPath, parseConfig } from '../model/config';
import { defaultConfig, applyPreset, PresetKind } from '../model/defaults';
import type { AnnualResult } from '../model/annual';
import type { Econ } from '../model/economics';

export type TabId = 'map' | 'module' | 'energy' | 'economics' | 'optimizer' | 'assumptions';

const CURRENT_KEY = 'fleet.current.v1';
const SCENARIOS_KEY = 'fleet.scenarios.v1';

function readJSON(key: string): unknown {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJSON(key: string, value: unknown): void {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable (private window or blocked): keep working in memory.
  }
}

function initialConfig(): SimConfig {
  const r = parseConfig(readJSON(CURRENT_KEY));
  return r.ok ? r.config : defaultConfig();
}

function initialScenarios(): Record<string, SimConfig> {
  const raw = readJSON(SCENARIOS_KEY);
  const out: Record<string, SimConfig> = {};
  if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const r = parseConfig(v);
      if (r.ok) out[k] = r.config;
    }
  }
  return out;
}

export interface FleetStore {
  cfg: SimConfig;
  annual: AnnualResult | null;
  econ: Econ | null;
  running: boolean;
  runError: string | null;
  tab: TabId;
  investor: boolean;
  scenarios: Record<string, SimConfig>;
  notice: string | null;
  update(path: string, value: unknown): void;
  preset(kind: PresetKind, id: string): void;
  replace(cfg: SimConfig): void;
  reset(): void;
  setResults(annual: AnnualResult, econ: Econ): void;
  setRunning(running: boolean): void;
  setRunError(msg: string): void;
  setTab(tab: TabId): void;
  setInvestor(on: boolean): void;
  saveScenario(name: string): void;
  loadScenario(name: string): void;
  deleteScenario(name: string): void;
  setNotice(msg: string | null): void;
}

export const useFleet = create<FleetStore>((set, get) => ({
  cfg: initialConfig(),
  annual: null,
  econ: null,
  running: false,
  runError: null,
  tab: 'map',
  investor: false,
  scenarios: initialScenarios(),
  notice: null,
  update: (path, value) => set({ cfg: setPath(get().cfg, path, value) }),
  preset: (kind, id) => set({ cfg: applyPreset(get().cfg, kind, id) }),
  replace: (cfg) => set({ cfg }),
  reset: () => set({ cfg: defaultConfig(), notice: 'Restored the default scenario.' }),
  setResults: (annual, econ) => set({ annual, econ, running: false, runError: null }),
  setRunning: (running) => set({ running }),
  setRunError: (msg) => set({ runError: msg, running: false }),
  setTab: (tab) => set({ tab }),
  setInvestor: (investor) => set({ investor }),
  saveScenario: (name) => {
    const n = name.trim();
    if (!n) {
      set({ notice: 'Give the scenario a name before saving.' });
      return;
    }
    if (!ConfigSchema.safeParse(get().cfg).success) {
      set({ notice: 'This scenario has invalid inputs and was not saved.' });
      return;
    }
    set({ scenarios: { ...get().scenarios, [n]: get().cfg }, notice: `Saved "${n}".` });
  },
  loadScenario: (name) => {
    const c = get().scenarios[name];
    if (c) set({ cfg: c, notice: `Loaded "${name}".` });
  },
  deleteScenario: (name) => {
    const rest = { ...get().scenarios };
    delete rest[name];
    set({ scenarios: rest });
  },
  setNotice: (notice) => set({ notice }),
}));

// Only valid configs are persisted, so a reload never discards the last good scenario.
useFleet.subscribe((s, prev) => {
  if (s.cfg !== prev.cfg && ConfigSchema.safeParse(s.cfg).success) writeJSON(CURRENT_KEY, s.cfg);
  if (s.scenarios !== prev.scenarios) writeJSON(SCENARIOS_KEY, s.scenarios);
});
