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
/** Time constant for a module's correction back toward its slot, seconds (design choice). */
export const CONTROL_TAU_S = 600;
