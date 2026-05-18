// kLa correlation registry for stirred-tank bioreactors.
// Port of kla_correlations.py — one pure function per correlation.
//
// All functions receive a pre-computed Pg [W] to avoid redundant power
// calculations when the caller has already derived it.
//
// Units: kLa returned in s⁻¹. Callers multiply by 3600 for h⁻¹.
//
// References:
//   [1] van't Riet K (1979) Ind Eng Chem Process Des Dev 18:357-364
//   [2] Linek V et al. (1987) Biotechnol Bioeng 30:323-331
//   [3] Linek V et al. (2004) Chem Eng Sci 59:5145-5154
//   [4] Moucha T et al. (2003) Chem Eng Sci 58:1839-1846
//   [5] Garcia-Ochoa F, Gomez E (2004) Biotechnol Adv 22:495-517
//   [6] Zhu Y et al. (2001) Chem Eng Sci 56:3069-3078

import type { KlaCorrelationFn, ReactorOperatingPoint } from "./types";

// --- van't Riet (1979) — non-coalescing (active) ---

/** Non-coalescing (electrolyte/broth) medium: kLa = 0.002 · (Pg/V)^0.7 · Vs^0.2 */
export const klaVantRietNonCoalescing: KlaCorrelationFn = (op, Pg) => {
  const PgV = Pg / op.V_L;
  return 0.002 * PgV ** 0.7 * op.v_s ** 0.2;
};

// --- Linek et al. (2004) — impeller-type-specific, single impeller ---

/**
 * Rushton:       kLa = 0.0083 · (Pg/V)^0.62 · Vs^0.49
 * Pitched blade: kLa = 0.0063 · (Pg/V)^0.63 · Vs^0.58
 * Hydrofoil/other: kLa = 0.0057 · (Pg/V)^0.67 · Vs^0.56
 */
export const klaLinek2004: KlaCorrelationFn = (op, Pg) => {
  const PgV = Pg / op.V_L;
  const imp = op.impeller_type.toLowerCase();
  if (imp === "rushton" || imp === "smith") {
    return 0.0083 * PgV ** 0.62 * op.v_s ** 0.49;
  }
  if (imp.startsWith("pitched_blade") || imp.startsWith("pbt")) {
    return 0.0063 * PgV ** 0.63 * op.v_s ** 0.58;
  }
  return 0.0057 * PgV ** 0.67 * op.v_s ** 0.56;
};

// --- Garcia-Ochoa & Gomez (2004) — viscosity-corrected ---

/**
 * kLa = 0.015 · (Pg/V)^0.6 · Vs^0.6 · (μ_water / μ_eff)^0.5
 * μ_water = 1.0e-3 Pa·s
 */
export const klaGarciaOchoa2004: KlaCorrelationFn = (op, Pg) => {
  const PgV = Pg / op.V_L;
  const mu_w = 1.0e-3;
  const mu_eff = op.mu_L;
  return 0.015 * PgV ** 0.6 * op.v_s ** 0.6 * (mu_w / mu_eff) ** 0.5;
};

// --- Registry ---

export const KLA_CORRELATION_REGISTRY: Record<string, KlaCorrelationFn> = {
  vant_riet_non_coalescing: klaVantRietNonCoalescing,
  linek_2004:               klaLinek2004,
  garcia_ochoa_2004:        klaGarciaOchoa2004,
};

// --- ARCHIVED correlations (not selected by selectKlaEnsemble) ---

// /** Coalescing (water-like) medium: kLa = 0.026 · (Pg/V)^0.4 · Vs^0.5 */
// export const klaVantRietCoalescing: KlaCorrelationFn = (op, Pg) => {
//   const PgV = Pg / op.V_L;
//   return 0.026 * PgV ** 0.4 * op.v_s ** 0.5;
// };

// /** Linek 1987 (older revision, superseded by Linek 2004): kLa = 0.00495 · (Pg/V)^0.593 · Vs^0.4 */
// export const klaLinek1987: KlaCorrelationFn = (op, Pg) => {
//   const PgV = Pg / op.V_L;
//   return 0.00495 * PgV ** 0.593 * op.v_s ** 0.4;
// };

// /** Moucha 2003 — multi-impeller (2×Rushton default): kLa = 0.00379 · (Pg/V)^0.623 · Vs^0.775 */
// export const klaMoucha2003: KlaCorrelationFn = (op, Pg) => {
//   const PgV = Pg / op.V_L;
//   return 0.00379 * PgV ** 0.623 * op.v_s ** 0.775;
// };

// /**
//  * Zhu 2001 — non-Newtonian (power-law / CMC):
//  * kLa = 0.00913 · (Pg/V)^0.64 · Vs^0.30 · (μ_app [mPa·s])^−0.84
//  */
// export const klaZhu2001: KlaCorrelationFn = (op, Pg) => {
//   const PgV = Pg / op.V_L;
//   const K   = op.K   ?? 1.0e-3;
//   const n   = op.n_pl ?? 1.0;
//   const k_s = 11.5;
//   const mu_app_mPas = K * (k_s * op.N_rps) ** (n - 1) * 1000;
//   return 0.00913 * PgV ** 0.64 * op.v_s ** 0.30 * mu_app_mPas ** (-0.84);
// };
