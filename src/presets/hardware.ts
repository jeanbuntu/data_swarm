import { Sourced, s, est, EUR_USD, GBP_USD } from './sourced';

export interface PanelPreset { id: string; name: string; efficiency: Sourced; usdPerW: Sourced; kgPerM2: Sourced; tempCoeffPerC: Sourced }
export interface BatteryPreset { id: string; name: string; usdPerKwh: Sourced; whPerKg: Sourced; rte: Sourced; cycleLife: Sourced }
export interface AcceleratorPreset {
  id: string; name: string; tdpW: Sourced; denseTflops: Sourced; priceUsd: Sourced; memGB: Sourced;
  massKg: Sourced; volumeL: Sourced; firmUsdPerGpuH: Sourced; spotUsdPerGpuH: Sourced;
  /** Host, networking and server overhead per GPU in a land data center, for the competitor benchmark. */
  serverW: Sourced; serverUsd: Sourced;
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
const DGX_H100 = 'https://docs.nvidia.com/dgx/dgxh100-user-guide/introduction-to-dgxh100.html';
const META_TCO = 'https://pytorchtoatoms.substack.com/p/metas-24k-h100-cluster-capextco-and';
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
    serverW: est(100, 'W', 'host share per L4 card'), serverUsd: est(2500, 'USD', 'host share per L4 card'),
  },
  {
    id: 'l40s', name: 'NVIDIA L40S (350 W)',
    tdpW: s(350, 'W', NV_L40S), denseTflops: s(362, 'TFLOPS', NV_L40S, 'dense BF16'),
    priceUsd: s(9970, 'USD', 'https://www.newegg.com/p/N82E16888892001', 'new; about 7,000 USD used'),
    memGB: s(48, 'GB', NV_L40S),
    massKg: est(1.5, 'kg', 'dual-slot card'), volumeL: est(2.5, 'L', 'card plus mounting'),
    firmUsdPerGpuH: s(2.25, 'USD/GPU-h', COREWEAVE), spotUsdPerGpuH: s(0.79, 'USD/GPU-h', RUNPOD, 'RunPod community'),
    serverW: est(200, 'W', 'host share per L40S card'), serverUsd: est(4000, 'USD', 'host share per L40S card; no server price found'),
  },
  {
    id: 'h100-nvl', name: 'NVIDIA H100 NVL PCIe (375 W)',
    tdpW: s(375, 'W', NV_H100, 'configurable 350 to 400 W'), denseTflops: s(835, 'TFLOPS', NV_H100, 'dense BF16'),
    priceUsd: est(27500, 'USD', 'range 25k to 30k USD'), memGB: s(94, 'GB', NV_H100),
    massKg: est(1.7, 'kg', 'dual-slot card'), volumeL: est(2.5, 'L', 'card plus mounting'),
    firmUsdPerGpuH: est(6.16, 'USD/GPU-h', 'H100 SXM CoreWeave price used as a proxy'),
    spotUsdPerGpuH: est(2.69, 'USD/GPU-h', 'H100 RunPod community price used as a proxy'),
    serverW: est(300, 'W', 'PCIe host share per card'), serverUsd: est(6000, 'USD', 'PCIe host share per card'),
  },
  {
    id: 'h100-sxm', name: 'NVIDIA H100 SXM (700 W)',
    tdpW: s(700, 'W', NV_H100), denseTflops: s(989, 'TFLOPS', NV_H100, 'dense BF16'),
    priceUsd: s(28000, 'USD', GPU_PRICES, 'midpoint of 25k to 31k; needs an HGX baseboard'), memGB: s(80, 'GB', NV_H100),
    massKg: est(2.5, 'kg', 'per-GPU share of an HGX board'), volumeL: est(3, 'L', 'per-GPU share of an HGX board'),
    firmUsdPerGpuH: s(6.16, 'USD/GPU-h', COREWEAVE), spotUsdPerGpuH: s(2.69, 'USD/GPU-h', RUNPOD, 'RunPod community'),
    serverW: s(575, 'W', DGX_H100, 'derived: DGX H100 10.2 kW system max over 8 GPUs, minus 700 W GPU'), serverUsd: s(9100, 'USD', META_TCO, 'derived: about 37,100 USD per GPU incl. host and network minus the 28,000 USD card'),
  },
  {
    id: 'h200-sxm', name: 'NVIDIA H200 SXM (700 W)',
    tdpW: s(700, 'W', NV_H200), denseTflops: s(989, 'TFLOPS', NV_H200, 'dense BF16'),
    priceUsd: s(35000, 'USD', GPU_PRICES, 'midpoint of 30k to 40k'), memGB: s(141, 'GB', NV_H200),
    massKg: est(2.5, 'kg', 'per-GPU share of an HGX board'), volumeL: est(3, 'L', 'per-GPU share of an HGX board'),
    firmUsdPerGpuH: s(6.31, 'USD/GPU-h', COREWEAVE), spotUsdPerGpuH: s(3.59, 'USD/GPU-h', RUNPOD, 'RunPod community'),
    serverW: s(575, 'W', DGX_H100, 'H100 HGX host share used for H200'), serverUsd: s(9100, 'USD', META_TCO, 'H100 cluster host and network share used for H200'),
  },
  {
    id: 'b200', name: 'NVIDIA B200 HGX (1000 W)',
    tdpW: s(1000, 'W', LENOVO_B200), denseTflops: s(2250, 'TFLOPS', NV_HGX, 'dense BF16'),
    priceUsd: s(40000, 'USD', GPU_PRICES, 'midpoint of 30k to 50k'), memGB: s(180, 'GB', NV_HGX),
    massKg: est(3, 'kg', 'per-GPU share of an HGX board'), volumeL: est(3.5, 'L', 'per-GPU share of an HGX board'),
    firmUsdPerGpuH: s(8.6, 'USD/GPU-h', COREWEAVE), spotUsdPerGpuH: s(5.98, 'USD/GPU-h', RUNPOD, 'RunPod community'),
    serverW: est(790, 'W', 'about 14.3 kW per 8-GPU system minus 1,000 W GPU'), serverUsd: est(10000, 'USD', 'host and network share per GPU'),
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
    serverW: est(0, 'W', 'integrated module, no separate host'), serverUsd: est(0, 'USD', 'integrated module, no separate host'),
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
