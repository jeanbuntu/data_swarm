# Fleet: Sourced Default Parameters

All values accessed 2026-10-15 unless noted. Prices are USD unless marked. "Derived" means computed by us from the cited source. Rows marked ESTIMATE are unsourced and must be shown as such in the Assumptions tab. Third-party reseller sources should be confirmed with vendor quotes before investor use (especially Starlink plans and GPU prices).

Data query keys (substitute LAT/LON):

- **P-C** NASA POWER climatology 2001-2025: `https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=ALLSKY_SFC_SW_DWN,CLRSKY_SFC_SW_DWN,CLOUD_AMT,WS10M,WS50M&community=RE&latitude=LAT&longitude=LON&format=JSON`
- **P-D** POWER daily 2015-2024: `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=ALLSKY_SFC_SW_DWN,CLRSKY_SFC_SW_DWN,WS10M,WS10M_MAX&community=RE&latitude=LAT&longitude=LON&start=20150101&end=20241231&format=JSON`
- **P-H** POWER hourly, June 2019-2023, LST: `https://power.larc.nasa.gov/api/temporal/hourly/point?parameters=ALLSKY_SFC_SW_DWN,CLRSKY_SFC_SW_DWN&community=RE&latitude=LAT&longitude=LON&start=YYYY0601&end=YYYY0630&time-standard=LST&format=JSON`
- **E5** ERA5 via Open-Meteo 2015-2024: `https://archive-api.open-meteo.com/v1/archive?latitude=LAT&longitude=LON&start_date=2015-01-01&end_date=2024-12-31&daily=shortwave_radiation_sum&models=era5`
- **OM** Open-Meteo Marine Oct 2023 to Sep 2025 (currents: Meteo-France SMOC, includes tides and waves): `https://marine-api.open-meteo.com/v1/marine?latitude=LAT&longitude=LON&hourly=wave_height,ocean_current_velocity,ocean_current_direction&start_date=2023-10-01&end_date=2025-09-30`
- **NDBC** buoy stdmet 2020-2024: `https://www.ndbc.noaa.gov/view_text_file.php?filename=STNhYYYY.txt.gz&dir=data/historical/stdmet/`

## 1. Solar panels (W/m² and kg/m² derived from datasheet power, dimensions, mass)

| Item | Specs | Price | Source |
|---|---|---|---|
| CSI Solar TOPHiKu6 CS6.2-54TM-520 (standard TOPCon) | 520 W, 23.4%, 1961x1134 mm, 23.3 kg; 234 W/m², 10.5 kg/m²; -0.29%/°C | €0.120/W wholesale (sun.store index Sep 2026) | https://solarproof.com.au/datasheets/panel_datasheet_CS-Datasheet-TOPHiKu6_CS6.2-54TM_v1.2_EN.pdf ; https://now.solar/2026/10/09/european-pv-module-prices-inch-downwards-in-september-pv-tech/ |
| Maxeon 7 SPR-MAX7-445-PT (premium IBC) | 445 W, 24.1%, 1787x1035 mm, 20.7 kg; 241 W/m², 11.2 kg/m²; -0.27%/°C | ESTIMATE $1.00-1.50/W retail | https://www.cleanenergyreviews.info/s/Sunpower_maxeon_7_112c_PT_435-445_res_dc_en_a4_551184A_v2.pdf |
| Aiko Neostar 3S 485 W (premium ABC) | 485 W, 24.3%, 1762x1134 mm, 21.1 kg; 243 W/m², 10.6 kg/m²; -0.26%/°C | €0.354/W retail; €0.128/W wholesale BC index | https://www.wattuneed.com/en/traditional-solar-panels/27902-aiko-neostar-3s-mono-glass-gen3-485wc-0768563824760.html |
| Solbian SP137 (flexible marine) | 137 W, 1490x546x2 mm, 2.0 kg; 168 W/m² (16.8%), 2.46 kg/m²; -0.38%/°C | $10.94/W retail | https://emarineinc.com/products/solbian-137w-24v-flexible-solar-panel-sp137 |
| MiaSolé FLEX-03 400M (flexible CIGS) | 400 W, 17.4% aperture, 2580x973 mm; 159 W/m², 1.7 kg/m²; -0.38%/°C; IEC 61701 | ESTIMATE $0.80-1.50/W | https://miasole.com/wp-content/uploads/2022/07/flex-03m_2.6m_datasheet_jp-2019.pdf |

## 2. Batteries (LFP)

| Item | Specs | Price | Source |
|---|---|---|---|
| BNEF 2025 pack survey (benchmark) | LFP pack average | $81/kWh LFP; $70/kWh stationary | https://about.bnef.com/insights/clean-energy/lithium-ion-battery-pack-prices-fall-to-108-per-kilowatt-hour-despite-rising-metal-prices-bloombergnef/ (Dec 2025) |
| EVE MB31 314 Ah cell | 1004.8 Wh, 5.6 kg = 179 Wh/kg; 8000 cycles to 70% SOH; RTE 92-95% cell | $74/kWh retail | https://www.18650batterystore.com/collections/lifepo4-prismatic-cells/products/eve-mb31-grade-a-cells-3-2v-lifepo4-314ah-battery |
| Victron NG 12.8 V 200 Ah (marine) | 2560 Wh, 19.0 kg = 135 Wh/kg, IP65; 2500 cycles at 80% DoD, 92% RTE (older Smart datasheet) | $579/kWh | https://www.solar-electric.com/victron-energy-12-8v-200ah-ng-lifepo4-battery.html |
| Battle Born 100 Ah 12 V (marine/RV) | 1280 Wh, 14.1 kg = 91 Wh/kg; 3000-5000 cycles at 80% DoD; RTE ESTIMATE 92% | $624/kWh | https://battlebornbatteries.com/products/100ah-12v-lifepo4-deep-cycle-batteries |

## 3. Starlink (starlink.com renders client-side; values via resellers and third parties)

| Item | Specs | Price | Source |
|---|---|---|---|
| Starlink Mini | Official avg 20-40 W, idle 15 W, 60 W peak; independent measurement 50-55 W avg | $149 | https://www.ankersolix.com/blogs/smart-home/starlink-mini-power-consumption ; https://earthsims.com/starlink/starlink-mini-review/ |
| Starlink Standard (Gen 3) | Avg 75-100 W, idle ~20 W; in-motion maritime not supported | $349 | https://www.dishytech.com/how-much-power-does-starlink-use/ |
| Starlink Performance (Gen 3, maritime) | Avg 75-100 W; peak ESTIMATE ~150 W; IP68; 5.2 kg | $1,849 | https://emarineinc.com/products/starlink-performance-gen3-kit-w-flat-mount |
| Flat High Performance (Gen 2, legacy) | Avg 110-150 W, idle ~45 W | $2,500 | https://starlinkinsider.com/starlink-maritime/ |
| Global Priority plan (commercial, ocean) | 50 GB / 500 GB / 1 TB / 2 TB; after cap 1 Mbps down / 0.5 Mbps up; +50 GB add-on $100 | $250 / $650 / $1,150 / $2,150 per month | https://dishycentral.com/starlink-business-plans (2026-09-25) |
| Personal Maritime / Roam + Ocean Mode | Personal vessels under 40 ft only; beyond 12 nm, $6/GB (since 2026-09-27) | $185 / $175 per month | https://www.basenor.com/blogs/news/starlink-personal-maritime-plan-185-mo-for-small-boat-owners |
| Throughput at sea | 40-220 Mbps down, 8-25 Mbps up, 20-40 ms (older figures) | n/a | https://starlinkinsider.com/starlink-maritime/ |

## 4. Accelerators (dense = half of NVIDIA sparse figures)

| Item | TDP | Dense BF16/FP16 TFLOPS | TFLOPS/W | Memory | Price | Source |
|---|---|---|---|---|---|---|
| B200 (HGX) | 1000 W | 2,250 | 2.25 | ~180 GB | $30-50k | https://lenovopress.lenovo.com/lp2226 ; https://intuitionlabs.ai/articles/data-center-gpu-prices |
| H200 SXM | 700 W | 989 | 1.41 | 141 GB | $30-40k | https://www.nvidia.com/en-us/data-center/h200/ |
| H100 SXM | 700 W | 989 | 1.41 | 80 GB | $25-31k | https://www.nvidia.com/en-us/data-center/h100/ |
| H100 NVL (PCIe) | 350-400 W | 835 | 2.09-2.39 | 94 GB | ESTIMATE $25-30k | https://www.nvidia.com/en-us/data-center/h100/ |
| L40S | 350 W | 362 | 1.03 | 48 GB | $9,970 new | https://www.newegg.com/p/N82E16888892001 |
| L4 | 72 W | 121 | 1.68 | 24 GB | $3,995 new; ~$2,700 used | https://www.itcreations.com/product/159905 |
| Jetson AGX Orin 64GB | 15-60 W | INT8 ~137 dense TOPS (FP16 not stated) | n/a | 64 GB | $3,499 dev kit | https://hwbusters.com/news/nvidia-jetson-prices-jump-up-to-101-the-249-orin-nano-super-is-now-399/ |
| Jetson AGX Thor T5000 | 40-130 W | FP4 2,070 sparse (BF16 not stated) | n/a | 128 GB | $5,499 dev kit | https://www.nvidia.com/en-us/autonomous-machines/embedded-systems/jetson-thor/ |

## 4b. Cloud GPU rental, on-demand $/GPU-hour (hyperscaler per-instance price / GPU count, derived)

| GPU | Prices | Sources |
|---|---|---|
| H100 | AWS $6.88; GCP $11.06; Azure $12.29; Lambda $3.99-4.29; CoreWeave $6.16; RunPod community $2.69, secure $3.99 | instances.vantage.sh, gcloud-compute.com, lambda.ai/pricing, coreweave.com/pricing, runpod.io/pricing |
| H200 | AWS $7.91; CoreWeave $6.31; RunPod $3.59 / $5.29 | same |
| B200 | AWS $14.24; Lambda $6.69-6.99; CoreWeave $8.60; RunPod $5.98 / $7.99 | same |
| A100 80GB | AWS $3.43; Lambda $2.79; CoreWeave $2.70; RunPod $1.39 / $1.79 | same |
| L40S | AWS $1.86; CoreWeave $2.25; RunPod $0.79 / $1.09 | same |
| L4 | AWS $0.805; GCP $0.707; RunPod $0.44 / $0.59 | same |

## 5. Thrusters

| Item | Specs | Price | Source |
|---|---|---|---|
| Blue Robotics T200 | 3.71 kgf @ 205 W (12 V); 5.25 kgf @ 390 W (16 V); 6.7 kgf @ 645 W (20 V) | $230; $184 at 150+ | https://bluerobotics.com/store/thrusters/t100-t200-thrusters/t200-thruster-r2-rp/ |
| Blue Robotics T500 | 6.0 kgf @ 202 W; 9.3 kgf @ 402 W; 13.0 kgf @ 681 W; 16.1 kgf @ 1044 W (24 V) | $790; $632 at 150+ | https://bluerobotics.com/store/thrusters/t500-thruster/ |
| Torqeedo Ultralight 403 | 400 W in, 180 W propulsive, ~15 kgf static | $2,499 with battery | https://www.overtons.com/torqeedo-ultralight-403-ac-363899.html |
| ePropulsion Spirit 1.0 Evo | 1000 W, 316 N static, 48 V | £2,125 with battery | https://www.epropulsion.com/ |

## 6. Southern California environment

### 6a. Monthly GHI, kWh/m²/day (Jan..Dec, annual), NASA POWER (CERES SYN1deg, 1° grid)

| Point | Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec | Annual |
|---|---|---|
| Inner Bight / LA cell (33.95, -118.45) | 3.14 4.01 5.17 6.32 6.55 6.29 6.55 6.34 5.47 4.31 3.40 2.83 | 5.04 |
| Outer Bight ~100-180 km (33.3, -119.5) | 3.19 4.06 5.19 6.40 6.58 6.13 6.08 5.84 5.28 4.27 3.43 2.88 | 4.95 |
| ~300 km offshore (32.5, -121.5) | 3.15 3.89 5.04 6.00 6.14 5.92 4.99 4.82 4.91 4.15 3.36 2.81 | 4.60 |

ERA5 transect (10/50/100/150/300 km WSW of Santa Monica): annual 5.56 / 5.57 / 5.66 / 5.62 / 5.28. ERA5 runs 0.6-1.5 kWh/m²/day above POWER in May-Aug, consistent with reanalysis under-representing stratus. **POWER is the default; ERA5 is used only for spatial shape.** The 100 km and 150 km POWER points share one grid cell.

Along the coast (POWER annual): San Diego offshore 4.91; LA 5.04; Pt Conception offshore 5.09; Big Sur offshore 4.78; San Francisco offshore 4.37.

### 6b. Marine layer (derived; K = all-sky / clear-sky daily GHI; clear K≥0.9, cloudy K<0.6)

- Cloud amount: inner May 59%, Jun 68%, Jul 63%; outer Jun 61%, Jul 64%; 300 km Jul 85%, Aug 80%.
- May-Jul clear / cloudy day share: inner 30% / 18%; outer 26% / 26%; 300 km 19% / 47%. Clear days deliver 0.96-0.97 of clear-sky, cloudy days ~0.48-0.50. Full-year clear-day share: 47% / 46% / 34%.
- June hourly K (burn-off): inner 0.50 (06 LST), 0.67 (09), 0.81 (12), 0.85 (14). Outer 0.54, 0.64, 0.76, 0.80. 300 km peaks at 0.73 (13 LST). Clearings expand fastest 09-12 PST (https://acp.copernicus.org/articles/20/4637/2020/acp-20-4637-2020.pdf).
- Maximum cloud albedo lies 10-50+ km offshore; south of Pt Conception the maximum is west of the Channel Islands, with lower albedo over the inner Bight (https://cw3e.ucsd.edu/wp-content/uploads/2013/09/10.1002_jgrd.50652.pdf). June is the cloudiest month in SoCal (https://swcasc.arizona.edu/publication/northward-march-summer-low-cloudiness-along-california-coast).

### 6c. Currents, wind, waves

- California Current: southward, generally 0.05-0.10 m/s, core up to 0.25 m/s; poleward countercurrent inshore in summer to early fall (https://montereybay.noaa.gov/sitechar/phys21.html).
- Total surface current at (33.3, -119.5), SMOC incl. tides and waves: mean 0.23 m/s, p90 0.39, max 0.69; vector-mean drift 0.15 m/s toward 141° (SE). (OM)
- Waves, NDBC mean / p90 / p99 Hs (m): 46025 Santa Monica Basin 1.12 / 1.68 / 2.92; 46086 San Clemente Basin 1.52 / 2.29 / 3.66; 46069 S. Santa Rosa 2.11 / 3.24 / 4.73; 46047 Tanner Bank 2.11 / 3.32 / 4.66. Winter mean ~1.6x summer.
- Wind, NDBC mean (m/s): 3.5 / 4.3 / 6.9 / 6.0 (same buoys). Days with any hourly obs >13.9 m/s: 2.1% / 1.1% / 12.6% / 2.5%. Gale days (>17.2 m/s) under 0.6%.
- Wind, POWER WS10M mean: inner 3.2, outer 5.0, 300 km 7.2 m/s.
- Cloud cells: marine stratocumulus 10-100 km (https://par.nsf.gov/servlets/purl/10286039). Drift speed ESTIMATE = boundary-layer wind (POWER WS50M 5.7 m/s outer Bight).

### 6d. Other regions (for location presets)

| Region | Annual GHI | Clear days | Wind WS10 | Hs mean / p90 | Current mean |
|---|---|---|---|---|---|
| Equatorial Pacific (0, -140) | 6.70 | 77% | 6.0 | 1.94 / 2.34 | 0.58 (p90 1.06) |
| Canaries offshore (28, -17.5) | 5.35 | 44% | 5.7 | 1.80 / 2.58 | 0.23 |
| Arabian Sea (15, 65) | 5.72 (monsoon Jun-Aug ~4.8-5.1) | 64% | Jul 11.2 | p90 4.04 | n/a |

## 7. Supporting costs

| Item | Specs | Price | Source |
|---|---|---|---|
| Victron SmartSolar MPPT 150/35 | 35 A (~2 kW at 48 V) | $148.54 (~$0.07/W at 48 V) | https://store.solarcellzusa.com/products/victron-energy-smartsolar-mppt-150-35 |
| Garmin GPS 24xd | Multi-band GNSS, NMEA 2000 | $250-356 | https://www.thornebros.com/products/garmin-gps-24xd-receiver-and-antenna-for-the-nmea-2000-network-010-02316-10 |
| SparkFun ZED-F9P | RTK GNSS | $184 | https://www.sparkfun.com/categories/86?page=1 |
| Blue Robotics 8" enclosure | Acrylic to 40 m | from $492 | https://bluerobotics.com/?p=13476 |
| Seawater heat exchanger ~10 kW Ti plate | Alfa Laval AQ1A 9-plate | ESTIMATE $500-1,500 | https://shop.alfalaval.com/ |
| Custom ~1.5 m hull | Commercial USVs 1.3-8 m: $30k to millions | ESTIMATE $5-15k | https://pmc.ncbi.nlm.nih.gov/articles/PMC9041221/ |
| Petal deployment and tracking mechanism | n/a | ESTIMATE (no source found) | n/a |
