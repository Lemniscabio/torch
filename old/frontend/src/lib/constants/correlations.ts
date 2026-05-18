// Empirical correlation coefficients used in the calculation engine.
// Source: /docs/lemnisca_scaleup_app_dev_spec.md Section 7

// --- Van't Riet kLa Correlation (R1) ---

/** Coalescing medium: kLa = C · (P/V)^α · Vs^β  (s⁻¹) */
export const VANT_RIET_COALESCING_COEFFICIENT   = 0.026;
export const VANT_RIET_COALESCING_PV_EXPONENT   = 0.4;
export const VANT_RIET_COALESCING_VS_EXPONENT   = 0.5;

/** Non-coalescing medium (informational) */
export const VANT_RIET_NON_COALESCING_COEFFICIENT  = 0.002;
export const VANT_RIET_NON_COALESCING_PV_EXPONENT  = 0.7;
export const VANT_RIET_NON_COALESCING_VS_EXPONENT  = 0.2;

// --- Ruszkowski mixing time correlation (R2) ---

/** Ruszkowski constant — used in R2 */
export const RUSZKOWSKI_CONSTANT = 5.9;

// --- CO₂ stripping (R4) ---

/** kLa_CO₂ / kLa_O₂ ratio */
export const KLA_CO2_O2_RATIO = 0.9;

/** CO₂ inhibitory threshold (bar) — used in R4 scoring */
export const CO2_INHIBITORY_THRESHOLD = 0.15;

/** CO₂ activation biomass threshold (g/L CDW) — used in R4 */
export const CO2_BIOMASS_THRESHOLD = 20;

/** CO₂ activation OUR threshold (mmol/L/h) — used in R4 */
export const CO2_OUR_THRESHOLD = 30;

// --- Heat transfer (R5) ---

/** Metabolic heat factor (kW per (mmol/L/h) per m³) */
export const METABOLIC_HEAT_FACTOR = 0.46;

/** Jacket heat transfer coefficient (W/m²·K) */
export const U_JACKET = 400;

/** Cooling water outlet temperature offset (°C) — used in legacy R5; superseded by flowrate-based calc in Stage 5 */
export const T_CW_OUTLET_OFFSET = 10;
