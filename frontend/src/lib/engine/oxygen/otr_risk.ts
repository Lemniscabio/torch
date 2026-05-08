// R1 — Oxygen Transfer Risk.

import type { ProcessInputs, DerivedParameters, OtrRiskResult, RiskScore, Confidence, AssessmentFlag } from "@/lib/types";
import { PV_SCENARIO_MULTIPLIERS, OTR_THRESHOLDS } from "@/lib/constants";
import { buildOperatingPoint, computeKlaEnsemble } from "./kla_achievable";

function scoreKlaRatio(ratio: number): RiskScore {
  if (ratio > OTR_THRESHOLDS.low)       return "low";
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
): { result: OtrRiskResult; flags: AssessmentFlag[] } {
  const flags: AssessmentFlag[] = [];

  const kla_required = derived.our_peak / derived.driving_force;

  // Lab-scale kLa ensemble
  const opLab = buildOperatingPoint({
    D_T: derived.lab_geometry.t_diameter,
    H_L: derived.lab_geometry.h_liquid,
    V_L: derived.lab_geometry.volume_m3,
    d_i: derived.lab_geometry.d_imp,
    impeller_type: inputs.impeller_type,
    n_imp: inputs.n_impellers,
    N_rps: derived.n_rps,
    Q_gas: derived.q_gas_lab,
    v_s:   derived.vs_lab,
    mu_L:  derived.mu,
  });
  const labEnsemble = computeKlaEnsemble(opLab, derived.p_total, derived.biomass_cdw);
  const kla_lab = labEnsemble.mean;

  if (kla_lab < kla_required) {
    flags.push({
      domain: "otr",
      message: "Your lab process appears oxygen-limited. Resolve this before scale-up assessment is meaningful.",
    });
  }

  // Target-scale operating point
  const opTarget = buildOperatingPoint({
    D_T: derived.target_geometry.t_diameter,
    H_L: derived.target_geometry.h_liquid,
    V_L: derived.target_geometry.volume_m3,
    d_i: derived.target_geometry.d_imp,
    impeller_type: inputs.impeller_type,
    n_imp: inputs.n_impellers,
    N_rps: derived.n_rps,
    Q_gas: derived.q_gas_target,
    v_s:   derived.vs_target,
    mu_L:  derived.mu,
  });

  const V_target      = derived.target_geometry.volume_m3;
  const pv_conservative = PV_SCENARIO_MULTIPLIERS.conservative * derived.pv_lab;
  const pv_moderate     = PV_SCENARIO_MULTIPLIERS.moderate     * derived.pv_lab;
  const pv_aggressive   = PV_SCENARIO_MULTIPLIERS.aggressive   * derived.pv_lab;

  const ensConservative = computeKlaEnsemble(opTarget, pv_conservative * V_target, derived.biomass_cdw);
  const ensModerate     = computeKlaEnsemble(opTarget, pv_moderate     * V_target, derived.biomass_cdw);
  const ensAggressive   = computeKlaEnsemble(opTarget, pv_aggressive   * V_target, derived.biomass_cdw);

  const kla_ratio = ensModerate.mean / kla_required;
  const score     = scoreKlaRatio(kla_ratio);

  const { confidence, driver } = otrConfidence(inputs.our_mode);

  return {
    result: {
      score,
      kla_required,
      kla_lab,
      kla_target_conservative: ensConservative.mean,
      kla_target_moderate:     ensModerate.mean,
      kla_target_aggressive:   ensAggressive.mean,
      kla_ratio,
      pv_conservative,
      pv_moderate,
      pv_aggressive,
      correlations_used: ensModerate.correlations,
      kla_std:           ensModerate.std,
      kla_components:    ensModerate.components,
      confidence,
      driver,
    },
    flags,
  };
}

// R2 — Oxygen to Substrate Utilization Risk

// Updated thresholds for oxygen-to-substrate utilization ratio risk assessment.
// Note: These thresholds are placeholders and should be validated against reliable sources such as PubMed or ScienceDirect.
function scoreMuRatio(ratio: number): RiskScore {
  if (ratio > 2.0) return "low"; // High oxygen-to-substrate ratio indicates low risk.
  if (ratio > 1.0) return "moderate";
  if (ratio > 0.5) return "high";
  return "critical"; // Very low oxygen-to-substrate ratio indicates critical risk.
}

export function calculateMuO2SubstrateRisk(
  inputs: ProcessInputs,
  derived: DerivedParameters,
): { result: OtrRiskResult; flags: AssessmentFlag[] } {
  const flags: AssessmentFlag[] = [];

  const mu_o2 = derived.mu_o2;
  const mu_substrate = derived.mu_substrate;

  if (mu_substrate === 0) {
    flags.push({
      domain: "otr",
      message: "Substrate utilization rate is zero, cannot calculate risk ratio."
    });
    return {
      result: {
        score: "critical",
        mu_o2,
        mu_substrate,
        mu_ratio: Infinity,
        confidence: "low_confidence",
        driver: "Substrate utilization rate is zero."
      },
      flags,
    };
  }

  const mu_ratio = mu_o2 / mu_substrate;
  const score = scoreMuRatio(mu_ratio);

  return {
    result: {
      score,
      mu_o2,
      mu_substrate,
      mu_ratio,
      confidence: "high_confidence",
      driver: "Calculated from provided oxygen and substrate utilization rates."
    },
    flags,
  };
}
