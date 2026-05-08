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
import { gassedPower, ungassedPower } from "../correlations/gassed_power";
import { deriveGasVelocity } from "./gas";
import type { ReactorOperatingPoint } from "../correlations/types";

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
  vvm: number,
): PowerResult {
  const impeller = IMPELLER_CONSTANTS[impeller_type];
  const n_rps = rpm / 60;
  const gas = deriveGasVelocity(vvm, lab_geometry.volume_m3 * 1000, lab_geometry.a_cross);
  const op: ReactorOperatingPoint = {
    D_T:          lab_geometry.t_diameter,
    H_L:          lab_geometry.h_liquid,
    V_L:          lab_geometry.volume_m3,
    d_i:          lab_geometry.d_imp,
    impeller_type,
    Np:           impeller.np,
    n_imp:        n_impellers,
    N_rps:        n_rps,
    Q_gas:        gas.q_gas,
    v_s:          gas.vs,
    rho_L:        RHO,
    mu_L:         1.0e-3,
    broth_type:   "coalescing",
  };

  const p_ungassed = ungassedPower(op);
  const p_total    = gassedPower(op);
  const p_gassed   = n_impellers > 0 ? p_total / n_impellers : 0;
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
