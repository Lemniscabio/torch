// Heat-transfer film coefficients and wall properties.

import type { ImpellerType } from "@/lib/types";
import {
  BROTH_K_W_MK, BROTH_CP_J_KGK, RHO,
  CHILTON_DREW_C,
  JACKET_WATER_MU_PA_S, JACKET_WATER_K_W_MK, JACKET_WATER_PR, WATER_RHO_KG_M3,
  JACKET_GAP_FRACTION, JACKET_GAP_MIN_M, JACKET_GAP_MAX_M,
  VESSEL_GLASS_THRESHOLD_LITRES, GLASS_K_W_MK, GLASS_WALL_M, SS316_K_W_MK, SS316_WALL_M,
} from "@/lib/constants";

// ─── Broth-side film coefficient h_i (W/m²·K) ───────────────────────────────
// Chilton-Drew correlation for jacketed vessel with baffles:
//   Nu = C · Re_imp^(2/3) · Pr^(1/3) · (μ/μ_w)^0.14
// Viscosity correction (μ/μ_w)^0.14 set to 1.0 (wall T unknown without iteration).

export interface BrothFilmResult {
  h_i:      number; // W/m²·K
  Re_imp:   number;
  Pr_broth: number;
  Nu:       number;
}

export function deriveBrothFilmCoeff(
  D_T:           number,       // m  — vessel diameter
  d_imp:         number,       // m  — impeller diameter
  N_rps:         number,       // rps — agitation speed
  mu:            number,       // Pa·s — broth viscosity
  impeller_type: ImpellerType,
): BrothFilmResult {
  const Re_imp   = (RHO * N_rps * d_imp * d_imp) / mu;
  const Pr_broth = (BROTH_CP_J_KGK * mu) / BROTH_K_W_MK;
  const C        = CHILTON_DREW_C[impeller_type];
  const Nu       = C * Math.pow(Re_imp, 2 / 3) * Math.pow(Pr_broth, 1 / 3);
  const h_i      = (Nu * BROTH_K_W_MK) / D_T;
  return { h_i, Re_imp, Pr_broth, Nu };
}

// ─── Jacket-side film coefficient h_o (W/m²·K) ──────────────────────────────
// Assumes annular jacket with gap = clamp(JACKET_GAP_FRACTION·D_T, 20 mm, 80 mm).
// Dittus-Boelter (water being heated by warm broth → exponent 0.4):
//   Nu = 0.023 · Re^0.8 · Pr^0.4
// Valid for Re > 10 000; returns a conservative floor for laminar flow.

export interface JacketFilmResult {
  h_o:     number; // W/m²·K
  gap_m:   number; // m — assumed annular gap
  Re_jkt:  number;
  u_jkt:   number; // m/s — water velocity in annulus
}

export function deriveJacketFilmCoeff(
  D_T:          number, // m
  flowrate_lpm: number, // L/min
): JacketFilmResult {
  const gap_m    = Math.min(JACKET_GAP_MAX_M, Math.max(JACKET_GAP_MIN_M, JACKET_GAP_FRACTION * D_T));
  const D_h      = 2 * gap_m;                                           // hydraulic diameter (thin annulus)
  const A_c      = Math.PI * gap_m * (D_T + gap_m);                    // annulus cross-section (m²)
  const F_m3s    = flowrate_lpm / 60000;                                // m³/s
  const u_jkt    = A_c > 0 ? F_m3s / A_c : 0;                         // m/s
  const Re_jkt   = (WATER_RHO_KG_M3 * u_jkt * D_h) / JACKET_WATER_MU_PA_S;

  let Nu: number;
  if (Re_jkt >= 10000) {
    Nu = 0.023 * Math.pow(Re_jkt, 0.8) * Math.pow(JACKET_WATER_PR, 0.4); // Dittus-Boelter
  } else if (Re_jkt >= 2300) {
    Nu = 0.023 * Math.pow(Re_jkt, 0.8) * Math.pow(JACKET_WATER_PR, 0.4) * 0.7; // transitional correction
  } else {
    Nu = 3.66; // laminar fully-developed floor
  }
  const h_o = (Nu * JACKET_WATER_K_W_MK) / D_h;

  return { h_o, gap_m, Re_jkt, u_jkt };
}

// ─── Vessel wall material and properties ─────────────────────────────────────

export interface WallProperties {
  material:   "glass" | "stainless_steel";
  k_W_mK:     number; // W/m·K
  thickness_m: number; // m
}

export function getWallProperties(volume_litres: number): WallProperties {
  if (volume_litres <= VESSEL_GLASS_THRESHOLD_LITRES) {
    return { material: "glass", k_W_mK: GLASS_K_W_MK, thickness_m: GLASS_WALL_M };
  }
  return { material: "stainless_steel", k_W_mK: SS316_K_W_MK, thickness_m: SS316_WALL_M };
}
