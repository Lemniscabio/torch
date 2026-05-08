// R2 — Mixing Risk.
//
// Two complementary scores:
//   ph_score  — θ_mix vs threshold (applies to batch and fed-batch)
//   da_score  — kinetic Damköhler Da_eff vs thresholds (gradient/overflow risk)
//
// Overall score = worst of the two.

import type { ProcessInputs, DerivedParameters, MixingRiskResult, RiskScore, Confidence, AssessmentFlag } from "@/lib/types";
import { RUSZKOWSKI_CONSTANT, RHO, PH_MIX_THRESHOLDS, KINETIC_PARAMS } from "@/lib/constants";
import { deriveDamkohler } from "./uptake_damkohler";
import type { ReactorScaleConfigs } from "../reactor_configs";

function ruszkowskiMixingTime(t_diameter: number, d_imp: number, pv: number): number {
  const epsilon = pv / RHO;
  return (
    RUSZKOWSKI_CONSTANT *
    Math.pow(t_diameter, 2) /
    (Math.pow(epsilon, 1 / 3) * Math.pow(d_imp, 4 / 3))
  );
}

function scoreDaEff(daEff: number): RiskScore {
  if (daEff < 0.1)  return "low";
  if (daEff < 1.0)  return "moderate";
  if (daEff < 10.0) return "high";
  return "critical";
}

function scorePhControl(theta_mix_target: number): RiskScore {
  if (theta_mix_target < PH_MIX_THRESHOLDS.low)      return "low";
  if (theta_mix_target <= PH_MIX_THRESHOLDS.moderate) return "moderate";
  return "high";
}

function mixingConfidence(hasDa: boolean): { confidence: Confidence; driver: string } {
  if (hasDa) {
    return {
      confidence: "reliable",
      driver: "Mixing risk from Ruszkowski correlation and kinetic Damkohler (Da_eff primary, with lab/target comparison).",
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
  reactorConfigs: ReactorScaleConfigs,
): { result: MixingRiskResult; flags: AssessmentFlag[] } {
  const flags: AssessmentFlag[] = [];

  const theta_mix_lab = ruszkowskiMixingTime(
    reactorConfigs.lab.geometry.t_diameter,
    reactorConfigs.lab.geometry.d_imp,
    reactorConfigs.lab.pv_w_m3,
  );

  const theta_mix_target = ruszkowskiMixingTime(
    reactorConfigs.target.geometry.t_diameter,
    reactorConfigs.target.geometry.d_imp,
    reactorConfigs.target.pv_w_m3,
  );

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
  let da_eff_lab: number | undefined;
  let da_eff_target: number | undefined;
  let mu_eff: number | undefined;
  let da_score: RiskScore | undefined;
  let da_score_lab: RiskScore | undefined;
  let da_score_target: RiskScore | undefined;

  if (derived.biomass_cdw > 0 && derived.our_peak > 0) {
    const kp = KINETIC_PARAMS[inputs.organism_species];
    const damLab = deriveDamkohler({
      theta_mix_s:  theta_mix_lab,
      mu_max:       kp.mu_max,
      K_s:          kp.Ks,
      yield_x_s:    kp.Y_X_S,
      yield_o2:     kp.Y_O2,
      biomass_cdw:  derived.biomass_cdw,
      our_peak:     derived.our_peak,
    });
    const damTarget = deriveDamkohler({
      theta_mix_s:  theta_mix_target,
      mu_max:       kp.mu_max,
      K_s:          kp.Ks,
      yield_x_s:    kp.Y_X_S,
      yield_o2:     kp.Y_O2,
      biomass_cdw:  derived.biomass_cdw,
      our_peak:     derived.our_peak,
    });
    da_max   = damTarget.da_max;
    da_eff   = damTarget.da_eff;
    da_eff_lab = damLab.da_eff;
    da_eff_target = damTarget.da_eff;
    mu_eff   = damTarget.mu_eff;
    da_score_lab = scoreDaEff(damLab.da_eff);
    da_score_target = scoreDaEff(damTarget.da_eff);
    da_score = da_score_target;

    if (damTarget.da_eff >= 10) {
      flags.push({
        domain: "mixing",
        message: `Da_eff at target is ${damTarget.da_eff.toFixed(2)} — strong mixing/uptake mismatch expected.`,
      });
    }
  }

  const score = da_score ?? ph_score;
  const score_lab = da_score_lab ?? ph_score;
  const score_target = da_score_target ?? ph_score;

  const { confidence, driver } = mixingConfidence(da_score !== undefined);

  return {
    result: {
      score,
      score_lab,
      score_target,
      theta_mix_lab,
      theta_mix_target,
      da_max,
      da_eff,
      da_eff_lab,
      da_eff_target,
      da_score,
      da_score_lab,
      da_score_target,
      mu_eff,
      ph_score,
      confidence,
      driver,
    },
    flags,
  };
}
