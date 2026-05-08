// R3 — Shear Stress Risk.

import type { ProcessInputs, DerivedParameters, ShearRiskResult, RiskScore, Confidence, AssessmentFlag } from "@/lib/types";
import { TIP_SPEED_THRESHOLDS, SHEAR_THRESHOLDS } from "@/lib/constants";

function scoreTipSpeedRatio(ratio: number): RiskScore {
  if (ratio < SHEAR_THRESHOLDS.low)      return "low";
  if (ratio < SHEAR_THRESHOLDS.moderate) return "moderate";
  if (ratio < SHEAR_THRESHOLDS.high)     return "high";
  return "critical";
}

// Margin = threshold/actual = 1/ratio. Boundaries are reciprocals of SHEAR_THRESHOLDS.
function scoreTipSpeedMargin(margin: number): RiskScore {
  if (margin > 1 / SHEAR_THRESHOLDS.low)      return "low";       // margin > 1.43
  if (margin > 1 / SHEAR_THRESHOLDS.moderate) return "moderate";  // margin > 1.0
  if (margin > 1 / SHEAR_THRESHOLDS.high)     return "high";      // margin > 0.77
  return "critical";
}

export function calculateShearRisk(
  inputs: ProcessInputs,
  derived: DerivedParameters,
): { result: ShearRiskResult; flags: AssessmentFlag[] } {
  const d_imp_lab    = derived.lab_geometry.d_imp;
  const d_imp_target = derived.target_geometry.d_imp;

  // Constant P/V scale-up: N_target = N_lab × (D_lab / D_target)^(5/3)
  const n_target  = derived.n_rps * Math.pow(d_imp_lab / d_imp_target, 5 / 3);
  const tip_speed = Math.PI * n_target * d_imp_target;

  const tip_speed_threshold = TIP_SPEED_THRESHOLDS[inputs.organism_species];
  const tip_speed_ratio     = tip_speed / tip_speed_threshold;
  const tip_speed_margin    = tip_speed_threshold / tip_speed;
  const score               = scoreTipSpeedRatio(tip_speed_ratio);
  const margin_score        = scoreTipSpeedMargin(tip_speed_margin);

  const confidence: Confidence = "reliable";
  const driver = "Shear risk depends on geometry and agitation; independent of OUR estimation.";

  return {
    result: { score, n_target, tip_speed, tip_speed_threshold, tip_speed_ratio, tip_speed_margin, margin_score, confidence, driver },
    flags: [],
  };
}
