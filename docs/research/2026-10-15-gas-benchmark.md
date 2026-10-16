# Gas-powered (behind-the-meter) AI data center: default parameters per GPU-hour

All values were retrieved by web research on 2026-10-15. "Date" is the publication or data date where the source states one, and the access date (2026-10-15) otherwise. Rows marked "derived" are arithmetic on sourced inputs. Rows marked "UNSOURCED - estimate" had no credible public source.

Assumptions to confirm: US dollars, nominal (vendor and EIA dollar-years are listed in the unit column); fuel prices are HHV-based, so all vendor LHV heat rates are converted with HHV = LHV x 1.11; the comparison case is an owner-operated campus with on-site gas as prime power; GPU utilization of 80% (UNSOURCED - estimate) and a 9.33% cost of capital (the WACC used in the Meta-cluster analysis cited in item 7) are modelling defaults chosen for this report.

## 1. Natural gas price

| item | value | unit | source URL | date | note |
|---|---|---|---|---|---|
| Henry Hub spot, 2026 average (STEO forecast) | 3.48 | $/MMBtu | https://www.eia.gov/outlooks/steo/report/natgas.php | released 2026-10-06 | Recommended default. STEO 2027 forecast is 3.16. |
| Henry Hub spot, Sep 2026 monthly average | 2.95 | $/MMBtu | https://www.eia.gov/dnav/ng/hist/rngwhhdm.htm | release 2026-10-15 | Jan 2026 was 7.72 (winter storm Fern); Feb to Sep 2026 ranged 2.77 to 3.62. |
| Henry Hub futures (NYMEX) | not obtained | $/MMBtu | https://www.eia.gov/dnav/ng/hist/rngc1d.htm | accessed 2026-10-15 | EIA futures table ends Apr 2024; CME settle pages not retrieved. Spot plus STEO cover item 1. |
| US industrial delivered price, trailing 12 mo (Aug 2025 to Jul 2026) | 5.33 / 5.14 | $/Mcf / $/MMBtu | https://www.eia.gov/dnav/ng/hist/n3035us3m.htm | release 2026-09-30 | Derived simple mean of monthly values; Jul 2026 alone is 4.58 $/Mcf. Proxy for a non-California site paying delivered gas. |
| California industrial price, trailing 12 mo (Aug 2025 to Jul 2026, Apr 2026 NA) | 12.54 / 12.09 | $/Mcf / $/MMBtu | https://www.eia.gov/dnav/ng/hist/n3035ca3m.htm | release 2026-09-30 | Derived simple mean of 11 months; Jul 2026 alone is 11.09 $/Mcf. 2025 annual (volume weighted) is 13.06 $/Mcf per https://www.eia.gov/dnav/ng/hist/n3035ca3a.htm |
| Conversion | 1 Mcf = 1.037 | MMBtu | https://www.eia.gov/tools/faqs/faq.php?id=45&t=8 | 2025 US average heat content | $/MMBtu = ($/Mcf) / 1.037 |

## 2. Heat rate (HHV basis) and fuel cost per MWh

| item | value | unit | source URL | date | note |
|---|---|---|---|---|---|
| HHV/LHV conversion | 1.11 | ratio | https://www.fortisbc.com/services/commercial-industrial-services/natural-gas-price-market-curtailment-information | accessed 2026-10-15 | Utility rule of thumb. Applied to vendor LHV/ISO figures below. |
| Reciprocating engine, EIA reference plant (4 x 5.6 MW) | 8,295 | Btu/kWh HHV | https://www.eia.gov/analysis/studies/powerplants/capitalcost/pdf/capital_cost_AEO2020.pdf | Feb 2020 | Recommended recip default (conservative). AEO2025 report dropped the engine case. |
| Wartsila 50SG, 790 MW off-grid Texas data center | 6,800 LHV (about 7,550 HHV) | Btu/kWh | https://www.wartsila.com/media/news/23-04-2026-wartsila-continues-to-expand-its-data-center-footprint-with-new-790-mw-order-in-texas-the-next-data-center-alley-3743595 | 2026-04-23 | "approx. 50% efficiency" implies LHV. HHV derived. |
| Jenbacher J620 | 43.3% (about 7,880 LHV, 8,750 HHV) | efficiency / Btu/kWh | https://www.jenbacher.com/en/gas-engines/type-6/j620-fast-start/ | accessed 2026-10-15 | At generator terminals; heat rates derived. |
| Aeroderivative simple cycle, EIA reference (4 x 54 MW) | 9,447 | Btu/kWh HHV | https://www.eia.gov/analysis/studies/powerplants/capitalcost/pdf/capital_cost_AEO2025.pdf | Jan 2024 (2023 $) | Recommended turbine default. |
| GE Vernova LM2500XPRESS class | 8,861 LHV (about 9,840 HHV) | Btu/kWh | https://gevernova.com/gas-power/products/gas-turbines/lm2500 | accessed 2026-10-15 | ISO, 38.5% net; column pairing on page not fully clear. |
| Solar Turbines Titan 350 (38 MW) | 8,495 (about 9,430 HHV) | Btu/kWh ISO | https://solarturbines.com/en_US/products/power-generation-packages/titan-350-38mw.html | accessed 2026-10-15 (via search snippet; page timed out) | Industrial gas turbine; not confirmed as aeroderivative. Basis assumed LHV. |
| Combined cycle, EIA (2x2x1 H class / 1x1x1) | 6,266 / 6,226 | Btu/kWh HHV | https://www.eia.gov/analysis/studies/powerplants/capitalcost/pdf/capital_cost_AEO2025.pdf | Jan 2024 | Lazard new-build CCGT: 6,475 to 6,550. |
| Fuel cost, recip 8,295, at HH 3.48 / US ind 5.14 / CA 12.09 | 28.9 / 42.6 / 100.3 | $/MWh | derived | 2026-10-15 | Heat rate x price / 1000. |
| Fuel cost, Wartsila 7,550 HHV | 26.3 / 38.8 / 91.3 | $/MWh | derived | 2026-10-15 | Same price order. |
| Fuel cost, aero 9,447 | 32.9 / 48.6 / 114.2 | $/MWh | derived | 2026-10-15 | Same price order. |
| Fuel cost, CC 6,266 | 21.8 / 32.2 / 75.8 | $/MWh | derived | 2026-10-15 | Same price order. |

What gas-powered AI sites actually use: xAI Colossus 1 (Memphis) ran Solar SMT-130 turbines (about 16 MW) and VoltaGrid 2.5 MW mobile units, and Colossus 2 (Southaven) uses Titan 350 units (https://en.wikipedia.org/wiki/Colossus_(supercomputer), https://cleanview.co/reports/behind-the-meter-data-centers/full-report/colossus, accessed 2026-10-15). Crusoe's Abilene campus permits list five GE LM2500XPRESS aeroderivatives plus Titan 350s, about 360 MW initial, alongside an ERCOT connection (https://cleanview.co/reports/behind-the-meter-data-centers/full-report/stargate-abilene, accessed 2026-10-15). VoltaGrid's 2.3 GW Oracle program uses INNIO Jenbacher reciprocating engines (https://www.powermag.com/oracle-taps-voltagrid-for-2-3-gw-modular-gas-fleet-to-power-ai-data-centers-across-texas/, Oct 2025). Practice therefore mixes small industrial or aeroderivative turbines (speed to power) and large reciprocating engine fleets (efficiency, modular N+x redundancy); combined cycle is rare at behind-the-meter sites because of size and lead time.

## 3. Generation O&M and capex

| item | value | unit | source URL | date | note |
|---|---|---|---|---|---|
| Recip capex, EIA | 1,810 | $/kW (2019 $) | https://www.eia.gov/analysis/studies/powerplants/capitalcost/pdf/capital_cost_AEO2020.pdf | Feb 2020 | Pre-shortage; treat as floor-to-mid. |
| Recip fixed O&M / variable O&M, EIA | 35.16 / 5.69 | $/kW-yr / $/MWh (2019 $) | same | Feb 2020 | Fixed O&M is about 4.5 $/MWh at 90% capacity factor (derived). |
| Aero capex, EIA | 1,606 | $/kW (2023 $) | https://www.eia.gov/analysis/studies/powerplants/capitalcost/pdf/capital_cost_AEO2025.pdf | Jan 2024 | |
| Aero fixed O&M / variable O&M, EIA | 9.56 / 5.70 | $/kW-yr / $/MWh (2023 $) | same | Jan 2024 | Fixed O&M is about 1.2 $/MWh at 90% CF (derived). |
| Gas peaking new build, Lazard | 1,150 to 1,450; FOM 10 to 17; VOM 3.50 to 5.00; HR 10,275 to 11,175 | $/kW; $/kW-yr; $/MWh; Btu/kWh | https://www.lazard.com/media/uounhon4/lazards-lcoeplus-june-2025.pdf | Jun 2025 | Frame-peaker basis. CCGT: 1,200 to 1,600 $/kW, high case 2,400 to 2,600. |
| Plants reaching COD 2026 to 2027 / 2030 to 2031 (GridLab, via OilPrice) | 1,116 to 1,427 / 2,000+ | $/kW | https://oilprice.com/Energy/Energy-General/The-Gas-Turbine-Shortage-Just-Became-AIs-Biggest-Constraint.amp.html | accessed 2026-10-15 | Secondary report of filings. |
| Turbine equipment price trend (Wood Mackenzie) | 600 by end 2027, +195% vs 2019 | $/kW, equipment only | https://www.woodmac.com/press-releases/gas-turbine-prices-soar-195-as-market-faces-supply-demand-crisis/ | accessed 2026-10-15 | |
| Behind-the-meter gas capex (trade research) | 800 to 1,200 | $/kW | https://www.datacentres.com/news/behind-the-meter-power-gas-turbines-and-fuel-cells-emerge-as-data-centres-escape-slot1-2026-08-19 | 2026-08-19 | Methodology not disclosed. |
| Recommended capex default | 1,800 | $/kW installed | UNSOURCED - estimate | 2026-10-15 | Near EIA recip; within GridLab-to-2030 range. |
| Installed-to-load ratio (redundancy) | 1.25 | ratio | UNSOURCED - estimate | 2026-10-15 | N+x for islanded prime power. |
| All-in BTM power cost, recip (Modo Energy) | 125 | $/MWh | https://modoenergy.com/research/us-data-center-onsite-gas-speed-to-power | 2026-09-10 | Illustrative; grid comparison 66. |
| Recip and aero cost floor (RaboResearch) | 74 to 84 | $/MWh | https://www.rabobank.com/knowledge/d011532274-the-marathon-can-behind-the-meter-data-center-power-solutions-endure-the-decade-in-the-us | Jun 2026 | Rebuild cycles keep cost from falling lower. |
| Modelled all-in power cost (recip, 1.25x redundancy, 80% load factor, 20 yr, 9.33%) | 77 / 91 / 148 | $/MWh at HH / US ind / CA gas | derived | 2026-10-15 | Fixed charges 42.3 $/MWh plus VOM plus fuel. |

## 4. PUE and facility cost

| item | value | unit | source URL | date | note |
|---|---|---|---|---|---|
| Industry average PUE (Uptime survey) | 1.54 (above 1.5 in report caption) | ratio | https://intelligence.uptimeinstitute.com/resource/uptime-institute-global-data-center-survey-2025 ; https://mgrid.org/2025/10/01/uptime-institute-data-center-pue-stagnation-2025-liquid-cooling/ | Jul 2025 | 1.54 confirmed only in secondary coverage. |
| Google fleet PUE | 1.09 | ratio | https://www.datacenters.google/efficiency | accessed 2026-10-15 | Best-in-class hyperscale. |
| Liquid-cooled GB200 site, assumed PUE | 1.1 | ratio | https://www.theregister.com/2025/05/27/oracle_openai_40b/ | 2025-05-27 | Journalist assumption for Abilene, not a measurement. |
| Recommended PUE default for new AI facility | 1.2 | ratio | UNSOURCED - estimate | 2026-10-15 | Between 1.09 and 1.54. |
| US colocation average base rate (CBRE H2 2025, via Inflect) | 195.94 | $/kW-month | https://inflect.com/blog/colocation-pricing-what-to-expect-for-racks-cabinets-and-cages-in-2026 | 2026 (page dates conflict) | Space and power infrastructure, excludes energy. All-in about 250. |
| Primary-market asking rates (CBRE) | Chicago 200 to 230; N. Virginia 190 to 235; 10+ MW N. Virginia 160 to 185 | $/kW-month | https://www.cbre.com/insights/reports/global-data-center-trends-2026 ; https://www.cbre.com/insights/books/north-america-data-center-trends-h1-2026/northern-virginia-data-center-market | Q1 / H1 2026 | Primary-market vacancy 1.4% (H1 2026 report, 2026-08-27). |
| California: Silicon Valley asking rates | 200 to 275 | $/kW-month | https://www.cbre.com/press-releases/silicon-valley-data-center-demand-continues-outpace-supply-causing-vacancy-fall-further-rents-rise | accessed 2026-10-15 | No Southern California figure found; CBRE SoCal profile says pricing rising. |
| Owner build cost (Cushman & Wakefield 2026 guide) | 8.9 to 23.3 | $M per MW | https://irei.com/news/cushman-wakefield-releases-2026-data-center-development-cost-guide-citing-21-rise-in-per-mw-construction-costs/ | Aug/Sep 2026 | Excludes IT. Alternative to colo rent; do not use both. |

## 5. GPU cloud prices

| item | value | unit | source URL | date | note |
|---|---|---|---|---|---|
| Crusoe H100 80GB HGX, on-demand list | 4.50 | $/GPU-hr | https://www.crusoe.ai/cloud/pricing | accessed 2026-10-15 | computeprices showed 3.90 (2026-09-17); primary page governs. |
| Crusoe H200 141GB | 5.40 | $/GPU-hr | same | accessed 2026-10-15 | |
| Crusoe B200 180GB | 8.50 | $/GPU-hr | same | accessed 2026-10-15 | B300: 9.60; GB200: contact sales. |
| Crusoe L40S 48GB | 1.50 | $/GPU-hr | same | accessed 2026-10-15 | |
| Crusoe L4 | not offered | | same | accessed 2026-10-15 | |
| Crusoe spot | contact sales; launched "up to 90% off" hyperscaler on-demand | | https://www.crusoe.ai/blog/crusoe-cloud-now-offers-spot-pricing-access-powerful-gpus-on-crusoe-cloud-up-to-90-off ; https://docs.cloud.crusoe.ai/usage-billing/spot | 2025 | No public spot rate. Reserved: "lowest rates" via sales. |
| Oracle OCI (VoltaGrid Jenbacher BTM at Frontier) H100 / L40S list | 10.75 / 3.50 | $/GPU-hr | https://www.thundercompute.com/blog/oracle-cloud-oci-gpu-pricing | reviewed 2026-08-11 | Secondary; Oracle page returned 403. Second source shows H100 at 10.00. |
| Market H100 SXM, median of 100 in-stock listings (low) | 2.83 (1.30) | $/GPU-hr | https://computeprices.com/gpus/h100 | checked 2026-10-15/16 | Recommended market default. |
| Market H200 median (low) | 4.24 (1.67) | $/GPU-hr | https://computeprices.com/gpus/h200 | same | |
| Market B200 median (low) | 6.13 (3.50) | $/GPU-hr | https://computeprices.com/gpus/b200 | same | |
| Market L40S median (low) | 1.17 (0.38) | $/GPU-hr | https://computeprices.com/gpus/l40s | same | |
| Market L4 median (low); GCP; AWS | 0.765 (0.269); 0.71; 0.80 | $/GPU-hr | https://computeprices.com/gpus/l4 ; https://jarvislabs.ai/blog/l4-gpu-price | Oct 2026; Feb 2026 | Jarvislabs spot from 0.29. |

Crusoe Cloud prices are a single list across all Crusoe regions, so they are not specific to gas-powered capacity. Crusoe sold its flare-gas mining business to NYDIG in March 2025 (https://www.datacenterdynamics.com/en/news/crusoe-exits-crypto-operations-to-focus-on-ai-sell-business-to-nydig, 2025-03-25), and Abilene combines grid and on-site gas. No public GPU cloud was found whose posted price is tied to on-site gas. xAI does not sell GPU-hours.

## 6. Operator margin

| item | value | unit | source URL | date | note |
|---|---|---|---|---|---|
| CoreWeave reported cost of revenue | 28% of 5,131 $M revenue (gross margin 72%) | % | https://www.sec.gov/Archives/edgar/data/1769628/000176962826000104/crwv-20251231.htm | FY2025 10-K | Cost of revenue includes rent and power but excludes server depreciation, which sits in Technology and infrastructure. |
| CoreWeave margin after server D&A (about 2,300 $M) | about 27% | % | derived from same | FY2025 | After all Technology and infrastructure: about 15%. Interest expense 1,229 $M (about 24% of revenue). |
| Oracle Nvidia rental gross margin | about 14% (range under 10 to about 20) | % | https://sherwood.news/markets/oracle-tumbles-after-report-that-its-lost-nearly-usd100-million-from-renting | Oct 2025 | The Information via secondary coverage; includes some depreciation, about 7 points more pending. |
| Implied markup over fully loaded cost | 1.15 to 1.4 | x | derived | 2026-10-15 | From the margins above. |

## 7. Server overhead per GPU

| item | value | unit | source URL | date | note |
|---|---|---|---|---|---|
| H100 SXM TDP | 700 | W | https://www.nvidia.com/en-us/data-center/h100/ | accessed 2026-10-15 | |
| DGX H100 system max power | 10.2 (1.275 per GPU) | kW | https://docs.nvidia.com/dgx/dgxh100-user-guide/introduction-to-dgxh100.html | accessed 2026-10-15 | Page layout ambiguous; 10.2 kW widely cited as system max. |
| DGX H100 host | 2 x Xeon 8480C (56 cores), 2 TB DDR5, 8 x ConnectX-7 400G plus 2 dual-port, 8 x 3.84 TB NVMe | config | same | accessed 2026-10-15 | Per GPU: 14 cores, 256 GB RAM, one 400G NIC. |
| All-in power per H100 incl. host, NICs, cooling share | 1.37 | kW | https://inferencex.semianalysis.com/chips/h100 | accessed 2026-10-15 | Already facility-level; do not multiply by PUE. |
| Capex per H100 incl. host and cluster network (Meta 24k cluster) | about 37,100 (InfiniBand about 7,800) | $/GPU | https://pytorchtoatoms.substack.com/p/metas-24k-h100-cluster-capextco-and | 2024-05-04 | Derived: CPU 15.97 $M = 1.75% of BOM. H100 is 65.8% of BOM. |
| 8-GPU H100 server price | 250,000 to 400,000 | $ | https://intuitionlabs.ai/articles/nvidia-ai-gpu-pricing-guide | updated 2026-10-15 | Cites TRG Datacenters. H100 card 25,000 to 35,000 (https://www.spheron.network/blog/nvidia-h100-price-2026/, 2026-07-20). |
| Recommended H100 capex default | 35,000 | $/GPU | UNSOURCED - estimate | 2026-10-15 | Between 2026 card plus host pricing and the 2024 Meta figure. |
| L4 TDP | 72 | W | https://www.nvidia.com/en-us/data-center/l4/ | accessed 2026-10-15 | L40S: 350 W (https://www.nvidia.com/en-us/data-center/l40s/). |
| L4 card price | 2,000 to 3,000; Sep 2026 street 3,497 | $ | https://jarvislabs.ai/blog/l4-gpu-price ; https://gpupoet.com/gpu/learn/price/september-2026/nvidia-l4 | Feb 2026; Sep 2026 | |
| Host per L4 (GCP g2-standard-4) | 4 vCPU, 16 GB RAM | config | https://docs.cloud.google.com/compute/docs/gpus | accessed 2026-10-15 | A3 H100 VM: 208 vCPU, 1,872 GB, 1,000 Gbps per 8 GPUs. |
| Host power and cost per L4 | about 100 W; about 2,500 $ | W; $ | UNSOURCED - estimate | 2026-10-15 | Gives about 170 W IT, 5,500 $ per L4. |
| L40S server price | not found | | | | Vultr 8x L40S rents at 13.37 $/hr (https://www.vpsbenchmarks.com/gpu_plans/vultr/nvidia-l40s-8gpus). |

## 8. Depreciation life

| item | value | unit | source URL | date | note |
|---|---|---|---|---|---|
| CoreWeave technology equipment | 6 | years | https://www.sec.gov/Archives/edgar/data/1769628/000176962826000104/crwv-20251231.htm | FY2025 10-K | Extended from 5 in 2023. |
| Alphabet servers | 6 | years | https://www.sec.gov/Archives/edgar/data/1652044/000165204424000022/goog-20231231.htm | FY2023 10-K | |
| Microsoft servers and network | 6 (from 4) | years | https://www.sec.gov/Archives/edgar/data/789019/000095017023035122/msft-20230630.htm | FY2023 10-K | Effective start of FY2023. |
| Meta servers and network | 5.5 | years | https://www.mbi-deepdives.com/big-tech-earnings-quality/ | 2025 (secondary) | |
| Amazon subset of servers | 5 (from 6) | years | https://deepquarry.substack.com/p/amazon-revises-server-lifespan-amid | effective 2025-01-01 (secondary) | Shortened citing AI pace. |
| Recommended default | 5 | years | derived | 2026-10-15 | Sensitivity 4 to 6. |

## Estimate

Using a 35,000 $ H100 capex, 5-year life at 9.33%, 80% utilization, 196 $/kW-month facility cost, 0.10 $/hr other opex (UNSOURCED) and 1.37 kW all-in at 77 $/MWh (Texas, Henry Hub gas), a gas-powered H100 costs about 1.95 $ per utilized GPU-hour; California gas raises it to about 2.05 $. This is consistent with the Meta-cluster estimate (1.69 $) and the SemiAnalysis retail TCO (2.00 $). An L4 at 5,500 $ all-in and about 205 W facility power costs about 0.31 to 0.33 $ per utilized hour. At a 1.15 to 1.4x markup, implied prices are about 2.25 to 2.85 $ (H100) and 0.36 to 0.46 $ (L4), below Crusoe list (4.50 $) and near the H100 market median (2.83 $). Capex, depreciation life, cost of capital and utilization dominate; energy is about 5 to 10% of H100 cost.
