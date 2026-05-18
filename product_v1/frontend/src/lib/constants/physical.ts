// Physical and thermodynamic constants.
// Source: /docs/lemnisca_scaleup_app_dev_spec.md Sections 1.3 and 7

// --- Fluid mechanics ---

/** Broth density (kg/m³) — used in D3, D4, R2, R4, R5 */
export const RHO = 1000;

/** Gravitational acceleration (m/s²) — used in R4 */
export const G = 9.81;

// --- Gas constants ---

/** Atmospheric pressure (Pa) */
export const ATMOSPHERIC_PRESSURE_PA = 101325;

/** Atmospheric pressure (bar) — used for pCO₂ calculations */
export const ATMOSPHERIC_PRESSURE_BAR = ATMOSPHERIC_PRESSURE_PA / 1e5;

/** Atmospheric pressure (atm) */
export const ATMOSPHERIC_PRESSURE_ATM = 1;

/** Molar volume of an ideal gas at temperature T (°C) and 1 atm, L/mol. Replaces fixed STP value of 22.4. */
export function molarVolumeIdealGas(temperatureC: number): number {
  const R = 8.314; // J/(mol·K)
  return (R * (temperatureC + 273.15) / ATMOSPHERIC_PRESSURE_PA) * 1000;
}

/** Ambient CO₂ mole fraction in dry air (~400 ppm) */
export const Y_CO2_INLET = 4e-4;

/** Maximum plausible CO₂ outlet mole fraction (safety cap) */
export const MAX_CO2_MOLE_FRACTION = 0.20;

// --- CO₂ physical properties ---

/** Henry's constant for CO₂ in water (~30°C) (mol/L/atm) — used in R4 */
export const H_CO2 = 0.034;

// --- Lookup table helper ---

export interface LookupPoint {
  temperature: number; // °C
  value: number;
}

export function interpolateTable(table: LookupPoint[], temperature: number): number {
  if (temperature <= table[0].temperature) return table[0].value;
  if (temperature >= table[table.length - 1].temperature) return table[table.length - 1].value;
  for (let i = 0; i < table.length - 1; i++) {
    const t0 = table[i].temperature;
    const t1 = table[i + 1].temperature;
    if (temperature >= t0 && temperature <= t1) {
      const fraction = (temperature - t0) / (t1 - t0);
      return table[i].value + fraction * (table[i + 1].value - table[i].value);
    }
  }
  return table[table.length - 1].value;
}

// --- Viscosity at process temperature (Pa·s) — interpolate linearly ---

export const VISCOSITY_TABLE: LookupPoint[] = [
  { temperature: 20, value: 0.00100 },
  { temperature: 25, value: 0.00089 },
  { temperature: 30, value: 0.00080 },
  { temperature: 37, value: 0.00069 },
  { temperature: 42, value: 0.00062 },
];

// --- Oxygen saturation concentration C* (mmol/L, air, 1 atm) — interpolate linearly ---

export const C_STAR_TABLE: LookupPoint[] = [
  { temperature: 20, value: 0.276 },
  { temperature: 25, value: 0.258 },
  { temperature: 30, value: 0.237 },
  { temperature: 35, value: 0.213 },
  { temperature: 37, value: 0.204 },
  { temperature: 42, value: 0.186 },
];

// --- Non-Newtonian broth rheology ---

/** Apparent viscosity (Pa·s) used for high-density broths (≥ 60 g/L CDW) — 100 cP flat approximation */
export const HIGH_DENSITY_MU_PA_S = 0.1;

// --- ARCHIVED: quadratic apparent viscosity polynomial (superseded by flat 100 cP for high-density category) ---
// export const NON_NEWTONIAN_BIOMASS_THRESHOLD = 60;
// export const NON_NEWTONIAN_MU_A = 1.25e-3;  // cP · (L/g)²
// export const NON_NEWTONIAN_MU_B = 0.175;    // cP · (L/g)

/** Reference O₂ mole fraction in dry air — used to normalise C* for enriched/depleted sparging */
export const O2_REFERENCE_FRACTION = 0.209;
