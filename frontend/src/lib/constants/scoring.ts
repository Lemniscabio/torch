// Risk scoring thresholds and colour codes.
// Source: /docs/lemnisca_scaleup_app_dev_spec.md Section 2.2 and 4.3

// --- OTR: kLa ratio (achievable / required) ---

export const OTR_THRESHOLDS = {
  low:      1.5, // ratio > 1.5      → low
  moderate: 1.0, // ratio 1.0–1.5    → moderate
  high:     0.7, // ratio 0.7–1.0    → high
  // below 0.7 → critical
} as const;

// --- Mixing: Damköhler number ---

export const DA_THRESHOLDS = {
  low:      0.3,  // Da < 0.3        → low      (gradients negligible)
  moderate: 1.0,  // Da 0.3–1.0      → moderate (emerging gradients)
  high:     3.0,  // Da 1.0–3.0      → high     (significant overflow metabolism likely)
  // above 3.0 → critical             (severe gradients, order-of-magnitude productivity loss)
  // Source: Larsson & Enfors (1996); Bylund et al. (1998)
} as const;

// --- pH control: mixing time (seconds) ---

export const PH_MIX_THRESHOLDS = {
  low:      30, // θ_mix < 30 s      → low
  moderate: 60, // θ_mix 30–60 s     → moderate
  // above 60 s → high
} as const;

// --- Shear: tip speed ratio (v_tip / organism threshold) ---

export const SHEAR_THRESHOLDS = {
  low:      0.7, // ratio < 0.7      → low
  moderate: 1.0, // ratio 0.7–1.0    → moderate
  high:     1.3, // ratio 1.0–1.3    → high
  // above 1.3 → critical
} as const;

// --- CO₂: pCO₂ at vessel bottom (bar) ---

// pco2_margin = PCO2_CRITICAL[organism] / pco2_bottom; higher = safer.
export const CO2_THRESHOLDS = {
  low:      1.5,  // margin > 1.5  → low       (pCO₂ < 67% of critical)
  moderate: 1.0,  // margin > 1.0  → moderate  (pCO₂ 67–100% of critical)
  high:     0.75, // margin > 0.75 → high       (pCO₂ 100–133% of critical)
  // margin ≤ 0.75 → critical     (pCO₂ > 133% of critical)
} as const;

// --- Heat: Q_metabolic / Q_cool_max ---

export const HEAT_THRESHOLDS = {
  low:      0.60, // ratio < 0.60    → low
  moderate: 0.85, // ratio 0.60–0.85 → moderate
  high:     1.0,  // ratio 0.85–1.00 → high
  // above 1.00 → critical
} as const;

// --- Risk colour codes ---

export const RISK_COLOURS = {
  low:      "#27AE60",
  moderate: "#F39C12",
  high:     "#E67E22",
  critical: "#C0392B",
} as const;
