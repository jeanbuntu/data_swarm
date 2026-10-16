import type { Sourced } from './sourced';
import { PANELS, BATTERIES, ACCELERATORS, TERMINALS, PLANS, THRUSTERS } from './hardware';
import { COSTS } from './costs';
import { SOCAL_ENV, DAY_TYPE, DAY_K, MARINE_PROFILE_SOURCE, MARINE_MONTHLY_SOURCE } from './socal';
import { WORKLOADS } from './workloads';
import { MARKET_DEFAULTS } from './market';

export * from './sourced';
export * from './hardware';
export * from './costs';
export * from './socal';
export * from './workloads';
export * from './market';

export const ALL_PRESET_DATA = {
  PANELS, BATTERIES, ACCELERATORS, TERMINALS, PLANS, THRUSTERS, COSTS, SOCAL_ENV, DAY_TYPE, DAY_K,
  MARINE_PROFILE_SOURCE, MARINE_MONTHLY_SOURCE, WORKLOADS, MARKET_DEFAULTS,
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
