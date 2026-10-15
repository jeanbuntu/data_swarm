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
