// R2 — Mixing Risk.
//
// Two complementary scores:
//   ph_score  — θ_mix vs threshold (applies to batch and fed-batch)
//   da_score  — kinetic Damköhler Da_max vs thresholds (gradient/overflow risk)
//
// Overall score = worst of the two.

import type { ProcessInputs, DerivedParameters, MixingRiskResult, RiskScore, Confidence, AssessmentFlag } from "@/lib/types";
import { RUSZKOWSKI_CONSTANT, RHO, PH_MIX_THRESHOLDS, DA_THRESHOLDS, KINETIC_PARAMS } from "@/lib/constants";
import { deriveDamkohler } from "./uptake_damkohler";

function ruszkowskiMixingTime(t_diameter: number, d_imp: number, pv: number): number {
  const epsilon = pv / RHO;
  return (
    RUSZKOWSKI_CONSTANT *
    Math.pow(t_diameter, 2) /
    (Math.pow(epsilon, 1 / 3) * Math.pow(d_imp, 4 / 3))
  );
}

function scoreDa(da: number): RiskScore {
  if (da < DA_THRESHOLDS.low)      return "low";
  if (da < DA_THRESHOLDS.moderate) return "moderate";
  if (da < DA_THRESHOLDS.high)     return "high";
  return "critical";
}

function scorePhControl(theta_mix_target: number): RiskScore {
  if (theta_mix_target < PH_MIX_THRESHOLDS.low)      return "low";
  if (theta_mix_target <= PH_MIX_THRESHOLDS.moderate) return "moderate";
  return "high";
}

const SCORE_ORDER: Record<RiskScore, number> = { low: 0, moderate: 1, high: 2, critical: 3 };

function worstScore(...scores: RiskScore[]): RiskScore {
  return scores.reduce((a, b) => SCORE_ORDER[a] >= SCORE_ORDER[b] ? a : b);
}

function mixingConfidence(hasDa: boolean): { confidence: Confidence; driver: string } {
  if (hasDa) {
    return {
      confidence: "reliable",
      driver: "Mixing risk from Ruszkowski correlation and kinetic Damköhler (μ_max-based, conservative).",
    };
  }
  return {
    confidence: "reliable",
    driver: "Mixing risk based on θ_mix only — no biomass supplied for Damköhler calculation.",
  };
}

export function calculateMixingRisk(
  inputs: ProcessInputs,
  derived: DerivedParameters,
): { result: MixingRiskResult; flags: AssessmentFlag[] } {
  const flags: AssessmentFlag[] = [];

  const theta_mix_lab = ruszkowskiMixingTime(
    derived.lab_geometry.t_diameter,
    derived.lab_geometry.d_imp,
    derived.pv_lab,
  );

  const theta_mix_target =
    theta_mix_lab * Math.pow(inputs.v_target / inputs.v_lab, 1 / 3);

  if (inputs.h_d_target > 1.5) {
    flags.push({
      domain: "mixing",
      message:
        "Mixing time estimate carries significant additional uncertainty for H/D > 1.5. Multi-impeller configurations are standard practice at this scale. Ruszkowski validated for H/D 0.8–1.5 only.",
    });
  }

  if (theta_mix_lab > 30 && inputs.v_lab < 20) {
    flags.push({
      domain: "mixing",
      message: "Unusual mixing time for this vessel size — verify RPM entry.",
    });
  }

  const ph_score = scorePhControl(theta_mix_target);

  // Kinetic Damköhler — requires biomass and organism kinetics
  let da_max: number | undefined;
  let da_eff: number | undefined;
  let mu_eff: number | undefined;
  let da_score: RiskScore | undefined;

  if (derived.biomass_cdw > 0 && derived.our_peak > 0) {
    const kp = KINETIC_PARAMS[inputs.organism_species];
    const dam = deriveDamkohler({
      theta_mix_s:  theta_mix_target,
      mu_max:       kp.mu_max,
      K_s:          kp.Ks,
      yield_x_s:    kp.Y_X_S,
      yield_o2:     kp.Y_O2,
      biomass_cdw:  derived.biomass_cdw,
      our_peak:     derived.our_peak,
    });
    da_max   = dam.da_max;
    da_eff   = dam.da_eff;
    mu_eff   = dam.mu_eff;
    da_score = scoreDa(da_max);

    if (da_max >= DA_THRESHOLDS.high) {
      flags.push({
        domain: "mixing",
        message: `Kinetic Damköhler Da = ${da_max.toFixed(1)} — substrate gradients expected at target scale. Risk of overflow metabolism (acetate/ethanol). Da_eff = ${da_eff.toFixed(2)} (informational).`,
      });
    }
  }

  const score = da_score
    ? worstScore(ph_score, da_score)
    : ph_score;

  const { confidence, driver } = mixingConfidence(da_score !== undefined);

  return {
    result: {
      score,
      theta_mix_lab,
      theta_mix_target,
      da_max,
      da_eff,
      da_score,
      mu_eff,
      ph_score,
      confidence,
      driver,
    },
    flags,
  };
}
