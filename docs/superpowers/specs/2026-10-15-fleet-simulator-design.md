# Fleet: Solar Ocean Compute Swarm Simulator, Design Spec

Date: 2026-10-15
Status: Draft for founder review

## 1. Purpose and audience

Fleet is a local, browser-based planning and simulation tool for a startup that operates a swarm of solar-powered floating compute modules and sells their compute as a service over Starlink. It serves two audiences:

1. The founder, for design-space exploration: tuning hardware, swarm, and business hyperparameters to maximize delivered compute and margin at acceptable cost.
2. Investors, for a polished, sourced presentation of unit economics and feasibility.

Success means the founder can change any major hardware, environment, swarm, or pricing assumption with a slider, immediately see the effect on delivered compute and service economics, find good configurations with the optimizer, and show an investor a clean summary whose every default number is traceable to a cited source.

### Assumptions (confirm or correct)

- Fleet is an independent venture. The tool carries no GMR branding or product names.
- All environment data (solar, clouds, currents, wind) is modeled from sourced statistics, not fetched live.
- "Compute" means commercially available accelerators (data center GPUs down to edge modules), selectable by preset.
- Default operating area is offshore Los Angeles / Southern California Bight.
- Business model is compute as a service: the company owns and operates the swarm and sells GPU-hours.

## 2. First-principles constraints the tool must make visible

- **Power, not volume, binds.** A 1.52 m x 1.52 m hull with petals deploying to roughly 3.5 m span carries on the order of 9 m² of PV, about 2 kW peak and only a few hundred watts averaged over 24 hours. Starlink and propulsion draw from that same budget.
- **Sun chasing is local.** Solar position moves far faster than a small vessel. The swarm cannot follow daylight. Achievable gains are petal tilt tracking, local cloud and marine-layer avoidance at kilometer scale, and seasonal or regional positioning.
- **Propulsion power scales with v³.** Station-keeping against the California Current and repositioning both cost energy that would otherwise run compute.
- **Compute per watt matters more than compute per card.** Lower-TDP accelerators may yield more total delivered compute from the same energy budget.
- **Seawater cooling** gives a modeled efficiency advantage (lower pod overhead power than a terrestrial PUE).

### Research findings that shape defaults (see Appendix A)

- **Starlink is a compute-class load.** A maritime-capable Performance Gen 3 terminal averages 75-100 W, more than one L4 (72 W). The Mini is officially 20-40 W but measured at 50-55 W. Terminal power is a first-order term in the energy budget.
- **Uplink and data plan, not only power, can bind.** At-sea uplink is about 8-25 Mbps per terminal. Beyond 12 nm, commercial use requires Global Priority ($250 for 50 GB to $2,150 for 2 TB per month, throttled to 0.5 Mbps up after the cap) or $6/GB Ocean Mode. Per-module data plans can rival per-module compute revenue, so data volume and plan cost are modeled explicitly.
- **Offshore is not sunnier in summer in the SoCal Bight.** NASA POWER shows July-August GHI 7-24% lower in outer waters than the inner Bight, and the strongest stratus lies 10-50+ km offshore and west of the Channel Islands. Cloud-seeking gains may be modest; the tool must report them honestly, including when station-keeping in the inner Bight wins.
- **Compute per watt ranking (dense BF16/FP16):** B200 2.25, H100 NVL 2.1-2.4, L4 1.68, H100/H200 SXM 1.41, L40S 1.03 TFLOPS/W. The 72 W L4 is the natural default for a ~300-400 W average budget.
- **ERA5 overstates summer GHI by up to about 25% here.** NASA POWER is the default irradiance source; ERA5 is used only for spatial shape.

## 3. Architecture

Single client-side TypeScript application. Vite + React + TypeScript, run locally with `npm run dev`. No backend.

```
src/
  model/            pure, deterministic, unit-tested functions; no DOM, no React
    solar.ts        sun position (NREL SPA style), clear-sky irradiance, POA irradiance by tracking mode
    environment.ts  marine layer deck, procedural cloud cells, current, wind series (seeded RNG)
    module.ts       one module, one timestep: PV, loads, propulsion, battery dispatch, compute power
    swarm.ts        formation, tolerance, stray/rejoin, centroid strategies
    jobs.ts         job arrivals, scheduler, Starlink transfer, checkpointing; plus aggregate formula
    economics.ts    capex, opex, revenue tiers, margin, payback, NPV, IRR, LCOC, tornado
    optimizer.ts    2D sweep and Pareto sampling over the annual aggregate model
    feasibility.ts  buoyancy, pod volume, wind stow downtime
    config.ts       Zod schema for the full scenario config, versioned
  presets/          vendor and location presets; every value has {value, unit, source, date}
  workers/          Web Workers for annual run and optimizer
  state/            Zustand store: current config, sim playback state, cached results
  ui/               React components: panels, tabs, charts (Recharts), map canvas, module diagram
```

Data flow: sliders write to the config in the Zustand store. The live view steps the model on the main thread at the chosen playback speed (one day, 5 minute steps). Config changes debounce-trigger the annual run in a Web Worker, which returns yearly metrics consumed by the KPI strip and the Economics tab. The optimizer runs in its own worker on demand.

Determinism: all stochastic elements (clouds, disturbances, job arrivals) use a seeded RNG. The seed is part of the scenario config, so results are reproducible and shareable.

## 4. Module model

### Inputs (slider panels, each backed by an editable preset)

- **Hull and petals:** hull side length (default 1.52 m), draft, petal count, petal length (sets deployed span and PV area), tracking mode (flat, 1-axis tilt, 2-axis), petal actuator power and cost.
- **Solar:** panel preset (efficiency, W/m², kg/m², $/W, temperature coefficient), MPPT efficiency, water-cooling temperature offset.
- **Battery:** preset (chemistry, $/kWh, Wh/kg, round-trip efficiency, cycle life), capacity kWh, depth of discharge.
- **Compute:** accelerator preset (TDP, dense FP16/BF16 TFLOPS, INT8 TOPS, memory, price, volume per card), card count, target utilization, host and network overhead watts, seawater cooling overhead factor.
- **Comms:** Starlink terminal preset (average and peak watts, price, throughput up and down, latency), plan preset (monthly cost, data cap, post-cap throttle rate, overage $/GB). Uplink topology: one terminal per module (default), or shared uplink where one terminal serves k modules over a short-range in-swarm radio link (radio power, cost, and range as parameters; range must exceed formation spacing). Shared uplink is a scenario lever for cutting Starlink power and plan cost at the price of bandwidth per module.
- **Propulsion:** thruster preset (thrust vs electrical power, price), thruster count, hull drag coefficient and frontal area, propulsive efficiency.
- **Environment:** location preset (default offshore LA), date, marine layer and cloud parameters, current speed and direction, wind statistics, wind stow threshold.

### Timestep (5 minutes live, 15 minutes annual)

1. Sun position from location and time.
2. Clear-sky irradiance, attenuated by the cloud field at the module position, projected onto the plane of array for the tracking mode.
3. PV DC power = POA irradiance x PV area x efficiency x temperature factor x MPPT efficiency. Zero when petals are stowed.
4. Fixed loads: Starlink, avionics, petal actuators, pod overhead.
5. Propulsion power = ½ ρ C_d A v³ / η, using the module's speed through water (ground velocity minus current).
6. Battery dispatch per operating policy:
   - **Daylight-only:** compute runs only on PV surplus; battery covers fixed loads overnight.
   - **24/7 battery-backed:** battery sized to sustain the firm compute commitment through the night.
   - **Max-throughput:** compute power-capped to whatever energy is available after loads, respecting minimum state of charge.
7. Compute power available, converted to delivered TFLOPS via the accelerator's TFLOPS/W at the power cap, bounded by card count and TDP.
8. Energy balance recorded: harvested = loads + propulsion + compute + battery delta + losses.

### Feasibility checks (red flags, never blocking)

- Buoyancy: total mass vs displaced mass at chosen draft.
- Pod volume: cards plus host plus heat exchanger vs pod internal volume.
- Wind stow downtime: fraction of hours above stow threshold.

### Outputs per module

Delivered TFLOP-hours per day and GPU-hour equivalents, energy waterfall, utilization, capex, cost per delivered PFLOP-hour.

## 5. Swarm and environment

### Map

Stylized 2D map of the Southern California Bight (approximately Point Conception to San Diego) from a small bundled coastline polyline. No external map tiles.

### Environment fields

- **Marine layer:** a data-driven stratus field. Its mean spatial pattern interpolates the three NASA POWER points (inner Bight, outer Bight, 300 km offshore) with ERA5 supplying only the spatial shape, so in summer the outer waters are cloudier than the inner Bight, matching the sourced climatology. Its diurnal cycle follows the sourced hourly clearness profile (thick at dawn, clearing fastest 09-12 local, thinnest mid-afternoon), and its seasonal strength follows the monthly clear/cloudy day shares. A day-to-day random draw selects clear, partly cloudy, or overcast days in the sourced proportions.
- **Cloud cells:** procedural noise field advected by wind. Sliders: cell size, coverage, drift speed.
- **Current:** uniform vector, default southward California Current, speed and heading sliders.
- **Wind:** seeded series from sourced statistics; triggers petal stow above threshold.

### Swarm behavior

- N modules (default 20, range 1 to 100) assigned to slots on a hexagonal lattice around the swarm centroid. Spacing and tolerance radius are sliders.
- Inside tolerance: free drift, zero propulsion energy.
- Outside tolerance: steer back toward slot.
- Beyond breakaway distance (caused by tunable wave and wind disturbance): flagged as a stray, executes a rejoin maneuver, energy charged to that module.
- Centroid strategies (selectable, comparable):
  1. **Station-keep:** hold a fixed point against current.
  2. **Drift:** ride the current, zero propulsion.
  3. **Cloud-seeking:** move centroid toward the best predicted irradiance within a lookahead horizon, capped speed, moving only when expected solar gain exceeds propulsion energy.
- Geofence: minimum and maximum offshore distance.

### Run modes

- **Live view:** one simulated day at adjustable playback speed, showing petals, clouds, modules, strays, and job packets.
- **Annual run:** 365 days at 15 minute steps in a Web Worker, using the aggregate job formula.

## 6. Compute jobs

### Arrivals and workload mix

Poisson arrivals at a configurable demand rate. Workload mix across three presets, each defined by compute per job, input bytes, output bytes, and deadline tolerance:

- **Batch AI inference:** small data, latency tolerant.
- **Training / fine-tune chunks:** long, checkpointed.
- **Data-heavy batch** (rendering, scientific): large inputs, bandwidth bound.

### Flow (live view, discrete)

Arrival, then the scheduler assigns the job to a module with free cards and sufficient power, then input downlink over that module's Starlink, then execution, then output uplink. Uplink and downlink are modeled as separate constraints. Power loss mid-job rolls back to the last checkpoint (checkpoint interval slider).

### Aggregate formula (annual run and optimizer)

Delivered compute per step = min(power-limited compute, bandwidth-limited compute, demand). A test asserts that the discrete and aggregate methods agree within tolerance on the same day.

### Binding constraint

Each step records which of power, bandwidth, or demand was binding. The KPI strip shows the current binding constraint; annual results report time share for each.

### Metrics

Delivered PFLOP-hours per day and year, GPU-hour equivalents, jobs completed, mean turnaround, card utilization, link utilization, binding constraint shares.

## 7. Compute-as-a-service economics

### Headline (per module and per swarm)

Billable GPU-hours per year, revenue, fully loaded cost per GPU-hour (amortized capex + opex + Starlink + maintenance), gross margin per GPU-hour and per module, payback months, NPV, IRR. The cost per GPU-hour is displayed next to the market reference price.

### Capacity tiers

- **Firm capacity:** battery-backed share deliverable 24/7, sold at a reserved or contract price, with an availability target and SLA penalty for shortfall.
- **Interruptible capacity:** solar surplus beyond the firm commitment, sold at a spot or preemptible price.

Default prices for both tiers come from sourced cloud rental rates for the selected accelerator class, editable. Firm defaults to a mid-market on-demand price (for L4, GCP $0.707/GPU-h); interruptible defaults to the low end of the market (for L4, RunPod community $0.44/GPU-h) as a proxy for spot pricing, since spot rates were not separately sourced.

### Capex per module (supporting chart)

Panels, petal mechanism and actuators, hull, pressure-rated pod and heat exchanger, battery, MPPT, accelerators, host and networking, Starlink terminal, thrusters, GNSS and avionics, integration and assembly (% uplift), contingency (%). Swarm level adds deployment vessel days and spares (% of fleet).

### Opex per year

Starlink plan x terminals, data overage (job bytes beyond plan cap at the overage rate, or throughput throttled after cap), maintenance visits x cost, insurance (% of capex), module loss rate, battery replacement from cycle life, accelerator refresh interval.

### Analysis outputs

Capex stacked breakdown, annual P&L, payback curve, NPV and IRR at user discount rate and horizon, levelized cost of compute per PFLOP-hour, tornado chart of ±20% input sensitivity on margin per GPU-hour.

## 8. Optimizer

Runs in a Web Worker on the 12 representative day model (one day per month). A test asserts the 12 day model is within a few percent of the 365 day run for the default scenario.

1. **2D sweep:** user picks any two inputs as axes (for example battery kWh x card count, accelerator preset x petal span, panel preset x swarm strategy) and one target metric (delivered compute, cost per GPU-hour, margin, payback). Output: heatmap with infeasible cells hatched.
2. **Pareto sampling:** about 500 random configs within user ranges, plotted as capex vs annual delivered compute (or margin), frontier highlighted. Clicking a point loads that config into the sliders.

## 9. User interface

```
Fleet  [Scenario ▾] [Save] [Export JSON] [Import]                     [Investor ◐]
KPI strip: PFLOP-h/yr | Binding constraint | Cost/GPU-h vs market | Margin | Payback | Feasibility flags
Left: collapsible slider panels (Hull/Petals, Solar, Battery, Compute, Comms, Propulsion,
      Environment, Swarm, Jobs, Economics)
Center tabs: Swarm Map | Module | Energy | Economics | Optimizer | Assumptions
Playback bar: play/pause, speed 1x to 1000x, date scrubber
```

- **Swarm Map:** live canvas simulation.
- **Module:** animated flower diagram (petals opening and tracking) plus a Sankey of one day's energy flow.
- **Energy:** 24 hour chart of irradiance, PV output, loads, battery SOC, and compute power.
- **Economics:** headline service metrics, capex breakdown, P&L, payback, tornado.
- **Optimizer:** sweep heatmap and Pareto chart.
- **Assumptions:** every preset value with unit, source URL, and date.
- **Investor mode:** hides slider panels, presents a saved scenario as a clean KPI and chart story.

Scenarios save to localStorage and export/import as versioned JSON validated by the Zod schema. Invalid imports show a clear error listing failing fields.

Visual direction: a polished ocean-dark theme with light mode support, consistent chart palette, readable at laptop and projector sizes.

## 10. Error handling

- Slider ranges enforce valid domains; derived impossibilities (for example negative available power) clamp to zero and raise a feasibility flag instead of throwing.
- Worker failures surface a non-blocking error banner and keep the last good results visible.
- Import validation rejects malformed scenarios with field-level messages.

## 11. Testing

Vitest, written test first for the model layer:

- Solar position matches NREL SPA reference values within tolerance.
- Energy conservation per timestep.
- Propulsion power scales with v³.
- Discrete vs aggregate job model agreement on the same day.
- 12 day vs 365 day agreement.
- Economics outputs match a hand-computed reference case (payback, NPV, IRR, cost per GPU-hour).
- Swarm: a displaced module beyond breakaway returns within tolerance in bounded time; drift strategy uses zero propulsion energy.
- Config schema round trip (export then import yields an identical config).

UI is verified by running the app in a browser and exercising each tab.

## 12. Out of scope (v1)

Live weather or irradiance feeds, hydrodynamic hull simulation, RF link budgets, multi-swarm logistics, user accounts or a backend, deployment hosting.

## Appendix A: Sourced default values

Full sourced tables, URLs, and data queries: `docs/research/2026-10-15-default-parameters.md`. The presets in `src/presets/` are generated from that file, and every value carries its source and date into the Assumptions tab. Values with no source are labeled ESTIMATE in the UI.

Default scenario (a starting point, expected to be revised once the optimizer runs):

| Parameter | Default | Basis |
|---|---|---|
| Location | Outer Bight, 33.3 N 119.5 W, geofence 20-150 km offshore | POWER cell, NDBC buoys |
| Monthly GHI | POWER outer Bight series, annual 4.95 kWh/m²/day | NASA POWER climatology 2001-2025 |
| Marine layer | June hourly clearness 0.54 (06) to 0.80 (14) LST, seasonal strength from monthly clear/cloudy day shares | NASA POWER hourly and daily |
| Current | 0.15 m/s toward 141°, variability to p90 0.39 m/s | Open-Meteo Marine (SMOC) |
| Wind | mean 5.0 m/s, stow threshold 13.9 m/s | POWER WS10M, NDBC |
| Waves | mean Hs 1.5-2.1 m (disturbance strength) | NDBC 46086, 46069 |
| Hull | 1.52 m square, petals to 3.5 m span | Founder brief |
| Panels | CSI TOPHiKu6, 23.4%, -0.29%/°C, €0.120/W wholesale | Datasheet, sun.store index |
| Battery | LFP, $81/kWh pack benchmark plus marine enclosure uplift, 179 Wh/kg cell, 92% RTE | BNEF 2025, EVE MB31 |
| Accelerator | NVIDIA L4, 72 W, 121 TFLOPS dense FP16, $3,995 | NVIDIA, IT Creations |
| Starlink | Mini (45 W modeled average, between official and measured), $149; Global Priority 500 GB $650/mo | Anker, EarthSims, DishyCentral |
| Thrusters | 2x Blue Robotics T200, $230 each | Blue Robotics |
| MPPT | Victron SmartSolar 150/35, $149 | SolarCellzUSA |
| GNSS | SparkFun ZED-F9P, $184 | SparkFun |
| Hull, pod, heat exchanger, petal mechanism | ESTIMATE ranges, flagged in UI | See research file |
| Prices | Firm $0.707/GPU-h, interruptible $0.44/GPU-h (L4) | GCP, RunPod |

Confirm with vendor quotes before investor use: Starlink plans and terminal power, GPU prices, and every ESTIMATE row.
