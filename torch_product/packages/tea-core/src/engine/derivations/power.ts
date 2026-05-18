// D3 — Power input derivation.

import type { ImpellerType, AssessmentFlag, VesselGeometry } from "../../types";
import { IMPELLER_CONSTANTS, RHO } from "../../constants";
import { SOFT_WARNING_BOUNDS } from "../../constants/input_bounds";
import { getScaleupOperatingRange } from "../../constants/scaleup_operating_ranges";
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
  };

  const p_ungassed = ungassedPower(op);
  const p_total    = gassedPower(op);
  const p_gassed   = n_impellers > 0 ? p_total / n_impellers : 0;
  const pv_lab     = p_total / lab_geometry.volume_m3;

  return { n_rps, p_ungassed, p_gassed, p_total, pv_lab };
}

export function derivePowerFlags(vvm: number, pv_lab: number, volume_l: number): AssessmentFlag[] {
  const flags: AssessmentFlag[] = [];

  const vvmBounds = SOFT_WARNING_BOUNDS.vvm_gassed_power;
  if (vvm > vvmBounds.max || vvm < vvmBounds.min) {
    flags.push({
      message: "Gassed power correction carries additional uncertainty outside VVM 0.5–2.0 range.",
    });
  }

  const pvBounds = getScaleupOperatingRange(volume_l).max_pv_w_m3;
  if (pv_lab < pvBounds.min || pv_lab > pvBounds.max) {
    flags.push({ message: "Atypical operating envelope — verify inputs." });
  }

  return flags;
}
