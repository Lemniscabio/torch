// R5 — Heat Removal Risk.

import type { ProcessInputs, DerivedParameters, HeatRiskResult, RiskScore, Confidence, AssessmentFlag } from "@/lib/types";
import { METABOLIC_HEAT_FACTOR, U_JACKET, T_CW_OUTLET_OFFSET, HEAT_THRESHOLDS } from "@/lib/constants";

function scoreHeatRatio(ratio: number): RiskScore {
  if (ratio < HEAT_THRESHOLDS.low)      return "low";
  if (ratio < HEAT_THRESHOLDS.moderate) return "moderate";
  if (ratio < HEAT_THRESHOLDS.high)     return "high";
  return "critical";
}

function heatConfidence(our_mode: ProcessInputs["our_mode"]): { confidence: Confidence; driver: string } {
  if (our_mode === "measured") {
    return { confidence: "reliable",    driver: "OUR user-provided; heat model uses standard jacket U-value assumption." };
  }
  return { confidence: "directional", driver: "OUR estimated from literature; heat generation scales directly with OUR. Provide measured OUR to improve confidence." };
}

export function calculateHeatRisk(
  inputs: ProcessInputs,
  derived: DerivedParameters,
): { result: HeatRiskResult; flags: AssessmentFlag[] } {
  const { t_diameter, h_liquid, volume_m3 } = derived.target_geometry;

  const q_metabolic = METABOLIC_HEAT_FACTOR * derived.our_peak * volume_m3;

  const a_jacket =
    Math.PI * t_diameter * h_liquid +
    (Math.PI / 4) * t_diameter * t_diameter;

  const t_cw_inlet  = inputs.t_cw_inlet;
  const t_cw_outlet = t_cw_inlet + T_CW_OUTLET_OFFSET;
  const t_process   = inputs.temperature;

  const dt_hot  = t_process - t_cw_inlet;
  const dt_cold = t_process - t_cw_outlet;

  const dt_lm =
    Math.abs(dt_hot - dt_cold) < 0.001
      ? dt_hot
      : (dt_hot - dt_cold) / Math.log(dt_hot / dt_cold);

  const q_cool_max = (U_JACKET * a_jacket * dt_lm) / 1000;
  const heat_ratio = q_cool_max > 0 ? q_metabolic / q_cool_max : Infinity;
  const score      = scoreHeatRatio(heat_ratio);

  const { confidence, driver } = heatConfidence(inputs.our_mode);

  return {
    result: { score, q_metabolic, a_jacket, dt_lm, q_cool_max, heat_ratio, confidence, driver },
    flags: [],
  };
}
