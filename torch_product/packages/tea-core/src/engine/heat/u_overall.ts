// Overall heat-transfer coefficient U (W/m²·K).
//
// 1/U = 1/h_i + Rf_broth + δ_wall/k_wall + Rf_jacket + 1/h_o
//
// Fouling resistances are included to avoid idealized clean-surface U values.
// Glass vessels are wall-resistance-limited, so their U cap is lower than SS.
import {
  U_OVERALL_MIN_W_M2K,
  U_OVERALL_MAX_GLASS_W_M2K,
  U_OVERALL_MAX_SS_W_M2K,
  BROTH_FOULING_R_M2K_W,
  JACKET_FOULING_R_M2K_W,
} from "../../constants";

export interface OverallUResult {
  U:            number; // W/m²·K
  R_broth:      number; // m²·K/W — 1/h_i
  R_wall:       number; // m²·K/W — δ/k
  R_jacket:     number; // m²·K/W — 1/h_o
  R_total:      number; // m²·K/W
}

export function deriveOverallU(
  h_i:         number, // W/m²·K — broth-side film
  h_o:         number, // W/m²·K — jacket-side film
  k_wall:      number, // W/m·K  — wall thermal conductivity
  thickness_m: number, // m      — wall thickness
  wall_material?: "glass" | "stainless_steel",
): OverallUResult {
  const R_broth  = 1 / h_i;
  const R_wall   = thickness_m / k_wall;
  const R_jacket = 1 / h_o;
  const R_total  =
    R_broth +
    BROTH_FOULING_R_M2K_W +
    R_wall +
    JACKET_FOULING_R_M2K_W +
    R_jacket;
  const U_raw = 1 / R_total;
  const inferredMaterial =
    wall_material ?? (k_wall > 5 ? "stainless_steel" : "glass");
  const U_max =
    inferredMaterial === "glass"
      ? U_OVERALL_MAX_GLASS_W_M2K
      : U_OVERALL_MAX_SS_W_M2K;
  const U = Math.min(U_max, Math.max(U_OVERALL_MIN_W_M2K, U_raw));
  return { U, R_broth, R_wall, R_jacket, R_total };
}
