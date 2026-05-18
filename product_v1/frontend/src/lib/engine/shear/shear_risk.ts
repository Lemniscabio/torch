// R3 — Shear Stress Risk.

import type { ProcessInputs, DerivedParameters, ShearRiskResult, RiskScore, Confidence, AssessmentFlag } from "@/lib/types";
import { TIP_SPEED_THRESHOLDS, TIP_SPEED_THRESHOLD_RELATIVE_UNCERTAINTY, SHEAR_THRESHOLDS } from "@/lib/constants";
import type { ReactorScaleConfigs } from "../reactor_configs";

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
  reactorConfigs: ReactorScaleConfigs,
): { result: ShearRiskResult; flags: AssessmentFlag[] } {
  const n_lab = reactorConfigs.lab.rpm / 60;
  const n_target = reactorConfigs.target.rpm / 60;
  const tip_speed_lab = reactorConfigs.lab.tip_speed_m_s;
  const tip_speed = reactorConfigs.target.tip_speed_m_s;

  const tip_speed_threshold       = TIP_SPEED_THRESHOLDS[inputs.organism_species];
  const tip_speed_ratio_lab       = tip_speed_lab / tip_speed_threshold;
  const tip_speed_margin_lab      = tip_speed_threshold / tip_speed_lab;
  const tip_speed_margin_lab_std  = tip_speed_margin_lab * TIP_SPEED_THRESHOLD_RELATIVE_UNCERTAINTY;
  const tip_speed_ratio           = tip_speed / tip_speed_threshold;
  const tip_speed_margin          = tip_speed_threshold / tip_speed;
  const tip_speed_margin_std      = tip_speed_margin * TIP_SPEED_THRESHOLD_RELATIVE_UNCERTAINTY;
  const margin_score_lab          = scoreTipSpeedMargin(tip_speed_margin_lab);
  const margin_score_target       = scoreTipSpeedMargin(tip_speed_margin);
  const margin_score              = margin_score_target;
  const score_lab                 = margin_score_lab;
  const score_target        = margin_score_target;
  const score               = score_target;

  const confidence: Confidence = "reliable";
  const driver = "Shear risk depends on geometry and agitation; independent of OUR estimation.";

  return {
    result: {
      score,
      score_lab,
      score_target,
      n_lab,
      n_target,
      tip_speed_lab,
      tip_speed,
      tip_speed_threshold,
      tip_speed_ratio_lab,
      tip_speed_margin_lab,
      tip_speed_margin_lab_std,
      tip_speed_ratio,
      tip_speed_margin,
      tip_speed_margin_std,
      margin_score,
      margin_score_lab,
      margin_score_target,
      confidence,
      driver,
    },
    flags: [],
  };
}
