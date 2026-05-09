// R1 — Oxygen Transfer Risk.

import type { ProcessInputs, DerivedParameters, OtrRiskResult, RiskScore, Confidence, AssessmentFlag } from "@/lib/types";
import {
  PV_SCENARIO_MULTIPLIERS,
  OTR_THRESHOLDS,
} from "@/lib/constants";
import type { ReactorScaleConfigs } from "../reactor_configs";
import { buildOperatingPoint, computeKlaEnsemble } from "./kla_achievable";

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

  const kla_lab = reactorConfigs.lab.kla_h;
  const driving_force_lab = reactorConfigs.lab.oxygen.driving_force_lm;
  const otr_capacity_lab = kla_lab * driving_force_lab;
  const otr_our_ratio_lab = our_peak_selected > 0
    ? otr_capacity_lab / our_peak_selected
    : 0;

  const kla_required = derived.driving_force > 0
    ? our_peak_selected / derived.driving_force
    : Infinity;
  if (otr_our_ratio_lab < 1.0) {
    flags.push({
      domain: "otr",
      message: "Your lab process appears oxygen-limited. Resolve this before scale-up assessment is meaningful.",
    });
  }

  // Canonical lab-scale operating point from lab reactor config.
  const opLab = buildOperatingPoint({
    D_T: reactorConfigs.lab.geometry.t_diameter,
    H_L: reactorConfigs.lab.geometry.h_liquid,
    V_L: reactorConfigs.lab.geometry.volume_m3,
    d_i: reactorConfigs.lab.geometry.d_imp,
    impeller_type: inputs.impeller_type,
    n_imp: reactorConfigs.lab.n_impellers,
    N_rps: reactorConfigs.lab.rpm / 60,
    Q_gas: reactorConfigs.lab.gas.q_gas,
    v_s: reactorConfigs.lab.gas.vs,
    mu_L: derived.mu,
  });
  const ensLab = computeKlaEnsemble(opLab, reactorConfigs.lab.power_w, derived.biomass_cdw);

  // Canonical target-scale operating point from target reactor config.
  const opTarget = buildOperatingPoint({
    D_T: reactorConfigs.target.geometry.t_diameter,
    H_L: reactorConfigs.target.geometry.h_liquid,
    V_L: reactorConfigs.target.geometry.volume_m3,
    d_i: reactorConfigs.target.geometry.d_imp,
    impeller_type: inputs.impeller_type,
    n_imp: reactorConfigs.target.n_impellers,
    N_rps: reactorConfigs.target.rpm / 60,
    Q_gas: reactorConfigs.target.gas.q_gas,
    v_s:   reactorConfigs.target.gas.vs,
    mu_L:  derived.mu,
  });

  const pv_conservative = PV_SCENARIO_MULTIPLIERS.conservative * reactorConfigs.target.pv_w_m3;
  const pv_moderate     = PV_SCENARIO_MULTIPLIERS.moderate     * reactorConfigs.target.pv_w_m3;
  const pv_aggressive   = PV_SCENARIO_MULTIPLIERS.aggressive   * reactorConfigs.target.pv_w_m3;

  const ensConservative = computeKlaEnsemble(
    opTarget,
    PV_SCENARIO_MULTIPLIERS.conservative * reactorConfigs.target.power_w,
    derived.biomass_cdw,
  );
  const ensModerate = computeKlaEnsemble(
    opTarget,
    reactorConfigs.target.power_w,
    derived.biomass_cdw,
  );
  const ensAggressive = computeKlaEnsemble(
    opTarget,
    PV_SCENARIO_MULTIPLIERS.aggressive * reactorConfigs.target.power_w,
    derived.biomass_cdw,
  );

  const kla_target_moderate = reactorConfigs.target.kla_h;
  const driving_force_target = reactorConfigs.target.oxygen.driving_force_lm;
  const otr_capacity_target = kla_target_moderate * driving_force_target;
  const otr_our_ratio_target = our_peak_selected > 0
    ? otr_capacity_target / our_peak_selected
    : 0;
  const score_lab = scoreKlaRatio(otr_our_ratio_lab);
  const score_target = scoreKlaRatio(otr_our_ratio_target);
  const score = score_target;

  const { confidence, driver } = otrConfidence(inputs.our_mode);

  return {
    result: {
      score,
      score_lab,
      score_target,
      our_peak_selected,
      our_peak_lab: our_peak_selected,
      kla_required,
      kla_lab,
      kla_target_conservative: ensConservative.mean,
      kla_target_moderate,
      kla_target_aggressive:   ensAggressive.mean,
      kla_ratio: otr_our_ratio_target,
      otr_capacity_lab,
      otr_capacity_target,
      otr_our_ratio_lab,
      otr_our_ratio_target,
      pv_conservative,
      pv_moderate,
      pv_aggressive,
      correlations_used: ensModerate.correlations,
      kla_std:           ensModerate.std,
      kla_lab_min:       ensLab.min,
      kla_lab_max:       ensLab.max,
      kla_target_min:    ensModerate.min,
      kla_target_max:    ensModerate.max,
      kla_min:           ensModerate.min,
      kla_max:           ensModerate.max,
      kla_components:    ensModerate.components,
      confidence,
      driver,
    },
    flags,
  };
}

// // R2 — Oxygen to Substrate Utilization Risk

// // Updated thresholds for oxygen-to-substrate utilization ratio risk assessment.
// // Note: These thresholds are placeholders and should be validated against reliable sources such as PubMed or ScienceDirect.
// function scoreMuRatio(ratio: number): RiskScore {
//   if (ratio > 2.0) return "low"; // High oxygen-to-substrate ratio indicates low risk.
//   if (ratio > 1.0) return "moderate";
//   if (ratio > 0.5) return "high";
//   return "critical"; // Very low oxygen-to-substrate ratio indicates critical risk.
// }

// export function calculateMuO2SubstrateRisk(
//   inputs: ProcessInputs,
//   derived: DerivedParameters,
// ): { result: OtrRiskResult; flags: AssessmentFlag[] } {
//   const flags: AssessmentFlag[] = [];

//   const mu_o2 = derived.mu_o2;
//   const mu_substrate = derived.mu_substrate;

//   if (mu_substrate === 0) {
//     flags.push({
//       domain: "otr",
//       message: "Substrate utilization rate is zero, cannot calculate risk ratio."
//     });
//     return {
//       result: {
//         score: "critical",
//         mu_o2,
//         mu_substrate,
//         mu_ratio: Infinity,
//         confidence: "low_confidence",
//         driver: "Substrate utilization rate is zero."
//       },
//       flags,
//     };
//   }

//   const mu_ratio = mu_o2 / mu_substrate;
//   const score = scoreMuRatio(mu_ratio);

//   return {
//     result: {
//       score,
//       mu_o2,
//       mu_substrate,
//       mu_ratio,
//       confidence: "high_confidence",
//       driver: "Calculated from provided oxygen and substrate utilization rates."
//     },
//     flags,
//   };
// }
