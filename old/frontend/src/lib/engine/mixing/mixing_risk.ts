// R2 — Mixing Risk.
//
// O2-mixing margin (inverse Da-like):
//   margin = (3600 * C_L / OUR_peak) / theta_mix = t_o2 / t_mix
// where C_L is dissolved O2 concentration implied by DO setpoint.
//
// This compares mixing timescale against local O2 depletion timescale.

import type { ProcessInputs, DerivedParameters, MixingRiskResult, RiskScore, Confidence, AssessmentFlag } from "@/lib/types";
import { RUSZKOWSKI_CONSTANT, RHO } from "@/lib/constants";
import type { ReactorScaleConfigs } from "../reactor_configs";

function ruszkowskiMixingTime(t_diameter: number, d_imp: number, pv: number): number {
  const epsilon = pv / RHO;
  return (
    RUSZKOWSKI_CONSTANT *
    Math.pow(t_diameter, 2) /
    (Math.pow(epsilon, 1 / 3) * Math.pow(d_imp, 4 / 3))
  );
}

function scoreO2MixingMargin(margin: number): RiskScore {
  if (margin > 10.0) return "low";
  if (margin > 1.0)  return "moderate";
  if (margin > 0.1)  return "high";
  return "critical";
}

function oxygenDepletionTimeSeconds(cL: number, ourPeak: number): number {
  if (ourPeak <= 0) return Infinity;
  if (cL <= 0) return 0;
  return (3600 * cL) / ourPeak;
}

function o2MixingMargin(thetaMix: number, cL: number, ourPeak: number): number {
  const tau = oxygenDepletionTimeSeconds(cL, ourPeak);
  if (!Number.isFinite(tau)) return 0;
  if (tau <= 0) return Infinity;
  if (thetaMix <= 0) return Infinity;
  return tau / thetaMix;
}

function mixingConfidence(ourMode: ProcessInputs["our_mode"]): { confidence: Confidence; driver: string } {
  if (ourMode === "measured") {
    return {
      confidence: "reliable",
      driver: "OUR user-provided; mixing risk uses Ruszkowski mixing time and O2 depletion margin.",
    };
  }

  return {
    confidence: "directional",
    driver: "OUR estimated from literature; mixing risk inherits OUR uncertainty through O2 depletion time.",
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

  const oxygen_depletion_time_lab_s = oxygenDepletionTimeSeconds(derived.c_l_lab, derived.our_peak);
  const oxygen_depletion_time_target_s = oxygenDepletionTimeSeconds(derived.c_l, derived.our_peak);
  const o2_mixing_ratio_lab = o2MixingMargin(theta_mix_lab, derived.c_l_lab, derived.our_peak);
  const o2_mixing_ratio_target = o2MixingMargin(theta_mix_target, derived.c_l, derived.our_peak);

  const score_lab = scoreO2MixingMargin(o2_mixing_ratio_lab);
  const score_target = scoreO2MixingMargin(o2_mixing_ratio_target);
  const score = score_target;

  if (o2_mixing_ratio_target <= 0.1) {
    flags.push({
      domain: "mixing",
      message: `O2 mixing margin (t_o2/t_mix) at target is ${o2_mixing_ratio_target.toFixed(2)} — strong mixing/oxygen depletion mismatch expected.`,
    });
  }

  const { confidence, driver } = mixingConfidence(inputs.our_mode);

  return {
    result: {
      score,
      score_lab,
      score_target,
      theta_mix_lab,
      theta_mix_target,
      o2_mixing_ratio_lab,
      o2_mixing_ratio_target,
      oxygen_depletion_time_lab_s,
      oxygen_depletion_time_target_s,
      confidence,
      driver,
    },
    flags,
  };
}
