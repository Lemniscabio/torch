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

/** kLa_CO₂ / kLa_O₂ ratio.
 *  Penetration / surface-renewal theory gives kLa ∝ D^0.5, so the ratio is
 *  (D_CO₂/D_O₂)^0.5 ≈ 0.951, not the plain diffusivity ratio (0.905). */
export const KLA_CO2_O2_RATIO = Math.sqrt(1.9e-9 / 2.1e-9); // (CO2/O2 diffusivity ratio at 25°C)^0.5

/** CO₂ inhibitory threshold (bar) — used in R4 scoring */
export const CO2_INHIBITORY_THRESHOLD = 0.15;

/** CO₂ activation biomass threshold (g/L CDW) — used in R4 */
export const CO2_BIOMASS_THRESHOLD = 0.1;

/** CO₂ activation OUR threshold (mmol/L/h) — used in R4 */
export const CO2_OUR_THRESHOLD = 0.1;

