# Fleet Simulator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Fleet, a local browser app that simulates a swarm of solar-powered floating compute modules off Southern California and shows the founder and investors delivered compute, compute-as-a-service economics, and optimized configurations.

**Architecture:** A Vite + React + TypeScript single-page app with no backend. All physics, swarm, job, and economics logic lives in pure, deterministic, unit-tested TypeScript modules under `src/model/` (no DOM or React imports). Vendor and environment defaults live in `src/presets/`, and every value carries its source and access date. The UI reads one Zustand store holding the scenario config. A Web Worker runs the 365-day annual model whenever the config changes, a second worker runs the optimizer, and the live map steps a one-day simulation on the main thread.

**Tech Stack:** Node 20, Vite 5.4.11, React 18.3.1, TypeScript 5.6.3, Zustand 4.5.5, Recharts 2.13.3, Zod 3.23.8, Vitest 2.1.8.

**Spec:** `docs/superpowers/specs/2026-10-15-fleet-simulator-design.md` (sourced data: `docs/research/2026-10-15-default-parameters.md`). Read both before starting.

## Global Constraints

- The app name shown on screen is exactly `Fleet`. No GMR branding or GMR product names anywhere.
- No em dashes in UI copy, docs, comments, or commit messages.
- Every default numeric parameter must be traceable: either a preset field (`Sourced`) or an entry in `SOURCED_DEFAULTS`. Unsourced values use `est(...)` and show an `EST` badge in the UI.
- `src/model/**` must not import React, the DOM, `window`, or `Math.random`. All randomness goes through the seeded RNG in `src/model/rng.ts`.
- Pin dependency versions exactly as listed in Task 1 (no `^` or `~`).
- Default location: offshore Los Angeles, origin 33.05 N, 118.95 W.
- Business model is compute as a service: firm (battery-backed) capacity at the firm price, interruptible (solar surplus) capacity at the spot price.
- Before writing chart code (Tasks 15 to 17), load the `dataviz` skill and follow its palette and mark guidance. Before UI tasks (13 to 18), load `frontend-design`.
- End every commit message with the session's Co-Authored-By trailer.
- Run `npm test` and `npm run typecheck` before every commit. Both must pass.

## Spec adjustments made while planning (already applied to the spec)

- The optimizer uses 36 representative days (clear, partial, and cloudy for each month) with 4 sampled modules, not 12 days.
- The default origin is 33.05 N, 118.95 W, because 33.3 N, 119.5 W is San Nicolas Island.
- Live playback runs at 60x to 20,000x.
- The default Starlink plan is Global Priority 1 TB.
- Location presets outside SoCal are deferred.

## Review Focus

1. **Degenerate configs** (0 cards, 0 kWh battery, 0 thrusters, 0 petals, accelerator with 0 TFLOPS): no NaN or crash. Cost per GPU-hour shows `n/a` and KPIs stay readable. Pinned by `annual.test.ts` "degenerate config" and `economics.test.ts` "zero GPU-hours".
2. **Imported scenario JSON that is malformed, an older version, or out of range:** rejected with field-level messages, and the current scenario is untouched. Pinned by `config.test.ts` "parseConfig rejects".
3. **Current faster than the thrusters can hold:** modules drift and become strays, positions stay finite, and feasibility warns. Pinned by `swarm.test.ts` "overpowered by current" and `feasibility.test.ts` "thrust warning".
4. **Browser storage unavailable** (private window, blocked storage): the app loads the default scenario and works. Pinned by `store.test.ts` "loads without localStorage".
5. **Swarm size extremes (1 and 100 modules) and tight spacing:** the annual run completes with finite totals. Pinned by `annual.test.ts` "single module" and `optimizer.test.ts` "100-module evaluation".
6. **An invalid scenario state** (empty name field, an optimizer point outside slider bounds): it must never overwrite the last valid saved scenario or be exported, because a reload would otherwise fall back to defaults and silently lose the founder's work. Pinned by `store.persist.test.ts` "persists only valid configs". Pareto range inputs are clamped to slider bounds (Task 17), and Export refuses invalid configs with a message (Task 13).

## Performance budget

The approach was chosen for instant slider feedback, so timing is part of done:
- Task 9 prints the wall time of `runAnnual(defaultConfig(), 'full')`. If it is over about 2 s on this machine, change the annual worker (Task 13) to post a representative-mode result first and the full-year result second.
- Task 11 prints the wall time of one `evaluate()`. If it is over about 0.5 s, lower the Pareto default sample count in Task 17 from 200 so a run stays under about 2 minutes.
- Module and Energy tabs (Task 15) run a full live day on config changes; they use `useDeferredValue` so slider drags stay smooth.

## File Map

```
package.json, tsconfig.json, vite.config.ts, index.html, .gitignore, README.md
src/main.tsx                      React entry
src/App.tsx                       layout shell
src/styles.css                    tokens (light/dark), layout
src/model/
  constants.ts                    physical and model constants
  rng.ts                          seeded RNG, normal, poisson, hashSeed, pickIndex
  noise.ts                        3D value noise
  vec.ts                          2D vector helpers
  time.ts                         simulation calendar helpers
  config.ts                       Zod schema, SimConfig type, parse, getPath/setPath/leafPaths
  defaults.ts                     preset binding, SOURCED_DEFAULTS, defaultConfig, applyPreset, sourceFor
  solar.ts                        sun position, clear-sky GHI, POA irradiance, PV power
  geo.ts                          projection, polyline distance, anchor interpolation
  environment.ts                  irradiance field, marine layer, clouds, current, wind
  derive.ts                       derived module quantities
  module.ts                       battery and power dispatch per timestep
  swarm.ts                        formation, station keeping, strays, centroid strategies
  jobs.ts                         workload mix, aggregate model, discrete job simulation
  annual.ts                       365-day and representative-day runners
  economics.ts                    capex, opex, revenue tiers, NPV/IRR/payback
  feasibility.ts                  red-flag checks
  optimizer.ts                    evaluate, sweep, Pareto, tornado
  live.ts                         one-day live simulation for the map and charts
src/presets/
  sourced.ts                      Sourced type and helpers
  hardware.ts                     panels, batteries, accelerators, terminals, plans, thrusters
  costs.ts                        cost and physical estimates
  socal.ts                        coastline, islands, GHI anchors, marine layer, ocean defaults
  workloads.ts                    job workload presets
  index.ts                        re-exports, ALL_SOURCED walk helper
src/state/
  store.ts                        Zustand store and persistence
  useAnnualRunner.ts              annual worker hook
  useOptimizer.ts                 optimizer worker hook
  useAnimationLoop.ts             rAF hook
src/workers/
  protocol.ts                     worker message types
  annual.worker.ts
  optimizer.worker.ts
src/ui/
  format.ts, controls.tsx, panelDefs.ts, ParamPanels.tsx, Header.tsx, KpiStrip.tsx, Tabs.tsx
  map/MapCanvas.tsx, map/FormationCanvas.tsx, tabs/SwarmMapTab.tsx
  tabs/ModuleTab.tsx, tabs/FlowerSvg.tsx, tabs/EnergyTab.tsx
  tabs/EconomicsTab.tsx, tabs/econParts.tsx, InvestorView.tsx
  tabs/OptimizerTab.tsx, tabs/AssumptionsTab.tsx
```

Tests live next to the module they test as `*.test.ts`.

---

### Task 1: Project scaffold and core utilities

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`, `src/main.tsx`, `src/App.tsx`, `src/styles.css` (placeholder, replaced in Task 13)
- Create: `src/model/constants.ts`, `src/model/rng.ts`, `src/model/noise.ts`, `src/model/vec.ts`, `src/model/time.ts`
- Test: `src/model/rng.test.ts`, `src/model/noise.test.ts`, `src/model/time.test.ts`

**Interfaces:**
- Produces:
  - `type Rng = () => number`, `mulberry32(seed: number): Rng`, `normal(rng: Rng): number`, `poisson(rng: Rng, lambda: number): number`, `hashSeed(...parts: number[]): number`, `pickIndex(rng: Rng, weights: number[]): number`
  - `valueNoise3(seed: number, x: number, y: number, z: number): number` in [0, 1)
  - `interface Vec { x: number; y: number }`, `add`, `sub`, `scale`, `len`, `unit`, `dist`
  - `YEAR_START_MS`, `DAY_MS`, `DAYS_IN_MONTH`, `dayStartMs(doy)`, `doyOf(t)`, `monthOfDoy(doy)`, `midMonthDoy(m)`, `localSolarHour(t, lonDeg)`, `dateLabel(doy)`
  - constants `RAD`, `RHO_SEA`, `SOLAR_CONSTANT`, `WATER_ALBEDO`, `NIGHT_RESERVE_H`, `BUOYANCY_RESERVE`, `ELECTRONICS_KG`, `HOST_VOLUME_L`, `HX_VOLUME_L`, `TIDAL_AXIS_DEG`

- [ ] **Step 1: Create the project files**

`package.json`:
```json
{
  "name": "fleet",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "recharts": "2.13.3",
    "zod": "3.23.8",
    "zustand": "4.5.5"
  },
  "devDependencies": {
    "@types/react": "18.3.12",
    "@types/react-dom": "18.3.1",
    "@vitejs/plugin-react": "4.3.4",
    "typescript": "5.6.3",
    "vite": "5.4.11",
    "vitest": "2.1.8"
  }
}
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "types": ["vite/client"]
  },
  "include": ["src", "vite.config.ts"]
}
```

`vite.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  worker: { format: 'es' },
  test: { environment: 'node', include: ['src/**/*.test.ts'], testTimeout: 120000 },
});
```

`index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Fleet</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`.gitignore`:
```
node_modules
dist
*.log
```

`src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`src/App.tsx` (placeholder until Task 13):
```tsx
export default function App() {
  return <h1>Fleet</h1>;
}
```

`src/styles.css` (placeholder until Task 13):
```css
body { font-family: system-ui, sans-serif; }
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: installs without errors and creates `package-lock.json`.

- [ ] **Step 3: Write failing tests for the utilities**

`src/model/rng.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { mulberry32, normal, poisson, hashSeed, pickIndex } from './rng';

describe('rng', () => {
  it('is deterministic for a seed', () => {
    const a = mulberry32(42), b = mulberry32(42);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });
  it('produces uniform values in [0, 1) with mean near 0.5', () => {
    const r = mulberry32(1);
    let sum = 0;
    for (let i = 0; i < 20000; i++) { const v = r(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); sum += v; }
    expect(sum / 20000).toBeCloseTo(0.5, 1);
  });
  it('normal has mean 0 and std 1', () => {
    const r = mulberry32(7);
    const xs = Array.from({ length: 20000 }, () => normal(r));
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
    expect(Math.abs(mean)).toBeLessThan(0.03);
    expect(Math.abs(sd - 1)).toBeLessThan(0.03);
  });
  it('poisson matches its mean for small and large lambda', () => {
    const r = mulberry32(3);
    for (const lambda of [0.5, 4, 120]) {
      let sum = 0;
      for (let i = 0; i < 5000; i++) sum += poisson(r, lambda);
      expect(sum / 5000).toBeGreaterThan(lambda * 0.95);
      expect(sum / 5000).toBeLessThan(lambda * 1.05);
    }
    expect(poisson(r, 0)).toBe(0);
  });
  it('hashSeed differs by input and is stable', () => {
    expect(hashSeed(1, 2)).toBe(hashSeed(1, 2));
    expect(hashSeed(1, 2)).not.toBe(hashSeed(2, 1));
  });
  it('pickIndex follows weights', () => {
    const r = mulberry32(9);
    const counts = [0, 0, 0];
    for (let i = 0; i < 10000; i++) counts[pickIndex(r, [0.7, 0.2, 0.1])]++;
    expect(counts[0] / 10000).toBeCloseTo(0.7, 1);
    expect(counts[2] / 10000).toBeCloseTo(0.1, 1);
    expect(pickIndex(r, [0, 0, 1])).toBe(2);
  });
});
```

`src/model/noise.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { valueNoise3 } from './noise';

describe('valueNoise3', () => {
  it('is in [0,1), deterministic, and averages near 0.5', () => {
    let sum = 0;
    for (let i = 0; i < 5000; i++) {
      const v = valueNoise3(5, i * 0.37, i * 0.11, i * 0.05);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      expect(valueNoise3(5, i * 0.37, i * 0.11, i * 0.05)).toBe(v);
      sum += v;
    }
    expect(sum / 5000).toBeGreaterThan(0.45);
    expect(sum / 5000).toBeLessThan(0.55);
  });
  it('is continuous', () => {
    const a = valueNoise3(1, 3.2, 4.7, 0.3);
    const b = valueNoise3(1, 3.2001, 4.7, 0.3);
    expect(Math.abs(a - b)).toBeLessThan(0.01);
  });
  it('depends on the seed', () => {
    expect(valueNoise3(1, 2.5, 2.5, 2.5)).not.toBe(valueNoise3(2, 2.5, 2.5, 2.5));
  });
});
```

`src/model/time.test.ts`:
```ts
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
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL with module-not-found errors for `./rng`, `./noise`, `./time`.

- [ ] **Step 5: Implement the utilities**

`src/model/constants.ts`:
```ts
export const RAD = Math.PI / 180;
/** Seawater density, kg/m3. */
export const RHO_SEA = 1025;
/** Solar constant, W/m2. */
export const SOLAR_CONSTANT = 1361;
/** Albedo of open water for ground-reflected irradiance. */
export const WATER_ALBEDO = 0.06;
/** Hours of essential load kept in the battery before compute may draw it down. */
export const NIGHT_RESERVE_H = 14;
/** Fraction of displacement kept as reserve buoyancy. */
export const BUOYANCY_RESERVE = 0.2;
/** Wiring, MPPT, GNSS and avionics mass per module, kg (estimate). */
export const ELECTRONICS_KG = 10;
/** Pod volume taken by the host board and switch, liters (estimate). */
export const HOST_VOLUME_L = 15;
/** Pod volume taken by the seawater heat exchanger, liters (estimate). */
export const HX_VOLUME_L = 10;
/** Tidal current axis in the Bight, degrees clockwise from north (estimate, roughly alongshore). */
export const TIDAL_AXIS_DEG = 300;
```

`src/model/rng.ts`:
```ts
export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function normal(rng: Rng): number {
  let u = 0;
  while (u === 0) u = rng();
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function poisson(rng: Rng, lambda: number): number {
  if (!(lambda > 0)) return 0;
  if (lambda > 50) return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * normal(rng)));
  const limit = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng();
  } while (p > limit);
  return k - 1;
}

export function hashSeed(...parts: number[]): number {
  let h = 2166136261;
  for (const p of parts) {
    h ^= p | 0;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function pickIndex(rng: Rng, weights: number[]): number {
  const total = weights.reduce((a, b) => a + Math.max(0, b), 0);
  if (total <= 0) return 0;
  let u = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    u -= Math.max(0, weights[i]);
    if (u < 0) return i;
  }
  return weights.length - 1;
}
```

`src/model/noise.ts`:
```ts
function hash3(seed: number, x: number, y: number, z: number): number {
  let h = (seed | 0) ^ Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const smooth = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Smooth 3D value noise in [0, 1). */
export function valueNoise3(seed: number, x: number, y: number, z: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = smooth(x - xi), yf = smooth(y - yi), zf = smooth(z - zi);
  const c = (dx: number, dy: number, dz: number) => hash3(seed, xi + dx, yi + dy, zi + dz);
  const x00 = lerp(c(0, 0, 0), c(1, 0, 0), xf);
  const x10 = lerp(c(0, 1, 0), c(1, 1, 0), xf);
  const x01 = lerp(c(0, 0, 1), c(1, 0, 1), xf);
  const x11 = lerp(c(0, 1, 1), c(1, 1, 1), xf);
  return lerp(lerp(x00, x10, yf), lerp(x01, x11, yf), zf);
}
```

`src/model/vec.ts`:
```ts
export interface Vec {
  x: number;
  y: number;
}

export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec, k: number): Vec => ({ x: a.x * k, y: a.y * k });
export const len = (a: Vec): number => Math.hypot(a.x, a.y);
export const dist = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);
export const unit = (a: Vec): Vec => {
  const l = len(a);
  return l > 1e-12 ? { x: a.x / l, y: a.y / l } : { x: 0, y: 0 };
};
```

`src/model/time.ts`:
```ts
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
```

- [ ] **Step 6: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all tests PASS, typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: scaffold Fleet app with seeded RNG, noise, vector and time utilities"
```

---

### Task 2: Sourced presets

**Files:**
- Create: `src/presets/sourced.ts`, `src/presets/hardware.ts`, `src/presets/costs.ts`, `src/presets/socal.ts`, `src/presets/workloads.ts`, `src/presets/index.ts`
- Test: `src/presets/presets.test.ts`

**Interfaces:**
- Produces:
  - `interface Sourced { value: number; unit: string; source: string; date: string; estimate?: boolean; note?: string }`, `s(value, unit, source, note?)`, `est(value, unit, note)`, `ACCESSED`
  - `PANELS: PanelPreset[]`, `BATTERIES: BatteryPreset[]`, `ACCELERATORS: AcceleratorPreset[]`, `TERMINALS: TerminalPreset[]`, `PLANS: PlanPreset[]`, `THRUSTERS: ThrusterPreset[]`
  - `COSTS: Record<string, Sourced>` (keys listed in code)
  - `COAST: [number, number][]`, `LAND_POLYGON`, `ISLANDS`, `MAP_BOUNDS`, `GHI_ANCHORS`, `DAY_TYPE`, `DAY_K`, `MARINE_PROFILE`, `MARINE_MONTHLY_STRENGTH`, `SOCAL_ENV: Record<string, Sourced>`
  - `WORKLOADS: Workload[]` in fixed order `[inference, training, dataHeavy]`
  - `collectSourced(obj): Sourced[]` in `index.ts`

- [ ] **Step 1: Write the failing test**

`src/presets/presets.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { ALL_PRESET_DATA, collectSourced, ACCELERATORS, WORKLOADS, GHI_ANCHORS, COAST } from './index';

describe('presets', () => {
  const all = collectSourced(ALL_PRESET_DATA);
  it('collects a large set of sourced values', () => {
    expect(all.length).toBeGreaterThan(120);
  });
  it('every value has a source, date and unit', () => {
    for (const v of all) {
      expect(v.source.length).toBeGreaterThan(0);
      expect(v.date).toBe('2026-10-15');
      expect(v.unit.length).toBeGreaterThan(0);
      expect(Number.isFinite(v.value)).toBe(true);
    }
  });
  it('estimates are flagged exactly when the source is ESTIMATE', () => {
    for (const v of all) expect(!!v.estimate).toBe(v.source === 'ESTIMATE');
  });
  it('accelerator ids are unique and L4 is present', () => {
    const ids = ACCELERATORS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('l4');
  });
  it('workloads are in fixed order', () => {
    expect(WORKLOADS.map((w) => w.id)).toEqual(['inference', 'training', 'dataHeavy']);
  });
  it('GHI anchors have 12 months and ascending distance', () => {
    for (const a of GHI_ANCHORS) expect(a.monthly).toHaveLength(12);
    expect(GHI_ANCHORS.map((a) => a.km)).toEqual([10, 120, 300]);
  });
  it('coastline runs north to south', () => {
    expect(COAST[0][0]).toBeGreaterThan(COAST[COAST.length - 1][0]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/presets`
Expected: FAIL, cannot resolve `./index`.

- [ ] **Step 3: Implement the presets**

`src/presets/sourced.ts`:
```ts
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
```

`src/presets/hardware.ts`:
```ts
import { Sourced, s, est, EUR_USD, GBP_USD } from './sourced';

export interface PanelPreset { id: string; name: string; efficiency: Sourced; usdPerW: Sourced; kgPerM2: Sourced; tempCoeffPerC: Sourced }
export interface BatteryPreset { id: string; name: string; usdPerKwh: Sourced; whPerKg: Sourced; rte: Sourced; cycleLife: Sourced }
export interface AcceleratorPreset {
  id: string; name: string; tdpW: Sourced; denseTflops: Sourced; priceUsd: Sourced; memGB: Sourced;
  massKg: Sourced; volumeL: Sourced; firmUsdPerGpuH: Sourced; spotUsdPerGpuH: Sourced;
}
export interface TerminalPreset { id: string; name: string; terminalW: Sourced; usd: Sourced; massKg: Sourced; downMbps: Sourced; upMbps: Sourced }
export interface PlanPreset {
  id: string; name: string; usdPerMonth: Sourced; capGB: Sourced; throttleDownMbps: Sourced; throttleUpMbps: Sourced;
  overageUsdPerGB: Sourced | null;
}
export interface ThrusterPreset { id: string; name: string; thrustN: Sourced; maxElecW: Sourced; usd: Sourced; massKg: Sourced }

const CSI = 'https://solarproof.com.au/datasheets/panel_datasheet_CS-Datasheet-TOPHiKu6_CS6.2-54TM_v1.2_EN.pdf';
const PV_INDEX = 'https://now.solar/2026/10/09/european-pv-module-prices-inch-downwards-in-september-pv-tech/';
const MAXEON = 'https://www.cleanenergyreviews.info/s/Sunpower_maxeon_7_112c_PT_435-445_res_dc_en_a4_551184A_v2.pdf';
const AIKO = 'https://www.wattuneed.com/en/traditional-solar-panels/27902-aiko-neostar-3s-mono-glass-gen3-485wc-0768563824760.html';
const SOLBIAN = 'https://emarineinc.com/products/solbian-137w-24v-flexible-solar-panel-sp137';
const MIASOLE = 'https://miasole.com/wp-content/uploads/2022/07/flex-03m_2.6m_datasheet_jp-2019.pdf';

export const PANELS: PanelPreset[] = [
  {
    id: 'csi-tophiku6', name: 'CSI Solar TOPHiKu6 520 W (TOPCon)',
    efficiency: s(0.234, 'fraction', CSI),
    usdPerW: s(+(0.12 * EUR_USD.value).toFixed(3), 'USD/W', PV_INDEX, 'EUR 0.120/W wholesale index, Sep 2026, converted at the FX assumption'),
    kgPerM2: s(10.5, 'kg/m2', CSI, 'derived: 23.3 kg over 1.961 x 1.134 m'),
    tempCoeffPerC: s(-0.0029, '1/degC', CSI),
  },
  {
    id: 'maxeon-7', name: 'Maxeon 7 445 W (IBC)',
    efficiency: s(0.241, 'fraction', MAXEON),
    usdPerW: est(1.25, 'USD/W', 'retail range 1.00 to 1.50 USD/W; no current listing found'),
    kgPerM2: s(11.2, 'kg/m2', MAXEON, 'derived: 20.7 kg over 1.787 x 1.035 m'),
    tempCoeffPerC: s(-0.0027, '1/degC', MAXEON),
  },
  {
    id: 'aiko-neostar-3s', name: 'Aiko Neostar 3S 485 W (back contact)',
    efficiency: s(0.243, 'fraction', AIKO, 'listing also states 23.8%'),
    usdPerW: s(+(0.128 * EUR_USD.value).toFixed(3), 'USD/W', PV_INDEX, 'EUR 0.128/W back-contact wholesale index; retail is EUR 0.354/W'),
    kgPerM2: s(10.6, 'kg/m2', AIKO, 'derived: 21.1 kg over 1.762 x 1.134 m'),
    tempCoeffPerC: s(-0.0026, '1/degC', AIKO),
  },
  {
    id: 'solbian-sp137', name: 'Solbian SP137 (flexible, marine)',
    efficiency: s(0.168, 'fraction', SOLBIAN, 'module level, derived from 137 W over 1.490 x 0.546 m'),
    usdPerW: s(10.94, 'USD/W', SOLBIAN, 'retail 1,499 USD for 137 W'),
    kgPerM2: s(2.46, 'kg/m2', SOLBIAN),
    tempCoeffPerC: s(-0.0038, '1/degC', SOLBIAN),
  },
  {
    id: 'miasole-flex03', name: 'MiaSole FLEX-03 400 W (CIGS, flexible)',
    efficiency: s(0.174, 'fraction', MIASOLE, 'aperture efficiency'),
    usdPerW: est(1.15, 'USD/W', 'range 0.80 to 1.50 USD/W; no current listing found'),
    kgPerM2: s(2.0, 'kg/m2', MIASOLE, 'with adhesive'),
    tempCoeffPerC: s(-0.0038, '1/degC', MIASOLE),
  },
];

const BNEF = 'https://about.bnef.com/insights/clean-energy/lithium-ion-battery-pack-prices-fall-to-108-per-kilowatt-hour-despite-rising-metal-prices-bloombergnef/';
const EVE = 'https://www.18650batterystore.com/collections/lifepo4-prismatic-cells/products/eve-mb31-grade-a-cells-3-2v-lifepo4-314ah-battery';
const RTE_GLOSSARY = 'https://qbitsenergy.com/glossary/round-trip-efficiency/';
const VICTRON_NG = 'https://www.solar-electric.com/victron-energy-12-8v-200ah-ng-lifepo4-battery.html';
const VICTRON_SMART = 'https://www.fisheriessupply.com/product-resources/victron-energy/smartbatteriesdatasheet-pdf';
const BATTLE_BORN = 'https://battlebornbatteries.com/products/100ah-12v-lifepo4-deep-cycle-batteries';

export const BATTERIES: BatteryPreset[] = [
  {
    id: 'bnef-lfp-pack', name: 'LFP pack at BNEF 2025 benchmark price',
    usdPerKwh: s(81, 'USD/kWh', BNEF, 'BNEF Dec 2025 LFP pack average'),
    whPerKg: est(140, 'Wh/kg', 'pack-level estimate; EVE MB31 cells are 179 Wh/kg'),
    rte: s(0.93, 'fraction', RTE_GLOSSARY, 'cell-level 92 to 95%; low-authority source'),
    cycleLife: s(8000, 'cycles', EVE, 'EVE MB31 cells to 70% SOH at 25 C'),
  },
  {
    id: 'eve-mb31-diy', name: 'EVE MB31 314 Ah cells (self-built pack)',
    usdPerKwh: s(74, 'USD/kWh', EVE, 'retail sale price for 4 cells'),
    whPerKg: s(179, 'Wh/kg', EVE, 'cell level; a pack is lighter per Wh'),
    rte: s(0.93, 'fraction', RTE_GLOSSARY, 'cell-level 92 to 95%; low-authority source'),
    cycleLife: s(8000, 'cycles', EVE, 'to 70% SOH at 25 C'),
  },
  {
    id: 'victron-ng', name: 'Victron NG 12.8 V 200 Ah (marine)',
    usdPerKwh: s(579, 'USD/kWh', VICTRON_NG),
    whPerKg: s(135, 'Wh/kg', VICTRON_NG),
    rte: s(0.92, 'fraction', VICTRON_SMART, 'from the older Smart-series datasheet'),
    cycleLife: s(2500, 'cycles', VICTRON_SMART, 'at 80% DoD, older Smart-series datasheet'),
  },
  {
    id: 'battle-born', name: 'Battle Born 100 Ah 12 V (marine/RV)',
    usdPerKwh: s(624, 'USD/kWh', BATTLE_BORN),
    whPerKg: s(91, 'Wh/kg', BATTLE_BORN),
    rte: est(0.92, 'fraction', 'typical LFP round-trip efficiency; not stated by vendor'),
    cycleLife: s(3000, 'cycles', BATTLE_BORN, '3000 to 5000 cycles at 80% DoD'),
  },
];

const NV_H100 = 'https://www.nvidia.com/en-us/data-center/h100/';
const NV_H200 = 'https://www.nvidia.com/en-us/data-center/h200/';
const NV_L40S = 'https://www.nvidia.com/en-us/data-center/l40s/';
const NV_L4 = 'https://www.nvidia.com/en-us/data-center/l4/';
const NV_ORIN = 'https://www.nvidia.com/en-us/autonomous-machines/embedded-systems/jetson-orin/';
const LENOVO_B200 = 'https://lenovopress.lenovo.com/lp2226';
const NV_HGX = 'https://www.nvidia.com/en-us/data-center/hgx/';
const GPU_PRICES = 'https://intuitionlabs.ai/articles/data-center-gpu-prices';
const COREWEAVE = 'https://www.coreweave.com/pricing';
const RUNPOD = 'https://www.runpod.io/pricing';
const GCP_G2 = 'https://gcloud-compute.com/g2-standard-4.html';

export const ACCELERATORS: AcceleratorPreset[] = [
  {
    id: 'l4', name: 'NVIDIA L4 (72 W)',
    tdpW: s(72, 'W', NV_L4), denseTflops: s(121, 'TFLOPS', NV_L4, 'dense FP16, half of the 242 sparse figure'),
    priceUsd: s(3995, 'USD', 'https://www.itcreations.com/product/159905', 'new; about 2,700 USD used'),
    memGB: s(24, 'GB', NV_L4),
    massKg: est(0.5, 'kg', 'single-slot low-profile card'), volumeL: est(0.5, 'L', 'card plus mounting'),
    firmUsdPerGpuH: s(0.707, 'USD/GPU-h', GCP_G2, 'GCP g2-standard-4 on-demand'),
    spotUsdPerGpuH: s(0.44, 'USD/GPU-h', RUNPOD, 'RunPod community, proxy for spot'),
  },
  {
    id: 'l40s', name: 'NVIDIA L40S (350 W)',
    tdpW: s(350, 'W', NV_L40S), denseTflops: s(362, 'TFLOPS', NV_L40S, 'dense BF16'),
    priceUsd: s(9970, 'USD', 'https://www.newegg.com/p/N82E16888892001', 'new; about 7,000 USD used'),
    memGB: s(48, 'GB', NV_L40S),
    massKg: est(1.5, 'kg', 'dual-slot card'), volumeL: est(2.5, 'L', 'card plus mounting'),
    firmUsdPerGpuH: s(2.25, 'USD/GPU-h', COREWEAVE), spotUsdPerGpuH: s(0.79, 'USD/GPU-h', RUNPOD, 'RunPod community'),
  },
  {
    id: 'h100-nvl', name: 'NVIDIA H100 NVL PCIe (375 W)',
    tdpW: s(375, 'W', NV_H100, 'configurable 350 to 400 W'), denseTflops: s(835, 'TFLOPS', NV_H100, 'dense BF16'),
    priceUsd: est(27500, 'USD', 'range 25k to 30k USD'), memGB: s(94, 'GB', NV_H100),
    massKg: est(1.7, 'kg', 'dual-slot card'), volumeL: est(2.5, 'L', 'card plus mounting'),
    firmUsdPerGpuH: est(6.16, 'USD/GPU-h', 'H100 SXM CoreWeave price used as a proxy'),
    spotUsdPerGpuH: est(2.69, 'USD/GPU-h', 'H100 RunPod community price used as a proxy'),
  },
  {
    id: 'h100-sxm', name: 'NVIDIA H100 SXM (700 W)',
    tdpW: s(700, 'W', NV_H100), denseTflops: s(989, 'TFLOPS', NV_H100, 'dense BF16'),
    priceUsd: s(28000, 'USD', GPU_PRICES, 'midpoint of 25k to 31k; needs an HGX baseboard'), memGB: s(80, 'GB', NV_H100),
    massKg: est(2.5, 'kg', 'per-GPU share of an HGX board'), volumeL: est(3, 'L', 'per-GPU share of an HGX board'),
    firmUsdPerGpuH: s(6.16, 'USD/GPU-h', COREWEAVE), spotUsdPerGpuH: s(2.69, 'USD/GPU-h', RUNPOD, 'RunPod community'),
  },
  {
    id: 'h200-sxm', name: 'NVIDIA H200 SXM (700 W)',
    tdpW: s(700, 'W', NV_H200), denseTflops: s(989, 'TFLOPS', NV_H200, 'dense BF16'),
    priceUsd: s(35000, 'USD', GPU_PRICES, 'midpoint of 30k to 40k'), memGB: s(141, 'GB', NV_H200),
    massKg: est(2.5, 'kg', 'per-GPU share of an HGX board'), volumeL: est(3, 'L', 'per-GPU share of an HGX board'),
    firmUsdPerGpuH: s(6.31, 'USD/GPU-h', COREWEAVE), spotUsdPerGpuH: s(3.59, 'USD/GPU-h', RUNPOD, 'RunPod community'),
  },
  {
    id: 'b200', name: 'NVIDIA B200 HGX (1000 W)',
    tdpW: s(1000, 'W', LENOVO_B200), denseTflops: s(2250, 'TFLOPS', NV_HGX, 'dense BF16'),
    priceUsd: s(40000, 'USD', GPU_PRICES, 'midpoint of 30k to 50k'), memGB: s(180, 'GB', NV_HGX),
    massKg: est(3, 'kg', 'per-GPU share of an HGX board'), volumeL: est(3.5, 'L', 'per-GPU share of an HGX board'),
    firmUsdPerGpuH: s(8.6, 'USD/GPU-h', COREWEAVE), spotUsdPerGpuH: s(5.98, 'USD/GPU-h', RUNPOD, 'RunPod community'),
  },
  {
    id: 'jetson-agx-orin', name: 'NVIDIA Jetson AGX Orin 64GB (60 W)',
    tdpW: s(60, 'W', NV_ORIN, '15 to 60 W'),
    denseTflops: est(68, 'TFLOPS', 'half of about 137 dense INT8 TOPS; FP16 not stated by NVIDIA'),
    priceUsd: s(3499, 'USD', 'https://hwbusters.com/news/nvidia-jetson-prices-jump-up-to-101-the-249-orin-nano-super-is-now-399/', 'dev kit price'),
    memGB: s(64, 'GB', NV_ORIN),
    massKg: est(1.4, 'kg', 'dev kit'), volumeL: est(2, 'L', 'dev kit'),
    firmUsdPerGpuH: est(0.44, 'USD/GPU-h', 'no rental market; L4 spot price used as a proxy'),
    spotUsdPerGpuH: est(0.3, 'USD/GPU-h', 'no rental market; proxy'),
  },
];

const STARLINK_POWER = 'https://www.dishytech.com/how-much-power-does-starlink-use/';
const STARLINK_SEA = 'https://starlinkinsider.com/starlink-maritime/';
const GP_PLANS = 'https://dishycentral.com/starlink-business-plans';

export const TERMINALS: TerminalPreset[] = [
  {
    id: 'mini', name: 'Starlink Mini',
    terminalW: s(45, 'W', 'https://earthsims.com/starlink/starlink-mini-review/', 'between official 20 to 40 W (Anker, citing Starlink) and measured 50 to 55 W'),
    usd: s(149, 'USD', 'https://www.trioflatmount.com/blogs/news/understanding-starlink-pricing-and-plans'),
    massKg: est(1.2, 'kg', 'with mount and cable'),
    downMbps: s(100, 'Mbps', STARLINK_SEA, 'within 40 to 220 Mbps at sea; older figures'),
    upMbps: s(15, 'Mbps', STARLINK_SEA, 'within 8 to 25 Mbps at sea; older figures'),
  },
  {
    id: 'performance-gen3', name: 'Starlink Performance Gen 3 (maritime)',
    terminalW: s(87.5, 'W', STARLINK_POWER, 'average 75 to 100 W'),
    usd: s(1849, 'USD', 'https://emarineinc.com/products/starlink-performance-gen3-kit-w-flat-mount'),
    massKg: s(5.2, 'kg', 'https://emarineinc.com/products/starlink-performance-gen3-kit-w-flat-mount'),
    downMbps: s(100, 'Mbps', STARLINK_SEA, 'within 40 to 220 Mbps at sea'),
    upMbps: s(15, 'Mbps', STARLINK_SEA, 'within 8 to 25 Mbps at sea'),
  },
  {
    id: 'standard-gen3', name: 'Starlink Standard Gen 3 (not rated for in-motion maritime)',
    terminalW: s(87.5, 'W', STARLINK_POWER, 'average 75 to 100 W'),
    usd: s(349, 'USD', GP_PLANS),
    massKg: est(3.2, 'kg', 'with kickstand'),
    downMbps: s(100, 'Mbps', STARLINK_SEA, 'within 40 to 220 Mbps at sea'),
    upMbps: s(15, 'Mbps', STARLINK_SEA, 'within 8 to 25 Mbps at sea'),
  },
  {
    id: 'fhp-gen2', name: 'Starlink Flat High Performance Gen 2 (legacy)',
    terminalW: s(130, 'W', STARLINK_POWER, 'average 110 to 150 W'),
    usd: s(2500, 'USD', STARLINK_SEA, 'older pricing'),
    massKg: est(5.5, 'kg', 'with mount'),
    downMbps: s(100, 'Mbps', STARLINK_SEA, 'within 40 to 220 Mbps at sea'),
    upMbps: s(15, 'Mbps', STARLINK_SEA, 'within 8 to 25 Mbps at sea'),
  },
];

const gp = (id: string, name: string, usd: number, cap: number): PlanPreset => ({
  id, name,
  usdPerMonth: s(usd, 'USD/month', GP_PLANS),
  capGB: s(cap, 'GB/month', GP_PLANS),
  throttleDownMbps: s(1, 'Mbps', GP_PLANS, 'after the cap'),
  throttleUpMbps: s(0.5, 'Mbps', GP_PLANS, 'after the cap'),
  overageUsdPerGB: s(2, 'USD/GB', GP_PLANS, 'derived: +50 GB add-on for 100 USD'),
});

export const PLANS: PlanPreset[] = [
  gp('gp-50', 'Global Priority 50 GB', 250, 50),
  gp('gp-500', 'Global Priority 500 GB', 650, 500),
  gp('gp-1tb', 'Global Priority 1 TB', 1150, 1000),
  gp('gp-2tb', 'Global Priority 2 TB', 2150, 2000),
  {
    id: 'ocean-mode', name: 'Personal Maritime + Ocean Mode (personal vessels under 40 ft only)',
    usdPerMonth: s(185, 'USD/month', 'https://www.basenor.com/blogs/news/starlink-personal-maritime-plan-185-mo-for-small-boat-owners'),
    capGB: s(0, 'GB/month', 'https://www.trioflatmount.com/blogs/news/understanding-starlink-pricing-and-plans', 'beyond 12 nm all data is billed per GB'),
    throttleDownMbps: s(0, 'Mbps', 'https://www.trioflatmount.com/blogs/news/understanding-starlink-pricing-and-plans', 'no throttle; billed per GB'),
    throttleUpMbps: s(0, 'Mbps', 'https://www.trioflatmount.com/blogs/news/understanding-starlink-pricing-and-plans', 'no throttle; billed per GB'),
    overageUsdPerGB: s(6, 'USD/GB', 'https://www.trioflatmount.com/blogs/news/understanding-starlink-pricing-and-plans', 'Ocean Mode since 2026-09-27; not valid for commercial use'),
  },
];

const T200 = 'https://bluerobotics.com/store/thrusters/t100-t200-thrusters/t200-thruster-r2-rp/';
const T500 = 'https://bluerobotics.com/store/thrusters/t500-thruster/';
const KGF = 9.80665;

export const THRUSTERS: ThrusterPreset[] = [
  {
    id: 't200', name: 'Blue Robotics T200 (16 V)',
    thrustN: s(+(5.25 * KGF).toFixed(1), 'N', T200, '5.25 kgf at 16 V'), maxElecW: s(390, 'W', T200, 'at 16 V'),
    usd: s(230, 'USD', T200, '184 USD at 150+ units'), massKg: s(0.427, 'kg', T200),
  },
  {
    id: 't500', name: 'Blue Robotics T500 (24 V)',
    thrustN: s(+(16.1 * KGF).toFixed(1), 'N', T500, '16.1 kgf at 24 V'), maxElecW: s(1044, 'W', T500, 'at 24 V'),
    usd: s(790, 'USD', T500, '632 USD at 150+ units'), massKg: s(1.16, 'kg', T500),
  },
  {
    id: 'torqeedo-403', name: 'Torqeedo Ultralight 403',
    thrustN: s(+(15 * KGF).toFixed(1), 'N', 'https://www.overtons.com/torqeedo-ultralight-403-ac-363899.html', 'about 15 kgf static'),
    maxElecW: s(400, 'W', 'https://www.overtons.com/torqeedo-ultralight-403-ac-363899.html'),
    usd: s(2499, 'USD', 'https://www.overtons.com/torqeedo-ultralight-403-ac-363899.html', 'includes 915 Wh battery'),
    massKg: est(7, 'kg', 'motor without battery'),
  },
  {
    id: 'epropulsion-spirit', name: 'ePropulsion Spirit 1.0 Evo',
    thrustN: s(316, 'N', 'https://www.epropulsion.com/parts-database/SE-1111-L0--spirit-1.0-evo-motor-body-longshaft-w-o-battery-or-control'),
    maxElecW: s(1000, 'W', 'https://www.epropulsion.com/parts-database/SE-1111-L0--spirit-1.0-evo-motor-body-longshaft-w-o-battery-or-control'),
    usd: s(Math.round(2125 * GBP_USD.value), 'USD', 'https://seamarknunn.com/products/epropulsion-spirit-1-0-evo-electric-outboard-motor-long-shaft', 'GBP 2,125 with battery, at the FX assumption'),
    massKg: s(10.6, 'kg', 'https://www.epropulsion.com/parts-database/SE-1111-L0--spirit-1.0-evo-motor-body-longshaft-w-o-battery-or-control'),
  },
];
```

`src/presets/costs.ts`:
```ts
import { Sourced, s, est } from './sourced';

const VICTRON_MPPT = 'https://store.solarcellzusa.com/products/victron-energy-smartsolar-mppt-150-35';

export const COSTS: Record<string, Sourced> = {
  hullUsd: est(10000, 'USD', 'custom 1.5 m hull; range 5k to 15k; commercial USVs cost 30k and up'),
  podUsd: est(3000, 'USD', 'pressure-rated compute pod with penetrators; small acrylic enclosures start at 492 USD (Blue Robotics)'),
  heatExchangerUsd: est(1000, 'USD', 'about 10 kW titanium plate exchanger; range 500 to 1,500 USD'),
  petalUsdPerM2: est(250, 'USD/m2', 'petal frames, hinges and deployment actuators; no source found'),
  mpptUsdPerW: s(0.074, 'USD/W', VICTRON_MPPT, 'derived: 148.54 USD for about 2 kW at 48 V'),
  gnssUsd: s(184.22, 'USD', 'https://www.sparkfun.com/categories/86?page=1', 'SparkFun ZED-F9P RTK GNSS'),
  avionicsUsd: est(800, 'USD', 'flight computer, sensors and wiring'),
  hostUsd: est(1500, 'USD', 'host board, NIC and switch'),
  batteryIntegrationUplift: est(1.3, 'x', 'BMS, marine enclosure and wiring over pack price'),
  integrationPct: est(0.25, 'fraction', 'assembly and integration uplift'),
  contingencyPct: est(0.15, 'fraction', 'contingency'),
  sparesPct: est(0.1, 'fraction', 'spare modules as a share of the fleet'),
  deploymentVesselDays: est(3, 'days', 'vessel days to launch a 20-module swarm'),
  vesselDayUsd: est(15000, 'USD/day', 'support vessel day rate'),
  maintenanceVisitsPerYear: est(2, 'visits/year', 'swarm service visits'),
  visitUsd: est(25000, 'USD/visit', 'per swarm service visit'),
  insurancePct: est(0.03, 'fraction/year', 'marine insurance as a share of capex'),
  moduleLossRate: est(0.05, 'fraction/year', 'modules lost per year'),
  acceleratorRefreshYears: est(4, 'years', 'accelerator refresh interval'),
  discountRate: est(0.12, 'fraction/year', 'discount rate for NPV'),
  horizonYears: est(7, 'years', 'analysis horizon'),
  slaTarget: est(0.99, 'fraction', 'firm capacity availability target'),
  slaPenaltyMultiple: est(1, 'x', 'penalty as a multiple of revenue for each missed firm GPU-hour'),
  hullMassKg: est(150, 'kg', 'hull structure'),
  podMassKg: est(40, 'kg', 'pod shell and heat exchanger'),
  podVolumeL: est(120, 'L', 'pod internal volume'),
  draftM: est(0.6, 'm', 'hull draft'),
  dragCd: est(1.0, 'dimensionless', 'bluff box hull drag coefficient'),
  hostW: est(40, 'W', 'host board and switch at full load'),
  coolingOverhead: est(0.05, 'fraction', 'seawater loop pump; terrestrial data center overhead is typically higher'),
  avionicsW: est(15, 'W', 'flight computer, GNSS, sensors'),
  actuatorW: est(10, 'W', 'petal tracking actuators while tracking'),
  propEff: est(0.4, 'fraction', 'electrical to propulsive efficiency at low speed'),
  mpptEff: est(0.97, 'fraction', 'typical MPPT efficiency'),
  cellTempRiseC: est(20, 'degC', 'cell temperature rise above water at 800 W/m2'),
  waterTempC: est(17, 'degC', 'SoCal sea surface, typical 15 to 20 C'),
  radioW: est(5, 'W', 'in-swarm radio link for shared uplink'),
  radioUsd: est(300, 'USD', 'in-swarm radio link'),
  radioRangeM: est(2000, 'm', 'in-swarm radio range'),
};
```

`src/presets/socal.ts`:
```ts
import { Sourced, s, est } from './sourced';

export const POWER_CLIM = 'https://power.larc.nasa.gov/api/temporal/climatology/point (NASA POWER climatology 2001-2025)';
export const POWER_DAILY = 'https://power.larc.nasa.gov/api/temporal/daily/point (NASA POWER daily 2015-2024, derived)';
export const POWER_HOURLY = 'https://power.larc.nasa.gov/api/temporal/hourly/point (NASA POWER hourly, June 2019-2023, derived)';
export const OM_MARINE = 'https://marine-api.open-meteo.com/v1/marine (Open-Meteo Marine, Meteo-France SMOC, Oct 2023 to Sep 2025)';
export const NDBC = 'https://www.ndbc.noaa.gov/ (NDBC buoys 46025, 46086, 46069, 46047, 2020-2024)';

/** Coastline from north of Point Conception to the Mexico border, [lat, lon]. */
export const COAST: [number, number][] = [
  [34.9, -120.65], [34.76, -120.64], [34.58, -120.65], [34.449, -120.471], [34.47, -120.22], [34.41, -119.85],
  [34.4, -119.7], [34.39, -119.52], [34.27, -119.29], [34.15, -119.2], [34.09, -119.06], [34.04, -118.92],
  [34.0, -118.81], [34.03, -118.68], [34.01, -118.5], [33.92, -118.43], [33.8, -118.4], [33.74, -118.41],
  [33.71, -118.29], [33.75, -118.2], [33.7, -118.05], [33.65, -118.0], [33.6, -117.88], [33.54, -117.78],
  [33.46, -117.7], [33.42, -117.62], [33.3, -117.47], [33.19, -117.38], [33.0, -117.28], [32.85, -117.27],
  [32.75, -117.25], [32.67, -117.24], [32.53, -117.12], [32.3, -117.06],
];

export const LAND_POLYGON: [number, number][] = [...COAST, [32.2, -117.0], [32.2, -116.8], [35.0, -116.8], [35.0, -120.7]];

export const MAP_BOUNDS = { latMin: 32.3, latMax: 34.9, lonMin: -121.0, lonMax: -116.9 };

export const ISLANDS = [
  { name: 'San Miguel', lat: 34.04, lon: -120.37, rxKm: 6, ryKm: 4 },
  { name: 'Santa Rosa', lat: 33.96, lon: -120.1, rxKm: 12, ryKm: 8 },
  { name: 'Santa Cruz', lat: 34.01, lon: -119.75, rxKm: 18, ryKm: 6 },
  { name: 'Anacapa', lat: 34.01, lon: -119.4, rxKm: 4, ryKm: 1 },
  { name: 'Santa Barbara', lat: 33.48, lon: -119.04, rxKm: 2, ryKm: 2 },
  { name: 'San Nicolas', lat: 33.25, lon: -119.5, rxKm: 7, ryKm: 3 },
  { name: 'Santa Catalina', lat: 33.38, lon: -118.42, rxKm: 17, ryKm: 6 },
  { name: 'San Clemente', lat: 32.9, lon: -118.5, rxKm: 6, ryKm: 16 },
];

export interface GhiAnchor { km: number; label: string; monthly: number[]; source: string }

/** Monthly all-sky GHI, kWh/m2/day, by distance offshore. */
export const GHI_ANCHORS: GhiAnchor[] = [
  { km: 10, label: 'Inner Bight / LA cell (33.95, -118.45)', monthly: [3.14, 4.01, 5.17, 6.32, 6.55, 6.29, 6.55, 6.34, 5.47, 4.31, 3.4, 2.83], source: POWER_CLIM },
  { km: 120, label: 'Outer Bight (33.3, -119.5)', monthly: [3.19, 4.06, 5.19, 6.4, 6.58, 6.13, 6.08, 5.84, 5.28, 4.27, 3.43, 2.88], source: POWER_CLIM },
  { km: 300, label: '300 km offshore (32.5, -121.5)', monthly: [3.15, 3.89, 5.04, 6.0, 6.14, 5.92, 4.99, 4.82, 4.91, 4.15, 3.36, 2.81], source: POWER_CLIM },
];

/** Day-type shares. Summer means May to July. */
export const DAY_TYPE = {
  summer: {
    clear: s(0.26, 'fraction', POWER_DAILY, 'May to Jul outer Bight, clearness K >= 0.9'),
    cloudy: s(0.26, 'fraction', POWER_DAILY, 'May to Jul outer Bight, clearness K < 0.6'),
  },
  other: {
    clear: est(0.53, 'fraction', 'derived from the 46% full-year clear share after removing summer months'),
    cloudy: est(0.1, 'fraction', 'no direct source for non-summer cloudy share'),
  },
};

/** Daily irradiance relative to a clear day, by day type. */
export const DAY_K = {
  clear: s(1.0, 'relative', POWER_DAILY, 'clear days deliver 0.96 to 0.97 of clear-sky; normalized to 1'),
  partial: est(0.8, 'relative', 'between clear and cloudy'),
  cloudy: s(0.5, 'relative', POWER_DAILY, 'cloudy days deliver about 0.48 to 0.50 of clear-sky'),
};

/** June hourly clearness profile in the outer Bight, [local solar hour, K]. */
export const MARINE_PROFILE: [number, number][] = [[5, 0.5], [6, 0.54], [9, 0.64], [12, 0.76], [14, 0.8], [20, 0.8]];
export const MARINE_PROFILE_SOURCE = s(0.8, 'K at peak', POWER_HOURLY, 'June outer Bight: 0.54 at 06, 0.64 at 09, 0.76 at 12, 0.80 at 14 LST; values before 06 and after 14 are held');

/** Marine layer strength by month, 0 to 1 (June is the cloudiest month in SoCal). */
export const MARINE_MONTHLY_STRENGTH = [0, 0, 0, 0.2, 0.7, 1, 0.8, 0.5, 0.3, 0, 0, 0];
export const MARINE_MONTHLY_SOURCE = est(1, 'relative', 'seasonal shape from sources noting June as the cloudiest SoCal month; month weights are estimates');

export const SOCAL_ENV: Record<string, Sourced> = {
  originLat: s(33.05, 'deg', POWER_CLIM, 'design choice inside the outer Bight cell, between Santa Catalina and San Nicolas islands'),
  originLon: s(-118.95, 'deg', POWER_CLIM, 'design choice inside the outer Bight cell'),
  currentMs: s(0.15, 'm/s', OM_MARINE, 'vector-mean drift at 33.3, -119.5'),
  currentHeadingDeg: s(141, 'deg toward', OM_MARINE, 'vector-mean drift direction'),
  currentVariabilityMs: est(0.12, 'm/s', 'chosen so speed p90 approaches the sourced 0.39 m/s'),
  tidalMs: est(0.08, 'm/s', 'tidal amplitude; SMOC total includes tides'),
  windMeanMs: s(5.0, 'm/s', POWER_CLIM, 'WS10M outer Bight'),
  stowWindMs: s(13.9, 'm/s', NDBC, '27 kt; threshold choice is ours, buoys show 1 to 13% of days exceed it'),
  cloudCellKm: s(30, 'km', 'https://par.nsf.gov/servlets/purl/10286039', 'marine stratocumulus cells are 10 to 100 km'),
  cloudCellAmp: est(0.15, 'fraction', 'cloud cell irradiance swing'),
  cloudDriftMs: est(5.7, 'm/s', 'boundary-layer wind, POWER WS50M outer Bight'),
  cloudDriftHeadingDeg: est(135, 'deg toward', 'northwest winds carry clouds toward the southeast'),
  dayVariability: est(1, 'x', 'scales day-to-day variation; 1 uses sourced day-type shares'),
  marineLayerStrength: est(1, 'x', 'scales the marine layer diurnal cycle'),
  disturbanceMs: est(0.02, 'm/s', 'wave and wind random drift'),
};
```

`src/presets/workloads.ts`:
```ts
import { Sourced, est } from './sourced';

export interface Workload { id: 'inference' | 'training' | 'dataHeavy'; name: string; tflopPerJob: Sourced; inMB: Sourced; outMB: Sourced }

export const WORKLOADS: Workload[] = [
  {
    id: 'inference', name: 'Batch AI inference',
    tflopPerJob: est(14000, 'TFLOP', '7B model, 1,000 prompts x 1,000 tokens, 2 FLOP per parameter per token'),
    inMB: est(2, 'MB', 'prompts'), outMB: est(4, 'MB', 'about 1M output tokens of text'),
  },
  {
    id: 'training', name: 'Fine-tune chunk',
    tflopPerJob: est(217800, 'TFLOP', 'one L4-hour at 50% utilization: 121 x 0.5 x 3600'),
    inMB: est(100, 'MB', 'data shard'), outMB: est(50, 'MB', 'adapter checkpoint'),
  },
  {
    id: 'dataHeavy', name: 'Data-heavy batch (rendering, science)',
    tflopPerJob: est(50000, 'TFLOP', 'render or simulation chunk'),
    inMB: est(2000, 'MB', 'scene or dataset'), outMB: est(200, 'MB', 'results'),
  },
];
```

`src/presets/index.ts`:
```ts
import type { Sourced } from './sourced';
import { PANELS, BATTERIES, ACCELERATORS, TERMINALS, PLANS, THRUSTERS } from './hardware';
import { COSTS } from './costs';
import { SOCAL_ENV, DAY_TYPE, DAY_K, MARINE_PROFILE_SOURCE, MARINE_MONTHLY_SOURCE } from './socal';
import { WORKLOADS } from './workloads';

export * from './sourced';
export * from './hardware';
export * from './costs';
export * from './socal';
export * from './workloads';

export const ALL_PRESET_DATA = {
  PANELS, BATTERIES, ACCELERATORS, TERMINALS, PLANS, THRUSTERS, COSTS, SOCAL_ENV, DAY_TYPE, DAY_K,
  MARINE_PROFILE_SOURCE, MARINE_MONTHLY_SOURCE, WORKLOADS,
};

function isSourced(v: unknown): v is Sourced {
  return !!v && typeof v === 'object' && 'value' in v && 'source' in v && 'unit' in v;
}

/** Walks any preset structure and returns every Sourced value inside it. */
export function collectSourced(obj: unknown, out: Sourced[] = []): Sourced[] {
  if (isSourced(obj)) out.push(obj);
  else if (Array.isArray(obj)) obj.forEach((x) => collectSourced(x, out));
  else if (obj && typeof obj === 'object') Object.values(obj).forEach((x) => collectSourced(x, out));
  return out;
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/presets
git commit -m "feat: add sourced hardware, cost, SoCal environment and workload presets"
```

---

### Task 3: Scenario config, defaults and preset binding

**Files:**
- Create: `src/model/config.ts`, `src/model/defaults.ts`
- Test: `src/model/config.test.ts`

**Interfaces:**
- Consumes: presets from Task 2.
- Produces:
  - `ConfigSchema` (Zod), `type SimConfig`, `type Tracking = 'flat' | 'yaw' | 'dual'`, `type Policy = 'daylight' | 'firm' | 'max'`, `type Strategy = 'station' | 'drift' | 'seek'`
  - `parseConfig(raw: unknown): { ok: true; config: SimConfig } | { ok: false; errors: string[] }`
  - `getPath(obj: unknown, path: string): unknown`, `setPath<T>(obj: T, path: string, value: unknown): T` (returns a deep clone, throws on an unknown path), `leafPaths(obj: unknown, prefix?: string): string[]`
  - `type PresetKind = 'panel' | 'battery' | 'accelerator' | 'terminal' | 'plan' | 'thruster'`
  - `PRESET_FIELDS: Record<PresetKind, { presetPath: string; fields: Record<string, string> }>`
  - `PRESET_LISTS: Record<PresetKind, { id: string; name: string }[]>`
  - `applyPreset(cfg: SimConfig, kind: PresetKind, id: string): SimConfig`
  - `SOURCED_DEFAULTS: [string, Sourced][]`, `defaultConfig(): SimConfig`, `sourceFor(cfg: SimConfig, path: string): Sourced | null`, `payOverage(cfg: SimConfig): boolean`

- [ ] **Step 1: Write the failing test**

`src/model/config.test.ts`:
```ts
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/model/config.test.ts`
Expected: FAIL, cannot resolve `./config`.

- [ ] **Step 3: Implement `config.ts`**

```ts
import { z } from 'zod';

const n = (min: number, max: number) => z.number().finite().min(min).max(max);
const int = (min: number, max: number) => z.number().int().min(min).max(max);

export const TrackingSchema = z.enum(['flat', 'yaw', 'dual']);
export const PolicySchema = z.enum(['daylight', 'firm', 'max']);
export const StrategySchema = z.enum(['station', 'drift', 'seek']);
export type Tracking = z.infer<typeof TrackingSchema>;
export type Policy = z.infer<typeof PolicySchema>;
export type Strategy = z.infer<typeof StrategySchema>;

export const ConfigSchema = z.object({
  version: z.literal(1),
  name: z.string().min(1).max(80),
  seed: int(0, 2147483647),
  hull: z.object({
    sideM: n(0.5, 5), draftM: n(0.1, 3), massKg: n(10, 3000), podVolumeL: n(5, 3000), podMassKg: n(1, 1000),
    petalCount: int(0, 16), petalLengthM: n(0, 3), petalWidthM: n(0.1, 2),
    tracking: TrackingSchema, fixedTiltDeg: n(0, 60), maxTiltDeg: n(0, 80), dragCd: n(0.3, 2.5),
  }),
  panel: z.object({ presetId: z.string(), efficiency: n(0.05, 0.5), usdPerW: n(0, 20), kgPerM2: n(0.5, 30), tempCoeffPerC: n(-0.01, 0) }),
  pv: z.object({ mpptEff: n(0.8, 1), waterTempC: n(0, 35), cellTempRiseC: n(0, 40) }),
  battery: z.object({ presetId: z.string(), kwh: n(0, 200), usdPerKwh: n(0, 2000), whPerKg: n(20, 400), rte: n(0.5, 1), cycleLife: n(100, 20000), dod: n(0.1, 1) }),
  compute: z.object({
    presetId: z.string(), cards: int(0, 64), tdpW: n(1, 2000), denseTflops: n(0, 5000), priceUsd: n(0, 100000),
    massKg: n(0, 50), volumeL: n(0, 50), hostW: n(0, 1000), coolingOverhead: n(0, 0.5), policy: PolicySchema, firmComputeW: n(0, 100000),
  }),
  loads: z.object({ avionicsW: n(0, 500), actuatorW: n(0, 500) }),
  comms: z.object({
    terminalId: z.string(), terminalW: n(0, 500), terminalUsd: n(0, 20000), terminalMassKg: n(0, 50), downMbps: n(0, 2000), upMbps: n(0, 500),
    planId: z.string(), planUsdPerMonth: n(0, 50000), planCapGB: n(0, 100000), throttleDownMbps: n(0, 100), throttleUpMbps: n(0, 100),
    overageUsdPerGB: n(0, 100).nullable(), buyOverage: z.boolean(), modulesPerTerminal: int(1, 100),
    radioW: n(0, 100), radioUsd: n(0, 10000), radioRangeM: n(10, 50000),
  }),
  propulsion: z.object({ thrusterId: z.string(), count: int(0, 8), thrustN: n(0, 2000), maxElecW: n(0, 5000), usd: n(0, 20000), massKg: n(0, 50), propEff: n(0.05, 0.9) }),
  env: z.object({
    originLat: n(-80, 80), originLon: n(-180, 180), currentMs: n(0, 3), currentHeadingDeg: n(0, 360), currentVariabilityMs: n(0, 1), tidalMs: n(0, 1),
    windMeanMs: n(0, 25), stowWindMs: n(0, 40), cloudCellKm: n(1, 300), cloudCellAmp: n(0, 0.6), cloudDriftMs: n(0, 30), cloudDriftHeadingDeg: n(0, 360),
    dayVariability: n(0, 1.5), marineLayerStrength: n(0, 1.5), disturbanceMs: n(0, 1),
  }),
  swarm: z.object({
    count: int(1, 100), spacingM: n(10, 5000), toleranceM: n(1, 2000), breakawayM: n(5, 20000), strategy: StrategySchema,
    cruiseMs: n(0, 3), horizonH: n(0.5, 12), replanMin: n(5, 360), minOffshoreKm: n(0, 500), maxOffshoreKm: n(1, 1000),
  }),
  jobs: z.object({ arrivalsPerHour: n(0, 1e6), mixInference: n(0, 1), mixTraining: n(0, 1), mixDataHeavy: n(0, 1), checkpointMin: n(1, 240) }),
  econ: z.object({
    firmUsdPerGpuH: n(0, 100), spotUsdPerGpuH: n(0, 100), slaTarget: n(0, 1), slaPenaltyMultiple: n(0, 10),
    hullUsd: n(0, 1e6), podUsd: n(0, 1e6), heatExchangerUsd: n(0, 1e5), petalUsdPerM2: n(0, 1e4), mpptUsdPerW: n(0, 5),
    gnssUsd: n(0, 1e4), avionicsUsd: n(0, 1e5), hostUsd: n(0, 1e5), batteryIntegrationUplift: n(1, 5),
    integrationPct: n(0, 2), contingencyPct: n(0, 2), sparesPct: n(0, 1), deploymentVesselDays: n(0, 365), vesselDayUsd: n(0, 1e6),
    maintenanceVisitsPerYear: n(0, 52), visitUsd: n(0, 1e7), insurancePct: n(0, 0.5), moduleLossRate: n(0, 1),
    acceleratorRefreshYears: n(1, 20), discountRate: n(0, 1), horizonYears: int(1, 30),
  }),
});

export type SimConfig = z.infer<typeof ConfigSchema>;
export type ParseResult = { ok: true; config: SimConfig } | { ok: false; errors: string[] };

export function parseConfig(raw: unknown): ParseResult {
  const r = ConfigSchema.safeParse(raw);
  if (r.success) return { ok: true, config: r.data };
  return { ok: false, errors: r.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`) };
}

export function getPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>(
    (o, k) => (o !== null && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined),
    obj,
  );
}

export function setPath<T>(obj: T, path: string, value: unknown): T {
  const out = structuredClone(obj);
  const keys = path.split('.');
  let o = out as unknown as Record<string, unknown>;
  for (let i = 0; i < keys.length - 1; i++) {
    const next = o[keys[i]];
    if (next === null || typeof next !== 'object') throw new Error(`Unknown config path: ${path}`);
    o = next as Record<string, unknown>;
  }
  const last = keys[keys.length - 1];
  if (!(last in o)) throw new Error(`Unknown config path: ${path}`);
  o[last] = value;
  return out;
}

export function leafPaths(obj: unknown, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return prefix ? [prefix] : [];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => leafPaths(v, prefix ? `${prefix}.${k}` : k));
}
```

- [ ] **Step 4: Implement `defaults.ts`**

```ts
import { ConfigSchema, SimConfig, getPath, setPath } from './config';
import {
  Sourced, s, PANELS, BATTERIES, ACCELERATORS, TERMINALS, PLANS, THRUSTERS, COSTS, SOCAL_ENV, ACCESSED,
} from '../presets';

export type PresetKind = 'panel' | 'battery' | 'accelerator' | 'terminal' | 'plan' | 'thruster';

export const PRESET_FIELDS: Record<PresetKind, { presetPath: string; fields: Record<string, string> }> = {
  panel: { presetPath: 'panel.presetId', fields: { 'panel.efficiency': 'efficiency', 'panel.usdPerW': 'usdPerW', 'panel.kgPerM2': 'kgPerM2', 'panel.tempCoeffPerC': 'tempCoeffPerC' } },
  battery: { presetPath: 'battery.presetId', fields: { 'battery.usdPerKwh': 'usdPerKwh', 'battery.whPerKg': 'whPerKg', 'battery.rte': 'rte', 'battery.cycleLife': 'cycleLife' } },
  accelerator: {
    presetPath: 'compute.presetId',
    fields: {
      'compute.tdpW': 'tdpW', 'compute.denseTflops': 'denseTflops', 'compute.priceUsd': 'priceUsd', 'compute.massKg': 'massKg',
      'compute.volumeL': 'volumeL', 'econ.firmUsdPerGpuH': 'firmUsdPerGpuH', 'econ.spotUsdPerGpuH': 'spotUsdPerGpuH',
    },
  },
  terminal: { presetPath: 'comms.terminalId', fields: { 'comms.terminalW': 'terminalW', 'comms.terminalUsd': 'usd', 'comms.terminalMassKg': 'massKg', 'comms.downMbps': 'downMbps', 'comms.upMbps': 'upMbps' } },
  plan: {
    presetPath: 'comms.planId',
    fields: { 'comms.planUsdPerMonth': 'usdPerMonth', 'comms.planCapGB': 'capGB', 'comms.throttleDownMbps': 'throttleDownMbps', 'comms.throttleUpMbps': 'throttleUpMbps', 'comms.overageUsdPerGB': 'overageUsdPerGB' },
  },
  thruster: { presetPath: 'propulsion.thrusterId', fields: { 'propulsion.thrustN': 'thrustN', 'propulsion.maxElecW': 'maxElecW', 'propulsion.usd': 'usd', 'propulsion.massKg': 'massKg' } },
};

type AnyPreset = { id: string; name: string } & Record<string, unknown>;
const LISTS: Record<PresetKind, AnyPreset[]> = {
  panel: PANELS as unknown as AnyPreset[], battery: BATTERIES as unknown as AnyPreset[], accelerator: ACCELERATORS as unknown as AnyPreset[],
  terminal: TERMINALS as unknown as AnyPreset[], plan: PLANS as unknown as AnyPreset[], thruster: THRUSTERS as unknown as AnyPreset[],
};
export const PRESET_LISTS: Record<PresetKind, { id: string; name: string }[]> = LISTS;

function findPreset(kind: PresetKind, id: string): AnyPreset {
  const p = LISTS[kind].find((x) => x.id === id);
  if (!p) throw new Error(`Unknown ${kind} preset: ${id}`);
  return p;
}

export function applyPreset(cfg: SimConfig, kind: PresetKind, id: string): SimConfig {
  const p = findPreset(kind, id);
  const { presetPath, fields } = PRESET_FIELDS[kind];
  let out = setPath(cfg, presetPath, id);
  for (const [path, field] of Object.entries(fields)) {
    const v = p[field] as Sourced | null;
    out = setPath(out, path, v === null ? null : v.value);
  }
  return out;
}

const brief = (value: number, unit: string, note: string): Sourced => s(value, unit, 'Founder brief, 2026-10-15', note);
const design = (value: number, unit: string, note: string): Sourced => s(value, unit, 'Design default (adjustable)', note);

/** Non-preset defaults with provenance. Values here set the default config. */
export const SOURCED_DEFAULTS: [string, Sourced][] = [
  ['hull.sideM', brief(1.52, 'm', '5 ft hull')],
  ['hull.draftM', COSTS.draftM], ['hull.massKg', COSTS.hullMassKg], ['hull.podVolumeL', COSTS.podVolumeL], ['hull.podMassKg', COSTS.podMassKg],
  ['hull.petalCount', design(8, 'petals', 'flower layout')], ['hull.petalLengthM', design(1.0, 'm', 'gives a 3.52 m span')],
  ['hull.petalWidthM', design(0.9, 'm', 'fits 8 petals without overlap')], ['hull.fixedTiltDeg', design(25, 'deg', 'tilt when rotating to face the sun')],
  ['hull.maxTiltDeg', design(60, 'deg', 'petal hinge limit')], ['hull.dragCd', COSTS.dragCd],
  ['pv.mpptEff', COSTS.mpptEff], ['pv.waterTempC', COSTS.waterTempC], ['pv.cellTempRiseC', COSTS.cellTempRiseC],
  ['battery.kwh', design(8, 'kWh', 'covers about 14 h of loads plus firm compute')], ['battery.dod', design(0.9, 'fraction', 'usable depth of discharge')],
  ['compute.cards', design(8, 'cards', 'sized to the module power budget')], ['compute.hostW', COSTS.hostW], ['compute.coolingOverhead', COSTS.coolingOverhead],
  ['compute.firmComputeW', design(200, 'W', 'firm 24/7 compute commitment per module')],
  ['loads.avionicsW', COSTS.avionicsW], ['loads.actuatorW', COSTS.actuatorW],
  ['comms.modulesPerTerminal', design(1, 'modules', 'one terminal per module')],
  ['comms.radioW', COSTS.radioW], ['comms.radioUsd', COSTS.radioUsd], ['comms.radioRangeM', COSTS.radioRangeM],
  ['propulsion.count', design(2, 'thrusters', 'differential steering')], ['propulsion.propEff', COSTS.propEff],
  ['env.originLat', SOCAL_ENV.originLat], ['env.originLon', SOCAL_ENV.originLon], ['env.currentMs', SOCAL_ENV.currentMs],
  ['env.currentHeadingDeg', SOCAL_ENV.currentHeadingDeg], ['env.currentVariabilityMs', SOCAL_ENV.currentVariabilityMs], ['env.tidalMs', SOCAL_ENV.tidalMs],
  ['env.windMeanMs', SOCAL_ENV.windMeanMs], ['env.stowWindMs', SOCAL_ENV.stowWindMs], ['env.cloudCellKm', SOCAL_ENV.cloudCellKm],
  ['env.cloudCellAmp', SOCAL_ENV.cloudCellAmp], ['env.cloudDriftMs', SOCAL_ENV.cloudDriftMs], ['env.cloudDriftHeadingDeg', SOCAL_ENV.cloudDriftHeadingDeg],
  ['env.dayVariability', SOCAL_ENV.dayVariability], ['env.marineLayerStrength', SOCAL_ENV.marineLayerStrength], ['env.disturbanceMs', SOCAL_ENV.disturbanceMs],
  ['swarm.count', brief(20, 'modules', 'starting swarm size')], ['swarm.spacingM', design(150, 'm', 'formation spacing')],
  ['swarm.toleranceM', design(40, 'm', 'free-drift radius around each slot')], ['swarm.breakawayM', design(300, 'm', 'distance that flags a stray')],
  ['swarm.cruiseMs', design(0.3, 'm/s', 'swarm repositioning speed')], ['swarm.horizonH', design(3, 'h', 'cloud-seeking lookahead')],
  ['swarm.replanMin', design(30, 'min', 'cloud-seeking replan interval')], ['swarm.minOffshoreKm', design(20, 'km', 'stay clear of coastal traffic')],
  ['swarm.maxOffshoreKm', design(150, 'km', 'servicing range')],
  ['jobs.arrivalsPerHour', design(1500, 'jobs/h', 'demand above default capacity')], ['jobs.mixInference', design(0.95, 'fraction', 'job share')],
  ['jobs.mixTraining', design(0.04, 'fraction', 'job share')], ['jobs.mixDataHeavy', design(0.01, 'fraction', 'job share')],
  ['jobs.checkpointMin', design(15, 'min', 'checkpoint interval')],
  ['econ.slaTarget', COSTS.slaTarget], ['econ.slaPenaltyMultiple', COSTS.slaPenaltyMultiple], ['econ.hullUsd', COSTS.hullUsd],
  ['econ.podUsd', COSTS.podUsd], ['econ.heatExchangerUsd', COSTS.heatExchangerUsd], ['econ.petalUsdPerM2', COSTS.petalUsdPerM2],
  ['econ.mpptUsdPerW', COSTS.mpptUsdPerW], ['econ.gnssUsd', COSTS.gnssUsd], ['econ.avionicsUsd', COSTS.avionicsUsd], ['econ.hostUsd', COSTS.hostUsd],
  ['econ.batteryIntegrationUplift', COSTS.batteryIntegrationUplift], ['econ.integrationPct', COSTS.integrationPct],
  ['econ.contingencyPct', COSTS.contingencyPct], ['econ.sparesPct', COSTS.sparesPct], ['econ.deploymentVesselDays', COSTS.deploymentVesselDays],
  ['econ.vesselDayUsd', COSTS.vesselDayUsd], ['econ.maintenanceVisitsPerYear', COSTS.maintenanceVisitsPerYear], ['econ.visitUsd', COSTS.visitUsd],
  ['econ.insurancePct', COSTS.insurancePct], ['econ.moduleLossRate', COSTS.moduleLossRate],
  ['econ.acceleratorRefreshYears', COSTS.acceleratorRefreshYears], ['econ.discountRate', COSTS.discountRate], ['econ.horizonYears', COSTS.horizonYears],
];

const BASE: SimConfig = {
  version: 1, name: 'Baseline 20-module swarm', seed: 42,
  hull: { sideM: 0, draftM: 0, massKg: 0, podVolumeL: 0, podMassKg: 0, petalCount: 0, petalLengthM: 0, petalWidthM: 0, tracking: 'yaw', fixedTiltDeg: 0, maxTiltDeg: 0, dragCd: 0 },
  panel: { presetId: '', efficiency: 0, usdPerW: 0, kgPerM2: 0, tempCoeffPerC: 0 },
  pv: { mpptEff: 0, waterTempC: 0, cellTempRiseC: 0 },
  battery: { presetId: '', kwh: 0, usdPerKwh: 0, whPerKg: 0, rte: 0, cycleLife: 0, dod: 0 },
  compute: { presetId: '', cards: 0, tdpW: 0, denseTflops: 0, priceUsd: 0, massKg: 0, volumeL: 0, hostW: 0, coolingOverhead: 0, policy: 'firm', firmComputeW: 0 },
  loads: { avionicsW: 0, actuatorW: 0 },
  comms: {
    terminalId: '', terminalW: 0, terminalUsd: 0, terminalMassKg: 0, downMbps: 0, upMbps: 0, planId: '', planUsdPerMonth: 0, planCapGB: 0,
    throttleDownMbps: 0, throttleUpMbps: 0, overageUsdPerGB: null, buyOverage: false, modulesPerTerminal: 0, radioW: 0, radioUsd: 0, radioRangeM: 0,
  },
  propulsion: { thrusterId: '', count: 0, thrustN: 0, maxElecW: 0, usd: 0, massKg: 0, propEff: 0 },
  env: {
    originLat: 0, originLon: 0, currentMs: 0, currentHeadingDeg: 0, currentVariabilityMs: 0, tidalMs: 0, windMeanMs: 0, stowWindMs: 0,
    cloudCellKm: 0, cloudCellAmp: 0, cloudDriftMs: 0, cloudDriftHeadingDeg: 0, dayVariability: 0, marineLayerStrength: 0, disturbanceMs: 0,
  },
  swarm: { count: 0, spacingM: 0, toleranceM: 0, breakawayM: 0, strategy: 'station', cruiseMs: 0, horizonH: 0, replanMin: 0, minOffshoreKm: 0, maxOffshoreKm: 0 },
  jobs: { arrivalsPerHour: 0, mixInference: 0, mixTraining: 0, mixDataHeavy: 0, checkpointMin: 0 },
  econ: {
    firmUsdPerGpuH: 0, spotUsdPerGpuH: 0, slaTarget: 0, slaPenaltyMultiple: 0, hullUsd: 0, podUsd: 0, heatExchangerUsd: 0, petalUsdPerM2: 0,
    mpptUsdPerW: 0, gnssUsd: 0, avionicsUsd: 0, hostUsd: 0, batteryIntegrationUplift: 0, integrationPct: 0, contingencyPct: 0, sparesPct: 0,
    deploymentVesselDays: 0, vesselDayUsd: 0, maintenanceVisitsPerYear: 0, visitUsd: 0, insurancePct: 0, moduleLossRate: 0,
    acceleratorRefreshYears: 0, discountRate: 0, horizonYears: 0,
  },
};

const DEFAULT_PRESETS: [PresetKind, string][] = [
  ['panel', 'csi-tophiku6'], ['battery', 'bnef-lfp-pack'], ['accelerator', 'l4'], ['terminal', 'mini'], ['plan', 'gp-1tb'], ['thruster', 't200'],
];

export function defaultConfig(): SimConfig {
  let cfg = structuredClone(BASE);
  for (const [path, src] of SOURCED_DEFAULTS) cfg = setPath(cfg, path, src.value);
  for (const [kind, id] of DEFAULT_PRESETS) cfg = applyPreset(cfg, kind, id);
  return ConfigSchema.parse(cfg);
}

const DEFAULT_MAP = new Map(SOURCED_DEFAULTS);

/** Provenance for a config path: the selected preset's field, or the sourced default. */
export function sourceFor(cfg: SimConfig, path: string): Sourced | null {
  for (const kind of Object.keys(PRESET_FIELDS) as PresetKind[]) {
    const { presetPath, fields } = PRESET_FIELDS[kind];
    const field = fields[path];
    if (!field) continue;
    const p = LISTS[kind].find((x) => x.id === getPath(cfg, presetPath));
    const v = p ? (p[field] as Sourced | null) : null;
    return v ?? { value: 0, unit: '', source: 'Not applicable for this preset', date: ACCESSED };
  }
  return DEFAULT_MAP.get(path) ?? null;
}

/** True when data beyond the plan cap is bought per GB instead of throttled. */
export function payOverage(cfg: SimConfig): boolean {
  return cfg.comms.overageUsdPerGB !== null && (cfg.comms.buyOverage || cfg.comms.planCapGB === 0);
}
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/model/config.ts src/model/defaults.ts src/model/config.test.ts
git commit -m "feat: add scenario schema, sourced defaults and preset binding"
```

---

### Task 4: Solar geometry and PV power

**Files:**
- Create: `src/model/solar.ts`
- Test: `src/model/solar.test.ts`

**Interfaces:**
- Consumes: `RAD`, `SOLAR_CONSTANT`, `WATER_ALBEDO`, `SimConfig`, `Tracking`.
- Produces:
  - `interface SunPos { zenithDeg: number; azimuthDeg: number; elevationDeg: number }`
  - `sunPosition(utcMs: number, latDeg: number, lonDeg: number): SunPos` (NOAA algorithm with refraction)
  - `clearSkyGhi(zenithDeg: number): number` (Haurwitz, W/m2)
  - `erbsDiffuseFraction(kt: number): number`
  - `poaIrradiance(ghi: number, sun: SunPos, tracking: Tracking, fixedTiltDeg: number, maxTiltDeg: number, doy: number): number`
  - `pvPowerW(poaWm2: number, areaM2: number, cfg: Pick<SimConfig, 'panel' | 'pv'>): number`

- [ ] **Step 1: Write the failing test**

`src/model/solar.test.ts`:
```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/model/solar.test.ts`
Expected: FAIL, cannot resolve `./solar`.

- [ ] **Step 3: Implement `solar.ts`**

```ts
import { RAD, SOLAR_CONSTANT, WATER_ALBEDO } from './constants';
import type { SimConfig, Tracking } from './config';

export interface SunPos {
  zenithDeg: number;
  azimuthDeg: number;
  elevationDeg: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** NOAA solar position algorithm with atmospheric refraction. Azimuth is clockwise from north. */
export function sunPosition(utcMs: number, latDeg: number, lonDeg: number): SunPos {
  const jd = utcMs / 86400000 + 2440587.5;
  const T = (jd - 2451545) / 36525;
  const L0 = (((280.46646 + T * (36000.76983 + T * 0.0003032)) % 360) + 360) % 360;
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C =
    Math.sin(M * RAD) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
    Math.sin(2 * M * RAD) * (0.019993 - 0.000101 * T) +
    Math.sin(3 * M * RAD) * 0.000289;
  const omega = 125.04 - 1934.136 * T;
  const lambda = L0 + C - 0.00569 - 0.00478 * Math.sin(omega * RAD);
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(omega * RAD);
  const decl = Math.asin(Math.sin(eps * RAD) * Math.sin(lambda * RAD));
  const y = Math.tan((eps * RAD) / 2) ** 2;
  const eqTime =
    (4 / RAD) *
    (y * Math.sin(2 * L0 * RAD) -
      2 * e * Math.sin(M * RAD) +
      4 * e * y * Math.sin(M * RAD) * Math.cos(2 * L0 * RAD) -
      0.5 * y * y * Math.sin(4 * L0 * RAD) -
      1.25 * e * e * Math.sin(2 * M * RAD));
  const utcMinutes = (((utcMs % 86400000) + 86400000) % 86400000) / 60000;
  const tst = (((utcMinutes + eqTime + 4 * lonDeg) % 1440) + 1440) % 1440;
  let hourAngle = tst / 4 - 180;
  if (hourAngle < -180) hourAngle += 360;
  const latR = latDeg * RAD;
  const cosZ = clamp(Math.sin(latR) * Math.sin(decl) + Math.cos(latR) * Math.cos(decl) * Math.cos(hourAngle * RAD), -1, 1);
  const zenRad = Math.acos(cosZ);
  const zenDeg = zenRad / RAD;
  const azDenom = Math.cos(latR) * Math.sin(zenRad);
  let az: number;
  if (Math.abs(azDenom) < 1e-9) {
    az = latDeg > 0 ? 180 : 0;
  } else {
    const a = clamp((Math.sin(latR) * Math.cos(zenRad) - Math.sin(decl)) / azDenom, -1, 1);
    const acosDeg = Math.acos(a) / RAD;
    az = hourAngle > 0 ? (acosDeg + 180) % 360 : (540 - acosDeg) % 360;
  }
  const elev = 90 - zenDeg;
  let refr = 0;
  if (elev <= 85) {
    const te = Math.tan(elev * RAD);
    if (elev > 5) refr = 58.1 / te - 0.07 / te ** 3 + 0.000086 / te ** 5;
    else if (elev > -0.575) refr = 1735 + elev * (-518.2 + elev * (103.4 + elev * (-12.79 + elev * 0.711)));
    else refr = -20.772 / te;
    refr /= 3600;
  }
  const elevCorr = elev + refr;
  return { zenithDeg: 90 - elevCorr, azimuthDeg: az, elevationDeg: elevCorr };
}

/** Haurwitz clear-sky global horizontal irradiance, W/m2. */
export function clearSkyGhi(zenithDeg: number): number {
  const cz = Math.cos(zenithDeg * RAD);
  if (cz <= 0) return 0;
  return 1098 * cz * Math.exp(-0.057 / cz);
}

export function erbsDiffuseFraction(kt: number): number {
  if (kt <= 0.22) return 1 - 0.09 * kt;
  if (kt <= 0.8) return 0.9511 - 0.1604 * kt + 4.388 * kt ** 2 - 16.638 * kt ** 3 + 12.336 * kt ** 4;
  return 0.165;
}

/**
 * Plane-of-array irradiance. 'yaw' rotates the hull so panels at a fixed tilt face the sun's azimuth;
 * 'dual' also tilts petals toward the sun up to maxTiltDeg.
 */
export function poaIrradiance(ghi: number, sun: SunPos, tracking: Tracking, fixedTiltDeg: number, maxTiltDeg: number, doy: number): number {
  if (ghi <= 0 || sun.elevationDeg <= 0) return 0;
  if (tracking === 'flat') return ghi;
  const z = sun.zenithDeg * RAD;
  const cz = Math.cos(z);
  let dhi: number;
  let dni: number;
  if (cz <= 0.05) {
    dhi = ghi;
    dni = 0;
  } else {
    const i0 = SOLAR_CONSTANT * (1 + 0.033 * Math.cos((2 * Math.PI * doy) / 365));
    const kt = Math.min(1, ghi / (i0 * cz));
    dhi = ghi * erbsDiffuseFraction(kt);
    dni = (ghi - dhi) / cz;
  }
  const tilt = (tracking === 'dual' ? Math.min(sun.zenithDeg, maxTiltDeg) : fixedTiltDeg) * RAD;
  const beam = dni * Math.max(0, Math.cos(z - tilt));
  const diffuse = (dhi * (1 + Math.cos(tilt))) / 2;
  const ground = (ghi * WATER_ALBEDO * (1 - Math.cos(tilt))) / 2;
  return beam + diffuse + ground;
}

/** DC power after temperature derating and MPPT, W. Cell temperature = water + rise scaled by irradiance. */
export function pvPowerW(poaWm2: number, areaM2: number, cfg: Pick<SimConfig, 'panel' | 'pv'>): number {
  if (poaWm2 <= 0 || areaM2 <= 0) return 0;
  const cellC = cfg.pv.waterTempC + (poaWm2 / 800) * cfg.pv.cellTempRiseC;
  const tempFactor = Math.max(0, 1 + cfg.panel.tempCoeffPerC * (cellC - 25));
  return poaWm2 * areaM2 * cfg.panel.efficiency * tempFactor * cfg.pv.mpptEff;
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS. If the NREL azimuth check is off by about 180 degrees, the hour-angle branch is inverted. Fix the branch rather than loosening the tolerance.

- [ ] **Step 5: Commit**

```bash
git add src/model/solar.ts src/model/solar.test.ts
git commit -m "feat: add solar position, clear-sky, plane-of-array and PV power models"
```

---

### Task 5: Geography and environment fields

**Files:**
- Create: `src/model/geo.ts`, `src/model/environment.ts`
- Test: `src/model/environment.test.ts`

**Interfaces:**
- Consumes: `SimConfig`, `sunPosition`, `clearSkyGhi`, `SunPos`, `valueNoise3`, `mulberry32`, `hashSeed`, time helpers, SoCal presets.
- Produces:
  - `interface Projection { toXY(lat: number, lon: number): Vec; toLatLon(p: Vec): { lat: number; lon: number } }`, `makeProjection(lat0, lon0): Projection`
  - `distToPolyline(p: Vec, pts: Vec[]): number` (meters), `interpAnchors(km: number, anchors: GhiAnchor[], month0: number): number`
  - `type DayType = 'clear' | 'partial' | 'cloudy'`, `dayTypeProbs(month0: number): Record<DayType, number>`, `marineDiurnal(hour: number, month0: number, strength: number): number`
  - `interface Env { proj; coastXY; sun(t); ghi(t, x, y); current(t): Vec; wind(t); stowed(t): boolean; offshoreKm(x, y); dayType(doy): DayType; monthlyTargetGhi(month0, km): number }`
  - `createEnvironment(cfg: SimConfig, opts?: { forcedDayType?: DayType }): Env`

- [ ] **Step 1: Write the failing test**

`src/model/environment.test.ts`:
```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/model/environment.test.ts`
Expected: FAIL, cannot resolve `./environment`.

- [ ] **Step 3: Implement `geo.ts`**

```ts
import type { Vec } from './vec';
import { RAD } from './constants';
import type { GhiAnchor } from '../presets';

export const M_PER_DEG_LAT = 110540;

export interface Projection {
  toXY(lat: number, lon: number): Vec;
  toLatLon(p: Vec): { lat: number; lon: number };
}

/** Local equirectangular projection in meters around an origin. */
export function makeProjection(lat0: number, lon0: number): Projection {
  const kx = 111320 * Math.cos(lat0 * RAD);
  return {
    toXY: (lat, lon) => ({ x: (lon - lon0) * kx, y: (lat - lat0) * M_PER_DEG_LAT }),
    toLatLon: (p) => ({ lat: lat0 + p.y / M_PER_DEG_LAT, lon: lon0 + p.x / kx }),
  };
}

export function distToSegment(p: Vec, a: Vec, b: Vec): number {
  const abx = b.x - a.x, aby = b.y - a.y;
  const l2 = abx * abx + aby * aby;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / l2)) : 0;
  return Math.hypot(p.x - (a.x + t * abx), p.y - (a.y + t * aby));
}

export function distToPolyline(p: Vec, pts: Vec[]): number {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) best = Math.min(best, distToSegment(p, pts[i], pts[i + 1]));
  return best;
}

/** Linear interpolation of monthly GHI between distance anchors, clamped at the ends. */
export function interpAnchors(km: number, anchors: GhiAnchor[], month0: number): number {
  if (km <= anchors[0].km) return anchors[0].monthly[month0];
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i], b = anchors[i + 1];
    if (km <= b.km) {
      const t = (km - a.km) / (b.km - a.km);
      return a.monthly[month0] + t * (b.monthly[month0] - a.monthly[month0]);
    }
  }
  return anchors[anchors.length - 1].monthly[month0];
}
```

- [ ] **Step 4: Implement `environment.ts`**

```ts
import type { SimConfig } from './config';
import { sunPosition, clearSkyGhi, SunPos } from './solar';
import { valueNoise3 } from './noise';
import { mulberry32, hashSeed } from './rng';
import { makeProjection, distToPolyline, interpAnchors, Projection } from './geo';
import type { Vec } from './vec';
import { RAD, TIDAL_AXIS_DEG } from './constants';
import { YEAR_START_MS, doyOf, monthOfDoy, localSolarHour, midMonthDoy, dayStartMs } from './time';
import { COAST, GHI_ANCHORS, DAY_TYPE, DAY_K, MARINE_PROFILE, MARINE_MONTHLY_STRENGTH } from '../presets';

export type DayType = 'clear' | 'partial' | 'cloudy';

export interface Env {
  proj: Projection;
  coastXY: Vec[];
  sun(t: number): SunPos;
  ghi(t: number, x: number, y: number): number;
  current(t: number): Vec;
  wind(t: number): number;
  stowed(t: number): boolean;
  offshoreKm(x: number, y: number): number;
  dayType(doy: number): DayType;
  monthlyTargetGhi(month0: number, offshoreKm: number): number;
}

export function dayTypeProbs(month0: number): Record<DayType, number> {
  const p = month0 >= 4 && month0 <= 6 ? DAY_TYPE.summer : DAY_TYPE.other;
  return { clear: p.clear.value, cloudy: p.cloudy.value, partial: 1 - p.clear.value - p.cloudy.value };
}

function expectedRelative(month0: number): number {
  const p = dayTypeProbs(month0);
  return p.clear * DAY_K.clear.value + p.partial * DAY_K.partial.value + p.cloudy * DAY_K.cloudy.value;
}

const PROFILE_PEAK = Math.max(...MARINE_PROFILE.map(([, k]) => k));

function profileAt(hour: number): number {
  const pts = MARINE_PROFILE;
  if (hour <= pts[0][0]) return pts[0][1];
  for (let i = 0; i < pts.length - 1; i++) {
    const [h0, k0] = pts[i], [h1, k1] = pts[i + 1];
    if (hour <= h1) return k0 + ((hour - h0) / (h1 - h0)) * (k1 - k0);
  }
  return pts[pts.length - 1][1];
}

/** Multiplier for the marine layer at a local solar hour; 1 when the layer is absent. */
export function marineDiurnal(hour: number, month0: number, strength: number): number {
  const s = MARINE_MONTHLY_STRENGTH[month0] * strength;
  if (s <= 0) return 1;
  return Math.max(0.05, 1 - s * (1 - profileAt(hour) / PROFILE_PEAK));
}

const calibrationCache = new Map<string, number[]>();

/** Mean daily clear-sky GHI times the marine diurnal factor, kWh/m2/day, per month. */
function clearDiurnalMeans(lat: number, lon: number, strength: number): number[] {
  const key = `${lat}|${lon}|${strength}`;
  const hit = calibrationCache.get(key);
  if (hit) return hit;
  const out: number[] = [];
  for (let m = 0; m < 12; m++) {
    const t0 = dayStartMs(midMonthDoy(m));
    let kwh = 0;
    for (let k = 0; k < 144; k++) {
      const t = t0 + k * 600000;
      const sun = sunPosition(t, lat, lon);
      kwh += (clearSkyGhi(sun.zenithDeg) * marineDiurnal(localSolarHour(t, lon), m, strength)) / 6 / 1000;
    }
    out.push(kwh);
  }
  calibrationCache.set(key, out);
  return out;
}

export function createEnvironment(cfg: SimConfig, opts: { forcedDayType?: DayType } = {}): Env {
  const e = cfg.env;
  const lat0 = e.originLat, lon0 = e.originLon;
  const proj = makeProjection(lat0, lon0);
  const coastXY = COAST.map(([la, lo]) => proj.toXY(la, lo));
  const cal = clearDiurnalMeans(lat0, lon0, e.marineLayerStrength);
  const dayCache = new Map<number, { type: DayType; factor: number; windMean: number }>();

  const dayInfo = (doy: number) => {
    const hit = dayCache.get(doy);
    if (hit) return hit;
    const rng = mulberry32(hashSeed(cfg.seed, doy));
    const m = monthOfDoy(doy);
    const p = dayTypeProbs(m);
    const u = rng();
    const drawn: DayType = u < p.clear ? 'clear' : u < p.clear + p.partial ? 'partial' : 'cloudy';
    const type = opts.forcedDayType ?? drawn;
    const raw = DAY_K[type].value / expectedRelative(m);
    const factor = 1 + e.dayVariability * (raw - 1);
    const weibullScale = e.windMeanMs / 0.8862;
    const windMean = weibullScale * Math.sqrt(-Math.log(1 - rng()));
    const info = { type, factor, windMean };
    dayCache.set(doy, info);
    return info;
  };

  let lastT = NaN;
  let lastSun: SunPos = { zenithDeg: 90, azimuthDeg: 0, elevationDeg: 0 };
  const sun = (t: number) => {
    if (t !== lastT) {
      lastSun = sunPosition(t, lat0, lon0);
      lastT = t;
    }
    return lastSun;
  };

  const offshoreKm = (x: number, y: number) => distToPolyline({ x, y }, coastXY) / 1000;
  const cloudHeading = e.cloudDriftHeadingDeg * RAD;
  const driftKmH = { x: e.cloudDriftMs * 3.6 * Math.sin(cloudHeading), y: e.cloudDriftMs * 3.6 * Math.cos(cloudHeading) };
  const cloudSeed = (cfg.seed ^ 0x5bd1e995) | 0;

  const ghi = (t: number, x: number, y: number) => {
    const sp = sun(t);
    if (sp.elevationDeg <= 0) return 0;
    const clear = clearSkyGhi(sp.zenithDeg);
    const doy = doyOf(t);
    const m = monthOfDoy(doy);
    const k = interpAnchors(offshoreKm(x, y), GHI_ANCHORS, m) / cal[m];
    const diurnal = marineDiurnal(localSolarHour(t, lon0), m, e.marineLayerStrength);
    const tH = (t - YEAR_START_MS) / 3600000;
    const nz = valueNoise3(cloudSeed, (x / 1000 - driftKmH.x * tH) / e.cloudCellKm, (y / 1000 - driftKmH.y * tH) / e.cloudCellKm, tH / 6);
    const cell = 1 + e.cloudCellAmp * (2 * nz - 1);
    return Math.max(0, Math.min(clear * 1.05, clear * k * diurnal * dayInfo(doy).factor * cell));
  };

  const meanCurrent = { x: e.currentMs * Math.sin(e.currentHeadingDeg * RAD), y: e.currentMs * Math.cos(e.currentHeadingDeg * RAD) };
  const tidalAxis = { x: Math.sin(TIDAL_AXIS_DEG * RAD), y: Math.cos(TIDAL_AXIS_DEG * RAD) };
  const current = (t: number): Vec => {
    const tH = (t - YEAR_START_MS) / 3600000;
    const tide = e.tidalMs * Math.cos((2 * Math.PI * tH) / 12.42);
    const tD = tH / 24 / 2;
    const nu = 2 * valueNoise3(cfg.seed + 11, tD, 0.5, 0.5) - 1;
    const nv = 2 * valueNoise3(cfg.seed + 13, tD, 0.5, 0.5) - 1;
    return {
      x: meanCurrent.x + tide * tidalAxis.x + e.currentVariabilityMs * nu,
      y: meanCurrent.y + tide * tidalAxis.y + e.currentVariabilityMs * nv,
    };
  };

  const wind = (t: number) => {
    const h = localSolarHour(t, lon0);
    return dayInfo(doyOf(t)).windMean * (1 + 0.2 * Math.sin((2 * Math.PI * (h - 9)) / 24));
  };

  return {
    proj,
    coastXY,
    sun,
    ghi,
    current,
    wind,
    stowed: (t) => wind(t) > e.stowWindMs,
    offshoreKm,
    dayType: (doy) => dayInfo(doy).type,
    monthlyTargetGhi: (m, km) => interpAnchors(km, GHI_ANCHORS, m),
  };
}
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS. If the calibration test misses by more than 3% in a winter month, the 1.05x clear-sky clamp is cutting output; check that `k * diurnal` stays below 1.05 for that month before changing anything.

- [ ] **Step 6: Commit**

```bash
git add src/model/geo.ts src/model/environment.ts src/model/environment.test.ts
git commit -m "feat: add calibrated SoCal irradiance, marine layer, clouds, current and wind"
```

---
### Task 6: Derived quantities and module power dispatch

**Files:**
- Create: `src/model/derive.ts`, `src/model/module.ts`
- Create: `src/model/swarm.ts` containing only `hexSlots` (Task 7 adds the rest) and `src/model/jobs.ts` containing only `mixStats` (Task 8 adds the rest). `derive.ts` needs both, so they come first, already in their final form.
- Test: `src/model/module.test.ts`

**Interfaces:**
- Consumes: `SimConfig`, constants, `WORKLOADS`.
- Produces:
  - In `swarm.ts` (created here, extended in Task 7): `hexSlots(n: number, spacingM: number): Vec[]`
  - In `jobs.ts` (created here, extended in Task 8): `interface MixStats { weights: number[]; meanTflop: number; inMBPerTflop: number; outMBPerTflop: number }`, `mixStats(jobs: SimConfig['jobs'], workloads: Workload[]): MixStats`
  - `interface Derived { hullTopM2; petalM2; pvAreaM2; spanM; peakPvW; cardsMaxW; overheadFactor; maxComputeElecW; tflopsPerElecW; firmComputeElecW; terminals; starlinkWPerModule; essentialW; frontalAreaM2; maxThrustN; maxPropElecW; maxWaterSpeedMs; batteryKg; massKg; displacementKg; podNeedL; petalOverlap: boolean; formationRadiusM; batteryUsableKwh; socMinKwh; reserveKwh; mix: MixStats }` (all other fields are `number`)
  - `derive(cfg: SimConfig): Derived`
  - `interface DispatchInput { pvW: number; propulsionW: number; trackingActive: boolean; socKwh: number; dtH: number; computeCapElecW?: number }`
  - `interface StepFlows { pvW; essentialW; computeElecW; firmElecW; spotElecW; tflops; firmTflops; spotTflops; chargeW; dischargeW; curtailedW; unmetW; socKwh: number; online: boolean }` (`essentialW` is the essential load actually served, including propulsion)
  - `dispatch(cfg: SimConfig, d: Derived, inp: DispatchInput): StepFlows`

Energy balance invariant, asserted in tests: `pvW + dischargeW = essentialW + computeElecW + chargeW + curtailedW`.

- [ ] **Step 1: Write the failing test**

`src/model/module.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { derive } from './derive';
import { dispatch, StepFlows } from './module';
import { hexSlots } from './swarm';
import { mixStats } from './jobs';
import { defaultConfig } from './defaults';
import { WORKLOADS } from '../presets';
import type { SimConfig } from './config';

const balance = (f: StepFlows) => f.pvW + f.dischargeW - (f.essentialW + f.computeElecW + f.chargeW + f.curtailedW);

describe('hexSlots', () => {
  it('builds a hex lattice with minimum spacing', () => {
    expect(hexSlots(1, 100)).toEqual([{ x: 0, y: 0 }]);
    const s7 = hexSlots(7, 100);
    expect(s7).toHaveLength(7);
    for (let i = 1; i < 7; i++) expect(Math.hypot(s7[i].x, s7[i].y)).toBeCloseTo(100, 6);
    const s20 = hexSlots(20, 150);
    for (let i = 0; i < 20; i++) for (let j = i + 1; j < 20; j++) {
      expect(Math.hypot(s20[i].x - s20[j].x, s20[i].y - s20[j].y)).toBeGreaterThan(149.9);
    }
  });
});

describe('mixStats', () => {
  it('weights workloads and normalizes', () => {
    const m = mixStats({ arrivalsPerHour: 1, mixInference: 2, mixTraining: 0, mixDataHeavy: 0, checkpointMin: 15 }, WORKLOADS);
    expect(m.weights).toEqual([1, 0, 0]);
    expect(m.meanTflop).toBe(14000);
    expect(m.inMBPerTflop).toBeCloseTo(2 / 14000, 12);
    const z = mixStats({ arrivalsPerHour: 1, mixInference: 0, mixTraining: 0, mixDataHeavy: 0, checkpointMin: 15 }, WORKLOADS);
    expect(z.weights).toEqual([1, 0, 0]);
  });
});

describe('derive', () => {
  it('computes default module geometry and limits', () => {
    const d = derive(defaultConfig());
    expect(d.hullTopM2).toBeCloseTo(2.3104, 4);
    expect(d.pvAreaM2).toBeCloseTo(2.3104 + 8 * 1.0 * 0.9, 4);
    expect(d.spanM).toBeCloseTo(3.52, 6);
    expect(d.terminals).toBe(20);
    expect(d.maxWaterSpeedMs).toBeGreaterThan(0.4);
    expect(d.maxWaterSpeedMs).toBeLessThan(0.5);
    expect(d.massKg).toBeLessThan(d.displacementKg);
    expect(d.petalOverlap).toBe(false);
    expect(d.tflopsPerElecW).toBeGreaterThan(1.4);
    expect(d.tflopsPerElecW).toBeLessThan(121 / 72);
  });
  it('shares terminals across modules', () => {
    const c = defaultConfig();
    c.comms.modulesPerTerminal = 4;
    const d = derive(c);
    expect(d.terminals).toBe(5);
    expect(d.starlinkWPerModule).toBeCloseTo((5 * c.comms.terminalW) / 20, 9);
    expect(d.essentialW).toBeCloseTo(c.loads.avionicsW + d.starlinkWPerModule + c.comms.radioW, 9);
  });
  it('handles zero cards and zero thrusters', () => {
    const c = defaultConfig();
    c.compute.cards = 0;
    c.propulsion.count = 0;
    const d = derive(c);
    expect(d.maxComputeElecW).toBe(0);
    expect(d.tflopsPerElecW).toBe(0);
    expect(d.maxWaterSpeedMs).toBe(0);
  });
});

describe('dispatch', () => {
  const base = (mut?: (c: SimConfig) => void) => {
    const c = defaultConfig();
    mut?.(c);
    return { c, d: derive(c) };
  };

  it('conserves energy under every policy, day and night', () => {
    for (const policy of ['daylight', 'firm', 'max'] as const) {
      const { c, d } = base((c) => { c.compute.policy = policy; });
      for (const pvW of [0, 150, 900, 2500]) {
        for (const soc of [0.8, 4, 8]) {
          const f = dispatch(c, d, { pvW, propulsionW: 20, trackingActive: pvW > 0, socKwh: soc, dtH: 0.25 });
          expect(Math.abs(balance(f))).toBeLessThan(1e-6);
          expect(f.socKwh).toBeGreaterThanOrEqual(0);
          expect(f.socKwh).toBeLessThanOrEqual(c.battery.kwh + 1e-9);
        }
      }
    }
  });

  it('daylight policy never discharges the battery for compute', () => {
    const { c, d } = base((c) => { c.compute.policy = 'daylight'; });
    const f = dispatch(c, d, { pvW: 0, propulsionW: 0, trackingActive: false, socKwh: 8, dtH: 0.25 });
    expect(f.computeElecW).toBe(0);
    expect(f.dischargeW).toBeCloseTo(d.essentialW, 6);
  });

  it('firm policy runs firm compute from the battery at night and keeps the reserve', () => {
    const { c, d } = base();
    const f = dispatch(c, d, { pvW: 0, propulsionW: 0, trackingActive: false, socKwh: 8, dtH: 0.25 });
    expect(f.firmElecW).toBeCloseTo(d.firmComputeElecW, 6);
    expect(f.spotElecW).toBe(0);
    const low = dispatch(c, d, { pvW: 0, propulsionW: 0, trackingActive: false, socKwh: d.reserveKwh, dtH: 0.25 });
    expect(low.firmElecW).toBe(0);
    expect(low.online).toBe(true);
  });

  it('caps compute when asked', () => {
    const { c, d } = base();
    const f = dispatch(c, d, { pvW: 2500, propulsionW: 0, trackingActive: true, socKwh: 4, dtH: 0.25, computeCapElecW: 100 });
    expect(f.computeElecW).toBeLessThanOrEqual(100 + 1e-9);
    expect(Math.abs(balance(f))).toBeLessThan(1e-6);
  });

  it('marks the module offline and records unmet load when the battery is empty at night', () => {
    const { c, d } = base();
    const f = dispatch(c, d, { pvW: 0, propulsionW: 50, trackingActive: false, socKwh: d.socMinKwh, dtH: 0.25 });
    expect(f.online).toBe(false);
    expect(f.unmetW).toBeGreaterThan(0);
    expect(f.computeElecW).toBe(0);
  });

  it('works with a zero-capacity battery', () => {
    const { c, d } = base((c) => { c.battery.kwh = 0; });
    const f = dispatch(c, d, { pvW: 1000, propulsionW: 0, trackingActive: true, socKwh: 0, dtH: 0.25 });
    expect(Math.abs(balance(f))).toBeLessThan(1e-6);
    expect(f.chargeW).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/model/module.test.ts`
Expected: FAIL, cannot resolve `./derive`.

- [ ] **Step 3: Create `swarm.ts` with `hexSlots` (the rest comes in Task 7)**

```ts
import type { Vec } from './vec';

const HEX_DIRS: [number, number][] = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

/** Slots on a hexagonal lattice, filled ring by ring from the center. */
export function hexSlots(n: number, spacingM: number): Vec[] {
  const axial: [number, number][] = [[0, 0]];
  for (let k = 1; axial.length < n; k++) {
    let q = -k, r = k;
    for (let side = 0; side < 6; side++) {
      for (let j = 0; j < k; j++) {
        axial.push([q, r]);
        q += HEX_DIRS[side][0];
        r += HEX_DIRS[side][1];
      }
    }
  }
  return axial.slice(0, n).map(([q, r]) => ({ x: spacingM * (q + r / 2), y: spacingM * ((Math.sqrt(3) / 2) * r) }));
}
```

- [ ] **Step 4: Create `jobs.ts` with `mixStats` (the rest comes in Task 8)**

```ts
import type { SimConfig } from './config';
import type { Workload } from '../presets';

export interface MixStats {
  weights: number[];
  meanTflop: number;
  inMBPerTflop: number;
  outMBPerTflop: number;
}

export function mixStats(jobs: SimConfig['jobs'], workloads: Workload[]): MixStats {
  const raw = [jobs.mixInference, jobs.mixTraining, jobs.mixDataHeavy].map((w) => Math.max(0, w));
  const sum = raw.reduce((a, b) => a + b, 0);
  const weights = sum > 0 ? raw.map((w) => w / sum) : [1, 0, 0];
  const meanTflop = weights.reduce((a, w, i) => a + w * workloads[i].tflopPerJob.value, 0);
  const meanIn = weights.reduce((a, w, i) => a + w * workloads[i].inMB.value, 0);
  const meanOut = weights.reduce((a, w, i) => a + w * workloads[i].outMB.value, 0);
  return { weights, meanTflop, inMBPerTflop: meanTflop > 0 ? meanIn / meanTflop : 0, outMBPerTflop: meanTflop > 0 ? meanOut / meanTflop : 0 };
}
```

- [ ] **Step 5: Implement `derive.ts`**

```ts
import type { SimConfig } from './config';
import { RHO_SEA, ELECTRONICS_KG, HOST_VOLUME_L, HX_VOLUME_L, NIGHT_RESERVE_H } from './constants';
import { hexSlots } from './swarm';
import { mixStats, MixStats } from './jobs';
import { WORKLOADS } from '../presets';

export interface Derived {
  hullTopM2: number;
  petalM2: number;
  pvAreaM2: number;
  spanM: number;
  peakPvW: number;
  cardsMaxW: number;
  overheadFactor: number;
  maxComputeElecW: number;
  tflopsPerElecW: number;
  firmComputeElecW: number;
  terminals: number;
  starlinkWPerModule: number;
  essentialW: number;
  frontalAreaM2: number;
  maxThrustN: number;
  maxPropElecW: number;
  maxWaterSpeedMs: number;
  batteryKg: number;
  massKg: number;
  displacementKg: number;
  podNeedL: number;
  petalOverlap: boolean;
  formationRadiusM: number;
  batteryUsableKwh: number;
  socMinKwh: number;
  reserveKwh: number;
  mix: MixStats;
}

export function derive(cfg: SimConfig): Derived {
  const h = cfg.hull, c = cfg.compute, p = cfg.propulsion, b = cfg.battery;
  const hullTopM2 = h.sideM ** 2;
  const petalM2 = h.petalCount * h.petalLengthM * h.petalWidthM;
  const pvAreaM2 = hullTopM2 + petalM2;
  const cardsMaxW = c.cards * c.tdpW;
  const overheadFactor = 1 + c.coolingOverhead + (cardsMaxW > 0 ? c.hostW / cardsMaxW : 0);
  const maxComputeElecW = cardsMaxW * overheadFactor;
  const tflopsPerElecW = cardsMaxW > 0 ? c.denseTflops / c.tdpW / overheadFactor : 0;
  const terminals = Math.ceil(cfg.swarm.count / cfg.comms.modulesPerTerminal);
  const shared = cfg.comms.modulesPerTerminal > 1;
  const starlinkWPerModule = (terminals * cfg.comms.terminalW) / cfg.swarm.count;
  const essentialW = cfg.loads.avionicsW + starlinkWPerModule + (shared ? cfg.comms.radioW : 0);
  const frontalAreaM2 = h.sideM * h.draftM;
  const maxThrustN = p.count * p.thrustN;
  const maxPropElecW = p.count * p.maxElecW;
  const dragK = RHO_SEA * h.dragCd * frontalAreaM2;
  const vThrust = Math.sqrt((2 * maxThrustN) / dragK);
  const vPower = Math.cbrt((2 * maxPropElecW * p.propEff) / dragK);
  const batteryKg = (b.kwh * 1000) / b.whPerKg;
  const slots = hexSlots(cfg.swarm.count, cfg.swarm.spacingM);
  const socMinKwh = b.kwh * (1 - b.dod);
  const etaD = Math.sqrt(b.rte);
  return {
    hullTopM2,
    petalM2,
    pvAreaM2,
    spanM: h.sideM + 2 * h.petalLengthM,
    peakPvW: pvAreaM2 * cfg.panel.efficiency * 1000,
    cardsMaxW,
    overheadFactor,
    maxComputeElecW,
    tflopsPerElecW,
    firmComputeElecW: Math.min(c.firmComputeW, maxComputeElecW),
    terminals,
    starlinkWPerModule,
    essentialW,
    frontalAreaM2,
    maxThrustN,
    maxPropElecW,
    maxWaterSpeedMs: Math.min(vThrust, vPower),
    batteryKg,
    massKg:
      h.massKg + h.podMassKg + pvAreaM2 * cfg.panel.kgPerM2 + batteryKg + c.cards * c.massKg + p.count * p.massKg +
      (cfg.comms.terminalMassKg * terminals) / cfg.swarm.count + ELECTRONICS_KG,
    displacementKg: RHO_SEA * hullTopM2 * h.draftM,
    podNeedL: c.cards * c.volumeL + HOST_VOLUME_L + HX_VOLUME_L,
    petalOverlap: h.petalCount * h.petalWidthM > 2 * Math.PI * (h.sideM / 2 + h.petalLengthM / 2),
    formationRadiusM: Math.max(0, ...slots.map((s) => Math.hypot(s.x, s.y))),
    batteryUsableKwh: b.kwh * b.dod,
    socMinKwh,
    reserveKwh: Math.min(b.kwh, socMinKwh + (essentialW * NIGHT_RESERVE_H) / 1000 / etaD),
    mix: mixStats(cfg.jobs, WORKLOADS),
  };
}
```

- [ ] **Step 6: Implement `module.ts`**

```ts
import type { SimConfig } from './config';
import type { Derived } from './derive';

export interface DispatchInput {
  pvW: number;
  propulsionW: number;
  trackingActive: boolean;
  socKwh: number;
  dtH: number;
  computeCapElecW?: number;
}

export interface StepFlows {
  pvW: number;
  essentialW: number;
  computeElecW: number;
  firmElecW: number;
  spotElecW: number;
  tflops: number;
  firmTflops: number;
  spotTflops: number;
  chargeW: number;
  dischargeW: number;
  curtailedW: number;
  unmetW: number;
  socKwh: number;
  online: boolean;
}

/**
 * One timestep of power dispatch. Priority: essential loads (avionics, Starlink, actuators, propulsion),
 * then compute per policy, then battery charging, then curtailment.
 * - daylight: battery charges first, compute uses only remaining solar.
 * - firm: firm compute from solar then battery (down to the reserve), battery charges, spot compute uses surplus solar.
 * - max: compute from solar then battery (down to the reserve), battery charges with what is left.
 */
export function dispatch(cfg: SimConfig, d: Derived, inp: DispatchInput): StepFlows {
  const etaC = Math.sqrt(cfg.battery.rte);
  const etaD = etaC;
  const cap = cfg.battery.kwh;
  const dtH = inp.dtH;
  let soc = Math.min(cap, Math.max(0, inp.socKwh));
  let pv = Math.max(0, inp.pvW);
  let charge = 0;
  let discharge = 0;

  const draw = (wantW: number, floorKwh: number): number => {
    if (wantW <= 0) return 0;
    const fromPv = Math.min(pv, wantW);
    pv -= fromPv;
    const rest = wantW - fromPv;
    let fromBat = 0;
    if (rest > 0 && dtH > 0) {
      const availW = Math.max(0, ((soc - floorKwh) * etaD * 1000) / dtH);
      fromBat = Math.min(rest, availW);
      soc -= ((fromBat / etaD) * dtH) / 1000;
      discharge += fromBat;
    }
    return fromPv + fromBat;
  };

  const chargeFromPv = () => {
    if (dtH <= 0 || cap <= 0) return;
    const roomW = Math.max(0, ((cap - soc) * 1000) / (etaC * dtH));
    const c = Math.min(pv, roomW);
    pv -= c;
    soc += (c * etaC * dtH) / 1000;
    charge += c;
  };

  const essentialWant = d.essentialW + (inp.trackingActive ? cfg.loads.actuatorW : 0) + Math.max(0, inp.propulsionW);
  const served = draw(essentialWant, d.socMinKwh);
  const unmetW = Math.max(0, essentialWant - served);
  const online = unmetW < 1e-6;
  const capW = Math.max(0, Math.min(d.maxComputeElecW, inp.computeCapElecW ?? Infinity));

  let firm = 0;
  let spot = 0;
  if (online && capW > 0) {
    if (cfg.compute.policy === 'daylight') {
      chargeFromPv();
      spot = Math.min(pv, capW);
      pv -= spot;
    } else if (cfg.compute.policy === 'firm') {
      firm = draw(Math.min(d.firmComputeElecW, capW), d.reserveKwh);
      chargeFromPv();
      spot = Math.min(pv, capW - firm);
      pv -= spot;
    } else {
      spot = draw(capW, d.reserveKwh);
    }
  }
  chargeFromPv();
  const curtailedW = pv;
  const computeElecW = firm + spot;
  return {
    pvW: Math.max(0, inp.pvW),
    essentialW: served,
    computeElecW,
    firmElecW: firm,
    spotElecW: spot,
    tflops: computeElecW * d.tflopsPerElecW,
    firmTflops: firm * d.tflopsPerElecW,
    spotTflops: spot * d.tflopsPerElecW,
    chargeW: charge,
    dischargeW: discharge,
    curtailedW,
    unmetW,
    socKwh: soc,
    online,
  };
}
```

- [ ] **Step 7: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/model/derive.ts src/model/module.ts src/model/swarm.ts src/model/jobs.ts src/model/module.test.ts
git commit -m "feat: add derived module quantities and policy-based power dispatch"
```

---

### Task 7: Swarm dynamics

**Files:**
- Modify: `src/model/swarm.ts` (add everything below `hexSlots`)
- Test: `src/model/swarm.test.ts`

**Interfaces:**
- Consumes: `hexSlots`, `Vec` helpers, `normal`, `Rng`, `SimConfig`, `Derived`, `RHO_SEA`.
- Produces:
  - `interface SwarmEnv { ghi(t: number, x: number, y: number): number; current(t: number): Vec; offshoreKm(x: number, y: number): number }` (`Env` from Task 5 satisfies it)
  - `interface SwarmParams { slots: Vec[]; toleranceM; breakawayM; disturbanceMs; strategy: Strategy; cruiseMs; horizonH; replanMin; minOffshoreKm; maxOffshoreKm; maxWaterSpeedMs; maxPropElecW; cd; areaM2; propEff; pvYieldW }`
  - `interface ModuleKin { pos: Vec; stray: boolean }`
  - `interface SwarmState { centroid: Vec; centroidVel: Vec; modules: ModuleKin[]; nextReplanT: number; seekTarget: Vec | null; trail: Vec[] }`
  - `interface SwarmStepOut { waterSpeedMs: number[]; propulsionW: number[] }`
  - `propulsionPowerW(vWater: number, cd: number, areaM2: number, eta: number): number`
  - `swarmParams(cfg: SimConfig, d: Derived): SwarmParams`
  - `initSwarm(p: SwarmParams, centroid?: Vec): SwarmState`
  - `stepSwarm(s: SwarmState, p: SwarmParams, env: SwarmEnv, t: number, dtS: number, rng: Rng): SwarmStepOut` (mutates `s`)

- [ ] **Step 1: Write the failing test**

`src/model/swarm.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { initSwarm, stepSwarm, swarmParams, propulsionPowerW, SwarmEnv, SwarmParams } from './swarm';
import { derive } from './derive';
import { defaultConfig } from './defaults';
import { mulberry32 } from './rng';
import { dist, add } from './vec';

const flatEnv = (cur = { x: 0, y: 0 }, km = 50): SwarmEnv => ({ ghi: () => 500, current: () => cur, offshoreKm: () => km });

const params = (mut?: (p: SwarmParams) => void) => {
  const c = defaultConfig();
  c.env.disturbanceMs = 0;
  const p = swarmParams(c, derive(c));
  p.disturbanceMs = 0;
  mut?.(p);
  return p;
};

const run = (p: SwarmParams, env: SwarmEnv, hours: number, dtS = 60) => {
  const s = initSwarm(p);
  const rng = mulberry32(1);
  let energyWh = 0;
  for (let k = 0; k < (hours * 3600) / dtS; k++) {
    const out = stepSwarm(s, p, env, k * dtS * 1000, dtS, rng);
    energyWh += (out.propulsionW.reduce((a, b) => a + b, 0) * dtS) / 3600;
  }
  return { s, energyWh };
};

describe('swarm', () => {
  it('propulsion power scales with the cube of speed', () => {
    expect(propulsionPowerW(0.4, 1, 0.9, 0.4) / propulsionPowerW(0.2, 1, 0.9, 0.4)).toBeCloseTo(8, 9);
    expect(propulsionPowerW(0, 1, 0.9, 0.4)).toBe(0);
  });

  it('drift strategy with no disturbance uses zero propulsion and keeps formation', () => {
    const p = params((p) => { p.strategy = 'drift'; });
    const { s, energyWh } = run(p, flatEnv({ x: 0.2, y: -0.1 }), 6);
    expect(energyWh).toBe(0);
    s.modules.forEach((m, i) => expect(dist(m.pos, add(s.centroid, p.slots[i]))).toBeLessThan(1e-6));
  });

  it('station keeping against a current costs energy and holds near slots', () => {
    const p = params((p) => { p.strategy = 'station'; });
    const { s, energyWh } = run(p, flatEnv({ x: 0.2, y: 0 }), 6);
    expect(energyWh).toBeGreaterThan(0);
    expect(dist(s.centroid, { x: 0, y: 0 })).toBe(0);
    s.modules.forEach((m, i) => expect(dist(m.pos, p.slots[i])).toBeLessThan(p.toleranceM + 0.2 * 60 + 1));
    expect(s.modules.some((m) => m.stray)).toBe(false);
  });

  it('a displaced module is flagged as a stray and rejoins', () => {
    const p = params((p) => { p.strategy = 'station'; });
    const s = initSwarm(p);
    s.modules[3].pos = add(s.modules[3].pos, { x: 2 * p.breakawayM, y: 0 });
    const rng = mulberry32(2);
    stepSwarm(s, p, flatEnv(), 0, 60, rng);
    expect(s.modules[3].stray).toBe(true);
    for (let k = 1; k < 60; k++) stepSwarm(s, p, flatEnv(), k * 60000, 60, rng);
    expect(dist(s.modules[3].pos, p.slots[3])).toBeLessThanOrEqual(p.toleranceM + 1);
    expect(s.modules[3].stray).toBe(false);
  });

  it('cloud-seeking moves toward better sun when the gain beats the propulsion cost', () => {
    const p = params((p) => { p.strategy = 'seek'; });
    const env: SwarmEnv = { ghi: (_t, x) => 300 + x * 0.05, current: () => ({ x: 0, y: 0 }), offshoreKm: () => 50 };
    const { s } = run(p, env, 3);
    expect(s.centroid.x).toBeGreaterThan(1000);
  });

  it('cloud-seeking holds still when there is no gain', () => {
    const p = params((p) => { p.strategy = 'seek'; });
    const { s } = run(p, flatEnv(), 3);
    expect(dist(s.centroid, { x: 0, y: 0 })).toBe(0);
  });

  it('respects the geofence while drifting toward shore', () => {
    const p = params((p) => { p.strategy = 'drift'; p.minOffshoreKm = 20; });
    const env: SwarmEnv = { ghi: () => 500, current: () => ({ x: 0, y: -0.5 }), offshoreKm: (_x, y) => 50 + y / 1000 };
    const { s } = run(p, env, 48, 300);
    expect(env.offshoreKm(s.centroid.x, s.centroid.y)).toBeGreaterThan(19.5);
  });

  it('stays finite when overpowered by the current and flags strays', () => {
    const p = params((p) => { p.strategy = 'station'; });
    const { s } = run(p, flatEnv({ x: 1.0, y: 0 }), 6);
    for (const m of s.modules) {
      expect(Number.isFinite(m.pos.x)).toBe(true);
      expect(Number.isFinite(m.pos.y)).toBe(true);
    }
    expect(s.modules.some((m) => m.stray)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/model/swarm.test.ts`
Expected: FAIL, `initSwarm` is not exported.

- [ ] **Step 3: Implement the rest of `swarm.ts`**

Replace the top of `src/model/swarm.ts` so the file reads:

```ts
import type { Vec } from './vec';
import { add, sub, scale, len, unit } from './vec';
import { normal, Rng } from './rng';
import { RHO_SEA } from './constants';
import type { SimConfig, Strategy } from './config';
import type { Derived } from './derive';

const HEX_DIRS: [number, number][] = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

/** Slots on a hexagonal lattice, filled ring by ring from the center. */
export function hexSlots(n: number, spacingM: number): Vec[] {
  const axial: [number, number][] = [[0, 0]];
  for (let k = 1; axial.length < n; k++) {
    let q = -k, r = k;
    for (let side = 0; side < 6; side++) {
      for (let j = 0; j < k; j++) {
        axial.push([q, r]);
        q += HEX_DIRS[side][0];
        r += HEX_DIRS[side][1];
      }
    }
  }
  return axial.slice(0, n).map(([q, r]) => ({ x: spacingM * (q + r / 2), y: spacingM * ((Math.sqrt(3) / 2) * r) }));
}

export interface SwarmEnv {
  ghi(t: number, x: number, y: number): number;
  current(t: number): Vec;
  offshoreKm(x: number, y: number): number;
}

export interface SwarmParams {
  slots: Vec[];
  toleranceM: number;
  breakawayM: number;
  disturbanceMs: number;
  strategy: Strategy;
  cruiseMs: number;
  horizonH: number;
  replanMin: number;
  minOffshoreKm: number;
  maxOffshoreKm: number;
  maxWaterSpeedMs: number;
  maxPropElecW: number;
  cd: number;
  areaM2: number;
  propEff: number;
  /** PV watts per W/m2 of irradiance for one module. */
  pvYieldW: number;
}

export interface ModuleKin {
  pos: Vec;
  stray: boolean;
}

export interface SwarmState {
  centroid: Vec;
  centroidVel: Vec;
  modules: ModuleKin[];
  nextReplanT: number;
  seekTarget: Vec | null;
  trail: Vec[];
}

export interface SwarmStepOut {
  waterSpeedMs: number[];
  propulsionW: number[];
}

const TRAIL_MAX = 2000;

export function propulsionPowerW(vWater: number, cd: number, areaM2: number, eta: number): number {
  return (0.5 * RHO_SEA * cd * areaM2 * Math.abs(vWater) ** 3) / eta;
}

export function swarmParams(cfg: SimConfig, d: Derived): SwarmParams {
  const s = cfg.swarm;
  return {
    slots: hexSlots(s.count, s.spacingM),
    toleranceM: s.toleranceM,
    breakawayM: s.breakawayM,
    disturbanceMs: cfg.env.disturbanceMs,
    strategy: s.strategy,
    cruiseMs: s.cruiseMs,
    horizonH: s.horizonH,
    replanMin: s.replanMin,
    minOffshoreKm: s.minOffshoreKm,
    maxOffshoreKm: s.maxOffshoreKm,
    maxWaterSpeedMs: d.maxWaterSpeedMs,
    maxPropElecW: d.maxPropElecW,
    cd: cfg.hull.dragCd,
    areaM2: d.frontalAreaM2,
    propEff: cfg.propulsion.propEff,
    pvYieldW: d.pvAreaM2 * cfg.panel.efficiency * cfg.pv.mpptEff,
  };
}

export function initSwarm(p: SwarmParams, centroid: Vec = { x: 0, y: 0 }): SwarmState {
  return {
    centroid: { ...centroid },
    centroidVel: { x: 0, y: 0 },
    modules: p.slots.map((slot) => ({ pos: add(centroid, slot), stray: false })),
    nextReplanT: -Infinity,
    seekTarget: null,
    trail: [{ ...centroid }],
  };
}

function fenceCorrect(c: Vec, v: Vec, p: SwarmParams, env: SwarmEnv, dtS: number): Vec {
  const next = add(c, scale(v, dtS));
  const dk = env.offshoreKm(next.x, next.y);
  if (dk >= p.minOffshoreKm && dk <= p.maxOffshoreKm) return v;
  const h = 500;
  const g = unit({
    x: (env.offshoreKm(c.x + h, c.y) - env.offshoreKm(c.x - h, c.y)) / (2 * h),
    y: (env.offshoreKm(c.x, c.y + h) - env.offshoreKm(c.x, c.y - h)) / (2 * h),
  });
  const sp = Math.max(p.cruiseMs, 0.05);
  return dk < p.minOffshoreKm ? scale(g, sp) : scale(g, -sp);
}

function replanSeek(s: SwarmState, p: SwarmParams, env: SwarmEnv, t: number): void {
  const H = p.horizonH * 3600;
  const K = 6;
  const score = (q: Vec) => {
    let sum = 0;
    for (let k = 1; k <= K; k++) sum += env.ghi(t + (k * H * 1000) / K, q.x, q.y);
    return (sum * (H / K)) / 3600;
  };
  const base = score(s.centroid);
  let best: Vec | null = null;
  let bestScore = base;
  const reach = p.cruiseMs * H;
  for (let a = 0; a < 8; a++) {
    const q = add(s.centroid, { x: reach * Math.cos((a * Math.PI) / 4), y: reach * Math.sin((a * Math.PI) / 4) });
    const dk = env.offshoreKm(q.x, q.y);
    if (dk < p.minOffshoreKm || dk > p.maxOffshoreKm) continue;
    const sc = score(q);
    if (sc > bestScore) {
      best = q;
      bestScore = sc;
    }
  }
  const n = p.slots.length;
  // Benefit accrues gradually during the transit, so count half of the endpoint gain.
  const gainWh = (bestScore - base) * p.pvYieldW * n * 0.5;
  const costWh = n * propulsionPowerW(p.cruiseMs, p.cd, p.areaM2, p.propEff) * p.horizonH;
  s.seekTarget = best && gainWh > costWh ? best : null;
}

export function stepSwarm(s: SwarmState, p: SwarmParams, env: SwarmEnv, t: number, dtS: number, rng: Rng): SwarmStepOut {
  const cur = env.current(t);
  if (p.strategy === 'seek' && t >= s.nextReplanT) {
    s.nextReplanT = t + p.replanMin * 60000;
    replanSeek(s, p, env, t);
  }
  let vel: Vec = { x: 0, y: 0 };
  if (p.strategy === 'drift') vel = cur;
  else if (p.strategy === 'seek' && s.seekTarget) {
    const to = sub(s.seekTarget, s.centroid);
    const d = len(to);
    vel = d < 1 ? { x: 0, y: 0 } : scale(unit(to), Math.min(p.cruiseMs, d / dtS));
    if (d < 1) s.seekTarget = null;
  }
  vel = fenceCorrect(s.centroid, vel, p, env, dtS);
  s.centroidVel = vel;
  s.centroid = add(s.centroid, scale(vel, dtS));
  s.trail.push({ ...s.centroid });
  if (s.trail.length > TRAIL_MAX) s.trail.splice(0, s.trail.length - TRAIL_MAX);

  const waterSpeedMs: number[] = [];
  const propulsionW: number[] = [];
  const jitter = p.disturbanceMs * Math.sqrt(dtS * 60);
  s.modules.forEach((m, i) => {
    const target = add(s.centroid, p.slots[i]);
    const e = sub(target, m.pos);
    const d = len(e);
    if (d > p.breakawayM) m.stray = true;
    else if (d <= p.toleranceM) m.stray = false;
    let vw: Vec = { x: 0, y: 0 };
    if (d > p.toleranceM || m.stray) {
      const aim = Math.max(0, d - p.toleranceM * 0.5);
      const desired = add(vel, scale(unit(e), Math.min(p.maxWaterSpeedMs, aim / dtS)));
      vw = sub(desired, cur);
      const sp = len(vw);
      if (sp > p.maxWaterSpeedMs) vw = scale(vw, p.maxWaterSpeedMs / sp);
    }
    const ground = add(cur, vw);
    m.pos = add(m.pos, scale(ground, dtS));
    if (jitter > 0) m.pos = add(m.pos, { x: normal(rng) * jitter, y: normal(rng) * jitter });
    const speed = len(vw);
    waterSpeedMs.push(speed);
    propulsionW.push(p.maxWaterSpeedMs > 0 ? Math.min(p.maxPropElecW, propulsionPowerW(speed, p.cd, p.areaM2, p.propEff)) : 0);
  });
  return { waterSpeedMs, propulsionW };
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS. If the stray test fails because the module undershoots, check that `aim / dtS` is in meters per second and the speed cap uses `maxWaterSpeedMs`.

- [ ] **Step 5: Commit**

```bash
git add src/model/swarm.ts src/model/swarm.test.ts
git commit -m "feat: add swarm formation, station keeping, rejoin, cloud seeking and geofence"
```

---

### Task 8: Compute jobs (aggregate and discrete)

**Files:**
- Modify: `src/model/jobs.ts` (append below `mixStats`)
- Test: `src/model/jobs.test.ts`

**Interfaces:**
- Consumes: `poisson`, `pickIndex`, `Rng`, `Workload`.
- Produces:
  - `type Binding = 'power' | 'bandwidth' | 'demand'`
  - `aggregateStep(powerTflops: number, downMbps: number, upMbps: number, demandTflops: number, inMBPerTflop: number, outMBPerTflop: number): { tflops: number; binding: Binding; downMBps: number; upMBps: number }`
  - `interface Job { id; kind: number; tflop; inMB; outMB; phase: 'down' | 'compute' | 'up'; module: number; left; done; ckpt; ckptT; arrivedT }`
  - `interface JobState { t: number; nextId: number; queue: Job[]; active: Job[]; completed: number; rejected: number; workTflop: number; rolledBackTflop: number; turnaroundSumS: number; recentDone: { module: number; t: number; kind: number }[] }`
  - `interface ModuleCapacity { tflops: number; downMbps: number; upMbps: number }`
  - `initJobs(t0: number): JobState`
  - `stepJobs(s: JobState, caps: ModuleCapacity[], arrivalsPerHour: number, weights: number[], workloads: Workload[], checkpointMin: number, maxPerModule: number, dtS: number, rng: Rng): number[]` (mutates `s`, returns TFLOP of compute used per module this step)
  - `MAX_QUEUE = 2000`

- [ ] **Step 1: Write the failing test**

`src/model/jobs.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { aggregateStep, initJobs, stepJobs, mixStats } from './jobs';
import { mulberry32 } from './rng';
import { WORKLOADS } from '../presets';

const mix = (i: number, t: number, d: number) =>
  mixStats({ arrivalsPerHour: 0, mixInference: i, mixTraining: t, mixDataHeavy: d, checkpointMin: 15 }, WORKLOADS);

describe('aggregateStep', () => {
  it('identifies the binding constraint', () => {
    const m = mix(1, 0, 0);
    expect(aggregateStep(500, 100, 15, 4000, m.inMBPerTflop, m.outMBPerTflop).binding).toBe('power');
    expect(aggregateStep(500, 100, 15, 100, m.inMBPerTflop, m.outMBPerTflop).binding).toBe('demand');
    const h = mix(0, 0, 1);
    const r = aggregateStep(500, 100, 100, 4000, h.inMBPerTflop, h.outMBPerTflop);
    expect(r.binding).toBe('bandwidth');
    expect(r.tflops).toBeCloseTo(12.5 / (2000 / 50000), 6);
    expect(r.downMBps).toBeCloseTo(12.5, 6);
  });
  it('reports power as binding when nothing can run', () => {
    expect(aggregateStep(0, 100, 15, 4000, 0.001, 0.001)).toEqual({ tflops: 0, binding: 'power', downMBps: 0, upMBps: 0 });
  });
});

describe('discrete jobs', () => {
  const runDay = (weights: number[], caps: { tflops: number; downMbps: number; upMbps: number }) => {
    const s = initJobs(0);
    const rng = mulberry32(4);
    for (let k = 0; k < 288; k++) stepJobs(s, [caps], 1000, weights, WORKLOADS, 15, 64, 300, rng);
    return s;
  };

  it('agrees with the aggregate model when power binds', () => {
    const s = runDay([1, 0, 0], { tflops: 500, downMbps: 100, upMbps: 15 });
    const m = mix(1, 0, 0);
    const agg = aggregateStep(500, 100, 15, (1000 / 3600) * m.meanTflop, m.inMBPerTflop, m.outMBPerTflop).tflops * 86400;
    expect(Math.abs(s.workTflop - agg) / agg).toBeLessThan(0.05);
    expect(s.completed).toBeGreaterThan(2500);
  });

  it('agrees with the aggregate model when bandwidth binds', () => {
    const s = runDay([0, 0, 1], { tflops: 500, downMbps: 100, upMbps: 15 });
    const m = mix(0, 0, 1);
    const agg = aggregateStep(500, 100, 15, (1000 / 3600) * m.meanTflop, m.inMBPerTflop, m.outMBPerTflop).tflops * 86400;
    expect(Math.abs(s.workTflop - agg) / agg).toBeLessThan(0.05);
  });

  it('rolls jobs back to the last checkpoint when power is lost', () => {
    const s = initJobs(0);
    const rng = mulberry32(5);
    // A 240-minute checkpoint interval guarantees no checkpoint lands inside this hour.
    for (let k = 0; k < 12; k++) stepJobs(s, [{ tflops: 100, downMbps: 100, upMbps: 15 }], 20, [0, 1, 0], WORKLOADS, 240, 8, 300, rng);
    const before = s.workTflop;
    expect(before).toBeGreaterThan(0);
    stepJobs(s, [{ tflops: 0, downMbps: 0, upMbps: 0 }], 0, [0, 1, 0], WORKLOADS, 240, 8, 300, rng);
    expect(s.rolledBackTflop).toBeGreaterThan(0);
    expect(s.workTflop).toBeLessThan(before);
    expect(s.workTflop).toBeGreaterThanOrEqual(0);
  });

  it('caps the queue and counts rejections', () => {
    const s = initJobs(0);
    const rng = mulberry32(6);
    for (let k = 0; k < 10; k++) stepJobs(s, [{ tflops: 0, downMbps: 0, upMbps: 0 }], 100000, [1, 0, 0], WORKLOADS, 15, 8, 300, rng);
    expect(s.queue.length).toBeLessThanOrEqual(2000);
    expect(s.rejected).toBeGreaterThan(0);
  });

  it('returns per-module compute used within the budget', () => {
    const s = initJobs(0);
    const rng = mulberry32(7);
    const used = stepJobs(s, [{ tflops: 100, downMbps: 100, upMbps: 15 }, { tflops: 0, downMbps: 0, upMbps: 0 }], 5000, [1, 0, 0], WORKLOADS, 15, 64, 300, rng);
    expect(used[0]).toBeLessThanOrEqual(100 * 300 + 1e-6);
    expect(used[1]).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/model/jobs.test.ts`
Expected: FAIL, `aggregateStep` is not exported.

- [ ] **Step 3: Append the job model to `jobs.ts`**

Add these imports at the top of `src/model/jobs.ts`:
```ts
import { poisson, pickIndex, Rng } from './rng';
```

Append:
```ts
export type Binding = 'power' | 'bandwidth' | 'demand';

/** Delivered compute is the minimum of power-limited, bandwidth-limited and demand-limited rates. */
export function aggregateStep(
  powerTflops: number,
  downMbps: number,
  upMbps: number,
  demandTflops: number,
  inMBPerTflop: number,
  outMBPerTflop: number,
): { tflops: number; binding: Binding; downMBps: number; upMBps: number } {
  if (powerTflops <= 0) return { tflops: 0, binding: 'power', downMBps: 0, upMBps: 0 };
  const downLimit = inMBPerTflop > 0 ? downMbps / 8 / inMBPerTflop : Infinity;
  const upLimit = outMBPerTflop > 0 ? upMbps / 8 / outMBPerTflop : Infinity;
  const bandwidthTflops = Math.min(downLimit, upLimit);
  let tflops = powerTflops;
  let binding: Binding = 'power';
  if (bandwidthTflops < tflops) {
    tflops = bandwidthTflops;
    binding = 'bandwidth';
  }
  if (demandTflops < tflops) {
    tflops = demandTflops;
    binding = 'demand';
  }
  tflops = Math.max(0, tflops);
  return { tflops, binding, downMBps: tflops * inMBPerTflop, upMBps: tflops * outMBPerTflop };
}

export interface Job {
  id: number;
  kind: number;
  tflop: number;
  inMB: number;
  outMB: number;
  phase: 'down' | 'compute' | 'up';
  module: number;
  left: number;
  done: number;
  ckpt: number;
  ckptT: number;
  arrivedT: number;
}

export interface JobState {
  t: number;
  nextId: number;
  queue: Job[];
  active: Job[];
  completed: number;
  rejected: number;
  workTflop: number;
  rolledBackTflop: number;
  turnaroundSumS: number;
  recentDone: { module: number; t: number; kind: number }[];
}

export interface ModuleCapacity {
  tflops: number;
  downMbps: number;
  upMbps: number;
}

export const MAX_QUEUE = 2000;
const EPS = 1e-9;

export function initJobs(t0: number): JobState {
  return { t: t0, nextId: 1, queue: [], active: [], completed: 0, rejected: 0, workTflop: 0, rolledBackTflop: 0, turnaroundSumS: 0, recentDone: [] };
}

/**
 * Advances jobs by one step using per-module budgets: download MB, compute TFLOP and upload MB.
 * Jobs are served first-in first-out within each module, so throughput matches the aggregate model.
 */
export function stepJobs(
  s: JobState,
  caps: ModuleCapacity[],
  arrivalsPerHour: number,
  weights: number[],
  workloads: Workload[],
  checkpointMin: number,
  maxPerModule: number,
  dtS: number,
  rng: Rng,
): number[] {
  const arrivals = poisson(rng, (arrivalsPerHour * dtS) / 3600);
  for (let k = 0; k < arrivals; k++) {
    if (s.queue.length >= MAX_QUEUE) {
      s.rejected++;
      continue;
    }
    const kind = pickIndex(rng, weights);
    const w = workloads[kind];
    s.queue.push({
      id: s.nextId++, kind, tflop: w.tflopPerJob.value, inMB: w.inMB.value, outMB: w.outMB.value,
      phase: 'down', module: -1, left: w.inMB.value, done: 0, ckpt: 0, ckptT: s.t, arrivedT: s.t,
    });
  }

  const counts = caps.map(() => 0);
  for (const j of s.active) counts[j.module]++;
  while (s.queue.length) {
    let best = -1;
    for (let m = 0; m < caps.length; m++) {
      if (caps[m].tflops > 0 && counts[m] < maxPerModule && (best < 0 || counts[m] < counts[best])) best = m;
    }
    if (best < 0) break;
    const j = s.queue.shift()!;
    j.module = best;
    counts[best]++;
    s.active.push(j);
  }

  const budC = caps.map((c) => c.tflops * dtS);
  const budD = caps.map((c) => (c.downMbps / 8) * dtS);
  const budU = caps.map((c) => (c.upMbps / 8) * dtS);
  const used = caps.map(() => 0);
  const tEnd = s.t + dtS * 1000;
  const still: Job[] = [];

  for (const j of s.active) {
    const m = j.module;
    if (j.phase === 'down') {
      const u = Math.min(j.left, budD[m]);
      j.left -= u;
      budD[m] -= u;
      if (j.left <= EPS) {
        j.phase = 'compute';
        j.ckptT = s.t;
      }
    }
    if (j.phase === 'compute') {
      if (caps[m].tflops <= 0) {
        if (j.done > j.ckpt) {
          s.rolledBackTflop += j.done - j.ckpt;
          s.workTflop -= j.done - j.ckpt;
          j.done = j.ckpt;
        }
      } else {
        const u = Math.min(j.tflop - j.done, budC[m]);
        j.done += u;
        budC[m] -= u;
        used[m] += u;
        s.workTflop += u;
        if (tEnd - j.ckptT >= checkpointMin * 60000) {
          j.ckpt = j.done;
          j.ckptT = tEnd;
        }
        if (j.done >= j.tflop - EPS) {
          j.phase = 'up';
          j.left = j.outMB;
        }
      }
    }
    if (j.phase === 'up') {
      const u = Math.min(j.left, budU[m]);
      j.left -= u;
      budU[m] -= u;
      if (j.left <= EPS) {
        s.completed++;
        s.turnaroundSumS += (tEnd - j.arrivedT) / 1000;
        s.recentDone.push({ module: m, t: tEnd, kind: j.kind });
        continue;
      }
    }
    still.push(j);
  }
  s.active = still;
  if (s.recentDone.length > 200) s.recentDone.splice(0, s.recentDone.length - 200);
  s.t = tEnd;
  return used;
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/model/jobs.ts src/model/jobs.test.ts
git commit -m "feat: add aggregate and discrete job models with binding-constraint detection"
```

---

### Task 9: Annual runner

**Files:**
- Create: `src/model/annual.ts`
- Test: `src/model/annual.test.ts`

**Interfaces:**
- Consumes: `derive`, `dispatch`, `StepFlows`, `createEnvironment`, `dayTypeProbs`, `DayType`, `Env`, `swarmParams`, `initSwarm`, `stepSwarm`, `SwarmState`, `poaIrradiance`, `pvPowerW`, `aggregateStep`, `Binding`, time helpers, `mulberry32`, `hashSeed`, `payOverage`.
- Produces:
  - `interface Totals { pvKwh; essentialKwh; propulsionKwh; computeKwh; curtailedKwh; unmetKwh; chargeKwh; dischargeKwh; tflop; firmTflop; spotTflop; firmCommittedTflop; downGB; upGB; stowedH; hours; bindingH: Record<Binding, number> }` (swarm totals; `essentialKwh` includes served propulsion; `propulsionKwh` is requested propulsion)
  - `interface DaySummary extends Totals { doy: number; weight: number; ghiKwhM2: number; offshoreKm: number }`
  - `interface AnnualResult { mode: 'full' | 'representative'; days: DaySummary[]; totals: Totals; gbPerTerminalMonthly: number[]; batteryCyclesPerModule: number; availability: number | null; modules: number; terminals: number }`
  - `emptyTotals(): Totals`
  - `runAnnual(cfg: SimConfig, mode: 'full' | 'representative', opts?: { sampleModules?: number }): AnnualResult`

- [ ] **Step 1: Write the failing test**

`src/model/annual.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { runAnnual, Totals } from './annual';
import { defaultConfig, applyPreset } from './defaults';

const finite = (t: Totals) =>
  Object.entries(t).every(([, v]) => (typeof v === 'number' ? Number.isFinite(v) : Object.values(v).every(Number.isFinite)));

describe('annual', () => {
  const full = runAnnual(defaultConfig(), 'full');

  it('reports full-year runtime', () => {
    const t0 = performance.now();
    runAnnual(defaultConfig(), 'full');
    const ms = performance.now() - t0;
    console.log(`runAnnual full: ${ms.toFixed(0)} ms`);
    expect(ms).toBeLessThan(30000);
  });

  it('covers a full year with finite totals', () => {
    expect(full.days).toHaveLength(365);
    expect(Math.abs(full.totals.hours - 8760)).toBeLessThan(1);
    expect(finite(full.totals)).toBe(true);
    expect(full.totals.tflop).toBeGreaterThan(0);
  });

  it('conserves energy over the year', () => {
    const t = full.totals;
    const lhs = t.pvKwh + t.dischargeKwh;
    const rhs = t.essentialKwh + t.computeKwh + t.chargeKwh + t.curtailedKwh;
    expect(Math.abs(lhs - rhs) / lhs).toBeLessThan(1e-6);
  });

  it('splits compute into firm and spot and reports availability', () => {
    const t = full.totals;
    expect(Math.abs(t.firmTflop + t.spotTflop - t.tflop) / t.tflop).toBeLessThan(1e-9);
    expect(full.availability).not.toBeNull();
    expect(full.availability!).toBeGreaterThan(0);
    expect(full.availability!).toBeLessThanOrEqual(1 + 1e-9);
  });

  it('binding hours sum to total hours', () => {
    const b = full.totals.bindingH;
    expect(Math.abs(b.power + b.bandwidth + b.demand - full.totals.hours)).toBeLessThan(1e-6);
  });

  it('representative days with 4 sampled modules agree with the full run', () => {
    const rep = runAnnual(defaultConfig(), 'representative', { sampleModules: 4 });
    expect(Math.abs(rep.totals.pvKwh - full.totals.pvKwh) / full.totals.pvKwh).toBeLessThan(0.05);
    expect(Math.abs(rep.totals.tflop - full.totals.tflop) / full.totals.tflop).toBeLessThan(0.07);
    expect(Math.abs(rep.totals.hours - 8760)).toBeLessThan(1);
  });

  it('throttles after a small data cap and loses compute to bandwidth', () => {
    const c = applyPreset(defaultConfig(), 'plan', 'gp-50');
    const r = runAnnual(c, 'representative', { sampleModules: 4 });
    expect(r.totals.bindingH.bandwidth).toBeGreaterThan(0);
    const open = runAnnual(applyPreset(defaultConfig(), 'plan', 'gp-2tb'), 'representative', { sampleModules: 4 });
    expect(r.totals.tflop).toBeLessThan(open.totals.tflop);
  });

  it('degenerate config: no cards, no battery, no thrusters, no petals', () => {
    const c = defaultConfig();
    c.compute.cards = 0;
    c.battery.kwh = 0;
    c.propulsion.count = 0;
    c.hull.petalCount = 0;
    const r = runAnnual(c, 'representative', { sampleModules: 2 });
    expect(finite(r.totals)).toBe(true);
    expect(r.totals.tflop).toBe(0);
    expect(r.batteryCyclesPerModule).toBe(0);
  });

  it('single module runs', () => {
    const c = defaultConfig();
    c.swarm.count = 1;
    const r = runAnnual(c, 'representative');
    expect(finite(r.totals)).toBe(true);
    expect(r.terminals).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/model/annual.test.ts`
Expected: FAIL, cannot resolve `./annual`.

- [ ] **Step 3: Implement `annual.ts`**

```ts
import type { SimConfig } from './config';
import { payOverage } from './defaults';
import { derive, Derived } from './derive';
import { dispatch, StepFlows } from './module';
import { createEnvironment, dayTypeProbs, DayType, Env } from './environment';
import { swarmParams, initSwarm, stepSwarm, SwarmParams, SwarmState } from './swarm';
import { poaIrradiance, pvPowerW } from './solar';
import { aggregateStep, Binding } from './jobs';
import { dayStartMs, monthOfDoy, midMonthDoy, DAYS_IN_MONTH } from './time';
import { mulberry32, hashSeed } from './rng';

export interface Totals {
  pvKwh: number;
  essentialKwh: number;
  propulsionKwh: number;
  computeKwh: number;
  curtailedKwh: number;
  unmetKwh: number;
  chargeKwh: number;
  dischargeKwh: number;
  tflop: number;
  firmTflop: number;
  spotTflop: number;
  firmCommittedTflop: number;
  downGB: number;
  upGB: number;
  stowedH: number;
  hours: number;
  bindingH: Record<Binding, number>;
}

export interface DaySummary extends Totals {
  doy: number;
  weight: number;
  ghiKwhM2: number;
  offshoreKm: number;
}

export interface AnnualResult {
  mode: 'full' | 'representative';
  days: DaySummary[];
  totals: Totals;
  gbPerTerminalMonthly: number[];
  batteryCyclesPerModule: number;
  availability: number | null;
  modules: number;
  terminals: number;
}

export function emptyTotals(): Totals {
  return {
    pvKwh: 0, essentialKwh: 0, propulsionKwh: 0, computeKwh: 0, curtailedKwh: 0, unmetKwh: 0, chargeKwh: 0, dischargeKwh: 0,
    tflop: 0, firmTflop: 0, spotTflop: 0, firmCommittedTflop: 0, downGB: 0, upGB: 0, stowedH: 0, hours: 0,
    bindingH: { power: 0, bandwidth: 0, demand: 0 },
  };
}

function addInto(a: Totals, b: Totals, w: number): void {
  for (const k of Object.keys(a) as (keyof Totals)[]) {
    if (k === 'bindingH') continue;
    (a[k] as number) += (b[k] as number) * w;
  }
  a.bindingH.power += b.bindingH.power * w;
  a.bindingH.bandwidth += b.bindingH.bandwidth * w;
  a.bindingH.demand += b.bindingH.demand * w;
}

interface Ctx {
  cfg: SimConfig;
  d: Derived;
  params: SwarmParams;
  dtS: number;
  idx: number[];
  scale: number;
  demandTflops: number;
}

function simulateDay(
  ctx: Ctx,
  env: Env,
  doy: number,
  sw: SwarmState,
  soc: number[],
  isThrottled: () => boolean,
  addGB: (perTerminalGB: number) => void,
): DaySummary {
  const { cfg, d, params, dtS, idx, scale } = ctx;
  const dtH = dtS / 3600;
  const day: DaySummary = { ...emptyTotals(), doy, weight: 1, ghiKwhM2: 0, offshoreKm: 0 };
  const t0 = dayStartMs(doy);
  const rng = mulberry32(hashSeed(cfg.seed, doy, 99));
  const steps = Math.round(86400 / dtS);
  const firmTflopsPerModule = cfg.compute.policy === 'firm' ? d.firmComputeElecW * d.tflopsPerElecW : 0;

  for (let k = 0; k < steps; k++) {
    const t = t0 + k * dtS * 1000;
    const out = stepSwarm(sw, params, env, t, dtS, rng);
    const stowed = env.stowed(t);
    const sun = env.sun(t);
    const tracking = !stowed && cfg.hull.tracking !== 'flat' && sun.elevationDeg > 0;
    const area = stowed ? d.hullTopM2 : d.pvAreaM2;
    const pvs: number[] = [];
    const pass1: StepFlows[] = [];
    let potential = 0;
    let online = 0;
    for (const i of idx) {
      const pos = sw.modules[i].pos;
      const poa = poaIrradiance(env.ghi(t, pos.x, pos.y), sun, cfg.hull.tracking, cfg.hull.fixedTiltDeg, cfg.hull.maxTiltDeg, doy);
      const pvW = pvPowerW(poa, area, cfg);
      pvs.push(pvW);
      const f = dispatch(cfg, d, { pvW, propulsionW: out.propulsionW[i], trackingActive: tracking, socKwh: soc[i], dtH });
      pass1.push(f);
      potential += f.tflops * scale;
      if (f.online) online += scale;
    }
    const throttled = isThrottled();
    const termOnline = d.terminals * Math.min(1, online / cfg.swarm.count);
    const down = termOnline * (throttled ? cfg.comms.throttleDownMbps : cfg.comms.downMbps);
    const up = termOnline * (throttled ? cfg.comms.throttleUpMbps : cfg.comms.upMbps);
    const agg = aggregateStep(potential, down, up, ctx.demandTflops, d.mix.inMBPerTflop, d.mix.outMBPerTflop);
    const frac = potential > 0 ? agg.tflops / potential : 0;

    idx.forEach((i, j) => {
      let f = pass1[j];
      if (frac < 1 - 1e-9) {
        f = dispatch(cfg, d, {
          pvW: pvs[j], propulsionW: out.propulsionW[i], trackingActive: tracking, socKwh: soc[i], dtH, computeCapElecW: f.computeElecW * frac,
        });
      }
      soc[i] = f.socKwh;
      const e = (w: number) => (w * dtH * scale) / 1000;
      day.pvKwh += e(f.pvW);
      day.essentialKwh += e(f.essentialW);
      day.propulsionKwh += e(out.propulsionW[i]);
      day.computeKwh += e(f.computeElecW);
      day.curtailedKwh += e(f.curtailedW);
      day.unmetKwh += e(f.unmetW);
      day.chargeKwh += e(f.chargeW);
      day.dischargeKwh += e(f.dischargeW);
      day.tflop += f.tflops * dtS * scale;
      day.firmTflop += f.firmTflops * dtS * scale;
      day.spotTflop += f.spotTflops * dtS * scale;
      day.firmCommittedTflop += firmTflopsPerModule * dtS * scale;
    });
    const downGB = (agg.downMBps * dtS) / 1000;
    const upGB = (agg.upMBps * dtS) / 1000;
    day.downGB += downGB;
    day.upGB += upGB;
    addGB((downGB + upGB) / d.terminals);
    day.bindingH[agg.binding] += dtH;
    day.stowedH += stowed ? dtH : 0;
    day.hours += dtH;
    day.ghiKwhM2 += (env.ghi(t, sw.centroid.x, sw.centroid.y) * dtH) / 1000;
  }
  day.offshoreKm = env.offshoreKm(sw.centroid.x, sw.centroid.y);
  return day;
}

export function runAnnual(cfg: SimConfig, mode: 'full' | 'representative', opts: { sampleModules?: number } = {}): AnnualResult {
  const d = derive(cfg);
  const params = swarmParams(cfg, d);
  const n = cfg.swarm.count;
  const sample = Math.max(1, Math.min(n, opts.sampleModules ?? n));
  const idx = Array.from({ length: sample }, (_, k) => Math.floor((k * n) / sample));
  const ctx: Ctx = { cfg, d, params, dtS: 900, idx, scale: n / sample, demandTflops: (cfg.jobs.arrivalsPerHour / 3600) * d.mix.meanTflop };
  const capGB = cfg.comms.planCapGB;
  const paying = payOverage(cfg);
  const days: DaySummary[] = [];
  const gbMonthly = new Array(12).fill(0);
  const startSoc = () => new Array(n).fill(cfg.battery.kwh * 0.5);

  if (mode === 'full') {
    const env = createEnvironment(cfg);
    const sw = initSwarm(params);
    const soc = startSoc();
    for (let doy = 1; doy <= 365; doy++) {
      const m = monthOfDoy(doy);
      days.push(simulateDay(ctx, env, doy, sw, soc, () => !paying && gbMonthly[m] >= capGB, (gb) => { gbMonthly[m] += gb; }));
    }
  } else {
    const types: DayType[] = ['clear', 'partial', 'cloudy'];
    for (let m = 0; m < 12; m++) {
      const doy = midMonthDoy(m);
      const probs = dayTypeProbs(m);
      const runSet = (throttled: boolean) =>
        types.map((type) => {
          const env = createEnvironment(cfg, { forcedDayType: type });
          const sw = initSwarm(params);
          const soc = startSoc();
          simulateDay(ctx, env, doy, sw, soc, () => throttled, () => {});
          let gb = 0;
          const day = simulateDay(ctx, env, doy, sw, soc, () => throttled, (g) => { gb += g; });
          return { type, day, gb };
        });
      const open = runSet(false);
      const monthGB = open.reduce((a, r) => a + r.gb * probs[r.type] * DAYS_IN_MONTH[m], 0);
      const f = !paying && monthGB > capGB ? 1 - capGB / monthGB : 0;
      const thr = f > 0 ? runSet(true) : [];
      for (const r of open) {
        r.day.weight = DAYS_IN_MONTH[m] * probs[r.type] * (1 - f);
        gbMonthly[m] += r.gb * r.day.weight;
        days.push(r.day);
      }
      for (const r of thr) {
        r.day.weight = DAYS_IN_MONTH[m] * probs[r.type] * f;
        gbMonthly[m] += r.gb * r.day.weight;
        days.push(r.day);
      }
    }
  }

  const totals = emptyTotals();
  for (const day of days) addInto(totals, day, day.weight);
  const usable = cfg.battery.kwh * cfg.battery.dod;
  return {
    mode,
    days,
    totals,
    gbPerTerminalMonthly: gbMonthly,
    batteryCyclesPerModule: usable > 0 ? totals.dischargeKwh / n / usable : 0,
    availability: cfg.compute.policy === 'firm' && totals.firmCommittedTflop > 0 ? totals.firmTflop / totals.firmCommittedTflop : null,
    modules: n,
    terminals: d.terminals,
  };
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS. Note the printed `runAnnual full` time and apply the Performance budget rule (over about 2 s means the annual worker posts a representative result first). If the representative check misses its tolerance, first confirm the warm-up day runs before the measured day. Do not widen any tolerance in this plan to make a test pass; investigate the model, and if a tolerance truly must change, record why in the spec.

- [ ] **Step 5: Commit**

```bash
git add src/model/annual.ts src/model/annual.test.ts
git commit -m "feat: add 365-day and representative-day annual runners with data-cap throttling"
```

---

### Task 10: Compute-as-a-service economics

**Files:**
- Create: `src/model/economics.ts`
- Test: `src/model/economics.test.ts`

**Interfaces:**
- Consumes: `SimConfig`, `derive`, `AnnualResult`, `payOverage`.
- Produces:
  - `interface CostLine { key: string; label: string; usd: number; estimate: boolean }`
  - `moduleCapex(cfg: SimConfig): { lines: CostLine[]; total: number }`
  - `swarmCapex(cfg: SimConfig): { perModule: number; fleetModules: number; deployment: number; total: number }`
  - `crf(r: number, n: number): number`, `npv(r: number, flows: number[]): number`, `irr(flows: number[]): number | null`, `paybackMonths(flows: number[]): number | null`
  - `interface Econ { moduleCapex; capex; gpuHours; firmGpuHours; spotGpuHours; committedFirmGpuHours; availability: number | null; revenue: { firm; spot; slaPenalty; total }; opexLines: CostLine[]; opexTotal; grossMargin; costPerGpuHour; marginPerGpuHour; lcocPerPflopHour; marketFirm; marketSpot; flows: number[]; npv; irr: number | null; paybackMonths: number | null; annualPflopHours }`
  - `economics(cfg: SimConfig, annual: AnnualResult): Econ`

- [ ] **Step 1: Write the failing test**

`src/model/economics.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { moduleCapex, swarmCapex, crf, npv, irr, paybackMonths, economics } from './economics';
import { emptyTotals, AnnualResult } from './annual';
import { defaultConfig } from './defaults';
import { derive } from './derive';

const fakeAnnual = (over: Partial<ReturnType<typeof emptyTotals>>, availability: number | null): AnnualResult => ({
  mode: 'full', days: [], totals: { ...emptyTotals(), hours: 8760, ...over }, gbPerTerminalMonthly: new Array(12).fill(100),
  batteryCyclesPerModule: 300, availability, modules: 20, terminals: 20,
});

describe('finance helpers', () => {
  it('npv, irr, crf and payback', () => {
    expect(npv(0.1, [-100, 50, 60])).toBeCloseTo(-100 + 50 / 1.1 + 60 / 1.21, 9);
    expect(irr([-100, 110])!).toBeCloseTo(0.1, 6);
    expect(irr([-100, -10])).toBeNull();
    expect(crf(0.1, 10)).toBeCloseTo((0.1 * 1.1 ** 10) / (1.1 ** 10 - 1), 12);
    expect(crf(0, 4)).toBe(0.25);
    expect(paybackMonths([-100, 40, 40, 40])).toBeCloseTo(30, 9);
    expect(paybackMonths([-100, 10, 10])).toBeNull();
  });
});

describe('capex', () => {
  it('module capex lines sum with integration and contingency', () => {
    const c = defaultConfig();
    const d = derive(c);
    const m = moduleCapex(c);
    const panels = m.lines.find((l) => l.key === 'panels')!;
    expect(panels.usd).toBeCloseTo(d.peakPvW * c.panel.usdPerW, 6);
    const accel = m.lines.find((l) => l.key === 'accelerators')!;
    expect(accel.usd).toBe(8 * 3995);
    const sum = m.lines.reduce((a, l) => a + l.usd, 0);
    expect(m.total).toBeCloseTo(sum, 6);
    const sub = m.lines.filter((l) => l.key !== 'integration' && l.key !== 'contingency').reduce((a, l) => a + l.usd, 0);
    expect(m.lines.find((l) => l.key === 'integration')!.usd).toBeCloseTo(sub * c.econ.integrationPct, 6);
  });
  it('swarm capex adds spares and deployment', () => {
    const c = defaultConfig();
    const s = swarmCapex(c);
    expect(s.fleetModules).toBeCloseTo(22, 9);
    expect(s.total).toBeCloseTo(s.perModule * 22 + 3 * 15000, 6);
  });
});

describe('economics', () => {
  it('prices spot-only output at the spot price', () => {
    const c = defaultConfig();
    c.compute.policy = 'max';
    const gpuH = 1000;
    const tflop = 121 * 3600 * gpuH;
    const e = economics(c, fakeAnnual({ tflop, spotTflop: tflop }, null));
    expect(e.gpuHours).toBeCloseTo(gpuH, 9);
    expect(e.revenue.total).toBeCloseTo(gpuH * c.econ.spotUsdPerGpuH, 9);
    expect(e.revenue.slaPenalty).toBe(0);
  });
  it('applies the SLA penalty when firm availability misses the target', () => {
    const c = defaultConfig();
    const unit = 121 * 3600;
    const e = economics(c, fakeAnnual({ tflop: 1000 * unit, firmTflop: 600 * unit, spotTflop: 400 * unit, firmCommittedTflop: 700 * unit }, 600 / 700));
    const penalty = (0.99 - 600 / 700) * 700 * c.econ.firmUsdPerGpuH * c.econ.slaPenaltyMultiple;
    expect(e.revenue.slaPenalty).toBeCloseTo(penalty, 6);
    expect(e.revenue.total).toBeCloseTo(600 * c.econ.firmUsdPerGpuH + 400 * c.econ.spotUsdPerGpuH - penalty, 6);
  });
  it('builds opex lines and cash flows', () => {
    const c = defaultConfig();
    const unit = 121 * 3600;
    const e = economics(c, fakeAnnual({ tflop: 100000 * unit, spotTflop: 100000 * unit }, null));
    const plans = e.opexLines.find((l) => l.key === 'starlinkPlans')!;
    expect(plans.usd).toBe(20 * 1150 * 12);
    expect(e.opexLines.find((l) => l.key === 'dataOverage')!.usd).toBe(0);
    expect(e.flows).toHaveLength(c.econ.horizonYears + 1);
    expect(e.flows[0]).toBeCloseTo(-e.capex.total, 6);
    expect(e.costPerGpuHour).toBeCloseTo((e.capex.total * crf(c.econ.discountRate, c.econ.horizonYears) + e.opexTotal) / e.gpuHours, 6);
    expect(e.annualPflopHours).toBeCloseTo((100000 * unit) / 3.6e6, 6);
  });
  it('charges data overage when paying per GB', () => {
    const c = defaultConfig();
    c.comms.buyOverage = true;
    const a = fakeAnnual({}, null);
    a.gbPerTerminalMonthly = new Array(12).fill(1500);
    const e = economics(c, a);
    expect(e.opexLines.find((l) => l.key === 'dataOverage')!.usd).toBeCloseTo(12 * 500 * 2 * 20, 6);
  });
  it('handles zero GPU-hours without NaN', () => {
    const c = defaultConfig();
    const e = economics(c, fakeAnnual({}, null));
    expect(e.gpuHours).toBe(0);
    expect(e.costPerGpuHour).toBe(Infinity);
    expect(Number.isNaN(e.marginPerGpuHour)).toBe(false);
    expect(e.paybackMonths).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/model/economics.test.ts`
Expected: FAIL, cannot resolve `./economics`.

- [ ] **Step 3: Implement `economics.ts`**

```ts
import type { SimConfig } from './config';
import { payOverage } from './defaults';
import { derive } from './derive';
import type { AnnualResult } from './annual';

export interface CostLine {
  key: string;
  label: string;
  usd: number;
  estimate: boolean;
}

export function moduleCapex(cfg: SimConfig): { lines: CostLine[]; total: number } {
  const d = derive(cfg);
  const e = cfg.econ;
  const shared = cfg.comms.modulesPerTerminal > 1;
  const base: CostLine[] = [
    { key: 'panels', label: 'Solar panels', usd: d.peakPvW * cfg.panel.usdPerW, estimate: false },
    { key: 'petals', label: 'Petal frames and actuators', usd: d.petalM2 * e.petalUsdPerM2, estimate: true },
    { key: 'hull', label: 'Hull', usd: e.hullUsd, estimate: true },
    { key: 'pod', label: 'Compute pod', usd: e.podUsd, estimate: true },
    { key: 'heatExchanger', label: 'Seawater heat exchanger', usd: e.heatExchangerUsd, estimate: true },
    { key: 'battery', label: 'Battery (integrated)', usd: cfg.battery.kwh * cfg.battery.usdPerKwh * e.batteryIntegrationUplift, estimate: false },
    { key: 'mppt', label: 'MPPT controllers', usd: d.peakPvW * e.mpptUsdPerW, estimate: false },
    { key: 'accelerators', label: 'Accelerators', usd: cfg.compute.cards * cfg.compute.priceUsd, estimate: false },
    { key: 'host', label: 'Host board and network', usd: cfg.compute.cards > 0 ? e.hostUsd : 0, estimate: true },
    { key: 'starlink', label: 'Starlink terminal share', usd: cfg.comms.terminalUsd / cfg.comms.modulesPerTerminal + (shared ? cfg.comms.radioUsd : 0), estimate: false },
    { key: 'thrusters', label: 'Thrusters', usd: cfg.propulsion.count * cfg.propulsion.usd, estimate: false },
    { key: 'avionics', label: 'GNSS and avionics', usd: e.gnssUsd + e.avionicsUsd, estimate: true },
  ];
  const sub = base.reduce((a, l) => a + l.usd, 0);
  const integration = sub * e.integrationPct;
  const contingency = (sub + integration) * e.contingencyPct;
  const lines = [
    ...base,
    { key: 'integration', label: 'Integration and assembly', usd: integration, estimate: true },
    { key: 'contingency', label: 'Contingency', usd: contingency, estimate: true },
  ];
  return { lines, total: lines.reduce((a, l) => a + l.usd, 0) };
}

export function swarmCapex(cfg: SimConfig): { perModule: number; fleetModules: number; deployment: number; total: number } {
  const perModule = moduleCapex(cfg).total;
  const fleetModules = cfg.swarm.count * (1 + cfg.econ.sparesPct);
  const deployment = cfg.econ.deploymentVesselDays * cfg.econ.vesselDayUsd;
  return { perModule, fleetModules, deployment, total: perModule * fleetModules + deployment };
}

export const crf = (r: number, n: number): number => (r === 0 ? 1 / n : (r * (1 + r) ** n) / ((1 + r) ** n - 1));

export const npv = (r: number, flows: number[]): number => flows.reduce((a, f, i) => a + f / (1 + r) ** i, 0);

export function irr(flows: number[]): number | null {
  let lo = -0.99, hi = 10;
  let flo = npv(lo, flows);
  const fhi = npv(hi, flows);
  if (!Number.isFinite(flo) || !Number.isFinite(fhi) || flo * fhi > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fm = npv(mid, flows);
    if (Math.abs(fm) < 1e-9) return mid;
    if (flo * fm < 0) hi = mid;
    else {
      lo = mid;
      flo = fm;
    }
  }
  return (lo + hi) / 2;
}

export function paybackMonths(flows: number[]): number | null {
  let cum = flows[0];
  if (cum >= 0) return 0;
  for (let y = 1; y < flows.length; y++) {
    const next = cum + flows[y];
    if (next >= 0) return (y - 1) * 12 + (-cum / flows[y]) * 12;
    cum = next;
  }
  return null;
}

export interface Econ {
  moduleCapex: { lines: CostLine[]; total: number };
  capex: { perModule: number; fleetModules: number; deployment: number; total: number };
  gpuHours: number;
  firmGpuHours: number;
  spotGpuHours: number;
  committedFirmGpuHours: number;
  availability: number | null;
  revenue: { firm: number; spot: number; slaPenalty: number; total: number };
  opexLines: CostLine[];
  opexTotal: number;
  grossMargin: number;
  costPerGpuHour: number;
  marginPerGpuHour: number;
  lcocPerPflopHour: number;
  marketFirm: number;
  marketSpot: number;
  flows: number[];
  npv: number;
  irr: number | null;
  paybackMonths: number | null;
  annualPflopHours: number;
}

export function economics(cfg: SimConfig, annual: AnnualResult): Econ {
  const e = cfg.econ;
  const t = annual.totals;
  const mc = moduleCapex(cfg);
  const capex = swarmCapex(cfg);
  const gpuUnit = cfg.compute.denseTflops * 3600;
  const toGpuH = (tflop: number) => (gpuUnit > 0 ? tflop / gpuUnit : 0);
  const gpuHours = toGpuH(t.tflop);
  const firmGpuHours = toGpuH(t.firmTflop);
  const spotGpuHours = toGpuH(t.spotTflop);
  const committedFirmGpuHours = toGpuH(t.firmCommittedTflop);
  const availability = annual.availability;
  const slaPenalty =
    availability !== null && availability < e.slaTarget ? (e.slaTarget - availability) * committedFirmGpuHours * e.firmUsdPerGpuH * e.slaPenaltyMultiple : 0;
  const revenueFirm = firmGpuHours * e.firmUsdPerGpuH;
  const revenueSpot = spotGpuHours * e.spotUsdPerGpuH;
  const revenue = { firm: revenueFirm, spot: revenueSpot, slaPenalty, total: revenueFirm + revenueSpot - slaPenalty };

  const n = cfg.swarm.count;
  const terminals = annual.terminals;
  const overageRate = cfg.comms.overageUsdPerGB ?? 0;
  const dataOverage = payOverage(cfg)
    ? annual.gbPerTerminalMonthly.reduce((a, gb) => a + Math.max(0, gb - cfg.comms.planCapGB), 0) * overageRate * terminals
    : 0;
  const batteryLine = mc.lines.find((l) => l.key === 'battery')!.usd;
  const opexLines: CostLine[] = [
    { key: 'starlinkPlans', label: 'Starlink plans', usd: terminals * cfg.comms.planUsdPerMonth * 12, estimate: false },
    { key: 'dataOverage', label: 'Data beyond plan cap', usd: dataOverage, estimate: false },
    { key: 'maintenance', label: 'Service visits', usd: e.maintenanceVisitsPerYear * e.visitUsd, estimate: true },
    { key: 'insurance', label: 'Insurance', usd: e.insurancePct * capex.total, estimate: true },
    { key: 'moduleLosses', label: 'Module losses', usd: e.moduleLossRate * n * capex.perModule, estimate: true },
    {
      key: 'batteryWear', label: 'Battery wear',
      usd: n * batteryLine * Math.min(1, annual.batteryCyclesPerModule / cfg.battery.cycleLife), estimate: false,
    },
    { key: 'acceleratorRefresh', label: 'Accelerator refresh', usd: (n * cfg.compute.cards * cfg.compute.priceUsd) / e.acceleratorRefreshYears, estimate: true },
  ];
  const opexTotal = opexLines.reduce((a, l) => a + l.usd, 0);
  const annualCost = capex.total * crf(e.discountRate, e.horizonYears) + opexTotal;
  const grossMargin = revenue.total - opexTotal;
  const flows = [-capex.total, ...new Array(e.horizonYears).fill(grossMargin)];
  const annualPflopHours = t.tflop / 3.6e6;
  return {
    moduleCapex: mc,
    capex,
    gpuHours,
    firmGpuHours,
    spotGpuHours,
    committedFirmGpuHours,
    availability,
    revenue,
    opexLines,
    opexTotal,
    grossMargin,
    costPerGpuHour: gpuHours > 0 ? annualCost / gpuHours : Infinity,
    marginPerGpuHour: gpuHours > 0 ? (revenue.total - annualCost) / gpuHours : 0,
    lcocPerPflopHour: annualPflopHours > 0 ? annualCost / annualPflopHours : Infinity,
    marketFirm: e.firmUsdPerGpuH,
    marketSpot: e.spotUsdPerGpuH,
    flows,
    npv: npv(e.discountRate, flows),
    irr: irr(flows),
    paybackMonths: paybackMonths(flows),
    annualPflopHours,
  };
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/model/economics.ts src/model/economics.test.ts
git commit -m "feat: add compute-as-a-service economics with firm and spot tiers"
```

---
### Task 11: Feasibility checks and optimizer

**Files:**
- Create: `src/model/feasibility.ts`, `src/model/optimizer.ts`
- Test: `src/model/feasibility.test.ts`, `src/model/optimizer.test.ts`

**Interfaces:**
- Consumes: `derive`, `Derived`, `runAnnual`, `AnnualResult`, `economics`, `Econ`, `setPath`, `getPath`, `applyPreset`, `PresetKind`, `mulberry32`, `BUOYANCY_RESERVE`.
- Produces:
  - `interface Flag { id: string; severity: 'warn' | 'error'; message: string }`, `feasibility(cfg, d, annual?: AnnualResult | null, econ?: Econ | null): Flag[]`
  - `type Metric = 'pflopHours' | 'costPerGpuHour' | 'marginYear' | 'marginPerGpuHour' | 'paybackMonths'`, `METRICS: { id: Metric; label: string; better: 'high' | 'low' }[]`
  - `interface Evaluation { pflopHours; costPerGpuHour; marginYear; marginPerGpuHour; paybackMonths: number | null; capexTotal; feasible: boolean }`
  - `evaluate(cfg, sampleModules?: number): Evaluation`, `metricValue(ev: Evaluation, m: Metric): number`
  - `type Axis = { kind: 'number'; path; label; min; max; steps; integer? } | { kind: 'preset'; preset: PresetKind; label; ids: string[] } | { kind: 'enum'; path; label; values: string[] }`
  - `axisValues(a: Axis): (number | string)[]`, `applyAxis(cfg, a, v): SimConfig`
  - `interface SweepResult { xs: (number | string)[]; ys: (number | string)[]; cells: Evaluation[][] }` (`cells[yi][xi]`), `sweep(cfg, ax, ay, onProgress?, sampleModules?): SweepResult`
  - `interface Range { path; label; min; max; integer? }`, `interface ParetoPoint { values: Record<string, number>; ev: Evaluation }`, `interface ParetoResult { points: ParetoPoint[]; frontier: number[] }`
  - `paretoFrontier(pts: { x: number; y: number; ok: boolean }[]): number[]`, `pareto(cfg, ranges, n, seed, onProgress?, sampleModules?): ParetoResult`
  - `TORNADO_KEYS: { path: string; label: string }[]`, `interface TornadoRow { path; label; lowValue; highValue; low; high }`, `interface TornadoResult { base: number; rows: TornadoRow[] }`, `tornado(cfg, onProgress?, sampleModules?): TornadoResult`
  - `AXIS_OPTIONS: Axis[]`, `RANGE_OPTIONS: Range[]`

- [ ] **Step 1: Write the failing tests**

`src/model/feasibility.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { feasibility } from './feasibility';
import { derive } from './derive';
import { defaultConfig, applyPreset } from './defaults';
import { emptyTotals, AnnualResult } from './annual';

const ids = (c = defaultConfig(), a: AnnualResult | null = null) => feasibility(c, derive(c), a).map((f) => f.id);

describe('feasibility', () => {
  it('default config has no errors', () => {
    expect(feasibility(defaultConfig(), derive(defaultConfig())).filter((f) => f.severity === 'error')).toEqual([]);
  });
  it('flags buoyancy for a very heavy battery', () => {
    const c = applyPreset(defaultConfig(), 'battery', 'battle-born');
    c.battery.kwh = 150;
    expect(ids(c)).toContain('buoyancy');
  });
  it('flags pod volume for too many large cards', () => {
    const c = applyPreset(defaultConfig(), 'accelerator', 'l40s');
    c.compute.cards = 64;
    expect(ids(c)).toContain('podVolume');
  });
  it('thrust warning when currents exceed thruster speed', () => {
    const c = defaultConfig();
    c.env.currentMs = 1;
    expect(ids(c)).toContain('thrust');
  });
  it('geofence error when min is not below max', () => {
    const c = defaultConfig();
    c.swarm.minOffshoreKm = 200;
    expect(ids(c)).toContain('geofence');
  });
  it('annual-based flags', () => {
    const a: AnnualResult = {
      mode: 'full', days: [], gbPerTerminalMonthly: new Array(12).fill(0), batteryCyclesPerModule: 0, availability: 0.5, modules: 20, terminals: 20,
      totals: { ...emptyTotals(), hours: 8760, stowedH: 1000, unmetKwh: 5, bindingH: { power: 4000, bandwidth: 4000, demand: 760 } },
    };
    const f = ids(defaultConfig(), a);
    expect(f).toEqual(expect.arrayContaining(['windStow', 'unmet', 'bandwidth', 'sla']));
  });
});
```

`src/model/optimizer.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { paretoFrontier, axisValues, applyAxis, sweep, tornado, pareto, evaluate, metricValue, AXIS_OPTIONS, RANGE_OPTIONS } from './optimizer';
import { defaultConfig } from './defaults';
import { getPath } from './config';

const small = () => {
  const c = defaultConfig();
  c.swarm.count = 2;
  return c;
};

describe('optimizer', () => {
  it('finds the Pareto frontier (min x, max y)', () => {
    const pts = [
      { x: 1, y: 1, ok: true }, { x: 2, y: 3, ok: true }, { x: 3, y: 2, ok: true }, { x: 0.5, y: 5, ok: false }, { x: 4, y: 4, ok: true },
    ];
    expect(paretoFrontier(pts)).toEqual([0, 1, 4]);
  });
  it('generates axis values', () => {
    expect(axisValues({ kind: 'number', path: 'battery.kwh', label: '', min: 2, max: 30, steps: 8 })).toHaveLength(8);
    expect(axisValues({ kind: 'number', path: 'compute.cards', label: '', min: 1, max: 16, steps: 8, integer: true })).toEqual([1, 3, 5, 7, 10, 12, 14, 16]);
    expect(axisValues({ kind: 'enum', path: 'swarm.strategy', label: '', values: ['station', 'seek'] })).toEqual(['station', 'seek']);
  });
  it('applies number, preset and enum axes', () => {
    const c = defaultConfig();
    expect(applyAxis(c, { kind: 'preset', preset: 'accelerator', label: '', ids: [] }, 'l40s').compute.tdpW).toBe(350);
    expect(applyAxis(c, { kind: 'enum', path: 'swarm.strategy', label: '', values: [] }, 'seek').swarm.strategy).toBe('seek');
    expect(applyAxis(c, { kind: 'number', path: 'battery.kwh', label: '', min: 0, max: 1, steps: 2 }, 3).battery.kwh).toBe(3);
  });
  it('every axis and range option points at a real config path', () => {
    const c = defaultConfig();
    for (const a of AXIS_OPTIONS) if (a.kind !== 'preset') expect(getPath(c, a.path)).not.toBeUndefined();
    for (const r of RANGE_OPTIONS) expect(typeof getPath(c, r.path)).toBe('number');
  });
  it('sweeps a 2x2 grid', () => {
    let calls = 0;
    const r = sweep(small(), { kind: 'number', path: 'battery.kwh', label: '', min: 4, max: 12, steps: 2 }, { kind: 'enum', path: 'compute.policy', label: '', values: ['firm', 'max'] }, () => calls++);
    expect(r.cells).toHaveLength(2);
    expect(r.cells[0]).toHaveLength(2);
    expect(calls).toBe(4);
    for (const row of r.cells) for (const ev of row) expect(ev.pflopHours).toBeGreaterThan(0);
  });
  it('tornado rows are sorted by spread', () => {
    const t = tornado(small());
    expect(Number.isFinite(t.base)).toBe(true);
    expect(t.rows.length).toBeGreaterThan(5);
    for (let i = 1; i < t.rows.length; i++) {
      expect(Math.abs(t.rows[i - 1].high - t.rows[i - 1].low)).toBeGreaterThanOrEqual(Math.abs(t.rows[i].high - t.rows[i].low));
    }
  });
  it('pareto samples within ranges', () => {
    const r = pareto(small(), [{ path: 'battery.kwh', label: '', min: 2, max: 20 }], 4, 1);
    expect(r.points).toHaveLength(4);
    for (const p of r.points) {
      expect(p.values['battery.kwh']).toBeGreaterThanOrEqual(2);
      expect(p.values['battery.kwh']).toBeLessThanOrEqual(20);
    }
    for (const i of r.frontier) expect(r.points[i]).toBeDefined();
  });
  it('reports evaluate runtime', () => {
    const t0 = performance.now();
    evaluate(defaultConfig());
    console.log(`evaluate: ${(performance.now() - t0).toFixed(0)} ms`);
  });
  it('100-module evaluation stays finite', () => {
    const c = defaultConfig();
    c.swarm.count = 100;
    const ev = evaluate(c);
    expect(Number.isFinite(ev.pflopHours)).toBe(true);
    expect(Number.isFinite(metricValue(ev, 'marginPerGpuHour'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/model/feasibility.test.ts src/model/optimizer.test.ts`
Expected: FAIL, cannot resolve modules.

- [ ] **Step 3: Implement `feasibility.ts`**

```ts
import type { SimConfig } from './config';
import type { Derived } from './derive';
import type { AnnualResult } from './annual';
import type { Econ } from './economics';
import { BUOYANCY_RESERVE } from './constants';

export interface Flag {
  id: string;
  severity: 'warn' | 'error';
  message: string;
}

const r0 = (v: number) => Math.round(v).toLocaleString('en-US');
const pct = (v: number) => `${(v * 100).toFixed(0)}%`;

export function feasibility(cfg: SimConfig, d: Derived, annual?: AnnualResult | null, econ?: Econ | null): Flag[] {
  const flags: Flag[] = [];
  const warn = (id: string, message: string) => flags.push({ id, severity: 'warn', message });
  const error = (id: string, message: string) => flags.push({ id, severity: 'error', message });

  const limit = d.displacementKg * (1 - BUOYANCY_RESERVE);
  if (d.massKg > limit) {
    error('buoyancy', `Module mass ${r0(d.massKg)} kg exceeds ${r0(limit)} kg, which is 80% of displacement at ${cfg.hull.draftM} m draft. Increase draft or hull size, or cut battery mass.`);
  }
  if (d.podNeedL > cfg.hull.podVolumeL) {
    error('podVolume', `Cards, host and heat exchanger need ${r0(d.podNeedL)} L but the pod holds ${r0(cfg.hull.podVolumeL)} L.`);
  }
  if (d.petalOverlap) warn('petalOverlap', `${cfg.hull.petalCount} petals ${cfg.hull.petalWidthM} m wide overlap when open. Use fewer or narrower petals.`);
  if (cfg.comms.modulesPerTerminal > 1 && 2 * d.formationRadiusM > cfg.comms.radioRangeM) {
    warn('radioRange', `The formation is ${r0(2 * d.formationRadiusM)} m across but the in-swarm radio reaches ${r0(cfg.comms.radioRangeM)} m.`);
  }
  if (2 * cfg.swarm.toleranceM >= cfg.swarm.spacingM) warn('tolerance', 'The tolerance radius is at least half the spacing, so neighboring modules can touch.');
  if (cfg.swarm.breakawayM <= cfg.swarm.toleranceM) warn('breakaway', 'The breakaway distance should be larger than the tolerance radius.');
  const typical = cfg.env.currentMs + cfg.env.currentVariabilityMs;
  if (d.maxWaterSpeedMs < typical) {
    warn('thrust', `Thrusters reach ${d.maxWaterSpeedMs.toFixed(2)} m/s through the water, below typical currents of up to ${typical.toFixed(2)} m/s. Modules will be pushed off station.`);
  }
  if (cfg.swarm.minOffshoreKm >= cfg.swarm.maxOffshoreKm) error('geofence', 'The minimum distance offshore must be less than the maximum.');

  if (annual) {
    const hours = Math.max(1, annual.totals.hours);
    const stow = annual.totals.stowedH / hours;
    if (stow > 0.05) warn('windStow', `Petals are stowed for wind ${pct(stow)} of hours.`);
    if (annual.totals.unmetKwh > 0.01) {
      error('unmet', `Modules ran out of power for essential loads (${r0(annual.totals.unmetKwh)} kWh per year across the swarm). Add battery or panels, or cut loads.`);
    }
    const bw = annual.totals.bindingH.bandwidth / hours;
    if (bw > 0.2) warn('bandwidth', `Starlink bandwidth or the data cap limits compute ${pct(bw)} of hours.`);
    if (annual.availability !== null && annual.availability < cfg.econ.slaTarget) {
      warn('sla', `Firm capacity is available ${pct(annual.availability)} of committed hours, below the ${pct(cfg.econ.slaTarget)} target.`);
    }
  }
  if (econ && econ.gpuHours === 0) warn('noCompute', 'No compute is delivered. Add accelerators or check the power and policy settings.');
  return flags;
}
```

- [ ] **Step 4: Implement `optimizer.ts`**

```ts
import type { SimConfig } from './config';
import { setPath, getPath } from './config';
import { applyPreset, PresetKind } from './defaults';
import { runAnnual } from './annual';
import { economics } from './economics';
import { derive } from './derive';
import { feasibility } from './feasibility';
import { mulberry32 } from './rng';
import { ACCELERATORS, PANELS, PLANS } from '../presets';

export type Metric = 'pflopHours' | 'costPerGpuHour' | 'marginYear' | 'marginPerGpuHour' | 'paybackMonths';

export const METRICS: { id: Metric; label: string; better: 'high' | 'low' }[] = [
  { id: 'marginPerGpuHour', label: 'Margin per GPU-hour (USD)', better: 'high' },
  { id: 'marginYear', label: 'Gross margin per year (USD)', better: 'high' },
  { id: 'pflopHours', label: 'Delivered PFLOP-hours per year', better: 'high' },
  { id: 'costPerGpuHour', label: 'Cost per GPU-hour (USD)', better: 'low' },
  { id: 'paybackMonths', label: 'Payback (months)', better: 'low' },
];

export interface Evaluation {
  pflopHours: number;
  costPerGpuHour: number;
  marginYear: number;
  marginPerGpuHour: number;
  paybackMonths: number | null;
  capexTotal: number;
  feasible: boolean;
}

export function evaluate(cfg: SimConfig, sampleModules = 4): Evaluation {
  const annual = runAnnual(cfg, 'representative', { sampleModules });
  const e = economics(cfg, annual);
  const flags = feasibility(cfg, derive(cfg), annual, e);
  return {
    pflopHours: e.annualPflopHours,
    costPerGpuHour: e.costPerGpuHour,
    marginYear: e.grossMargin,
    marginPerGpuHour: e.marginPerGpuHour,
    paybackMonths: e.paybackMonths,
    capexTotal: e.capex.total,
    feasible: !flags.some((f) => f.severity === 'error'),
  };
}

export function metricValue(ev: Evaluation, m: Metric): number {
  if (m === 'paybackMonths') return ev.paybackMonths ?? Infinity;
  return ev[m];
}

export type Axis =
  | { kind: 'number'; path: string; label: string; min: number; max: number; steps: number; integer?: boolean }
  | { kind: 'preset'; preset: PresetKind; label: string; ids: string[] }
  | { kind: 'enum'; path: string; label: string; values: string[] };

export function axisValues(a: Axis): (number | string)[] {
  if (a.kind === 'preset') return a.ids;
  if (a.kind === 'enum') return a.values;
  const out: number[] = [];
  for (let i = 0; i < a.steps; i++) {
    const v = a.steps === 1 ? a.min : a.min + ((a.max - a.min) * i) / (a.steps - 1);
    out.push(a.integer ? Math.round(v) : Number(v.toPrecision(6)));
  }
  return [...new Set(out)];
}

export function applyAxis(cfg: SimConfig, a: Axis, v: number | string): SimConfig {
  if (a.kind === 'preset') return applyPreset(cfg, a.preset, String(v));
  return setPath(cfg, a.path, v);
}

export interface SweepResult {
  xs: (number | string)[];
  ys: (number | string)[];
  cells: Evaluation[][];
}

export function sweep(cfg: SimConfig, ax: Axis, ay: Axis, onProgress?: (done: number, total: number) => void, sampleModules = 4): SweepResult {
  const xs = axisValues(ax);
  const ys = axisValues(ay);
  const total = xs.length * ys.length;
  let done = 0;
  const cells = ys.map((y) =>
    xs.map((x) => {
      const ev = evaluate(applyAxis(applyAxis(cfg, ax, x), ay, y), sampleModules);
      onProgress?.(++done, total);
      return ev;
    }),
  );
  return { xs, ys, cells };
}

export interface Range {
  path: string;
  label: string;
  min: number;
  max: number;
  integer?: boolean;
}

export interface ParetoPoint {
  values: Record<string, number>;
  ev: Evaluation;
}

export interface ParetoResult {
  points: ParetoPoint[];
  frontier: number[];
}

/** Indices of feasible points not dominated on (lower x, higher y), ordered by x. */
export function paretoFrontier(pts: { x: number; y: number; ok: boolean }[]): number[] {
  const order = pts
    .map((_, i) => i)
    .filter((i) => pts[i].ok && Number.isFinite(pts[i].x) && Number.isFinite(pts[i].y))
    .sort((a, b) => pts[a].x - pts[b].x || pts[b].y - pts[a].y);
  const out: number[] = [];
  let best = -Infinity;
  for (const i of order) {
    if (pts[i].y > best) {
      out.push(i);
      best = pts[i].y;
    }
  }
  return out;
}

export function pareto(cfg: SimConfig, ranges: Range[], n: number, seed: number, onProgress?: (done: number, total: number) => void, sampleModules = 4): ParetoResult {
  const rng = mulberry32(seed);
  const points: ParetoPoint[] = [];
  for (let k = 0; k < n; k++) {
    const values: Record<string, number> = {};
    let c = cfg;
    for (const r of ranges) {
      let v = r.min + rng() * (r.max - r.min);
      if (r.integer) v = Math.round(v);
      values[r.path] = v;
      c = setPath(c, r.path, v);
    }
    points.push({ values, ev: evaluate(c, sampleModules) });
    onProgress?.(k + 1, n);
  }
  const frontier = paretoFrontier(points.map((p) => ({ x: p.ev.capexTotal, y: p.ev.pflopHours, ok: p.ev.feasible })));
  return { points, frontier };
}

export const TORNADO_KEYS: { path: string; label: string }[] = [
  { path: 'panel.efficiency', label: 'Panel efficiency' },
  { path: 'hull.petalLengthM', label: 'Petal length' },
  { path: 'battery.kwh', label: 'Battery capacity' },
  { path: 'battery.usdPerKwh', label: 'Battery price' },
  { path: 'compute.cards', label: 'Accelerator count' },
  { path: 'compute.priceUsd', label: 'Accelerator price' },
  { path: 'econ.firmUsdPerGpuH', label: 'Firm price' },
  { path: 'econ.spotUsdPerGpuH', label: 'Spot price' },
  { path: 'comms.planUsdPerMonth', label: 'Starlink plan price' },
  { path: 'econ.hullUsd', label: 'Hull cost' },
  { path: 'econ.integrationPct', label: 'Integration uplift' },
  { path: 'env.currentMs', label: 'Current speed' },
];

export interface TornadoRow {
  path: string;
  label: string;
  lowValue: number;
  highValue: number;
  low: number;
  high: number;
}

export interface TornadoResult {
  base: number;
  rows: TornadoRow[];
}

/** Margin per GPU-hour when each input moves -20% and +20%. */
export function tornado(cfg: SimConfig, onProgress?: (done: number, total: number) => void, sampleModules = 4): TornadoResult {
  const metric: Metric = 'marginPerGpuHour';
  const total = 1 + TORNADO_KEYS.length * 2;
  let done = 0;
  const base = metricValue(evaluate(cfg, sampleModules), metric);
  onProgress?.(++done, total);
  const rows = TORNADO_KEYS.map(({ path, label }) => {
    const v = getPath(cfg, path) as number;
    const isInt = path === 'compute.cards';
    const lowValue = isInt ? Math.max(0, Math.round(v * 0.8)) : v * 0.8;
    const highValue = isInt ? Math.round(v * 1.2) : v * 1.2;
    const low = metricValue(evaluate(setPath(cfg, path, lowValue), sampleModules), metric);
    onProgress?.(++done, total);
    const high = metricValue(evaluate(setPath(cfg, path, highValue), sampleModules), metric);
    onProgress?.(++done, total);
    return { path, label, lowValue, highValue, low, high };
  });
  rows.sort((a, b) => Math.abs(b.high - b.low) - Math.abs(a.high - a.low));
  return { base, rows };
}

export const AXIS_OPTIONS: Axis[] = [
  { kind: 'number', path: 'battery.kwh', label: 'Battery capacity (kWh)', min: 2, max: 30, steps: 8 },
  { kind: 'number', path: 'compute.cards', label: 'Accelerator cards', min: 1, max: 16, steps: 8, integer: true },
  { kind: 'number', path: 'compute.firmComputeW', label: 'Firm commitment (W)', min: 0, max: 800, steps: 8 },
  { kind: 'number', path: 'hull.petalLengthM', label: 'Petal length (m)', min: 0.4, max: 2, steps: 7 },
  { kind: 'number', path: 'comms.modulesPerTerminal', label: 'Modules per Starlink terminal', min: 1, max: 8, steps: 8, integer: true },
  { kind: 'preset', preset: 'accelerator', label: 'Accelerator', ids: ACCELERATORS.map((a) => a.id) },
  { kind: 'preset', preset: 'panel', label: 'Solar panel', ids: PANELS.map((p) => p.id) },
  { kind: 'preset', preset: 'plan', label: 'Starlink plan', ids: PLANS.map((p) => p.id) },
  { kind: 'enum', path: 'compute.policy', label: 'Operating policy', values: ['daylight', 'firm', 'max'] },
  { kind: 'enum', path: 'swarm.strategy', label: 'Swarm strategy', values: ['station', 'drift', 'seek'] },
  { kind: 'enum', path: 'hull.tracking', label: 'Sun tracking', values: ['flat', 'yaw', 'dual'] },
];

export const RANGE_OPTIONS: Range[] = [
  { path: 'battery.kwh', label: 'Battery capacity (kWh)', min: 2, max: 30 },
  { path: 'compute.cards', label: 'Accelerator cards', min: 1, max: 16, integer: true },
  { path: 'compute.firmComputeW', label: 'Firm commitment (W)', min: 0, max: 800 },
  { path: 'hull.petalLengthM', label: 'Petal length (m)', min: 0.4, max: 2 },
  { path: 'hull.petalCount', label: 'Petal count', min: 4, max: 12, integer: true },
  { path: 'comms.modulesPerTerminal', label: 'Modules per terminal', min: 1, max: 8, integer: true },
];
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS. The tornado and 100-module tests take several seconds each; that is expected. Note the printed `evaluate` time and apply the Performance budget rule for the Pareto default.

- [ ] **Step 6: Commit**

```bash
git add src/model/feasibility.ts src/model/optimizer.ts src/model/feasibility.test.ts src/model/optimizer.test.ts
git commit -m "feat: add feasibility flags, parameter sweep, Pareto sampling and tornado sensitivity"
```

---

### Task 12: Live one-day simulation

**Files:**
- Create: `src/model/live.ts`
- Test: `src/model/live.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 4 to 8.
- Produces:
  - `interface LivePoint { t; hour; ghi; sunElevationDeg; sunAzimuthDeg; stowed: boolean; pvW; essentialW; propulsionW; computeW; chargeW; dischargeW; curtailedW; socFrac; tflops; binding: Binding }` (watts are per-module averages; `tflops` is the swarm total; `hour` is hours since local midnight PST)
  - `interface LiveSim { cfg; d: Derived; env: Env; params: SwarmParams; rng: Rng; doy; t; dayStart; endT; dtS; swarm: SwarmState; soc: number[]; flows: StepFlows[]; jobs: JobState; history: LivePoint[]; stowed: boolean; binding: Binding; sunElevationDeg: number; done: boolean }`
  - `LIVE_DT_S = 300`, `createLiveSim(cfg, doy, startSocFrac?): LiveSim`, `stepLive(s: LiveSim): void` (mutates), `runLiveDay(cfg, doy): LiveSim`, `kickModule(s: LiveSim, i: number): void`

- [ ] **Step 1: Write the failing test**

`src/model/live.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createLiveSim, stepLive, runLiveDay, kickModule } from './live';
import { defaultConfig } from './defaults';

describe('live simulation', () => {
  const sim = runLiveDay(defaultConfig(), 172);

  it('steps a full day at 5-minute resolution', () => {
    expect(sim.history).toHaveLength(288);
    expect(sim.done).toBe(true);
    expect(sim.history[0].hour).toBe(0);
    expect(sim.history[287].hour).toBeCloseTo(23 + 55 / 60, 9);
  });

  it('balances energy at every step and keeps battery in range', () => {
    for (const p of sim.history) {
      expect(Math.abs(p.pvW + p.dischargeW - (p.essentialW + p.computeW + p.chargeW + p.curtailedW))).toBeLessThan(1e-6);
      expect(p.socFrac).toBeGreaterThanOrEqual(0);
      expect(p.socFrac).toBeLessThanOrEqual(1 + 1e-9);
    }
  });

  it('completes jobs and produces solar at midday', () => {
    expect(sim.jobs.completed).toBeGreaterThan(0);
    const noon = sim.history[144];
    expect(noon.pvW).toBeGreaterThan(200);
    expect(noon.sunElevationDeg).toBeGreaterThan(60);
  });

  it('a kicked module becomes a stray', () => {
    const s = createLiveSim(defaultConfig(), 172);
    stepLive(s);
    kickModule(s, 5);
    stepLive(s);
    expect(s.swarm.modules[5].stray).toBe(true);
  });

  it('stepLive does nothing after the day ends', () => {
    const before = sim.history.length;
    stepLive(sim);
    expect(sim.history.length).toBe(before);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/model/live.test.ts`
Expected: FAIL, cannot resolve `./live`.

- [ ] **Step 3: Implement `live.ts`**

```ts
import type { SimConfig } from './config';
import { derive, Derived } from './derive';
import { createEnvironment, Env } from './environment';
import { swarmParams, initSwarm, stepSwarm, SwarmParams, SwarmState } from './swarm';
import { poaIrradiance, pvPowerW } from './solar';
import { dispatch, StepFlows } from './module';
import { aggregateStep, initJobs, stepJobs, Binding, JobState } from './jobs';
import { mulberry32, hashSeed, Rng } from './rng';
import { dayStartMs } from './time';
import { add } from './vec';
import { WORKLOADS } from '../presets';

export interface LivePoint {
  t: number;
  hour: number;
  ghi: number;
  sunElevationDeg: number;
  sunAzimuthDeg: number;
  stowed: boolean;
  pvW: number;
  essentialW: number;
  propulsionW: number;
  computeW: number;
  chargeW: number;
  dischargeW: number;
  curtailedW: number;
  socFrac: number;
  tflops: number;
  binding: Binding;
}

export interface LiveSim {
  cfg: SimConfig;
  d: Derived;
  env: Env;
  params: SwarmParams;
  rng: Rng;
  doy: number;
  t: number;
  dayStart: number;
  endT: number;
  dtS: number;
  swarm: SwarmState;
  soc: number[];
  flows: StepFlows[];
  jobs: JobState;
  history: LivePoint[];
  stowed: boolean;
  binding: Binding;
  sunElevationDeg: number;
  done: boolean;
}

export const LIVE_DT_S = 300;

export function createLiveSim(cfg: SimConfig, doy: number, startSocFrac = 0.5): LiveSim {
  const d = derive(cfg);
  const env = createEnvironment(cfg);
  const params = swarmParams(cfg, d);
  const t0 = dayStartMs(doy);
  return {
    cfg, d, env, params,
    rng: mulberry32(hashSeed(cfg.seed, doy, 7)),
    doy, t: t0, dayStart: t0, endT: t0 + 86400000, dtS: LIVE_DT_S,
    swarm: initSwarm(params),
    soc: new Array(cfg.swarm.count).fill(cfg.battery.kwh * startSocFrac),
    flows: [],
    jobs: initJobs(t0),
    history: [],
    stowed: false,
    binding: 'power',
    sunElevationDeg: env.sun(t0).elevationDeg,
    done: false,
  };
}

export function stepLive(s: LiveSim): void {
  if (s.done) return;
  const { cfg, d, env, params } = s;
  const dtS = s.dtS;
  const dtH = dtS / 3600;
  const t = s.t;
  const n = cfg.swarm.count;
  const out = stepSwarm(s.swarm, params, env, t, dtS, s.rng);
  const stowed = env.stowed(t);
  const sun = env.sun(t);
  const tracking = !stowed && cfg.hull.tracking !== 'flat' && sun.elevationDeg > 0;
  const area = stowed ? d.hullTopM2 : d.pvAreaM2;
  const pvs: number[] = [];
  const pass1: StepFlows[] = [];
  let ghiSum = 0;
  for (let i = 0; i < n; i++) {
    const pos = s.swarm.modules[i].pos;
    const ghi = env.ghi(t, pos.x, pos.y);
    ghiSum += ghi;
    const pvW = pvPowerW(poaIrradiance(ghi, sun, cfg.hull.tracking, cfg.hull.fixedTiltDeg, cfg.hull.maxTiltDeg, s.doy), area, cfg);
    pvs.push(pvW);
    pass1.push(dispatch(cfg, d, { pvW, propulsionW: out.propulsionW[i], trackingActive: tracking, socKwh: s.soc[i], dtH }));
  }
  const linkShare = d.terminals / n;
  const caps = pass1.map((f) => ({
    tflops: f.tflops,
    downMbps: f.online ? cfg.comms.downMbps * linkShare : 0,
    upMbps: f.online ? cfg.comms.upMbps * linkShare : 0,
  }));
  const used = stepJobs(s.jobs, caps, cfg.jobs.arrivalsPerHour, d.mix.weights, WORKLOADS, cfg.jobs.checkpointMin, Math.max(32, cfg.compute.cards * 8), dtS, s.rng);
  s.flows = pass1.map((f, i) => {
    const rate = used[i] / dtS;
    if (rate >= f.tflops - 1e-9) return f;
    return dispatch(cfg, d, {
      pvW: pvs[i], propulsionW: out.propulsionW[i], trackingActive: tracking, socKwh: s.soc[i], dtH,
      computeCapElecW: d.tflopsPerElecW > 0 ? rate / d.tflopsPerElecW : 0,
    });
  });
  s.flows.forEach((f, i) => { s.soc[i] = f.socKwh; });
  const potential = pass1.reduce((a, f) => a + f.tflops, 0);
  const down = caps.reduce((a, c) => a + c.downMbps, 0);
  const up = caps.reduce((a, c) => a + c.upMbps, 0);
  s.binding = aggregateStep(potential, down, up, (cfg.jobs.arrivalsPerHour / 3600) * d.mix.meanTflop, d.mix.inMBPerTflop, d.mix.outMBPerTflop).binding;
  const avg = (sel: (f: StepFlows) => number) => s.flows.reduce((a, f) => a + sel(f), 0) / n;
  s.history.push({
    t,
    hour: (t - s.dayStart) / 3600000,
    ghi: ghiSum / n,
    sunElevationDeg: sun.elevationDeg,
    sunAzimuthDeg: sun.azimuthDeg,
    stowed,
    pvW: avg((f) => f.pvW),
    essentialW: avg((f) => f.essentialW),
    propulsionW: out.propulsionW.reduce((a, b) => a + b, 0) / n,
    computeW: avg((f) => f.computeElecW),
    chargeW: avg((f) => f.chargeW),
    dischargeW: avg((f) => f.dischargeW),
    curtailedW: avg((f) => f.curtailedW),
    socFrac: cfg.battery.kwh > 0 ? s.soc.reduce((a, b) => a + b, 0) / n / cfg.battery.kwh : 0,
    tflops: s.flows.reduce((a, f) => a + f.tflops, 0),
    binding: s.binding,
  });
  s.stowed = stowed;
  s.sunElevationDeg = sun.elevationDeg;
  s.t += dtS * 1000;
  s.done = s.t >= s.endT;
}

export function runLiveDay(cfg: SimConfig, doy: number): LiveSim {
  const s = createLiveSim(cfg, doy);
  while (!s.done) stepLive(s);
  return s;
}

/** Pushes one module twice the breakaway distance away in a random direction, to demonstrate rejoin. */
export function kickModule(s: LiveSim, i: number): void {
  const m = s.swarm.modules[i];
  if (!m) return;
  const a = s.rng() * 2 * Math.PI;
  const r = 2 * s.cfg.swarm.breakawayM;
  m.pos = add(m.pos, { x: r * Math.cos(a), y: r * Math.sin(a) });
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/model/live.ts src/model/live.test.ts
git commit -m "feat: add live one-day simulation with discrete jobs"
```

---

### Task 13: App shell, store, workers, parameter panels and KPI strip

Load the `frontend-design` skill before this task.

**Files:**
- Create: `src/styles.css` (replace placeholder), `src/App.tsx` (replace placeholder)
- Create: `src/state/store.ts`, `src/state/useAnimationLoop.ts`, `src/state/useAnnualRunner.ts`, `src/state/useOptimizer.ts`
- Create: `src/workers/protocol.ts`, `src/workers/annual.worker.ts`, `src/workers/optimizer.worker.ts`
- Create: `src/ui/format.ts`, `src/ui/controls.tsx`, `src/ui/panelDefs.ts`, `src/ui/ParamPanels.tsx`, `src/ui/Header.tsx`, `src/ui/KpiStrip.tsx`, `src/ui/Tabs.tsx`, `src/ui/MainContent.tsx`
- Test: `src/state/store.test.ts`, `src/state/store.persist.test.ts`, `src/ui/format.test.ts`, `src/ui/panelDefs.test.ts`

**Interfaces:**
- Consumes: the model layer.
- Produces:
  - `useFleet` Zustand hook with state `{ cfg, annual, econ, running, runError, tab, investor, scenarios, notice }` and actions `update(path, value)`, `preset(kind, id)`, `replace(cfg)`, `reset()`, `setResults(annual, econ)`, `setRunning(b)`, `setRunError(msg)`, `setTab(tab)`, `setInvestor(b)`, `saveScenario(name)`, `loadScenario(name)`, `deleteScenario(name)`, `setNotice(msg | null)`; `type TabId = 'map' | 'module' | 'energy' | 'economics' | 'optimizer' | 'assumptions'`
  - `useAnimationLoop(active: boolean, cb: (dtSec: number) => void): void`
  - `useOptimizer(): { busy: boolean; progress: [number, number] | null; response: OptResult | null; error: string | null; run(job: OptJob): void }`
  - format helpers: `fmtNum`, `fmtUsd`, `fmtCompact`, `fmtUsdCompact`, `fmtPct`, `fmtMonths`, `fmtHour`, `BINDING_LABEL`, `topBinding(bindingH)`
  - controls: `Slider`, `Select`, `Toggle`, `Section`, `Stat`
  - `PANEL_DEFS`, `PARAM_LABELS`, `ParamItem`
  - `MainContent` with a `renderTab(tab)` switch that later tasks extend

- [ ] **Step 1: Write the failing tests**

`src/state/store.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { useFleet } from './store';
import { defaultConfig } from '../model/defaults';

describe('store', () => {
  it('loads without localStorage', () => {
    expect((globalThis as { localStorage?: unknown }).localStorage).toBeUndefined();
    expect(useFleet.getState().cfg).toEqual(defaultConfig());
  });
  it('updates, applies presets, saves and loads scenarios', () => {
    const st = useFleet.getState;
    st().update('battery.kwh', 12);
    expect(st().cfg.battery.kwh).toBe(12);
    st().preset('accelerator', 'l40s');
    expect(st().cfg.compute.tdpW).toBe(350);
    st().saveScenario('Big battery');
    st().reset();
    expect(st().cfg.battery.kwh).toBe(8);
    st().loadScenario('Big battery');
    expect(st().cfg.battery.kwh).toBe(12);
    st().saveScenario('   ');
    expect(st().notice).toMatch(/name/);
    st().deleteScenario('Big battery');
    expect(st().scenarios['Big battery']).toBeUndefined();
  });
});
```

`src/state/store.persist.test.ts` (a separate file so the storage stub is installed before the store module loads):
```ts
import { describe, it, expect, beforeAll } from 'vitest';

const mem = new Map<string, string>();

beforeAll(() => {
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  };
});

describe('store persistence', () => {
  it('persists only valid configs', async () => {
    const { useFleet } = await import('./store');
    useFleet.getState().update('battery.kwh', 12);
    expect(JSON.parse(mem.get('fleet.current.v1')!).battery.kwh).toBe(12);
    useFleet.getState().update('name', '');
    expect(JSON.parse(mem.get('fleet.current.v1')!).name).toBe('Baseline 20-module swarm');
    useFleet.getState().saveScenario('x');
    expect(useFleet.getState().notice).toMatch(/invalid/);
  });
});
```

`src/ui/format.test.ts`:
```ts
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
```

`src/ui/panelDefs.test.ts`:
```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/state src/ui`
Expected: FAIL, cannot resolve modules.

- [ ] **Step 3: Implement state and workers**

`src/state/store.ts`:
```ts
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
```

`src/state/useAnimationLoop.ts`:
```ts
import { useEffect, useRef } from 'react';

export function useAnimationLoop(active: boolean, cb: (dtSec: number) => void): void {
  const cbRef = useRef(cb);
  cbRef.current = cb;
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      cbRef.current(dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active]);
}
```

`src/workers/protocol.ts`:
```ts
import type { SimConfig } from '../model/config';
import type { AnnualResult } from '../model/annual';
import type { Econ } from '../model/economics';
import type { Axis, Range, SweepResult, ParetoResult, TornadoResult } from '../model/optimizer';

export interface AnnualRequest { id: number; cfg: SimConfig }
export type AnnualResponse = { id: number; annual: AnnualResult; econ: Econ } | { id: number; error: string };

export type OptRequest =
  | { id: number; kind: 'sweep'; cfg: SimConfig; ax: Axis; ay: Axis }
  | { id: number; kind: 'pareto'; cfg: SimConfig; ranges: Range[]; n: number; seed: number }
  | { id: number; kind: 'tornado'; cfg: SimConfig };

export type OptResult =
  | { id: number; kind: 'sweep'; result: SweepResult }
  | { id: number; kind: 'pareto'; result: ParetoResult }
  | { id: number; kind: 'tornado'; result: TornadoResult };

export type OptResponse = OptResult | { id: number; kind: 'progress'; done: number; total: number } | { id: number; kind: 'error'; error: string };

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type OptJob = DistributiveOmit<OptRequest, 'id'>;
```

`src/workers/annual.worker.ts`:
```ts
import { runAnnual } from '../model/annual';
import { economics } from '../model/economics';
import type { AnnualRequest, AnnualResponse } from './protocol';

const ctx = self as unknown as { postMessage(m: AnnualResponse): void; onmessage: ((e: MessageEvent<AnnualRequest>) => void) | null };

ctx.onmessage = (e) => {
  const { id, cfg } = e.data;
  try {
    const annual = runAnnual(cfg, 'full');
    ctx.postMessage({ id, annual, econ: economics(cfg, annual) });
  } catch (err) {
    ctx.postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};
```

`src/workers/optimizer.worker.ts`:
```ts
import { sweep, pareto, tornado } from '../model/optimizer';
import type { OptRequest, OptResponse } from './protocol';

const ctx = self as unknown as { postMessage(m: OptResponse): void; onmessage: ((e: MessageEvent<OptRequest>) => void) | null };

ctx.onmessage = (e) => {
  const req = e.data;
  const progress = (done: number, total: number) => ctx.postMessage({ id: req.id, kind: 'progress', done, total });
  try {
    if (req.kind === 'sweep') ctx.postMessage({ id: req.id, kind: 'sweep', result: sweep(req.cfg, req.ax, req.ay, progress) });
    else if (req.kind === 'pareto') ctx.postMessage({ id: req.id, kind: 'pareto', result: pareto(req.cfg, req.ranges, req.n, req.seed, progress) });
    else ctx.postMessage({ id: req.id, kind: 'tornado', result: tornado(req.cfg, progress) });
  } catch (err) {
    ctx.postMessage({ id: req.id, kind: 'error', error: err instanceof Error ? err.message : String(err) });
  }
};
```

`src/state/useAnnualRunner.ts`:
```ts
import { useEffect, useRef } from 'react';
import { useFleet } from './store';
import type { AnnualResponse } from '../workers/protocol';

/** Re-runs the 365-day model in a worker 350 ms after the config stops changing. */
export function useAnnualRunner(): void {
  const cfg = useFleet((s) => s.cfg);
  const workerRef = useRef<Worker | null>(null);
  const reqRef = useRef(0);
  const busyRef = useRef(false);

  useEffect(
    () => () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    },
    [],
  );

  useEffect(() => {
    const handle = setTimeout(() => {
      if (busyRef.current && workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      if (!workerRef.current) {
        const w = new Worker(new URL('../workers/annual.worker.ts', import.meta.url), { type: 'module' });
        w.onmessage = (e: MessageEvent<AnnualResponse>) => {
          const r = e.data;
          if (r.id !== reqRef.current) return;
          busyRef.current = false;
          if ('error' in r) useFleet.getState().setRunError(r.error);
          else useFleet.getState().setResults(r.annual, r.econ);
        };
        w.onerror = (e) => {
          busyRef.current = false;
          useFleet.getState().setRunError(e.message || 'Annual model failed');
        };
        workerRef.current = w;
      }
      const id = ++reqRef.current;
      busyRef.current = true;
      useFleet.getState().setRunning(true);
      workerRef.current.postMessage({ id, cfg });
    }, 350);
    return () => clearTimeout(handle);
  }, [cfg]);
}
```

`src/state/useOptimizer.ts`:
```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import type { OptJob, OptResponse, OptResult } from '../workers/protocol';

interface OptState {
  busy: boolean;
  progress: [number, number] | null;
  response: OptResult | null;
  error: string | null;
}

/** Runs one optimizer job at a time in a fresh worker; starting a new job cancels the old one. */
export function useOptimizer() {
  const workerRef = useRef<Worker | null>(null);
  const idRef = useRef(0);
  const [state, setState] = useState<OptState>({ busy: false, progress: null, response: null, error: null });

  useEffect(
    () => () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    },
    [],
  );

  const run = useCallback((job: OptJob) => {
    workerRef.current?.terminate();
    const w = new Worker(new URL('../workers/optimizer.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = w;
    const id = ++idRef.current;
    w.onmessage = (e: MessageEvent<OptResponse>) => {
      const m = e.data;
      if (m.id !== idRef.current) return;
      if (m.kind === 'progress') setState((s) => ({ ...s, progress: [m.done, m.total] }));
      else if (m.kind === 'error') setState({ busy: false, progress: null, response: null, error: m.error });
      else setState({ busy: false, progress: null, response: m, error: null });
    };
    w.onerror = (e) => setState((s) => ({ ...s, busy: false, error: e.message || 'Optimizer failed' }));
    setState((s) => ({ ...s, busy: true, progress: null, error: null }));
    w.postMessage({ ...job, id });
  }, []);

  return { ...state, run };
}
```

- [ ] **Step 4: Implement formatting, controls and panel definitions**

`src/ui/format.ts`:
```ts
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
```

`src/ui/controls.tsx`:
```tsx
import { useEffect, useState, type ReactNode } from 'react';

const decimals = (step: number) => Math.min(6, Math.max(0, -Math.floor(Math.log10(step))));
const show = (v: number, step: number) => String(Number(v.toFixed(decimals(step))));

export interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  estimate?: boolean;
  title?: string;
  onChange(v: number): void;
}

export function Slider({ label, value, min, max, step, unit, estimate, title, onChange }: SliderProps) {
  const [text, setText] = useState(show(value, step));
  useEffect(() => setText(show(value, step)), [value, step]);
  const commit = (raw: string) => {
    const x = Number(raw);
    if (raw.trim() === '' || !Number.isFinite(x)) {
      setText(show(value, step));
      return;
    }
    const clamped = Math.min(max, Math.max(min, x));
    const snapped = Number((Math.round((clamped - min) / step) * step + min).toFixed(decimals(step)));
    onChange(Math.min(max, snapped));
  };
  return (
    <div className="slider" title={title}>
      <div className="slider-head">
        <span className="slider-label">
          {label}
          {estimate && <span className="badge est" title="Estimate: no direct source">EST</span>}
        </span>
        <span className="slider-value">
          <input
            type="number"
            value={text}
            step={step}
            aria-label={`${label} value`}
            onChange={(e) => setText(e.target.value)}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit((e.target as HTMLInputElement).value);
            }}
          />
          {unit && <span className="unit">{unit}</span>}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={Math.min(max, Math.max(min, value))} aria-label={label} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

export function Select({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange(v: string): void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange(v: boolean): void }) {
  return (
    <label className="field toggle-field">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function Section({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: ReactNode }) {
  return (
    <details className="section" open={defaultOpen}>
      <summary>{title}</summary>
      <div className="section-body">{children}</div>
    </details>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className={`stat ${tone ?? ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}
```

`src/ui/panelDefs.ts`:
```ts
import type { PresetKind } from '../model/defaults';

export type ParamItem =
  | { kind: 'slider'; path: string; label: string; min: number; max: number; step: number; unit?: string; scale?: number }
  | { kind: 'preset'; preset: PresetKind; label: string }
  | { kind: 'select'; path: string; label: string; options: { value: string; label: string }[] }
  | { kind: 'toggle'; path: string; label: string };

export interface PanelDef {
  title: string;
  items: ParamItem[];
}

const sl = (path: string, label: string, min: number, max: number, step: number, unit?: string, scale?: number): ParamItem => ({
  kind: 'slider', path, label, min, max, step, unit, scale,
});

export const PANEL_DEFS: PanelDef[] = [
  {
    title: 'Hull and petals',
    items: [
      sl('hull.sideM', 'Hull side', 0.5, 5, 0.01, 'm'),
      sl('hull.draftM', 'Draft', 0.1, 3, 0.05, 'm'),
      sl('hull.petalCount', 'Petal count', 0, 16, 1),
      sl('hull.petalLengthM', 'Petal length', 0, 3, 0.05, 'm'),
      sl('hull.petalWidthM', 'Petal width', 0.1, 2, 0.05, 'm'),
      {
        kind: 'select', path: 'hull.tracking', label: 'Sun tracking',
        options: [
          { value: 'flat', label: 'Flat (no tracking)' },
          { value: 'yaw', label: 'Rotate hull to face the sun, fixed tilt' },
          { value: 'dual', label: 'Rotate and tilt petals (two-axis)' },
        ],
      },
      sl('hull.fixedTiltDeg', 'Fixed tilt', 0, 60, 1, 'deg'),
      sl('hull.maxTiltDeg', 'Max petal tilt', 0, 80, 1, 'deg'),
      sl('hull.dragCd', 'Hull drag coefficient', 0.3, 2.5, 0.05),
      sl('hull.massKg', 'Hull mass', 10, 1000, 5, 'kg'),
      sl('hull.podVolumeL', 'Pod volume', 5, 1000, 5, 'L'),
      sl('hull.podMassKg', 'Pod mass', 1, 500, 1, 'kg'),
      sl('loads.avionicsW', 'Avionics power', 0, 200, 1, 'W'),
      sl('loads.actuatorW', 'Tracking actuator power', 0, 200, 1, 'W'),
    ],
  },
  {
    title: 'Solar',
    items: [
      { kind: 'preset', preset: 'panel', label: 'Panel' },
      sl('panel.efficiency', 'Efficiency', 5, 50, 0.1, '%', 100),
      sl('panel.usdPerW', 'Price', 0, 15, 0.01, '$/W'),
      sl('panel.kgPerM2', 'Areal mass', 0.5, 30, 0.1, 'kg/m²'),
      sl('panel.tempCoeffPerC', 'Temperature coefficient', -1, 0, 0.01, '%/°C', 100),
      sl('pv.mpptEff', 'MPPT efficiency', 80, 100, 0.5, '%', 100),
      sl('pv.waterTempC', 'Water temperature', 0, 35, 0.5, '°C'),
      sl('pv.cellTempRiseC', 'Cell temperature rise', 0, 40, 1, '°C'),
    ],
  },
  {
    title: 'Battery',
    items: [
      { kind: 'preset', preset: 'battery', label: 'Battery' },
      sl('battery.kwh', 'Capacity', 0, 60, 0.5, 'kWh'),
      sl('battery.usdPerKwh', 'Price', 0, 1000, 1, '$/kWh'),
      sl('battery.whPerKg', 'Specific energy', 20, 400, 1, 'Wh/kg'),
      sl('battery.rte', 'Round-trip efficiency', 50, 100, 0.5, '%', 100),
      sl('battery.cycleLife', 'Cycle life', 100, 20000, 100, 'cycles'),
      sl('battery.dod', 'Usable depth of discharge', 10, 100, 1, '%', 100),
    ],
  },
  {
    title: 'Compute',
    items: [
      { kind: 'preset', preset: 'accelerator', label: 'Accelerator' },
      sl('compute.cards', 'Cards per module', 0, 32, 1),
      {
        kind: 'select', path: 'compute.policy', label: 'Operating policy',
        options: [
          { value: 'firm', label: 'Firm 24/7 plus spot surplus' },
          { value: 'daylight', label: 'Daylight only (spot)' },
          { value: 'max', label: 'Max throughput (spot)' },
        ],
      },
      sl('compute.firmComputeW', 'Firm commitment', 0, 3000, 10, 'W'),
      sl('compute.tdpW', 'Card TDP', 1, 1200, 1, 'W'),
      sl('compute.denseTflops', 'Dense TFLOPS per card', 0, 2500, 1, 'TFLOPS'),
      sl('compute.priceUsd', 'Card price', 0, 60000, 50, '$'),
      sl('compute.hostW', 'Host power', 0, 500, 1, 'W'),
      sl('compute.coolingOverhead', 'Cooling overhead', 0, 50, 0.5, '%', 100),
    ],
  },
  {
    title: 'Starlink and network',
    items: [
      { kind: 'preset', preset: 'terminal', label: 'Terminal' },
      { kind: 'preset', preset: 'plan', label: 'Data plan' },
      sl('comms.modulesPerTerminal', 'Modules per terminal', 1, 20, 1),
      sl('comms.terminalW', 'Terminal power', 0, 200, 0.5, 'W'),
      sl('comms.downMbps', 'Downlink per terminal', 0, 300, 1, 'Mbps'),
      sl('comms.upMbps', 'Uplink per terminal', 0, 60, 0.5, 'Mbps'),
      sl('comms.planCapGB', 'Plan data cap', 0, 5000, 10, 'GB/mo'),
      sl('comms.planUsdPerMonth', 'Plan price', 0, 5000, 10, '$/mo'),
      { kind: 'toggle', path: 'comms.buyOverage', label: 'Buy data beyond the cap instead of throttling' },
      sl('comms.radioW', 'In-swarm radio power', 0, 50, 0.5, 'W'),
      sl('comms.radioRangeM', 'In-swarm radio range', 10, 20000, 10, 'm'),
    ],
  },
  {
    title: 'Propulsion',
    items: [
      { kind: 'preset', preset: 'thruster', label: 'Thruster' },
      sl('propulsion.count', 'Thrusters per module', 0, 8, 1),
      sl('propulsion.propEff', 'Propulsive efficiency', 5, 90, 1, '%', 100),
    ],
  },
  {
    title: 'Environment (offshore Los Angeles)',
    items: [
      sl('env.currentMs', 'Mean current', 0, 1.5, 0.01, 'm/s'),
      sl('env.currentHeadingDeg', 'Current heading (toward)', 0, 360, 1, 'deg'),
      sl('env.currentVariabilityMs', 'Current variability', 0, 0.6, 0.01, 'm/s'),
      sl('env.tidalMs', 'Tidal current', 0, 0.5, 0.01, 'm/s'),
      sl('env.windMeanMs', 'Mean wind', 0, 15, 0.1, 'm/s'),
      sl('env.stowWindMs', 'Petal stow wind', 0, 30, 0.1, 'm/s'),
      sl('env.marineLayerStrength', 'Marine layer strength', 0, 1.5, 0.05, 'x'),
      sl('env.dayVariability', 'Day-to-day variability', 0, 1.5, 0.05, 'x'),
      sl('env.cloudCellKm', 'Cloud cell size', 1, 200, 1, 'km'),
      sl('env.cloudCellAmp', 'Cloud cell strength', 0, 60, 1, '%', 100),
      sl('env.cloudDriftMs', 'Cloud drift speed', 0, 20, 0.1, 'm/s'),
      sl('env.cloudDriftHeadingDeg', 'Cloud drift heading', 0, 360, 1, 'deg'),
      sl('env.disturbanceMs', 'Wave drift disturbance', 0, 0.3, 0.005, 'm/s'),
      sl('seed', 'Random seed', 0, 9999, 1),
    ],
  },
  {
    title: 'Swarm',
    items: [
      sl('swarm.count', 'Modules', 1, 100, 1),
      {
        kind: 'select', path: 'swarm.strategy', label: 'Swarm strategy',
        options: [
          { value: 'station', label: 'Hold position' },
          { value: 'drift', label: 'Drift with the current' },
          { value: 'seek', label: 'Seek sunlight (cloud avoidance)' },
        ],
      },
      sl('swarm.spacingM', 'Spacing', 10, 2000, 5, 'm'),
      sl('swarm.toleranceM', 'Tolerance radius', 1, 500, 1, 'm'),
      sl('swarm.breakawayM', 'Breakaway distance', 5, 3000, 5, 'm'),
      sl('swarm.cruiseMs', 'Swarm cruise speed', 0, 1, 0.01, 'm/s'),
      sl('swarm.horizonH', 'Seek horizon', 0.5, 12, 0.5, 'h'),
      sl('swarm.replanMin', 'Seek replan interval', 5, 360, 5, 'min'),
      sl('swarm.minOffshoreKm', 'Min distance offshore', 0, 300, 1, 'km'),
      sl('swarm.maxOffshoreKm', 'Max distance offshore', 1, 400, 1, 'km'),
    ],
  },
  {
    title: 'Jobs and demand',
    items: [
      sl('jobs.arrivalsPerHour', 'Job arrivals (swarm)', 0, 20000, 10, 'jobs/h'),
      sl('jobs.mixInference', 'Batch inference share', 0, 100, 1, '%', 100),
      sl('jobs.mixTraining', 'Fine-tune share', 0, 100, 1, '%', 100),
      sl('jobs.mixDataHeavy', 'Data-heavy share', 0, 100, 1, '%', 100),
      sl('jobs.checkpointMin', 'Checkpoint interval', 1, 240, 1, 'min'),
    ],
  },
  {
    title: 'Pricing and economics',
    items: [
      sl('econ.firmUsdPerGpuH', 'Firm price', 0, 20, 0.01, '$/GPU-h'),
      sl('econ.spotUsdPerGpuH', 'Spot price', 0, 20, 0.01, '$/GPU-h'),
      sl('econ.slaTarget', 'Firm SLA target', 0, 100, 0.1, '%', 100),
      sl('econ.slaPenaltyMultiple', 'SLA penalty multiple', 0, 10, 0.1, 'x'),
      sl('econ.hullUsd', 'Hull cost', 0, 100000, 100, '$'),
      sl('econ.podUsd', 'Pod cost', 0, 50000, 50, '$'),
      sl('econ.heatExchangerUsd', 'Heat exchanger cost', 0, 10000, 50, '$'),
      sl('econ.petalUsdPerM2', 'Petal structure cost', 0, 2000, 10, '$/m²'),
      sl('econ.mpptUsdPerW', 'MPPT cost', 0, 1, 0.001, '$/W'),
      sl('econ.gnssUsd', 'GNSS cost', 0, 2000, 1, '$'),
      sl('econ.avionicsUsd', 'Avionics cost', 0, 10000, 10, '$'),
      sl('econ.hostUsd', 'Host board cost', 0, 20000, 50, '$'),
      sl('econ.batteryIntegrationUplift', 'Battery integration uplift', 1, 5, 0.05, 'x'),
      sl('econ.integrationPct', 'Integration uplift', 0, 100, 1, '%', 100),
      sl('econ.contingencyPct', 'Contingency', 0, 100, 1, '%', 100),
      sl('econ.sparesPct', 'Spare modules', 0, 100, 1, '%', 100),
      sl('econ.deploymentVesselDays', 'Deployment vessel days', 0, 60, 1, 'days'),
      sl('econ.vesselDayUsd', 'Vessel day rate', 0, 100000, 500, '$/day'),
      sl('econ.maintenanceVisitsPerYear', 'Service visits per year', 0, 52, 1, '/yr'),
      sl('econ.visitUsd', 'Cost per service visit', 0, 200000, 500, '$'),
      sl('econ.insurancePct', 'Insurance', 0, 50, 0.5, '%/yr', 100),
      sl('econ.moduleLossRate', 'Module loss rate', 0, 100, 0.5, '%/yr', 100),
      sl('econ.acceleratorRefreshYears', 'Accelerator refresh', 1, 20, 1, 'yr'),
      sl('econ.discountRate', 'Discount rate', 0, 100, 0.5, '%', 100),
      sl('econ.horizonYears', 'Horizon', 1, 30, 1, 'yr'),
    ],
  },
];

/** Slider bounds in config units, used to clamp optimizer range inputs. */
export const SLIDER_BOUNDS: Record<string, [number, number]> = Object.fromEntries(
  PANEL_DEFS.flatMap((p) => p.items.flatMap((i) => (i.kind === 'slider' ? [[i.path, [i.min / (i.scale ?? 1), i.max / (i.scale ?? 1)]] as [string, [number, number]]] : []))),
);

export const PARAM_LABELS: Record<string, string> = Object.fromEntries(
  PANEL_DEFS.flatMap((p) => p.items.flatMap((i) => (i.kind === 'preset' ? [] : [[i.path, i.label] as [string, string]]))),
);
```

- [ ] **Step 5: Implement the shell components**

`src/ui/ParamPanels.tsx`:
```tsx
import { useFleet } from '../state/store';
import { getPath, type SimConfig } from '../model/config';
import { PRESET_FIELDS, PRESET_LISTS, sourceFor } from '../model/defaults';
import { PANEL_DEFS, type ParamItem } from './panelDefs';
import { Slider, Select, Toggle, Section } from './controls';

function Item({ item, cfg }: { item: ParamItem; cfg: SimConfig }) {
  const st = useFleet.getState;
  if (item.kind === 'slider') {
    const k = item.scale ?? 1;
    const src = sourceFor(cfg, item.path);
    return (
      <Slider
        label={item.label}
        value={(getPath(cfg, item.path) as number) * k}
        min={item.min}
        max={item.max}
        step={item.step}
        unit={item.unit}
        estimate={!!src?.estimate}
        title={src ? `Source: ${src.source}${src.note ? `. ${src.note}` : ''}` : undefined}
        onChange={(v) => st().update(item.path, Number((v / k).toPrecision(12)))}
      />
    );
  }
  if (item.kind === 'preset') {
    const { presetPath } = PRESET_FIELDS[item.preset];
    return (
      <Select
        label={item.label}
        value={getPath(cfg, presetPath) as string}
        options={PRESET_LISTS[item.preset].map((p) => ({ value: p.id, label: p.name }))}
        onChange={(id) => st().preset(item.preset, id)}
      />
    );
  }
  if (item.kind === 'select') {
    return <Select label={item.label} value={getPath(cfg, item.path) as string} options={item.options} onChange={(v) => st().update(item.path, v)} />;
  }
  return <Toggle label={item.label} checked={getPath(cfg, item.path) as boolean} onChange={(v) => st().update(item.path, v)} />;
}

export function ParamPanels() {
  const cfg = useFleet((s) => s.cfg);
  return (
    <div className="panels">
      {PANEL_DEFS.map((p, i) => (
        <Section key={p.title} title={p.title} defaultOpen={i === 0}>
          {p.items.map((item) => (
            <Item key={item.kind === 'preset' ? `preset:${item.preset}` : item.path} item={item} cfg={cfg} />
          ))}
        </Section>
      ))}
    </div>
  );
}
```

`src/ui/Header.tsx`:
```tsx
import { useRef, useState } from 'react';
import { useFleet } from '../state/store';
import { ConfigSchema, parseConfig } from '../model/config';

type Theme = 'auto' | 'light' | 'dark';

export function Header() {
  const cfg = useFleet((s) => s.cfg);
  const scenarios = useFleet((s) => s.scenarios);
  const investor = useFleet((s) => s.investor);
  const notice = useFleet((s) => s.notice);
  const running = useFleet((s) => s.running);
  const st = useFleet.getState;
  const fileRef = useRef<HTMLInputElement>(null);
  const [theme, setTheme] = useState<Theme>('auto');

  const cycleTheme = () => {
    const next: Theme = theme === 'auto' ? 'dark' : theme === 'dark' ? 'light' : 'auto';
    setTheme(next);
    if (next === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', next);
  };

  const exportJson = () => {
    const check = ConfigSchema.safeParse(cfg);
    if (!check.success) {
      st().setNotice(`Fix these inputs before exporting: ${check.error.issues.map((i) => i.path.join('.')).join(', ')}`);
      return;
    }
    const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fleet-${cfg.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'scenario'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file: File) => {
    try {
      const r = parseConfig(JSON.parse(await file.text()));
      if (r.ok) {
        st().replace(r.config);
        st().setNotice(`Imported "${r.config.name}".`);
      } else {
        st().setNotice(`Import failed. ${r.errors.slice(0, 6).join('; ')}${r.errors.length > 6 ? ` (and ${r.errors.length - 6} more)` : ''}`);
      }
    } catch (e) {
      st().setNotice(`Import failed. ${(e as Error).message}`);
    }
  };

  return (
    <>
      <header className="header">
        <div className="brand">Fleet</div>
        <input className="scenario-name" value={cfg.name} aria-label="Scenario name" onChange={(e) => st().update('name', e.target.value)} />
        <select aria-label="Saved scenarios" value="" onChange={(e) => e.target.value && st().loadScenario(e.target.value)}>
          <option value="">Load scenario</option>
          {Object.keys(scenarios).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <button onClick={() => st().saveScenario(cfg.name)}>Save</button>
        <button onClick={exportJson}>Export JSON</button>
        <button onClick={() => fileRef.current?.click()}>Import</button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importJson(f);
            e.target.value = '';
          }}
        />
        <button onClick={() => st().reset()}>Reset defaults</button>
        <span className="spacer" />
        {running && <span className="running">Running annual model</span>}
        <button onClick={cycleTheme} aria-label="Change theme">Theme: {theme}</button>
        <label className="investor-toggle">
          <input type="checkbox" checked={investor} onChange={(e) => st().setInvestor(e.target.checked)} /> Investor view
        </label>
      </header>
      {notice && (
        <div className="notice" role="status">
          <span>{notice}</span>
          <button onClick={() => st().setNotice(null)} aria-label="Dismiss">
            Dismiss
          </button>
        </div>
      )}
    </>
  );
}
```

`src/ui/KpiStrip.tsx`:
```tsx
import { useMemo, useState } from 'react';
import { useFleet } from '../state/store';
import { derive } from '../model/derive';
import { feasibility } from '../model/feasibility';
import { BINDING_LABEL, fmtCompact, fmtMonths, fmtPct, fmtUsd, fmtUsdCompact, topBinding } from './format';

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className={`kpi ${tone ?? ''}`}>
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      {sub && <span className="kpi-sub">{sub}</span>}
    </div>
  );
}

export function KpiStrip() {
  const cfg = useFleet((s) => s.cfg);
  const annual = useFleet((s) => s.annual);
  const econ = useFleet((s) => s.econ);
  const runError = useFleet((s) => s.runError);
  const [open, setOpen] = useState(false);
  const d = useMemo(() => derive(cfg), [cfg]);
  const flags = useMemo(() => feasibility(cfg, d, annual, econ), [cfg, d, annual, econ]);
  const binding = annual ? topBinding(annual.totals.bindingH) : null;
  const pending = 'Calculating';
  const hasError = flags.some((f) => f.severity === 'error');

  return (
    <div className="kpi-wrap">
      <div className="kpis">
        <Kpi label="Compute delivered" value={econ ? `${fmtCompact(econ.annualPflopHours)} PFLOP-h/yr` : pending} sub={econ ? `${fmtCompact(econ.gpuHours)} GPU-hours` : undefined} />
        <Kpi label="Binding constraint" value={binding ? BINDING_LABEL[binding.key] : pending} sub={binding ? `${fmtPct(binding.share)} of hours` : undefined} tone={binding ? `bind-${binding.key}` : undefined} />
        <Kpi label="Cost per GPU-hour" value={econ ? fmtUsd(econ.costPerGpuHour, 2) : pending} sub={econ ? `Market ${fmtUsd(econ.marketFirm, 2)} firm, ${fmtUsd(econ.marketSpot, 2)} spot` : undefined} />
        <Kpi label="Gross margin per year" value={econ ? fmtUsdCompact(econ.grossMargin) : pending} sub={econ ? `${fmtUsd(econ.marginPerGpuHour, 2)} per GPU-hour after capital` : undefined} tone={econ && econ.grossMargin < 0 ? 'negative' : undefined} />
        <Kpi label="Payback" value={econ ? fmtMonths(econ.paybackMonths) : pending} sub={econ ? `Capex ${fmtUsdCompact(econ.capex.total)}` : undefined} />
        <button className={`kpi flags ${hasError ? 'has-error' : flags.length ? 'has-warn' : 'clear'}`} onClick={() => setOpen(!open)} aria-expanded={open}>
          <span className="kpi-label">Feasibility</span>
          <span className="kpi-value">{flags.length ? `${flags.length} flag${flags.length > 1 ? 's' : ''}` : 'All clear'}</span>
          <span className="kpi-sub">{flags.length ? 'Show details' : 'No red flags'}</span>
        </button>
      </div>
      {open && flags.length > 0 && (
        <ul className="flag-list">
          {flags.map((f) => (
            <li key={f.id} className={f.severity}>
              <strong>{f.severity === 'error' ? 'Error' : 'Warning'}:</strong> {f.message}
            </li>
          ))}
        </ul>
      )}
      {runError && <div className="run-error">Annual run failed: {runError}. Showing the last good results.</div>}
    </div>
  );
}
```

`src/ui/Tabs.tsx`:
```tsx
import { useFleet, type TabId } from '../state/store';

export const TABS: { id: TabId; label: string }[] = [
  { id: 'map', label: 'Swarm Map' },
  { id: 'module', label: 'Module' },
  { id: 'energy', label: 'Energy' },
  { id: 'economics', label: 'Economics' },
  { id: 'optimizer', label: 'Optimizer' },
  { id: 'assumptions', label: 'Assumptions' },
];

export function Tabs() {
  const tab = useFleet((s) => s.tab);
  return (
    <nav className="tabs" role="tablist">
      {TABS.map((t) => (
        <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'active' : ''} onClick={() => useFleet.getState().setTab(t.id)}>
          {t.label}
        </button>
      ))}
    </nav>
  );
}
```

`src/ui/MainContent.tsx` (later tasks replace cases in `renderTab` and the investor branch):
```tsx
import { useFleet, type TabId } from '../state/store';
import { Tabs } from './Tabs';

function Pending({ what }: { what: string }) {
  return (
    <section className="card">
      <p className="muted">{what} is not built yet.</p>
    </section>
  );
}

function renderTab(tab: TabId) {
  switch (tab) {
    default:
      return <Pending what="This view" />;
  }
}

export function MainContent() {
  const tab = useFleet((s) => s.tab);
  const investor = useFleet((s) => s.investor);
  if (investor) return <Pending what="The investor view" />;
  return (
    <>
      <Tabs />
      <div className="tab-body">{renderTab(tab)}</div>
    </>
  );
}
```

`src/App.tsx`:
```tsx
import { useAnnualRunner } from './state/useAnnualRunner';
import { useFleet } from './state/store';
import { Header } from './ui/Header';
import { KpiStrip } from './ui/KpiStrip';
import { ParamPanels } from './ui/ParamPanels';
import { MainContent } from './ui/MainContent';

export default function App() {
  useAnnualRunner();
  const investor = useFleet((s) => s.investor);
  return (
    <div className="app">
      <Header />
      <KpiStrip />
      <div className={`body${investor ? ' investor' : ''}`}>
        {!investor && (
          <aside className="side" aria-label="Parameters">
            <ParamPanels />
          </aside>
        )}
        <main className="main">
          <MainContent />
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Write the stylesheet**

`src/styles.css`:
```css
:root {
  --bg: #f3f6f8; --panel: #ffffff; --panel-2: #e9eff3; --text: #102030; --muted: #5b6d7a; --border: #d3dde4;
  --accent: #0b7a75; --accent-2: #1f5fa8; --warn: #a35f00; --error: #b3261e; --ok: #2e7d32;
  --ocean: #cfe2ec; --land: #e8e3d6; --land-edge: #b6ad97; --cloud: 255, 255, 255; --fence: 179, 38, 30;
  --c1: #0b7a75; --c2: #1f5fa8; --c3: #c26b00; --c4: #7b4bb7; --c5: #b3261e; --c6: #5b6d7a;
  --font: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --radius: 8px;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #0b1620; --panel: #10202c; --panel-2: #152a38; --text: #e3edf3; --muted: #8aa0b0; --border: #22394a;
    --accent: #3cc4bc; --accent-2: #6aa8f0; --warn: #f0a940; --error: #f2766d; --ok: #6cc070;
    --ocean: #0d2a3d; --land: #1d2a2f; --land-edge: #3b4c52; --cloud: 230, 240, 248; --fence: 242, 118, 109;
    --c1: #3cc4bc; --c2: #6aa8f0; --c3: #f0a940; --c4: #b18cf0; --c5: #f2766d; --c6: #8aa0b0;
    color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  --bg: #0b1620; --panel: #10202c; --panel-2: #152a38; --text: #e3edf3; --muted: #8aa0b0; --border: #22394a;
  --accent: #3cc4bc; --accent-2: #6aa8f0; --warn: #f0a940; --error: #f2766d; --ok: #6cc070;
  --ocean: #0d2a3d; --land: #1d2a2f; --land-edge: #3b4c52; --cloud: 230, 240, 248; --fence: 242, 118, 109;
  --c1: #3cc4bc; --c2: #6aa8f0; --c3: #f0a940; --c4: #b18cf0; --c5: #f2766d; --c6: #8aa0b0;
  color-scheme: dark;
}

* { box-sizing: border-box; }
html, body, #root { height: 100%; margin: 0; }
body { background: var(--bg); color: var(--text); font: 14px/1.45 var(--font); }
button, input, select { font: inherit; color: inherit; }
button {
  background: var(--panel-2); border: 1px solid var(--border); border-radius: 6px; padding: 5px 10px; cursor: pointer;
}
button:hover:not(:disabled) { border-color: var(--accent); }
button:disabled { opacity: 0.5; cursor: default; }
button.primary { background: var(--accent); border-color: var(--accent); color: var(--panel); }
select, input[type="number"], input[type="text"], .scenario-name {
  background: var(--panel); border: 1px solid var(--border); border-radius: 6px; padding: 4px 6px;
}
a { color: var(--accent-2); }
.muted { color: var(--muted); }
.note { color: var(--muted); font-size: 13px; }

.app { display: flex; flex-direction: column; height: 100vh; }
.header { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 8px 16px; background: var(--panel); border-bottom: 1px solid var(--border); }
.brand { font-weight: 700; font-size: 18px; letter-spacing: 0.02em; color: var(--accent); margin-right: 8px; }
.scenario-name { min-width: 200px; }
.spacer { flex: 1; }
.running { color: var(--muted); font-size: 12px; }
.running::before { content: ""; display: inline-block; width: 8px; height: 8px; margin-right: 6px; border-radius: 50%; background: var(--accent); animation: pulse 1s infinite alternate; }
@keyframes pulse { from { opacity: 0.3; } to { opacity: 1; } }
.investor-toggle { display: flex; align-items: center; gap: 6px; }
.notice { display: flex; justify-content: space-between; gap: 12px; align-items: center; padding: 6px 16px; background: var(--panel-2); border-bottom: 1px solid var(--border); }

.kpi-wrap { background: var(--panel); border-bottom: 1px solid var(--border); padding: 8px 16px; }
.kpis { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px; }
.kpi { display: flex; flex-direction: column; text-align: left; padding: 8px 10px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--panel); min-width: 0; }
.kpi-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
.kpi-value { font-size: 18px; font-weight: 650; font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kpi-sub { font-size: 12px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kpi.negative .kpi-value { color: var(--error); }
.kpi.bind-power .kpi-value { color: var(--c3); }
.kpi.bind-bandwidth .kpi-value { color: var(--c2); }
.kpi.bind-demand .kpi-value { color: var(--c4); }
.kpi.flags.has-error { border-color: var(--error); }
.kpi.flags.has-error .kpi-value { color: var(--error); }
.kpi.flags.has-warn { border-color: var(--warn); }
.kpi.flags.has-warn .kpi-value { color: var(--warn); }
.kpi.flags.clear .kpi-value { color: var(--ok); }
.flag-list { margin: 8px 0 0; padding-left: 18px; }
.flag-list li.error { color: var(--error); }
.flag-list li.warn { color: var(--warn); }
.run-error { margin-top: 6px; color: var(--error); }

.body { flex: 1; min-height: 0; display: grid; grid-template-columns: 330px minmax(0, 1fr); }
.body.investor { grid-template-columns: minmax(0, 1fr); }
.side { overflow-y: auto; border-right: 1px solid var(--border); background: var(--panel); padding: 8px 12px 24px; }
.main { overflow-y: auto; padding: 12px 16px 32px; min-width: 0; }

.section { border-bottom: 1px solid var(--border); padding: 4px 0; }
.section > summary { cursor: pointer; font-weight: 600; padding: 6px 0; }
.section-body { display: flex; flex-direction: column; gap: 10px; padding: 4px 0 10px; }
.slider-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.slider-label { font-size: 13px; }
.slider-value { display: flex; align-items: center; gap: 4px; }
.slider-value input { width: 84px; text-align: right; font-variant-numeric: tabular-nums; }
.unit { color: var(--muted); font-size: 12px; min-width: 36px; }
.slider input[type="range"] { width: 100%; accent-color: var(--accent); }
.field { display: flex; flex-direction: column; gap: 4px; font-size: 13px; }
.toggle-field { flex-direction: row; align-items: center; gap: 8px; }
.badge { display: inline-block; margin-left: 6px; padding: 0 5px; border-radius: 4px; font-size: 10px; font-weight: 700; letter-spacing: 0.04em; vertical-align: middle; }
.badge.est { background: rgba(194, 107, 0, 0.15); color: var(--warn); }
.badge.custom { background: rgba(31, 95, 168, 0.15); color: var(--accent-2); }

.tabs { display: flex; flex-wrap: wrap; gap: 4px; border-bottom: 1px solid var(--border); margin-bottom: 12px; }
.tabs button { border: none; border-bottom: 2px solid transparent; border-radius: 0; background: none; padding: 8px 12px; }
.tabs button.active { border-bottom-color: var(--accent); color: var(--accent); font-weight: 600; }
.tab-body { display: flex; flex-direction: column; gap: 12px; }
.card { background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius); padding: 12px 14px; margin: 0; min-width: 0; }
.card > h2, .card > figcaption { font-size: 15px; font-weight: 600; margin: 0 0 8px; }
.grid2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.stats-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
.stat { background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius); padding: 8px 10px; }
.stat-label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
.stat-value { font-size: 17px; font-weight: 650; font-variant-numeric: tabular-nums; }
.stat-sub { font-size: 12px; color: var(--muted); }
.stat.good .stat-value { color: var(--ok); }
.stat.bad .stat-value { color: var(--error); }
table.data { width: 100%; border-collapse: collapse; font-size: 13px; }
table.data th, table.data td { text-align: left; padding: 5px 8px; border-bottom: 1px solid var(--border); vertical-align: top; }
table.data td.num, table.data th.num { text-align: right; font-variant-numeric: tabular-nums; }
.table-scroll { overflow-x: auto; }

@media (max-width: 1100px) {
  .kpis { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .grid2 { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 760px) {
  .body { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto 1fr; }
  .side { max-height: 40vh; border-right: none; border-bottom: 1px solid var(--border); }
  .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .header, .kpi-wrap, .main { padding-left: 16px; padding-right: 16px; }
}
```

- [ ] **Step 7: Run tests, typecheck and build**

Run: `npm test && npm run typecheck && npm run build`
Expected: all PASS; `vite build` emits `dist/` including two worker chunks.

- [ ] **Step 8: Smoke-check in the browser**

Run: `npm run dev` (in the background), open `http://localhost:5173`. Expected: header reads "Fleet", the KPI strip shows "Calculating" and then real numbers within a few seconds, sliders change values, and the KPIs update after you release a slider. Stop the dev server afterwards.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add app shell with store, annual and optimizer workers, parameter panels and KPI strip"
```

---
### Task 14: Swarm Map tab

Load `frontend-design` before this task.

**Files:**
- Create: `src/ui/map/canvasUtil.ts`, `src/ui/map/MapCanvas.tsx`, `src/ui/map/FormationCanvas.tsx`, `src/ui/tabs/SwarmMapTab.tsx`
- Modify: `src/ui/MainContent.tsx` (add the `map` case), `src/styles.css` (append map styles)

**Interfaces:**
- Consumes: `LiveSim`, `createLiveSim`, `stepLive`, `kickModule`, `clearSkyGhi`, `LAND_POLYGON`, `ISLANDS`, `MAP_BOUNDS`, `useAnimationLoop`, `useFleet`, format helpers, `Stat`.
- Produces: `SwarmMapTab` component; `cssVar(name)`, `setupCanvas(canvas)` helpers.

This task is UI with no unit-testable logic. It is verified with typecheck, build and a browser check.

- [ ] **Step 1: Canvas helpers**

`src/ui/map/canvasUtil.ts`:
```ts
export const cssVar = (name: string): string => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** Sizes the canvas backing store to its CSS size times devicePixelRatio. */
export function setupCanvas(c: HTMLCanvasElement | null): { g: CanvasRenderingContext2D; W: number; H: number } | null {
  if (!c) return null;
  const W = c.clientWidth;
  const H = c.clientHeight;
  if (W === 0 || H === 0) return null;
  const dpr = window.devicePixelRatio || 1;
  const bw = Math.round(W * dpr), bh = Math.round(H * dpr);
  if (c.width !== bw || c.height !== bh) {
    c.width = bw;
    c.height = bh;
  }
  const g = c.getContext('2d');
  if (!g) return null;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { g, W, H };
}
```

- [ ] **Step 2: Bight map canvas**

`src/ui/map/MapCanvas.tsx`:
```tsx
import { useEffect, useRef } from 'react';
import type { LiveSim } from '../../model/live';
import type { Env } from '../../model/environment';
import { clearSkyGhi } from '../../model/solar';
import { RAD } from '../../model/constants';
import { LAND_POLYGON, ISLANDS, MAP_BOUNDS } from '../../presets';
import { cssVar, setupCanvas } from './canvasUtil';

const GW = 64;
const GH = 44;

export function MapCanvas({ sim, frame }: { sim: LiveSim; frame: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const fence = useRef<{ key: string; mask: Uint8Array } | null>(null);
  const clouds = useRef<{ env: Env; bucket: number; ratio: Float32Array } | null>(null);

  useEffect(() => {
    const ctx = setupCanvas(ref.current);
    if (!ctx) return;
    const { g, W, H } = ctx;
    const B = MAP_BOUNDS;
    const px = (lat: number, lon: number) => ({
      x: ((lon - B.lonMin) / (B.lonMax - B.lonMin)) * W,
      y: ((B.latMax - lat) / (B.latMax - B.latMin)) * H,
    });
    const cellLL = (i: number, j: number) => ({
      lat: B.latMax - ((j + 0.5) * (B.latMax - B.latMin)) / GH,
      lon: B.lonMin + ((i + 0.5) * (B.lonMax - B.lonMin)) / GW,
    });
    const { env, cfg } = sim;

    const fkey = `${cfg.swarm.minOffshoreKm}|${cfg.swarm.maxOffshoreKm}|${cfg.env.originLat}|${cfg.env.originLon}`;
    if (!fence.current || fence.current.key !== fkey) {
      const mask = new Uint8Array(GW * GH);
      for (let j = 0; j < GH; j++) {
        for (let i = 0; i < GW; i++) {
          const ll = cellLL(i, j);
          const p = env.proj.toXY(ll.lat, ll.lon);
          const dk = env.offshoreKm(p.x, p.y);
          mask[j * GW + i] = dk < cfg.swarm.minOffshoreKm || dk > cfg.swarm.maxOffshoreKm ? 1 : 0;
        }
      }
      fence.current = { key: fkey, mask };
    }

    const sun = env.sun(sim.t);
    const bucket = Math.floor(sim.t / 1800000);
    if (!clouds.current || clouds.current.env !== env || clouds.current.bucket !== bucket) {
      const ratio = new Float32Array(GW * GH);
      const clear = clearSkyGhi(sun.zenithDeg);
      for (let j = 0; j < GH; j++) {
        for (let i = 0; i < GW; i++) {
          const ll = cellLL(i, j);
          const p = env.proj.toXY(ll.lat, ll.lon);
          ratio[j * GW + i] = clear > 1 ? env.ghi(sim.t, p.x, p.y) / clear : 0;
        }
      }
      clouds.current = { env, bucket, ratio };
    }

    g.fillStyle = cssVar('--ocean');
    g.fillRect(0, 0, W, H);
    const cw = W / GW, ch = H / GH;
    const cloudRgb = cssVar('--cloud');
    const fenceRgb = cssVar('--fence');
    const day = sun.elevationDeg > 0;
    for (let j = 0; j < GH; j++) {
      for (let i = 0; i < GW; i++) {
        const k = j * GW + i;
        if (day) {
          const a = Math.max(0, Math.min(0.75, (1 - clouds.current.ratio[k]) * 0.9));
          if (a > 0.02) {
            g.fillStyle = `rgba(${cloudRgb},${a.toFixed(3)})`;
            g.fillRect(i * cw, j * ch, cw + 0.5, ch + 0.5);
          }
        }
        if (fence.current.mask[k]) {
          g.fillStyle = `rgba(${fenceRgb},0.10)`;
          g.fillRect(i * cw, j * ch, cw + 0.5, ch + 0.5);
        }
      }
    }
    if (!day) {
      g.fillStyle = 'rgba(0, 0, 20, 0.35)';
      g.fillRect(0, 0, W, H);
    }

    g.beginPath();
    LAND_POLYGON.forEach(([la, lo], idx) => {
      const q = px(la, lo);
      if (idx) g.lineTo(q.x, q.y);
      else g.moveTo(q.x, q.y);
    });
    g.closePath();
    g.fillStyle = cssVar('--land');
    g.fill();
    g.strokeStyle = cssVar('--land-edge');
    g.lineWidth = 1;
    g.stroke();

    const kmX = W / ((B.lonMax - B.lonMin) * 111.32 * Math.cos(33.6 * RAD));
    const kmY = H / ((B.latMax - B.latMin) * 110.54);
    for (const isl of ISLANDS) {
      const q = px(isl.lat, isl.lon);
      g.beginPath();
      g.ellipse(q.x, q.y, Math.max(1.5, isl.rxKm * kmX), Math.max(1.5, isl.ryKm * kmY), 0, 0, 2 * Math.PI);
      g.fill();
      g.stroke();
    }

    const trail = sim.swarm.trail;
    if (trail.length > 1) {
      g.strokeStyle = cssVar('--accent-2');
      g.lineWidth = 1.5;
      g.beginPath();
      trail.forEach((p, idx) => {
        const ll = env.proj.toLatLon(p);
        const q = px(ll.lat, ll.lon);
        if (idx) g.lineTo(q.x, q.y);
        else g.moveTo(q.x, q.y);
      });
      g.stroke();
    }

    const cl = env.proj.toLatLon(sim.swarm.centroid);
    const q = px(cl.lat, cl.lon);
    g.fillStyle = cssVar('--accent');
    g.beginPath();
    g.arc(q.x, q.y, 6, 0, 2 * Math.PI);
    g.fill();
    g.strokeStyle = cssVar('--panel');
    g.lineWidth = 2;
    g.stroke();

    g.font = `12px ${cssVar('--font')}`;
    g.fillStyle = cssVar('--text');
    const label = (text: string, lat: number, lon: number, dx = 6, dy = -6) => {
      const p = px(lat, lon);
      g.fillText(text, p.x + dx, p.y + dy);
    };
    label('Los Angeles', 34.05, -118.24);
    label('San Diego', 32.72, -117.16);
    label('Fleet swarm', cl.lat, cl.lon, 10, 4);
    g.fillStyle = cssVar('--muted');
    g.fillText('White: cloud and marine layer. Red tint: outside the geofence.', 10, H - 10);
  }, [sim, frame]);

  return <canvas ref={ref} className="map-canvas" role="img" aria-label="Map of the swarm position, cloud cover and geofence off Southern California" />;
}
```

- [ ] **Step 3: Formation canvas**

`src/ui/map/FormationCanvas.tsx`:
```tsx
import { useEffect, useRef } from 'react';
import type { LiveSim } from '../../model/live';
import { add, type Vec } from '../../model/vec';
import { cssVar, setupCanvas } from './canvasUtil';

function niceMeters(v: number): number {
  const p = 10 ** Math.floor(Math.log10(Math.max(1, v)));
  const m = v / p;
  return (m >= 5 ? 5 : m >= 2 ? 2 : 1) * p;
}

function arrow(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: string) {
  const a = Math.atan2(y1 - y0, x1 - x0);
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.stroke();
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x1 - 8 * Math.cos(a - 0.4), y1 - 8 * Math.sin(a - 0.4));
  g.lineTo(x1 - 8 * Math.cos(a + 0.4), y1 - 8 * Math.sin(a + 0.4));
  g.closePath();
  g.fill();
}

function drawFlower(g: CanvasRenderingContext2D, x: number, y: number, r: number, petals: number, stowed: boolean, color: string) {
  g.save();
  g.translate(x, y);
  g.fillStyle = color;
  const pr = stowed ? r * 0.45 : r;
  g.globalAlpha = 0.85;
  for (let k = 0; k < petals; k++) {
    g.save();
    g.rotate((2 * Math.PI * k) / petals);
    g.beginPath();
    g.ellipse(pr * 0.55, 0, pr * 0.45, Math.max(1, pr * 0.18), 0, 0, 2 * Math.PI);
    g.fill();
    g.restore();
  }
  g.globalAlpha = 1;
  const s = Math.max(3, r * 0.45);
  g.fillRect(-s / 2, -s / 2, s, s);
  g.restore();
}

export function FormationCanvas({ sim, frame }: { sim: LiveSim; frame: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = setupCanvas(ref.current);
    if (!ctx) return;
    const { g, W, H } = ctx;
    const { swarm, params, cfg, flows } = sim;
    const c0 = swarm.centroid;
    const radius = Math.max(1, ...params.slots.map((s) => Math.hypot(s.x, s.y)));
    const extent = Math.max(radius + cfg.swarm.breakawayM * 1.2, 100);
    const k = Math.min(W, H) / (2 * extent);
    const toPx = (p: Vec) => ({ x: W / 2 + (p.x - c0.x) * k, y: H / 2 - (p.y - c0.y) * k });

    g.fillStyle = cssVar('--panel-2');
    g.fillRect(0, 0, W, H);

    g.setLineDash([4, 4]);
    g.globalAlpha = 0.6;
    g.strokeStyle = cssVar('--warn');
    g.lineWidth = 1;
    g.beginPath();
    g.arc(W / 2, H / 2, (radius + cfg.swarm.breakawayM) * k, 0, 2 * Math.PI);
    g.stroke();
    g.globalAlpha = 1;
    g.strokeStyle = cssVar('--border');
    for (const s of params.slots) {
      const q = toPx(add(c0, s));
      g.beginPath();
      g.arc(q.x, q.y, Math.max(2, cfg.swarm.toleranceM * k), 0, 2 * Math.PI);
      g.stroke();
    }
    g.setLineDash([]);

    const recent = sim.jobs.recentDone.filter((r) => sim.t - r.t <= sim.dtS * 2000);
    g.strokeStyle = cssVar('--c2');
    g.globalAlpha = 0.55;
    g.lineWidth = 1;
    for (const r of recent) {
      const m = swarm.modules[r.module];
      if (!m) continue;
      const q = toPx(m.pos);
      g.beginPath();
      g.moveTo(q.x, q.y);
      g.lineTo(q.x + 12, 0);
      g.stroke();
    }
    g.globalAlpha = 1;

    const accent = cssVar('--accent'), warn = cssVar('--warn'), muted = cssVar('--muted');
    const glyph = Math.max(5, (cfg.hull.sideM / 2 + cfg.hull.petalLengthM) * k);
    swarm.modules.forEach((m, i) => {
      const q = toPx(m.pos);
      const f = flows[i];
      const color = f && !f.online ? muted : m.stray ? warn : accent;
      drawFlower(g, q.x, q.y, glyph, cfg.hull.petalCount, sim.stowed, color);
    });

    const cur = sim.env.current(sim.t);
    const sp = Math.hypot(cur.x, cur.y);
    const L = Math.min(60, sp * 150);
    const ax = 60, ay = H - 44;
    if (sp > 0) arrow(g, ax, ay, ax + (cur.x / sp) * L, ay - (cur.y / sp) * L, cssVar('--accent-2'));
    g.font = `12px ${cssVar('--font')}`;
    g.fillStyle = cssVar('--text');
    g.fillText(`Current ${sp.toFixed(2)} m/s`, 16, H - 12);

    const nice = niceMeters(extent / 2);
    const bar = nice * k;
    g.strokeStyle = cssVar('--text');
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(W - 20 - bar, H - 20);
    g.lineTo(W - 20, H - 20);
    g.stroke();
    g.fillText(`${nice} m`, W - 20 - bar, H - 26);
    g.fillStyle = cssVar('--muted');
    g.fillText('Lines to the top edge: jobs returned over Starlink', 16, 18);
  }, [sim, frame]);

  return <canvas ref={ref} className="formation-canvas" role="img" aria-label="Zoomed view of the formation, tolerance rings, strays and returning jobs" />;
}
```

- [ ] **Step 4: Tab component**

`src/ui/tabs/SwarmMapTab.tsx`:
```tsx
import { useEffect, useRef, useState } from 'react';
import { useFleet } from '../../state/store';
import { useAnimationLoop } from '../../state/useAnimationLoop';
import { createLiveSim, stepLive, kickModule, type LiveSim } from '../../model/live';
import { dateLabel, localSolarHour } from '../../model/time';
import { MapCanvas } from '../map/MapCanvas';
import { FormationCanvas } from '../map/FormationCanvas';
import { Stat } from '../controls';
import { BINDING_LABEL, fmtHour, fmtNum, fmtPct } from '../format';

export function SwarmMapTab() {
  const cfg = useFleet((s) => s.cfg);
  const [doy, setDoy] = useState(172);
  const [speedLog, setSpeedLog] = useState(Math.log10(1200));
  const [playing, setPlaying] = useState(true);
  const simRef = useRef<LiveSim | null>(null);
  const accRef = useRef(0);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    simRef.current = createLiveSim(cfg, doy);
    accRef.current = 0;
    setFrame((f) => f + 1);
  }, [cfg, doy]);

  useAnimationLoop(playing, (dt) => {
    const s = simRef.current;
    if (!s) return;
    accRef.current += dt * 10 ** speedLog;
    let stepped = false;
    let guard = 0;
    while (accRef.current >= s.dtS && guard++ < 50) {
      if (s.done) {
        simRef.current = createLiveSim(cfg, doy);
        accRef.current = 0;
        stepped = true;
        break;
      }
      stepLive(s);
      accRef.current -= s.dtS;
      stepped = true;
    }
    if (stepped) setFrame((f) => f + 1);
  });

  const s = simRef.current;
  if (!s) return null;
  const last = s.history[s.history.length - 1];
  const strays = s.swarm.modules.filter((m) => m.stray).length;
  const online = s.flows.filter((f) => f.online).length;
  const speed = 10 ** speedLog;

  return (
    <div className="tab-body">
      <div className="map-grid">
        <figure className="card">
          <figcaption>Southern California Bight</figcaption>
          <MapCanvas sim={s} frame={frame} />
        </figure>
        <figure className="card">
          <figcaption>Formation (zoomed)</figcaption>
          <FormationCanvas sim={s} frame={frame} />
        </figure>
      </div>
      <div className="card playback">
        <button className="primary" onClick={() => setPlaying(!playing)}>{playing ? 'Pause' : 'Play'}</button>
        <button
          disabled={playing}
          onClick={() => {
            if (simRef.current) {
              stepLive(simRef.current);
              setFrame((f) => f + 1);
            }
          }}
        >
          Step 5 min
        </button>
        <label className="field">
          <span>Speed {fmtNum(speed)}x</span>
          <input type="range" min={Math.log10(60)} max={Math.log10(20000)} step={0.01} value={speedLog} onChange={(e) => setSpeedLog(Number(e.target.value))} />
        </label>
        <label className="field">
          <span>Day {dateLabel(doy)}</span>
          <input type="range" min={1} max={365} value={doy} onChange={(e) => setDoy(Number(e.target.value))} />
        </label>
        <button
          onClick={() => {
            const sim = simRef.current;
            if (sim) {
              kickModule(sim, Math.floor(Math.random() * sim.cfg.swarm.count));
              setFrame((f) => f + 1);
            }
          }}
        >
          Scatter a module
        </button>
      </div>
      <div className="stats-row">
        <Stat label="Local solar time" value={fmtHour(localSolarHour(s.t, cfg.env.originLon))} />
        <Stat label="Sun elevation" value={`${fmtNum(s.sunElevationDeg)}°`} />
        <Stat label="Petals" value={s.stowed ? 'Stowed for wind' : 'Open'} />
        <Stat label="Modules online" value={`${online || cfg.swarm.count} of ${cfg.swarm.count}`} />
        <Stat label="Strays" value={String(strays)} tone={strays ? 'bad' : undefined} />
        <Stat label="Average battery" value={last ? fmtPct(last.socFrac) : 'n/a'} />
        <Stat label="Swarm compute" value={last ? `${fmtNum(last.tflops)} TFLOPS` : 'n/a'} />
        <Stat label="Jobs done, queued" value={`${fmtNum(s.jobs.completed)}, ${fmtNum(s.jobs.queue.length)}`} />
        <Stat label="Binding now" value={BINDING_LABEL[s.binding]} />
        <Stat label="Distance offshore" value={`${fmtNum(s.env.offshoreKm(s.swarm.centroid.x, s.swarm.centroid.y))} km`} />
      </div>
      {cfg.swarm.strategy === 'seek' && <p className="note">Cloud-seeking plans with a perfect forecast over its horizon, so the gain shown is an upper bound.</p>}
    </div>
  );
}
```

- [ ] **Step 5: Wire the tab and add styles**

In `src/ui/MainContent.tsx` add `import { SwarmMapTab } from './tabs/SwarmMapTab';` and, above `default:`, add:
```tsx
    case 'map':
      return <SwarmMapTab />;
```

Append to `src/styles.css`:
```css
.map-grid { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: 12px; }
.map-canvas, .formation-canvas { display: block; width: 100%; aspect-ratio: 4 / 3; border-radius: 6px; }
.playback { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 16px; }
.playback .field { min-width: 180px; }
.controls-row { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 10px 14px; margin-bottom: 10px; }
@media (max-width: 1100px) { .map-grid { grid-template-columns: minmax(0, 1fr); } }
```

- [ ] **Step 6: Verify**

Run: `npm test && npm run typecheck && npm run build`
Expected: PASS.
Run `npm run dev` and open the Swarm Map tab. Expected: the map shows the coastline, islands, cloud shading during the day, and a swarm marker about 90 km offshore. The formation view shows 20 flower glyphs, and "Scatter a module" turns one amber until it rejoins. Changing a slider resets the day.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add live Swarm Map tab with Bight map, formation view and playback"
```

---

### Task 15: Module and Energy tabs

Load `dataviz` and `frontend-design` before this task.

**Files:**
- Create: `src/ui/tabs/dayEnergy.ts`, `src/ui/tabs/FlowerSvg.tsx`, `src/ui/tabs/ModuleTab.tsx`, `src/ui/tabs/EnergyTab.tsx`, `src/ui/chartTheme.ts`
- Modify: `src/ui/MainContent.tsx` (add `module` and `energy` cases), `src/styles.css` (append)
- Test: `src/ui/tabs/dayEnergy.test.ts`

**Interfaces:**
- Consumes: `runLiveDay`, `LivePoint`, `AnnualResult`, `derive`, `monthOfDoy`, `DAYS_IN_MONTH`.
- Produces:
  - `interface DayEnergy { pvKwh; loadsKwh; propulsionKwh; computeKwh; chargeKwh; dischargeKwh; curtailedKwh }`, `dayEnergy(history: LivePoint[], dtS: number): DayEnergy` (per-module kWh)
  - `sankeyData(e: DayEnergy): { nodes: { name: string }[]; links: { source: number; target: number; value: number }[] }`
  - `monthlySeries(a: AnnualResult): { month: string; pv: number; compute: number; curtailed: number; ghi: number }[]` (per-module average daily kWh, GHI kWh/m2/day)
  - `TOOLTIP_STYLE`, `AXIS_PROPS` in `chartTheme.ts`

- [ ] **Step 1: Write the failing test**

`src/ui/tabs/dayEnergy.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { dayEnergy, sankeyData, monthlySeries } from './dayEnergy';
import { runLiveDay } from '../../model/live';
import { runAnnual } from '../../model/annual';
import { defaultConfig } from '../../model/defaults';
import { DAYS_IN_MONTH } from '../../model/time';

describe('day energy and sankey', () => {
  const sim = runLiveDay(defaultConfig(), 172);
  const e = dayEnergy(sim.history, sim.dtS);

  it('balances the power bus', () => {
    const inBus = e.pvKwh - e.curtailedKwh + e.dischargeKwh;
    const outBus = e.loadsKwh + e.propulsionKwh + e.computeKwh + e.chargeKwh;
    expect(Math.abs(inBus - outBus)).toBeLessThan(1e-3);
    expect(e.pvKwh).toBeGreaterThan(1);
  });

  it('builds sankey links that reference existing nodes', () => {
    const s = sankeyData(e);
    expect(s.links.length).toBeGreaterThan(2);
    for (const l of s.links) {
      expect(s.nodes[l.source]).toBeDefined();
      expect(s.nodes[l.target]).toBeDefined();
      expect(l.value).toBeGreaterThan(0);
    }
    const used = new Set(s.links.flatMap((l) => [l.source, l.target]));
    expect(used.size).toBe(s.nodes.length);
  });

  it('monthly series sums back to the annual total', () => {
    const a = runAnnual(defaultConfig(), 'full');
    const m = monthlySeries(a);
    expect(m).toHaveLength(12);
    const sum = m.reduce((acc, x, i) => acc + x.pv * DAYS_IN_MONTH[i] * a.modules, 0);
    expect(Math.abs(sum - a.totals.pvKwh) / a.totals.pvKwh).toBeLessThan(1e-9);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/tabs`
Expected: FAIL, cannot resolve `./dayEnergy`.

- [ ] **Step 3: Implement `dayEnergy.ts` and the chart theme**

`src/ui/tabs/dayEnergy.ts`:
```ts
import type { LivePoint } from '../../model/live';
import type { AnnualResult } from '../../model/annual';
import { monthOfDoy } from '../../model/time';

export interface DayEnergy {
  pvKwh: number;
  loadsKwh: number;
  propulsionKwh: number;
  computeKwh: number;
  chargeKwh: number;
  dischargeKwh: number;
  curtailedKwh: number;
}

export function dayEnergy(history: LivePoint[], dtS: number): DayEnergy {
  const k = dtS / 3600 / 1000;
  const e: DayEnergy = { pvKwh: 0, loadsKwh: 0, propulsionKwh: 0, computeKwh: 0, chargeKwh: 0, dischargeKwh: 0, curtailedKwh: 0 };
  for (const p of history) {
    const prop = Math.min(p.propulsionW, p.essentialW);
    e.pvKwh += p.pvW * k;
    e.propulsionKwh += prop * k;
    e.loadsKwh += (p.essentialW - prop) * k;
    e.computeKwh += p.computeW * k;
    e.chargeKwh += p.chargeW * k;
    e.dischargeKwh += p.dischargeW * k;
    e.curtailedKwh += p.curtailedW * k;
  }
  return e;
}

export function sankeyData(e: DayEnergy): { nodes: { name: string }[]; links: { source: number; target: number; value: number }[] } {
  const names = ['Solar', 'Battery out', 'Power bus', 'Avionics and Starlink', 'Propulsion', 'Compute', 'Battery in', 'Curtailed'];
  const raw: [number, number, number][] = [
    [0, 2, e.pvKwh - e.curtailedKwh],
    [1, 2, e.dischargeKwh],
    [2, 3, e.loadsKwh],
    [2, 4, e.propulsionKwh],
    [2, 5, e.computeKwh],
    [2, 6, e.chargeKwh],
    [0, 7, e.curtailedKwh],
  ];
  const kept = raw.filter(([, , v]) => v > 0.005);
  const used = [...new Set(kept.flatMap(([a, b]) => [a, b]))].sort((a, b) => a - b);
  const remap = new Map(used.map((old, i) => [old, i]));
  return {
    nodes: used.map((i) => ({ name: names[i] })),
    links: kept.map(([a, b, v]) => ({ source: remap.get(a)!, target: remap.get(b)!, value: Number(v.toFixed(3)) })),
  };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function monthlySeries(a: AnnualResult): { month: string; pv: number; compute: number; curtailed: number; ghi: number }[] {
  const acc = Array.from({ length: 12 }, () => ({ w: 0, pv: 0, compute: 0, curtailed: 0, ghi: 0 }));
  for (const d of a.days) {
    const x = acc[monthOfDoy(d.doy)];
    x.w += d.weight;
    x.pv += d.pvKwh * d.weight;
    x.compute += d.computeKwh * d.weight;
    x.curtailed += d.curtailedKwh * d.weight;
    x.ghi += d.ghiKwhM2 * d.weight;
  }
  return acc.map((x, m) => ({
    month: MONTHS[m],
    pv: x.w ? x.pv / x.w / a.modules : 0,
    compute: x.w ? x.compute / x.w / a.modules : 0,
    curtailed: x.w ? x.curtailed / x.w / a.modules : 0,
    ghi: x.w ? x.ghi / x.w : 0,
  }));
}
```

`src/ui/chartTheme.ts`:
```ts
export const TOOLTIP_STYLE = {
  contentStyle: { background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)' },
  labelStyle: { color: 'var(--text)' },
  itemStyle: { color: 'var(--text)' },
};

export const AXIS_PROPS = { stroke: 'var(--muted)', tick: { fill: 'var(--muted)', fontSize: 12 } };
export const GRID_PROPS = { stroke: 'var(--border)', strokeDasharray: '3 3' };
```

- [ ] **Step 4: Module tab**

`src/ui/tabs/FlowerSvg.tsx`:
```tsx
import type { SimConfig } from '../../model/config';

export function FlowerSvg({ cfg, sunElevationDeg, sunAzimuthDeg, stowed }: { cfg: SimConfig; sunElevationDeg: number; sunAzimuthDeg: number; stowed: boolean }) {
  const h = cfg.hull;
  const span = h.sideM + 2 * h.petalLengthM;
  const half = span / 2 + 0.6;
  const up = sunElevationDeg > 0;
  const tiltDeg = stowed || !up ? 0 : h.tracking === 'dual' ? Math.min(90 - sunElevationDeg, h.maxTiltDeg) : h.tracking === 'yaw' ? h.fixedTiltDeg : 0;
  // Screen angle of the sun direction (0 = +x, clockwise), from azimuth clockwise from north.
  const sunScreenDeg = sunAzimuthDeg - 90;
  const r0 = h.sideM / 2;
  const len = stowed ? h.petalLengthM * 0.15 : h.petalLengthM;
  const petals = Array.from({ length: h.petalCount }, (_, k) => {
    const a = (360 * k) / Math.max(1, h.petalCount);
    const rel = ((a - sunScreenDeg) * Math.PI) / 180;
    // In plan view a tilted petal looks shorter; petals facing toward or away from the sun tilt most.
    const proj = h.tracking === 'flat' ? len : len * Math.cos(((tiltDeg * Math.PI) / 180) * Math.abs(Math.cos(rel)));
    return { a, proj };
  });
  const sx = Math.cos((sunScreenDeg * Math.PI) / 180) * half * 0.9;
  const sy = Math.sin((sunScreenDeg * Math.PI) / 180) * half * 0.9;
  return (
    <svg viewBox={`${-half} ${-half} ${2 * half} ${2 * half}`} className="flower" role="img" aria-label={`Top view of one module with ${h.petalCount} petals, ${stowed ? 'stowed' : 'open'}`}>
      <circle cx={0} cy={0} r={half * 0.98} fill="var(--ocean)" />
      {petals.map((p) => (
        <g key={p.a} transform={`rotate(${p.a})`}>
          <rect x={r0} y={-h.petalWidthM / 2} width={Math.max(0.02, p.proj)} height={h.petalWidthM} fill="var(--c2)" fillOpacity={0.85} stroke="var(--panel)" strokeWidth={0.02} />
        </g>
      ))}
      <rect x={-r0} y={-r0} width={2 * r0} height={2 * r0} fill="var(--c2)" stroke="var(--text)" strokeWidth={0.03} />
      {up && (
        <>
          <line x1={0} y1={0} x2={sx} y2={sy} stroke="var(--c3)" strokeWidth={0.04} strokeDasharray="0.12 0.08" />
          <circle cx={sx} cy={sy} r={0.14} fill="var(--c3)" />
        </>
      )}
    </svg>
  );
}
```

`src/ui/tabs/ModuleTab.tsx`:
```tsx
import { useDeferredValue, useMemo, useState } from 'react';
import { ResponsiveContainer, Sankey, Tooltip } from 'recharts';
import { useFleet } from '../../state/store';
import { runLiveDay } from '../../model/live';
import { derive } from '../../model/derive';
import { dateLabel } from '../../model/time';
import { FlowerSvg } from './FlowerSvg';
import { dayEnergy, sankeyData } from './dayEnergy';
import { fmtHour, fmtNum } from '../format';
import { TOOLTIP_STYLE } from '../chartTheme';

interface NodeProps { x: number; y: number; width: number; height: number; payload: { name: string; value: number } }

function SankeyNode({ x, y, width, height, payload }: NodeProps) {
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill="var(--c1)" />
      <text x={x + width + 6} y={y + height / 2} dy="0.35em" fontSize={12} fill="var(--text)">
        {payload.name}: {fmtNum(payload.value, 2)} kWh
      </text>
    </g>
  );
}

export function ModuleTab() {
  const cfg = useDeferredValue(useFleet((s) => s.cfg));
  const [doy, setDoy] = useState(172);
  const [hour, setHour] = useState(12);
  const sim = useMemo(() => runLiveDay(cfg, doy), [cfg, doy]);
  const d = useMemo(() => derive(cfg), [cfg]);
  const point = sim.history[Math.min(sim.history.length - 1, Math.round(hour * 12))];
  const energy = dayEnergy(sim.history, sim.dtS);
  const sankey = sankeyData(energy);
  const rows: [string, string][] = [
    ['Panel area', `${fmtNum(d.pvAreaM2, 2)} m²`],
    ['Open span', `${fmtNum(d.spanM, 2)} m`],
    ['Peak solar', `${fmtNum(d.peakPvW / 1000, 2)} kW`],
    ['Compute efficiency incl. overhead', `${fmtNum(d.tflopsPerElecW, 2)} TFLOPS/W`],
    ['Max compute power', `${fmtNum(d.maxComputeElecW)} W`],
    ['Essential load (avionics, Starlink share)', `${fmtNum(d.essentialW, 1)} W`],
    ['Mass vs displacement', `${fmtNum(d.massKg)} kg of ${fmtNum(d.displacementKg)} kg`],
    ['Pod volume needed vs available', `${fmtNum(d.podNeedL)} L of ${fmtNum(cfg.hull.podVolumeL)} L`],
    ['Max speed through water', `${fmtNum(d.maxWaterSpeedMs, 2)} m/s`],
    ['Battery mass', `${fmtNum(d.batteryKg)} kg`],
  ];
  return (
    <div className="tab-body">
      <div className="grid2">
        <section className="card">
          <h2>One module, top view</h2>
          <div className="controls-row">
            <label className="field">
              <span>Day {dateLabel(doy)}</span>
              <input type="range" min={1} max={365} value={doy} onChange={(e) => setDoy(Number(e.target.value))} />
            </label>
            <label className="field">
              <span>Time {fmtHour(hour)}</span>
              <input type="range" min={0} max={23.9} step={0.25} value={hour} onChange={(e) => setHour(Number(e.target.value))} />
            </label>
          </div>
          {point && <FlowerSvg cfg={cfg} sunElevationDeg={point.sunElevationDeg} sunAzimuthDeg={point.sunAzimuthDeg} stowed={point.stowed} />}
          {point && (
            <p className="note">
              Sun {fmtNum(point.sunElevationDeg)}° up. Solar {fmtNum(point.pvW)} W, compute {fmtNum(point.computeW)} W, battery {fmtNum(point.socFrac * 100)}%.
              {point.stowed ? ' Petals are stowed for wind.' : ''}
            </p>
          )}
        </section>
        <section className="card">
          <h2>Where one day of energy goes (average module, {dateLabel(doy)})</h2>
          <ResponsiveContainer width="100%" height={340}>
            <Sankey data={sankey} nodePadding={28} margin={{ top: 10, right: 190, bottom: 10, left: 10 }} link={{ stroke: 'var(--c2)', strokeOpacity: 0.25 }} node={(p: NodeProps) => <SankeyNode {...p} />}>
              <Tooltip {...TOOLTIP_STYLE} formatter={(v) => `${fmtNum(Number(v), 2)} kWh`} />
            </Sankey>
          </ResponsiveContainer>
        </section>
      </div>
      <section className="card">
        <h2>Module specification</h2>
        <table className="data">
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k}>
                <th>{k}</th>
                <td className="num">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
```

If TypeScript rejects the `node` render prop's parameter type, type it as `(p: unknown) => <SankeyNode {...(p as NodeProps)} />`.

- [ ] **Step 5: Energy tab**

`src/ui/tabs/EnergyTab.tsx`:
```tsx
import { useDeferredValue, useMemo, useState } from 'react';
import { ResponsiveContainer, ComposedChart, LineChart, Area, Line, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { useFleet } from '../../state/store';
import { runLiveDay } from '../../model/live';
import { dateLabel } from '../../model/time';
import { dayEnergy, monthlySeries } from './dayEnergy';
import { Stat } from '../controls';
import { fmtHour, fmtNum } from '../format';
import { TOOLTIP_STYLE, AXIS_PROPS, GRID_PROPS } from '../chartTheme';

const HOUR_TICKS = [0, 3, 6, 9, 12, 15, 18, 21, 24];

export function EnergyTab() {
  const cfg = useDeferredValue(useFleet((s) => s.cfg));
  const annual = useFleet((s) => s.annual);
  const [doy, setDoy] = useState(172);
  const sim = useMemo(() => runLiveDay(cfg, doy), [cfg, doy]);
  const e = dayEnergy(sim.history, sim.dtS);
  const data = sim.history.map((p) => ({
    hour: Number(p.hour.toFixed(3)),
    pv: p.pvW,
    loads: Math.max(0, p.essentialW - p.propulsionW),
    propulsion: p.propulsionW,
    compute: p.computeW,
    curtailed: p.curtailedW,
    ghi: p.ghi,
    soc: p.socFrac * 100,
    tflops: p.tflops,
  }));
  const monthly = annual ? monthlySeries(annual) : null;

  return (
    <div className="tab-body">
      <section className="card">
        <div className="row-between">
          <h2>One day, average module ({dateLabel(doy)})</h2>
          <label className="field">
            <span>Day {dateLabel(doy)}</span>
            <input type="range" min={1} max={365} value={doy} onChange={(ev) => setDoy(Number(ev.target.value))} />
          </label>
        </div>
        <div className="stats-row">
          <Stat label="Solar" value={`${fmtNum(e.pvKwh, 2)} kWh`} />
          <Stat label="Compute" value={`${fmtNum(e.computeKwh, 2)} kWh`} />
          <Stat label="Avionics and Starlink" value={`${fmtNum(e.loadsKwh, 2)} kWh`} />
          <Stat label="Propulsion" value={`${fmtNum(e.propulsionKwh, 3)} kWh`} />
          <Stat label="Curtailed" value={`${fmtNum(e.curtailedKwh, 2)} kWh`} />
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={data} margin={{ top: 12, right: 16, bottom: 4, left: 8 }}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="hour" type="number" domain={[0, 24]} ticks={HOUR_TICKS} tickFormatter={(h) => fmtHour(Number(h))} {...AXIS_PROPS} />
            <YAxis yAxisId="w" {...AXIS_PROPS} label={{ value: 'W per module', angle: -90, position: 'insideLeft', fill: 'var(--muted)' }} />
            <YAxis yAxisId="g" orientation="right" {...AXIS_PROPS} label={{ value: 'Irradiance W/m²', angle: 90, position: 'insideRight', fill: 'var(--muted)' }} />
            <Tooltip {...TOOLTIP_STYLE} labelFormatter={(h) => fmtHour(Number(h))} formatter={(v) => fmtNum(Number(v))} />
            <Legend />
            <Area yAxisId="w" type="monotone" dataKey="pv" name="Solar" stroke="var(--c3)" fill="var(--c3)" fillOpacity={0.18} isAnimationActive={false} />
            <Line yAxisId="w" type="monotone" dataKey="compute" name="Compute" stroke="var(--c1)" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line yAxisId="w" type="monotone" dataKey="loads" name="Avionics and Starlink" stroke="var(--c6)" dot={false} isAnimationActive={false} />
            <Line yAxisId="w" type="monotone" dataKey="propulsion" name="Propulsion" stroke="var(--c4)" dot={false} isAnimationActive={false} />
            <Line yAxisId="w" type="monotone" dataKey="curtailed" name="Curtailed" stroke="var(--c5)" strokeDasharray="4 3" dot={false} isAnimationActive={false} />
            <Line yAxisId="g" type="monotone" dataKey="ghi" name="Irradiance" stroke="var(--c2)" strokeDasharray="2 3" dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data} margin={{ top: 12, right: 16, bottom: 4, left: 8 }}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="hour" type="number" domain={[0, 24]} ticks={HOUR_TICKS} tickFormatter={(h) => fmtHour(Number(h))} {...AXIS_PROPS} />
            <YAxis yAxisId="soc" domain={[0, 100]} {...AXIS_PROPS} label={{ value: 'Battery %', angle: -90, position: 'insideLeft', fill: 'var(--muted)' }} />
            <YAxis yAxisId="tf" orientation="right" {...AXIS_PROPS} label={{ value: 'Swarm TFLOPS', angle: 90, position: 'insideRight', fill: 'var(--muted)' }} />
            <Tooltip {...TOOLTIP_STYLE} labelFormatter={(h) => fmtHour(Number(h))} formatter={(v) => fmtNum(Number(v))} />
            <Legend />
            <Line yAxisId="soc" type="monotone" dataKey="soc" name="Average battery" stroke="var(--c1)" dot={false} isAnimationActive={false} />
            <Line yAxisId="tf" type="monotone" dataKey="tflops" name="Swarm compute" stroke="var(--c2)" dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </section>
      <section className="card">
        <h2>Across the year (average module, average day in each month)</h2>
        {monthly ? (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={monthly} margin={{ top: 12, right: 16, bottom: 4, left: 8 }}>
              <CartesianGrid {...GRID_PROPS} />
              <XAxis dataKey="month" {...AXIS_PROPS} />
              <YAxis yAxisId="k" {...AXIS_PROPS} label={{ value: 'kWh per day', angle: -90, position: 'insideLeft', fill: 'var(--muted)' }} />
              <YAxis yAxisId="g" orientation="right" {...AXIS_PROPS} label={{ value: 'GHI kWh/m²/day', angle: 90, position: 'insideRight', fill: 'var(--muted)' }} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v) => fmtNum(Number(v), 2)} />
              <Legend />
              <Bar yAxisId="k" dataKey="pv" name="Solar" fill="var(--c3)" isAnimationActive={false} />
              <Bar yAxisId="k" dataKey="compute" name="Compute" fill="var(--c1)" isAnimationActive={false} />
              <Bar yAxisId="k" dataKey="curtailed" name="Curtailed" fill="var(--c5)" isAnimationActive={false} />
              <Line yAxisId="g" type="monotone" dataKey="ghi" name="Irradiance at the swarm" stroke="var(--c2)" dot isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <p className="muted">Calculating the annual run.</p>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 6: Wire tabs and add styles**

In `src/ui/MainContent.tsx` add imports for `ModuleTab` and `EnergyTab` and these cases above `default:`:
```tsx
    case 'module':
      return <ModuleTab />;
    case 'energy':
      return <EnergyTab />;
```

Append to `src/styles.css`:
```css
.flower { display: block; width: 100%; max-width: 420px; margin: 0 auto; aspect-ratio: 1; }
.row-between { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: 8px 16px; }
.row-between h2 { margin: 0; font-size: 15px; }
```

- [ ] **Step 7: Verify**

Run: `npm test && npm run typecheck && npm run build`
Expected: PASS.
In the browser: the Module tab shows the flower opening and tracking as the time slider moves, plus a Sankey whose flows add up. The Energy tab shows a daytime solar bump, compute following the policy, and 12 monthly bar groups once the annual run finishes. Check both light and dark themes.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add Module and Energy tabs with flower diagram, energy Sankey and daily and monthly charts"
```

---

### Task 16: Economics tab and investor view

Load `dataviz` before this task.

**Files:**
- Create: `src/ui/tabs/econParts.tsx`, `src/ui/tabs/EconomicsTab.tsx`, `src/ui/InvestorView.tsx`
- Modify: `src/ui/MainContent.tsx` (add the `economics` case and the investor branch), `src/styles.css` (append)

**Interfaces:**
- Consumes: `Econ`, `SimConfig`, `useOptimizer`, `TornadoResult`, `derive`, `feasibility`, `createEnvironment`, `ACCELERATORS`.
- Produces: `EconomicsHeadline`, `CapexChart`, `CashflowChart`, `PnlTable`, `TornadoPanel` (all take `econ` and/or `cfg` props), `EconomicsTab`, `InvestorView`.

- [ ] **Step 1: Economics parts**

`src/ui/tabs/econParts.tsx`:
```tsx
import { useCallback, useEffect, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, AreaChart, Area, ReferenceLine, CartesianGrid, Legend } from 'recharts';
import type { Econ } from '../../model/economics';
import type { SimConfig } from '../../model/config';
import { useOptimizer } from '../../state/useOptimizer';
import { Stat } from '../controls';
import { fmtCompact, fmtMonths, fmtNum, fmtPct, fmtUsd, fmtUsdCompact } from '../format';
import { TOOLTIP_STYLE, AXIS_PROPS, GRID_PROPS } from '../chartTheme';

export function EconomicsHeadline({ econ, cfg }: { econ: Econ; cfg: SimConfig }) {
  return (
    <div className="stats-row">
      <Stat label="Revenue per year" value={fmtUsdCompact(econ.revenue.total)} sub={`${fmtUsdCompact(econ.revenue.firm)} firm, ${fmtUsdCompact(econ.revenue.spot)} spot`} />
      <Stat label="Opex per year" value={fmtUsdCompact(econ.opexTotal)} />
      <Stat label="Gross margin per year" value={fmtUsdCompact(econ.grossMargin)} tone={econ.grossMargin >= 0 ? 'good' : 'bad'} />
      <Stat label="Cost per GPU-hour" value={fmtUsd(econ.costPerGpuHour, 2)} sub={`Market ${fmtUsd(econ.marketFirm, 2)} firm, ${fmtUsd(econ.marketSpot, 2)} spot`} />
      <Stat label="Margin per GPU-hour" value={fmtUsd(econ.marginPerGpuHour, 2)} sub="After amortized capital" tone={econ.marginPerGpuHour >= 0 ? 'good' : 'bad'} />
      <Stat label="Delivered GPU-hours" value={fmtCompact(econ.gpuHours)} sub={`${fmtCompact(econ.firmGpuHours)} firm, ${fmtCompact(econ.spotGpuHours)} spot`} />
      <Stat label="Capex per module" value={fmtUsd(econ.capex.perModule)} />
      <Stat label="Swarm capex" value={fmtUsdCompact(econ.capex.total)} sub={`${fmtNum(econ.capex.fleetModules, 1)} modules incl. spares`} />
      <Stat label="NPV" value={fmtUsdCompact(econ.npv)} sub={`${fmtPct(cfg.econ.discountRate)} over ${cfg.econ.horizonYears} years`} tone={econ.npv >= 0 ? 'good' : 'bad'} />
      <Stat label="IRR" value={econ.irr === null ? 'n/a' : fmtPct(econ.irr, 1)} />
      <Stat label="Payback" value={fmtMonths(econ.paybackMonths)} />
      <Stat label="Firm availability" value={econ.availability === null ? 'No firm tier' : fmtPct(econ.availability, 1)} sub={`Target ${fmtPct(cfg.econ.slaTarget, 1)}`} />
      <Stat label="Levelized cost of compute" value={`${fmtUsd(econ.lcocPerPflopHour, 2)} / PFLOP-h`} />
    </div>
  );
}

export function CapexChart({ econ }: { econ: Econ }) {
  const data = [...econ.moduleCapex.lines]
    .filter((l) => l.usd > 0)
    .sort((a, b) => b.usd - a.usd)
    .map((l) => ({ label: l.label, usd: Math.round(l.usd), estimate: l.estimate }));
  return (
    <section className="card">
      <h2>Capex per module: {fmtUsd(econ.moduleCapex.total)}</h2>
      <ResponsiveContainer width="100%" height={Math.max(240, data.length * 28)}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 56, bottom: 4, left: 8 }}>
          <XAxis type="number" tickFormatter={(v) => fmtUsdCompact(Number(v))} {...AXIS_PROPS} />
          <YAxis type="category" dataKey="label" width={190} {...AXIS_PROPS} />
          <Tooltip {...TOOLTIP_STYLE} formatter={(v) => fmtUsd(Number(v))} />
          <Bar dataKey="usd" name="Cost" isAnimationActive={false} label={{ position: 'right', formatter: (v: unknown) => fmtUsdCompact(Number(v)), fill: 'var(--muted)', fontSize: 11 }}>
            {data.map((d) => (
              <Cell key={d.label} fill={d.estimate ? 'var(--c3)' : 'var(--c1)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="note">Teal bars use sourced prices. Amber bars are estimates that need vendor quotes.</p>
    </section>
  );
}

export function CashflowChart({ econ }: { econ: Econ }) {
  const data: { year: number; cum: number }[] = [];
  econ.flows.forEach((f, i) => data.push({ year: i, cum: (i ? data[i - 1].cum : 0) + f }));
  return (
    <section className="card">
      <h2>Cumulative cash, payback {fmtMonths(econ.paybackMonths)}</h2>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 12, right: 16, bottom: 4, left: 8 }}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="year" {...AXIS_PROPS} label={{ value: 'Year', position: 'insideBottomRight', offset: -2, fill: 'var(--muted)' }} />
          <YAxis tickFormatter={(v) => fmtUsdCompact(Number(v))} {...AXIS_PROPS} />
          <Tooltip {...TOOLTIP_STYLE} formatter={(v) => fmtUsd(Number(v))} labelFormatter={(y) => `Year ${y}`} />
          <ReferenceLine y={0} stroke="var(--text)" />
          <Area type="monotone" dataKey="cum" name="Cumulative cash" stroke="var(--c2)" fill="var(--c2)" fillOpacity={0.15} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </section>
  );
}

export function PnlTable({ econ, cfg }: { econ: Econ; cfg: SimConfig }) {
  const n = cfg.swarm.count;
  const rows: [string, number, boolean?][] = [
    ['Firm revenue', econ.revenue.firm],
    ['Spot revenue', econ.revenue.spot],
    ['SLA penalty', -econ.revenue.slaPenalty],
    ['Revenue', econ.revenue.total, true],
    ...econ.opexLines.map((l) => [l.label, -l.usd] as [string, number]),
    ['Opex', -econ.opexTotal, true],
    ['Gross margin', econ.grossMargin, true],
  ];
  return (
    <section className="card">
      <h2>Annual P&amp;L</h2>
      <div className="table-scroll">
        <table className="data">
          <thead>
            <tr>
              <th>Item</th>
              <th className="num">Swarm per year</th>
              <th className="num">Per module per year</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, v, strong]) => (
              <tr key={label} className={strong ? 'strong' : undefined}>
                <td>{label}</td>
                <td className="num">{fmtUsd(v)}</td>
                <td className="num">{fmtUsd(v / n)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function TornadoPanel({ cfg }: { cfg: SimConfig }) {
  const opt = useOptimizer();
  const [ranFor, setRanFor] = useState<SimConfig | null>(null);
  const { run } = opt;
  const start = useCallback(() => {
    run({ kind: 'tornado', cfg });
    setRanFor(cfg);
  }, [cfg, run]);
  useEffect(() => {
    if (!ranFor) start();
    // Run once when the panel first appears; later runs are on request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const result = opt.response?.kind === 'tornado' ? opt.response.result : null;
  const stale = ranFor !== null && ranFor !== cfg;
  const data = result ? result.rows.map((r) => ({ label: r.label, low: r.low - result.base, high: r.high - result.base })) : [];
  return (
    <section className="card">
      <div className="row-between">
        <h2>Sensitivity: margin per GPU-hour when each input moves 20%</h2>
        <button onClick={start} disabled={opt.busy}>{opt.busy ? 'Running' : stale ? 'Re-run for current inputs' : 'Re-run'}</button>
      </div>
      {opt.progress && <p className="muted">{opt.progress[0]} of {opt.progress[1]} model runs</p>}
      {opt.error && <p className="error-text">{opt.error}</p>}
      {result && (
        <>
          <p className="note">Baseline {fmtUsd(result.base, 2)} per GPU-hour. Bars show the change from baseline.{stale ? ' Inputs changed since this run.' : ''}</p>
          <ResponsiveContainer width="100%" height={Math.max(260, data.length * 30)}>
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }}>
              <CartesianGrid {...GRID_PROPS} />
              <XAxis type="number" tickFormatter={(v) => fmtUsd(Number(v), 2)} {...AXIS_PROPS} />
              <YAxis type="category" dataKey="label" width={150} {...AXIS_PROPS} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v) => fmtUsd(Number(v), 3)} />
              <Legend />
              <ReferenceLine x={0} stroke="var(--text)" />
              <Bar dataKey="low" name="Input 20% lower" fill="var(--c5)" isAnimationActive={false} />
              <Bar dataKey="high" name="Input 20% higher" fill="var(--c1)" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Economics tab and investor view**

`src/ui/tabs/EconomicsTab.tsx`:
```tsx
import { useFleet } from '../../state/store';
import { EconomicsHeadline, CapexChart, CashflowChart, PnlTable, TornadoPanel } from './econParts';

export function EconomicsTab() {
  const econ = useFleet((s) => s.econ);
  const cfg = useFleet((s) => s.cfg);
  if (!econ) {
    return (
      <section className="card">
        <p className="muted">Calculating the annual run.</p>
      </section>
    );
  }
  return (
    <div className="tab-body">
      <EconomicsHeadline econ={econ} cfg={cfg} />
      <div className="grid2">
        <CapexChart econ={econ} />
        <CashflowChart econ={econ} />
      </div>
      <div className="grid2">
        <PnlTable econ={econ} cfg={cfg} />
        <TornadoPanel cfg={cfg} />
      </div>
    </div>
  );
}
```

`src/ui/InvestorView.tsx`:
```tsx
import { useMemo } from 'react';
import { useFleet } from '../state/store';
import { derive } from '../model/derive';
import { feasibility } from '../model/feasibility';
import { createEnvironment } from '../model/environment';
import { ACCELERATORS } from '../presets';
import { EconomicsHeadline, CapexChart, CashflowChart, PnlTable } from './tabs/econParts';
import { fmtNum, fmtUsd } from './format';

export function InvestorView() {
  const cfg = useFleet((s) => s.cfg);
  const econ = useFleet((s) => s.econ);
  const annual = useFleet((s) => s.annual);
  const d = useMemo(() => derive(cfg), [cfg]);
  const km = useMemo(() => createEnvironment(cfg).offshoreKm(0, 0), [cfg]);
  const flags = feasibility(cfg, d, annual, econ);
  const accel = ACCELERATORS.find((a) => a.id === cfg.compute.presetId)?.name ?? 'custom accelerators';
  const estimates = econ ? econ.moduleCapex.lines.filter((l) => l.estimate && l.usd > 0).sort((a, b) => b.usd - a.usd).slice(0, 5) : [];
  return (
    <div className="tab-body investor-view">
      <section className="card hero">
        <p className="eyebrow">Fleet scenario</p>
        <h1>{cfg.name}</h1>
        <p className="lede">
          {cfg.swarm.count} solar-powered compute modules, each with {fmtNum(d.pvAreaM2, 1)} m² of panels and {cfg.compute.cards} x {accel}, operating about {fmtNum(km)} km off
          Southern California and selling compute as a service over Starlink.
        </p>
      </section>
      {econ ? (
        <>
          <EconomicsHeadline econ={econ} cfg={cfg} />
          <div className="grid2">
            <CapexChart econ={econ} />
            <CashflowChart econ={econ} />
          </div>
          <PnlTable econ={econ} cfg={cfg} />
        </>
      ) : (
        <section className="card">
          <p className="muted">Calculating the annual run.</p>
        </section>
      )}
      <section className="card">
        <h2>Open items before relying on these numbers</h2>
        <ul>
          {flags.map((f) => (
            <li key={f.id}>{f.message}</li>
          ))}
          {estimates.map((l) => (
            <li key={l.key}>
              {l.label} ({fmtUsd(l.usd)} per module) is an estimate and needs a vendor quote.
            </li>
          ))}
          <li>Starlink plan prices and GPU prices come from resellers and should be confirmed with vendor quotes.</li>
        </ul>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Wire and style**

In `src/ui/MainContent.tsx`: import `EconomicsTab` and `InvestorView`; add the case above `default:`:
```tsx
    case 'economics':
      return <EconomicsTab />;
```
and change the investor branch to `if (investor) return <InvestorView />;`.

Append to `src/styles.css`:
```css
.hero h1 { margin: 0 0 6px; font-size: 26px; }
.eyebrow { margin: 0; text-transform: uppercase; letter-spacing: 0.08em; font-size: 11px; color: var(--accent); font-weight: 700; }
.lede { margin: 0; font-size: 16px; max-width: 70ch; }
.investor-view { max-width: 1200px; margin: 0 auto; }
table.data tr.strong td { font-weight: 650; border-top: 1px solid var(--text); }
.error-text { color: var(--error); }
```

- [ ] **Step 4: Verify**

Run: `npm test && npm run typecheck && npm run build`
Expected: PASS.
In the browser: the Economics tab shows the headline tiles, sorted capex bars (amber for estimates), a cumulative cash curve crossing zero at the payback year, the P&L, and the tornado chart after a few seconds of progress. Toggling Investor view hides the sliders and shows the summary.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Economics tab with capex, cash flow, P&L and sensitivity, plus investor view"
```

---

### Task 17: Optimizer tab

Load `dataviz` before this task.

**Files:**
- Create: `src/ui/tabs/OptimizerTab.tsx`
- Modify: `src/ui/MainContent.tsx` (add the `optimizer` case), `src/styles.css` (append)

**Interfaces:**
- Consumes: `useOptimizer`, `AXIS_OPTIONS`, `RANGE_OPTIONS`, `METRICS`, `metricValue`, `applyAxis`, `Evaluation`, `Metric`, `setPath`, `PRESET_LISTS`, `PARAM_LABELS`.
- Produces: `OptimizerTab`.

- [ ] **Step 1: Implement the tab**

`src/ui/tabs/OptimizerTab.tsx`:
```tsx
import { useMemo, useState } from 'react';
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { useFleet } from '../../state/store';
import { useOptimizer } from '../../state/useOptimizer';
import { AXIS_OPTIONS, RANGE_OPTIONS, METRICS, metricValue, applyAxis, type Metric, type Evaluation } from '../../model/optimizer';
import { setPath } from '../../model/config';
import { PRESET_LISTS } from '../../model/defaults';
import { PARAM_LABELS, SLIDER_BOUNDS } from '../panelDefs';
import { fmtCompact, fmtMonths, fmtNum, fmtUsd, fmtUsdCompact } from '../format';
import { AXIS_PROPS, GRID_PROPS } from '../chartTheme';

function fmtMetric(ev: Evaluation, m: Metric): string {
  switch (m) {
    case 'pflopHours': return `${fmtCompact(ev.pflopHours)} PFLOP-h`;
    case 'costPerGpuHour': return fmtUsd(ev.costPerGpuHour, 2);
    case 'marginPerGpuHour': return fmtUsd(ev.marginPerGpuHour, 2);
    case 'marginYear': return fmtUsdCompact(ev.marginYear);
    case 'paybackMonths': return fmtMonths(ev.paybackMonths);
  }
}

function valueLabel(axisIdx: number, v: number | string): string {
  const a = AXIS_OPTIONS[axisIdx];
  if (a.kind === 'preset') return PRESET_LISTS[a.preset].find((p) => p.id === v)?.name ?? String(v);
  return typeof v === 'number' ? fmtNum(v, Number.isInteger(v) ? 0 : 2) : v;
}

function SweepPanel() {
  const cfg = useFleet((s) => s.cfg);
  const opt = useOptimizer();
  const [xi, setXi] = useState(0);
  const [yi, setYi] = useState(1);
  const [metric, setMetric] = useState<Metric>('marginPerGpuHour');
  const [ran, setRan] = useState<{ xi: number; yi: number } | null>(null);
  const result = opt.response?.kind === 'sweep' ? opt.response.result : null;
  const better = METRICS.find((m) => m.id === metric)!.better;

  const scale = useMemo(() => {
    if (!result) return null;
    const vals = result.cells.flat().filter((e) => e.feasible).map((e) => metricValue(e, metric)).filter(Number.isFinite);
    return vals.length ? { lo: Math.min(...vals), hi: Math.max(...vals) } : null;
  }, [result, metric]);

  const best = useMemo(() => {
    if (!result) return null;
    let b: [number, number] | null = null;
    let bv = better === 'high' ? -Infinity : Infinity;
    result.cells.forEach((row, y) =>
      row.forEach((ev, x) => {
        const v = metricValue(ev, metric);
        if (!ev.feasible || !Number.isFinite(v)) return;
        if (better === 'high' ? v > bv : v < bv) {
          bv = v;
          b = [x, y];
        }
      }),
    );
    return b as [number, number] | null;
  }, [result, metric, better]);

  const color = (ev: Evaluation): string | undefined => {
    if (!ev.feasible || !scale) return undefined;
    const v = metricValue(ev, metric);
    if (!Number.isFinite(v)) return undefined;
    let t = scale.hi > scale.lo ? (v - scale.lo) / (scale.hi - scale.lo) : 1;
    if (better === 'low') t = 1 - t;
    return `color-mix(in oklab, var(--c1) ${Math.round(12 + t * 88)}%, var(--panel))`;
  };

  const apply = (x: number, y: number) => {
    if (!result || !ran) return;
    const ax = AXIS_OPTIONS[ran.xi], ay = AXIS_OPTIONS[ran.yi];
    useFleet.getState().replace(applyAxis(applyAxis(cfg, ax, result.xs[x]), ay, result.ys[y]));
    useFleet.getState().setNotice(`Applied ${ax.label} = ${valueLabel(ran.xi, result.xs[x])} and ${ay.label} = ${valueLabel(ran.yi, result.ys[y])}.`);
  };

  return (
    <section className="card">
      <h2>Two-parameter sweep</h2>
      <div className="controls-row">
        <label className="field">
          <span>X axis</span>
          <select value={xi} onChange={(e) => setXi(Number(e.target.value))}>
            {AXIS_OPTIONS.map((a, i) => (
              <option key={a.label} value={i} disabled={i === yi}>{a.label}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Y axis</span>
          <select value={yi} onChange={(e) => setYi(Number(e.target.value))}>
            {AXIS_OPTIONS.map((a, i) => (
              <option key={a.label} value={i} disabled={i === xi}>{a.label}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Color by</span>
          <select value={metric} onChange={(e) => setMetric(e.target.value as Metric)}>
            {METRICS.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </label>
        <button
          className="primary"
          disabled={opt.busy}
          onClick={() => {
            opt.run({ kind: 'sweep', cfg, ax: AXIS_OPTIONS[xi], ay: AXIS_OPTIONS[yi] });
            setRan({ xi, yi });
          }}
        >
          {opt.busy ? 'Running' : 'Run sweep'}
        </button>
        {opt.progress && <span className="muted">{opt.progress[0]} of {opt.progress[1]} configurations</span>}
      </div>
      {opt.error && <p className="error-text">{opt.error}</p>}
      {result && ran && (
        <div className="table-scroll">
          <div className="heatmap" style={{ gridTemplateColumns: `minmax(120px, auto) repeat(${result.xs.length}, minmax(72px, 1fr))` }}>
            <div className="hm-corner">{AXIS_OPTIONS[ran.yi].label} by {AXIS_OPTIONS[ran.xi].label}</div>
            {result.xs.map((x, i) => (
              <div key={`x${i}`} className="hm-head">{valueLabel(ran.xi, x)}</div>
            ))}
            {result.cells.map((row, y) => [
              <div key={`y${y}`} className="hm-head hm-row">{valueLabel(ran.yi, result.ys[y])}</div>,
              ...row.map((ev, x) => {
                const isBest = !!best && best[0] === x && best[1] === y;
                return (
                  <button
                    key={`${x}-${y}`}
                    className={`hm-cell${ev.feasible ? '' : ' infeasible'}${isBest ? ' best' : ''}`}
                    style={{ background: color(ev) }}
                    title={`${fmtMetric(ev, metric)}${ev.feasible ? '' : ', fails a feasibility check'}. Click to load.`}
                    onClick={() => apply(x, y)}
                  >
                    {fmtMetric(ev, metric)}
                  </button>
                );
              }),
            ])}
          </div>
        </div>
      )}
      <p className="note">Each cell runs the representative-day model (36 days, 4 sampled modules). Hatched cells fail a feasibility check. The outlined cell is the best feasible one. Click a cell to load it into the sliders.</p>
    </section>
  );
}

interface Pt { i: number; capex: number; pflop: number; margin: number; feasible: boolean; values: Record<string, number> }

function ParetoTip({ active, payload }: { active?: boolean; payload?: { payload: Pt }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="tip">
      <div>Capex {fmtUsdCompact(p.capex)}</div>
      <div>{fmtCompact(p.pflop)} PFLOP-h per year</div>
      <div>Margin {fmtUsd(p.margin, 2)} per GPU-hour</div>
      {Object.entries(p.values).map(([k, v]) => (
        <div key={k} className="muted">{PARAM_LABELS[k] ?? k}: {fmtNum(v, 2)}</div>
      ))}
    </div>
  );
}

function ParetoPanel() {
  const cfg = useFleet((s) => s.cfg);
  const opt = useOptimizer();
  const [ranges, setRanges] = useState(RANGE_OPTIONS.map((r) => ({ ...r, on: ['battery.kwh', 'compute.cards', 'hull.petalLengthM'].includes(r.path) })));
  const [n, setN] = useState(200);
  const result = opt.response?.kind === 'pareto' ? opt.response.result : null;
  const front = new Set(result?.frontier ?? []);
  const pts: Pt[] = result
    ? result.points.map((p, i) => ({ i, capex: p.ev.capexTotal, pflop: p.ev.pflopHours, margin: p.ev.marginPerGpuHour, feasible: p.ev.feasible, values: p.values }))
    : [];
  const apply = (raw: unknown) => {
    const pt = ((raw as { payload?: Pt })?.payload ?? raw) as Pt | undefined;
    if (!pt?.values) return;
    let c = cfg;
    for (const [k, v] of Object.entries(pt.values)) c = setPath(c, k, v);
    useFleet.getState().replace(c);
    useFleet.getState().setNotice('Loaded the selected configuration into the sliders.');
  };
  const setRange = (k: number, patch: Partial<(typeof ranges)[number]>) =>
    setRanges((rs) =>
      rs.map((x, j) => {
        if (j !== k) return x;
        const next = { ...x, ...patch };
        const [lo, hi] = SLIDER_BOUNDS[x.path] ?? [-Infinity, Infinity];
        const clamp = (v: number) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : x.min);
        return { ...next, min: clamp(next.min), max: clamp(next.max) };
      }),
    );

  return (
    <section className="card">
      <h2>Best trade-offs: capex against delivered compute</h2>
      <div className="range-grid">
        {ranges.map((r, k) => (
          <div key={r.path} className="range-row">
            <label className="toggle-field">
              <input type="checkbox" checked={r.on} onChange={(e) => setRange(k, { on: e.target.checked })} /> {r.label}
            </label>
            <input type="number" step="any" value={r.min} aria-label={`${r.label} minimum`} onChange={(e) => setRange(k, { min: Number(e.target.value) })} />
            <span className="muted">to</span>
            <input type="number" step="any" value={r.max} aria-label={`${r.label} maximum`} onChange={(e) => setRange(k, { max: Number(e.target.value) })} />
          </div>
        ))}
      </div>
      <div className="controls-row">
        <label className="field">
          <span>Samples</span>
          <input type="number" min={20} max={1000} step={10} value={n} onChange={(e) => setN(Math.max(20, Math.min(1000, Number(e.target.value) || 200)))} />
        </label>
        <button
          className="primary"
          disabled={opt.busy || !ranges.some((r) => r.on && r.max > r.min)}
          onClick={() => opt.run({ kind: 'pareto', cfg, ranges: ranges.filter((r) => r.on && r.max > r.min).map(({ on: _on, ...r }) => r), n, seed: cfg.seed })}
        >
          {opt.busy ? 'Running' : 'Sample configurations'}
        </button>
        {opt.progress && <span className="muted">{opt.progress[0]} of {opt.progress[1]}</span>}
      </div>
      {opt.error && <p className="error-text">{opt.error}</p>}
      {result && (
        <ResponsiveContainer width="100%" height={380}>
          <ScatterChart margin={{ top: 8, right: 24, bottom: 24, left: 8 }}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis type="number" dataKey="capex" name="Swarm capex" tickFormatter={(v) => fmtUsdCompact(Number(v))} {...AXIS_PROPS} label={{ value: 'Swarm capex', position: 'insideBottom', offset: -12, fill: 'var(--muted)' }} />
            <YAxis type="number" dataKey="pflop" name="PFLOP-h per year" tickFormatter={(v) => fmtCompact(Number(v))} {...AXIS_PROPS} />
            <ZAxis range={[40, 40]} />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<ParetoTip />} />
            <Legend />
            <Scatter name="Feasible" data={pts.filter((p) => p.feasible && !front.has(p.i))} fill="var(--c6)" fillOpacity={0.5} onClick={apply} isAnimationActive={false} />
            <Scatter name="Infeasible" data={pts.filter((p) => !p.feasible)} fill="var(--c5)" fillOpacity={0.35} isAnimationActive={false} />
            <Scatter name="Best trade-offs" data={pts.filter((p) => front.has(p.i)).sort((a, b) => a.capex - b.capex)} fill="var(--c1)" line={{ stroke: 'var(--c1)' }} onClick={apply} isAnimationActive={false} />
          </ScatterChart>
        </ResponsiveContainer>
      )}
      <p className="note">Teal points are the best trade-offs: no other sampled configuration delivers more compute for less capital. Click a point to load it into the sliders.</p>
    </section>
  );
}

export function OptimizerTab() {
  return (
    <div className="tab-body">
      <SweepPanel />
      <ParetoPanel />
    </div>
  );
}
```

- [ ] **Step 2: Wire and style**

In `src/ui/MainContent.tsx` import `OptimizerTab` and add above `default:`:
```tsx
    case 'optimizer':
      return <OptimizerTab />;
```

Append to `src/styles.css`:
```css
.heatmap { display: grid; gap: 3px; min-width: max-content; }
.hm-corner, .hm-head { font-size: 12px; color: var(--muted); padding: 4px 6px; display: flex; align-items: center; }
.hm-head:not(.hm-row) { justify-content: center; text-align: center; }
.hm-cell { border: 1px solid var(--border); border-radius: 4px; padding: 8px 4px; font-size: 12px; font-variant-numeric: tabular-nums; background: var(--panel-2); }
.hm-cell.infeasible { background: repeating-linear-gradient(45deg, var(--panel-2), var(--panel-2) 4px, var(--panel) 4px, var(--panel) 8px) !important; color: var(--muted); }
.hm-cell.best { outline: 2px solid var(--text); outline-offset: 1px; }
.range-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 6px 16px; margin-bottom: 10px; }
.range-row { display: grid; grid-template-columns: 1fr 80px auto 80px; align-items: center; gap: 6px; }
.tip { background: var(--panel); border: 1px solid var(--border); border-radius: 6px; padding: 8px 10px; font-size: 12px; }
```

- [ ] **Step 3: Verify**

Run: `npm test && npm run typecheck && npm run build`
Expected: PASS.
In the browser, run the default sweep (battery kWh by cards). Expected: a progress counter, then an 8 by 8 heatmap with one outlined best cell; clicking a cell updates the sliders and the KPIs. Run Pareto sampling with 100 samples. Expected: a scatter with a teal frontier line; clicking a frontier point loads it.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add Optimizer tab with parameter sweep heatmap and Pareto trade-off chart"
```

---

### Task 18: Assumptions tab, README and final verification

**Files:**
- Create: `src/ui/tabs/AssumptionsTab.tsx`, `README.md`
- Modify: `src/ui/MainContent.tsx` (add the `assumptions` case, remove `Pending` and `default`), `src/styles.css` (append)

**Interfaces:**
- Consumes: `leafPaths`, `getPath`, `sourceFor`, presets, `PARAM_LABELS`, `GHI_ANCHORS`.
- Produces: `AssumptionsTab`, `MODEL_NOTES`.

- [ ] **Step 1: Implement the tab**

`src/ui/tabs/AssumptionsTab.tsx`:
```tsx
import { useMemo, type ReactNode } from 'react';
import { useFleet } from '../../state/store';
import { getPath, leafPaths } from '../../model/config';
import { sourceFor } from '../../model/defaults';
import { PANELS, BATTERIES, ACCELERATORS, TERMINALS, PLANS, THRUSTERS, GHI_ANCHORS, type Sourced } from '../../presets';
import { PARAM_LABELS } from '../panelDefs';

export const MODEL_NOTES = [
  "Irradiance is calibrated so each month's average matches NASA POWER all-sky climatology (2001 to 2025) at the swarm's distance from shore. ERA5 is not used for levels because it overstates summer sun here by up to about 25%.",
  'The marine layer follows the sourced June hourly clearness profile, scaled by month. Day-to-day weather draws clear, partly cloudy and overcast days in the sourced proportions.',
  'Cloud-seeking assumes a perfect forecast over its planning horizon, so its gain is an upper bound.',
  "GPU-hours are equivalents: delivered dense FP16/BF16 TFLOP divided by the card's dense TFLOPS. A card capped to half its power delivers about half a GPU-hour per hour here, which is conservative because real cards are more efficient when capped.",
  'Firm capacity is billed at the firm price and interruptible capacity at the spot price. Firm hours missed below the SLA target incur a penalty.',
  'Starlink data counts both directions against the plan cap. Without overage purchases, links throttle to the post-cap rate for the rest of the month.',
  'Capex is amortized over the horizon at the discount rate. Accelerator refresh and battery wear are also charged each year, which double counts some hardware and keeps costs conservative.',
  'Panels on water run cooler than on land: cell temperature is water temperature plus a rise proportional to irradiance.',
  'Values marked EST have no direct source and need vendor quotes. Reseller prices for Starlink plans and GPUs should be confirmed before investor use.',
];

const URL_RE = /https?:\/\/[^\s;)]+/g;

function SourceLinks({ source }: { source: string }) {
  const urls = source.match(URL_RE) ?? [];
  if (!urls.length) return <span>{source}</span>;
  const rest = source.replace(URL_RE, '').replace(/[();]/g, ' ').replace(/\s+/g, ' ').trim();
  const links: ReactNode[] = [];
  urls.forEach((u, i) => {
    let host = u;
    try {
      host = new URL(u).hostname.replace(/^www\./, '');
    } catch {
      // keep the raw URL text
    }
    if (i) links.push(', ');
    links.push(<a key={u} href={u} target="_blank" rel="noreferrer">{host}</a>);
  });
  return (
    <span>
      {links}
      {rest && <span className="muted"> {rest}</span>}
    </span>
  );
}

const fmtVal = (v: number) => Number(v.toPrecision(5)).toLocaleString('en-US', { maximumFractionDigits: 6 });

type Catalog = { title: string; items: { id: string; name: string }[]; fields: [string, string][] };

const CATALOGS: Catalog[] = [
  { title: 'Solar panels', items: PANELS, fields: [['efficiency', 'Efficiency'], ['usdPerW', 'Price'], ['kgPerM2', 'Areal mass'], ['tempCoeffPerC', 'Temperature coefficient']] },
  { title: 'Batteries', items: BATTERIES, fields: [['usdPerKwh', 'Price'], ['whPerKg', 'Specific energy'], ['rte', 'Round trip'], ['cycleLife', 'Cycle life']] },
  { title: 'Accelerators', items: ACCELERATORS, fields: [['tdpW', 'TDP'], ['denseTflops', 'Dense TFLOPS'], ['priceUsd', 'Price'], ['firmUsdPerGpuH', 'Firm price'], ['spotUsdPerGpuH', 'Spot price']] },
  { title: 'Starlink terminals', items: TERMINALS, fields: [['terminalW', 'Power'], ['usd', 'Price'], ['downMbps', 'Down'], ['upMbps', 'Up']] },
  { title: 'Starlink plans', items: PLANS, fields: [['usdPerMonth', 'Price'], ['capGB', 'Cap'], ['overageUsdPerGB', 'Overage']] },
  { title: 'Thrusters', items: THRUSTERS, fields: [['thrustN', 'Thrust'], ['maxElecW', 'Power'], ['usd', 'Price']] },
];

function PresetTable({ title, items, fields }: Catalog) {
  return (
    <div className="table-scroll">
      <h3>{title}</h3>
      <table className="data">
        <thead>
          <tr>
            <th>Option</th>
            {fields.map(([, label]) => (
              <th key={label} className="num">{label}</th>
            ))}
            <th>Sources</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => {
            const rec = it as unknown as Record<string, Sourced | null>;
            const sources = [...new Set(fields.map(([k]) => rec[k]?.source).filter((x): x is string => !!x))].join(' ; ');
            return (
              <tr key={it.id}>
                <td>{it.name}</td>
                {fields.map(([k]) => {
                  const s = rec[k];
                  return (
                    <td key={k} className="num" title={s ? `${s.source}${s.note ? `. ${s.note}` : ''}` : ''}>
                      {s ? `${fmtVal(s.value)} ${s.unit}` : 'n/a'}
                      {s?.estimate && <span className="badge est">EST</span>}
                    </td>
                  );
                })}
                <td><SourceLinks source={sources} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function AssumptionsTab() {
  const cfg = useFleet((s) => s.cfg);
  const rows = useMemo(
    () =>
      leafPaths(cfg)
        .filter((p) => p !== 'version' && typeof getPath(cfg, p) === 'number')
        .map((path) => {
          const value = getPath(cfg, path) as number;
          const src = sourceFor(cfg, path);
          const custom = !!src && src.unit !== '' && Math.abs(src.value - value) > 1e-9 * Math.max(1, Math.abs(value));
          return { path, value, src, custom };
        }),
    [cfg],
  );
  return (
    <div className="tab-body">
      <section className="card">
        <h2>How to read these numbers</h2>
        <ul className="notes">
          {MODEL_NOTES.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </section>
      <section className="card">
        <h2>Current scenario inputs</h2>
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>Parameter</th>
                <th className="num">Value</th>
                <th>Unit</th>
                <th>Source</th>
                <th>Accessed</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.path}>
                  <td>
                    {PARAM_LABELS[r.path] ?? r.path}
                    <div className="muted mono">{r.path}</div>
                  </td>
                  <td className="num">{fmtVal(r.value)}</td>
                  <td>{r.src?.unit ?? ''}</td>
                  <td>
                    <SourceLinks source={r.src?.source ?? 'Not sourced'} />
                    {r.src?.note && <div className="muted">{r.src.note}</div>}
                  </td>
                  <td>{r.src?.date ?? ''}</td>
                  <td>
                    {r.src?.estimate && <span className="badge est">EST</span>}
                    {r.custom && <span className="badge custom">CUSTOM</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card">
        <h2>Vendor catalogs</h2>
        {CATALOGS.map((c) => (
          <PresetTable key={c.title} {...c} />
        ))}
      </section>
      <section className="card">
        <h2>Southern California sunlight, NASA POWER all-sky GHI (kWh/m²/day)</h2>
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>Location</th>
                {MONTHS.map((m) => (
                  <th key={m} className="num">{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {GHI_ANCHORS.map((a) => (
                <tr key={a.km}>
                  <td>{a.label}<div className="muted">modeled at {a.km} km offshore</div></td>
                  {a.monthly.map((v, i) => (
                    <td key={i} className="num">{v.toFixed(2)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="note">Source: <SourceLinks source={GHI_ANCHORS[0].source} />. Full research tables: docs/research/2026-10-15-default-parameters.md.</p>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Finish `MainContent.tsx`**

Replace `src/ui/MainContent.tsx` with:
```tsx
import { useFleet, type TabId } from '../state/store';
import { Tabs } from './Tabs';
import { SwarmMapTab } from './tabs/SwarmMapTab';
import { ModuleTab } from './tabs/ModuleTab';
import { EnergyTab } from './tabs/EnergyTab';
import { EconomicsTab } from './tabs/EconomicsTab';
import { OptimizerTab } from './tabs/OptimizerTab';
import { AssumptionsTab } from './tabs/AssumptionsTab';
import { InvestorView } from './InvestorView';

function renderTab(tab: TabId) {
  switch (tab) {
    case 'map':
      return <SwarmMapTab />;
    case 'module':
      return <ModuleTab />;
    case 'energy':
      return <EnergyTab />;
    case 'economics':
      return <EconomicsTab />;
    case 'optimizer':
      return <OptimizerTab />;
    case 'assumptions':
      return <AssumptionsTab />;
  }
}

export function MainContent() {
  const tab = useFleet((s) => s.tab);
  const investor = useFleet((s) => s.investor);
  if (investor) return <InvestorView />;
  return (
    <>
      <Tabs />
      <div className="tab-body">{renderTab(tab)}</div>
    </>
  );
}
```

Append to `src/styles.css`:
```css
.notes { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; max-width: 90ch; }
.mono { font-family: var(--mono); font-size: 11px; }
.card h3 { font-size: 14px; margin: 14px 0 6px; }
```

- [ ] **Step 3: README**

`README.md`:
````markdown
# Fleet

Fleet is a local planning simulator for a swarm of solar-powered floating compute modules operating off Southern California and selling compute as a service over Starlink. It models sunlight and the marine layer, swarm station keeping, compute jobs, and service economics, and helps size hardware against delivered compute and margin.

## Run it

```bash
npm install
npm run dev     # opens on http://localhost:5173
npm test        # model unit tests
npm run build   # production build in dist/
```

## Where things live

The physics, swarm, job, economics and optimizer code is in `src/model/`. It is pure TypeScript with unit tests next to each file. Vendor and environment defaults are in `src/presets/`, and each value carries its source and access date; the underlying research is in `docs/research/2026-10-15-default-parameters.md`. The interface is in `src/ui/`, `src/state/` and `src/workers/`, and the design spec is in `docs/superpowers/specs/`.

## Caveats

Values marked EST in the app are estimates without a direct source. Confirm Starlink plans, GPU prices and every estimate with vendor quotes before using the numbers with investors. Cloud-seeking results assume a perfect forecast and are an upper bound.
````

- [ ] **Step 4: Full verification**

Run each command and confirm the expected result before moving on:

1. `npm test` passes, with every test file listed.
2. `npm run typecheck` is clean.
3. `npm run build` emits `dist/` with the two worker chunks.
4. `grep -rnP "\x{2014}" src docs README.md` returns no matches (no em dashes).
5. `grep -rn "not built yet\|GMR\|GrayMatter" src README.md` returns no matches.
6. `grep -rn "Math.random" src/model` returns no matches.

Then run `npm run dev` and check in the browser (use the `run` or `claude-in-chrome` skill):

- Every tab renders and the console shows no errors.
- The KPIs update after you move a slider.
- Exporting, then importing, the JSON round-trips. Importing a file with `"battery": {"rte": 3}` shows a field-level error and leaves the scenario unchanged.
- Dark and light themes are both legible.
- At 390 px wide there is no horizontal page scroll.
- Investor view hides the sliders.
- The Assumptions tab lists every input, shows EST badges, and shows a CUSTOM badge after you change a slider.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Assumptions tab with sourced inputs and vendor catalogs, README, final wiring"
```
