// Gassed power correlations for stirred-tank bioreactors.
// Port of kla_correlations.py gassed power section.

import type { ReactorOperatingPoint } from "./types";

/**
 * Michel & Miller (1962) — Rushton and Smith turbines.
 * Pg = 0.706 · (P₀² · N · d_i³ / Q_g^0.56)^0.45
 * Ref: AIChE J 8:262–266
 */
function michelMiller(P0: number, op: ReactorOperatingPoint): number {
  const Q_safe = Math.max(op.Q_gas, 1e-12);
  return 0.706 * Math.pow((P0 ** 2 * op.N_rps * op.d_i ** 3) / Q_safe ** 0.56, 0.45);
}

/**
 * Cui et al. (1996) — pitched-blade turbines.
 * Pg = 0.648 · (P₀² · N · d_i³ / Q_g^0.56)^0.45
 * Ref: Biotechnol Bioeng 49:456–464
 */
function cui(P0: number, op: ReactorOperatingPoint): number {
  const Q_safe = Math.max(op.Q_gas, 1e-12);
  return 0.648 * Math.pow((P0 ** 2 * op.N_rps * op.d_i ** 3) / Q_safe ** 0.56, 0.45);
}

/**
 * Generic Pg/P0 for low-power-number impellers (hydrofoils, marine).
 * Pg/P0 ≈ 1 − 12 · (Q_g / (N · d_i³)), clamped to [0.3, 1.0].
 */
function generic(P0: number, op: ReactorOperatingPoint): number {
  const N_safe = Math.max(op.N_rps, 1e-6);
  const Fl = op.Q_gas / (N_safe * op.d_i ** 3);
  const ratio = Math.max(0.3, Math.min(1.0, 1.0 - 12.0 * Fl));
  return ratio * P0;
}

/** Ungassed power for a single impeller: P₀ = Np · ρ · N³ · d_i⁵ */
export function ungassedPower(op: ReactorOperatingPoint): number {
  return op.Np * op.rho_L * op.N_rps ** 3 * op.d_i ** 5;
}

/**
 * Total gassed power for the impeller system [W].
 * Selects correlation by impeller type; accounts for multiple impellers.
 */
export function gassedPower(op: ReactorOperatingPoint): number {
  const P0_single = ungassedPower(op);
  const imp = op.impeller_type.toLowerCase();

  let Pg_single: number;
  if (imp === "rushton" || imp === "smith") {
    Pg_single = michelMiller(P0_single, op);
  } else if (imp.startsWith("pitched_blade") || imp.startsWith("pbt")) {
    Pg_single = cui(P0_single, op);
  } else {
    Pg_single = generic(P0_single, op);
  }

  if (op.n_imp > 1) {
    // Interaction factor: closely-spaced impellers lose ~10-20% per impeller
    const spacing_ratio = op.D_T > 0 ? op.D_T / op.D_T : 1.0; // default 1:1 spacing
    const interaction = Math.min(1.0, 0.85 + 0.15 * spacing_ratio);
    return op.n_imp * Pg_single * interaction;
  }

  return Pg_single;
}

/** Specific gassed power P/V [W/m³] */
export function specificPower(op: ReactorOperatingPoint): number {
  return gassedPower(op) / op.V_L;
}
