// R1 — Oxygen Transfer Risk.

import type { ProcessInputs, DerivedParameters, OtrRiskResult, RiskScore, Confidence, AssessmentFlag } from "@/lib/types";
import { OTR_THRESHOLDS } from "@/lib/constants";
import type { ReactorScaleConfigs } from "../reactor_configs";

function scoreKlaRatio(ratio: number): RiskScore {
  if (ratio >= OTR_THRESHOLDS.low)      return "low";
  if (ratio >= OTR_THRESHOLDS.moderate) return "moderate";
  if (ratio >= OTR_THRESHOLDS.high)     return "high";
  return "critical";
}

function otrConfidence(our_mode: ProcessInputs["our_mode"]): { confidence: Confidence; driver: string } {
  if (our_mode === "measured") {
    return { confidence: "high_confidence", driver: "OUR user-provided." };
  }
  return {
    confidence: "directional",
    driver: "OUR estimated from literature; provide measured OUR to upgrade to High-confidence.",
  };
}

export function calculateOtrRisk(
  inputs: ProcessInputs,
  derived: DerivedParameters,
  reactorConfigs: ReactorScaleConfigs,
): { result: OtrRiskResult; flags: AssessmentFlag[] } {
  const flags: AssessmentFlag[] = [];
  const our_peak_selected = derived.our_peak;

  const kla_lab              = reactorConfigs.lab.kla_h;
  const kla_lab_std          = reactorConfigs.lab.kla_ensemble.std;
  const otr_capacity_lab     = kla_lab * reactorConfigs.lab.oxygen.driving_force_lm;
  const otr_our_ratio_lab    = our_peak_selected > 0 ? otr_capacity_lab / our_peak_selected : 0;
  const otr_our_ratio_lab_std = kla_lab > 0 ? otr_our_ratio_lab * (kla_lab_std / kla_lab) : 0;

  const kla_required = derived.driving_force > 0
    ? our_peak_selected / derived.driving_force
    : Infinity;

  if (otr_our_ratio_lab < 1.0) {
    flags.push({
      domain: "otr",
      message: "Your lab process appears oxygen-limited. Resolve this before scale-up assessment is meaningful.",
    });
  }

  const kla_target               = reactorConfigs.target.kla_h;
  const kla_target_std           = reactorConfigs.target.kla_ensemble.std;
  const otr_capacity_target      = kla_target * reactorConfigs.target.oxygen.driving_force_lm;
  const otr_our_ratio_target     = our_peak_selected > 0 ? otr_capacity_target / our_peak_selected : 0;
  const otr_our_ratio_target_std = kla_target > 0 ? otr_our_ratio_target * (kla_target_std / kla_target) : 0;

  const score_lab    = scoreKlaRatio(otr_our_ratio_lab);
  const score_target = scoreKlaRatio(otr_our_ratio_target);

  const { confidence, driver } = otrConfidence(inputs.our_mode);

  return {
    result: {
      score:               score_target,
      score_lab,
      score_target,
      our_peak_selected,
      our_peak_lab:        our_peak_selected,
      kla_required,
      kla_lab,
      kla_lab_std,
      kla_target_moderate: kla_target,
      kla_target_std:      kla_target_std,
      kla_ratio:           otr_our_ratio_target,
      otr_capacity_lab,
      otr_capacity_target,
      otr_our_ratio_lab,
      otr_our_ratio_lab_std,
      otr_our_ratio_target,
      otr_our_ratio_target_std,
      pv_target:           reactorConfigs.target.pv_w_m3,
      confidence,
      driver,
    },
    flags,
  };
}
