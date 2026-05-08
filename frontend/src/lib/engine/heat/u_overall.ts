// Overall heat-transfer coefficient U (W/m²·K).
//
// 1/U = 1/h_i + δ_wall/k_wall + 1/h_o
//
// No fouling factor — overestimates U by ~5–10 % vs a fouled vessel.

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
): OverallUResult {
  const R_broth  = 1 / h_i;
  const R_wall   = thickness_m / k_wall;
  const R_jacket = 1 / h_o;
  const R_total  = R_broth + R_wall + R_jacket;
  return { U: 1 / R_total, R_broth, R_wall, R_jacket, R_total };
}
