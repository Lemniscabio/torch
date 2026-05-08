// D4 + D6 — Viscosity, Reynolds number, and oxygen driving force.

import type { AssessmentFlag } from "@/lib/types";
import { VISCOSITY_TABLE, C_STAR_TABLE, RHO, interpolateTable } from "@/lib/constants";

// --- Viscosity ---

export function deriveViscosity(temperature: number): number {
  return interpolateTable(VISCOSITY_TABLE, temperature);
}

// --- D4: Reynolds number ---

export type FlowRegime = "turbulent" | "transitional" | "laminar";

export interface ReynoldsResult {
  re:     number;
  regime: FlowRegime;
}

export function deriveReynolds(
  n_rps: number,
  d_imp: number,
  mu:    number,
): ReynoldsResult {
  const re = (RHO * n_rps * d_imp * d_imp) / mu;
  const regime: FlowRegime =
    re > 10000 ? "turbulent" : re >= 1000 ? "transitional" : "laminar";
  return { re, regime };
}

export function deriveReynoldsFlags(regime: FlowRegime): AssessmentFlag[] {
  if (regime === "transitional")
    return [{ message: "Transitional flow regime — power number assumption may not hold." }];
  if (regime === "laminar")
    return [{ message: "Laminar flow — correlations invalid." }];
  return [];
}

// --- D6: C* and driving force ---

export interface DrivingForceResult {
  c_star:        number; // mmol/L
  c_l:           number; // mmol/L at DO setpoint
  driving_force: number; // c_star - c_l
}

export function deriveDrivingForce(
  temperature:  number,
  do_setpoint: number,
): DrivingForceResult {
  const c_star       = interpolateTable(C_STAR_TABLE, temperature);
  const c_l          = (do_setpoint / 100) * c_star;
  const driving_force = c_star - c_l;
  return { c_star, c_l, driving_force };
}
