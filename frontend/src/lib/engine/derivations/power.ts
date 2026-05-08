// D3 — Power input derivation.

import type { ImpellerType, AssessmentFlag, VesselGeometry } from "@/lib/types";
import {
  IMPELLER_CONSTANTS,
  RHO,
  PV_LOW_SANITY,
  PV_HIGH_SANITY,
  VVM_VALID_LOW,
  VVM_VALID_HIGH,
  PV_SCENARIO_MULTIPLIERS,
} from "@/lib/constants";

export interface PowerResult {
  n_rps:      number; // rev/s
  p_ungassed: number; // W (single impeller, ungassed)
  p_gassed:   number; // W (single impeller, gassed)
  p_total:    number; // W (all impellers, gassed)
  pv_lab:     number; // W/m³
}

export function derivePowerInput(
  impeller_type: ImpellerType,
  n_impellers: number,
  rpm: number,
  lab_geometry: VesselGeometry,
): PowerResult {
  const impeller = IMPELLER_CONSTANTS[impeller_type];
  const n_rps = rpm / 60;
  const d_imp = lab_geometry.d_imp;

  const p_ungassed = impeller.np * RHO * n_rps ** 3 * d_imp ** 5;
  const p_gassed   = impeller.pg_p_factor * p_ungassed;
  const p_total    = n_impellers * p_gassed;
  const pv_lab     = p_total / lab_geometry.volume_m3;

  return { n_rps, p_ungassed, p_gassed, p_total, pv_lab };
}

export function derivePowerFlags(vvm: number, pv_lab: number): AssessmentFlag[] {
  const flags: AssessmentFlag[] = [];

  if (vvm > VVM_VALID_HIGH || vvm < VVM_VALID_LOW) {
    flags.push({
      message: "Gassed power correction carries additional uncertainty outside VVM 0.5–2.0 range.",
    });
  }

  const allBelow =
    PV_SCENARIO_MULTIPLIERS.conservative * pv_lab < PV_LOW_SANITY &&
    PV_SCENARIO_MULTIPLIERS.moderate      * pv_lab < PV_LOW_SANITY &&
    PV_SCENARIO_MULTIPLIERS.aggressive    * pv_lab < PV_LOW_SANITY;
  const allAbove =
    PV_SCENARIO_MULTIPLIERS.conservative  * pv_lab > PV_HIGH_SANITY &&
    PV_SCENARIO_MULTIPLIERS.moderate      * pv_lab > PV_HIGH_SANITY &&
    PV_SCENARIO_MULTIPLIERS.aggressive    * pv_lab > PV_HIGH_SANITY;

  if (allBelow || allAbove) {
    flags.push({ message: "Atypical operating envelope — verify inputs." });
  }

  return flags;
}
