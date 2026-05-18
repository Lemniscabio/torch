// R2 — Mixing Risk.
//
// O2-mixing margin (inverse Da-like):
//   margin = (3600 * C_L / OUR_peak) / theta_mix = t_o2 / t_mix
// where C_L is dissolved O2 concentration implied by DO setpoint.
//
// This compares mixing timescale against local O2 depletion timescale.

import type { ProcessInputs, DerivedParameters, MixingRiskResult, RiskScore, Confidence, AssessmentFlag } from "@/lib/types";
import { O2_MIXING_THRESHOLDS, FEEDING_FREQUENCY_SECONDS } from "@/lib/constants";
import type { ReactorScaleConfigs } from "../reactor_configs";
import type { ReactorScaleConfig } from "../reactor_configs";
import { computeMixingTimeEnsemble } from "./mixing_correlations";

// Exported for external consumers (ResultsDashboard, PdfReport projection rows).
// Uses Ruszkowski only — single-correlation shortcut for display, not risk scoring.
export function ruszkowskiMixingTime(t_diameter: number, d_imp: number, pv: number): number {
  const ensemble = computeMixingTimeEnsemble({
    T: t_diameter,
    D: d_imp,
    N_rps: 1, // N_rps not needed by Ruszkowski/Cooke; Grenville-Nienow will be out of range but mean still valid
    pv_w_m3: pv,
    impeller_type: "rushton", // conservative default for single-call use
  });
  // Return the ensemble mean (dominated by Ruszkowski/Cooke which don't use N_rps)
  return ensemble.mean;
}

function mixingEnsembleForScale(scale: ReactorScaleConfig, impeller_type: ProcessInputs["impeller_type"]) {
  return computeMixingTimeEnsemble({
    T:            scale.geometry.t_diameter,
    D:            scale.geometry.d_imp,
    N_rps:        scale.rpm / 60,
    pv_w_m3:      scale.pv_w_m3,
    impeller_type,
  });
}

function scoreO2MixingMargin(margin: number): RiskScore {
  if (margin > O2_MIXING_THRESHOLDS.low)      return "low";
  if (margin > O2_MIXING_THRESHOLDS.moderate) return "moderate";
  if (margin > O2_MIXING_THRESHOLDS.high)     return "high";
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

// σ(ratio) / ratio = σ(theta) / theta  (inverse proportionality)
function o2MixingMarginStd(ratio: number, thetaMix: number, thetaStd: number): number {
  if (thetaMix <= 0) return 0;
  return ratio * (thetaStd / thetaMix);
}

function mixingConfidence(ourMode: ProcessInputs["our_mode"]): { confidence: Confidence; driver: string } {
  if (ourMode === "measured") {
    return {
      confidence: "reliable",
      driver: "OUR user-provided; mixing risk uses correlation ensemble (Ruszkowski, Cooke, Grenville-Nienow) and O2 depletion margin.",
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

  const ensLab    = mixingEnsembleForScale(reactorConfigs.lab,    inputs.impeller_type);
  const ensTarget = mixingEnsembleForScale(reactorConfigs.target, inputs.impeller_type);

  const theta_mix_lab        = ensLab.mean;
  const theta_mix_lab_std    = ensLab.std;
  const theta_mix_target     = ensTarget.mean;
  const theta_mix_target_std = ensTarget.std;

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

  const oxygen_depletion_time_lab_s    = oxygenDepletionTimeSeconds(derived.c_star_lab, derived.our_peak);
  const oxygen_depletion_time_target_s = oxygenDepletionTimeSeconds(derived.c_star,     derived.our_peak);

  // τ_feed: feed pulse timescale (fed-batch only)
  const process_type = inputs.process_type ?? "batch";
  const t_feed_s: number | undefined =
    process_type === "fed_batch" && inputs.feeding_frequency
      ? FEEDING_FREQUENCY_SECONDS[inputs.feeding_frequency]
      : undefined;

  // τ_process = min(τ_feed, τ_O₂); for batch = τ_O₂
  const t_process_lab_s    = t_feed_s !== undefined
    ? Math.min(t_feed_s, oxygen_depletion_time_lab_s)
    : oxygen_depletion_time_lab_s;
  const t_process_target_s = t_feed_s !== undefined
    ? Math.min(t_feed_s, oxygen_depletion_time_target_s)
    : oxygen_depletion_time_target_s;

  const process_mixing_ratio_lab    = t_process_lab_s    / Math.max(theta_mix_lab,    1e-9);
  const process_mixing_ratio_target = t_process_target_s / Math.max(theta_mix_target, 1e-9);

  const process_mixing_ratio_lab_std    = o2MixingMarginStd(process_mixing_ratio_lab,    theta_mix_lab,    theta_mix_lab_std);
  const process_mixing_ratio_target_std = o2MixingMarginStd(process_mixing_ratio_target, theta_mix_target, theta_mix_target_std);

  const score_lab    = scoreO2MixingMargin(process_mixing_ratio_lab);
  const score_target = scoreO2MixingMargin(process_mixing_ratio_target);
  const score        = score_target;

  if (process_mixing_ratio_target <= 0.1) {
    flags.push({
      domain: "mixing",
      message: `Process mixing margin (τ_process/τ_mix) at target is ${process_mixing_ratio_target.toFixed(2)} — strong mixing/process timescale mismatch expected.`,
    });
  }

  const { confidence, driver } = mixingConfidence(inputs.our_mode);

  return {
    result: {
      score,
      score_lab,
      score_target,
      theta_mix_lab,
      theta_mix_lab_std,
      theta_mix_target,
      theta_mix_target_std,
      process_mixing_ratio_lab,
      process_mixing_ratio_lab_std,
      process_mixing_ratio_target,
      process_mixing_ratio_target_std,
      t_feed_s,
      t_process_lab_s,
      t_process_target_s,
      oxygen_depletion_time_lab_s,
      oxygen_depletion_time_target_s,
      confidence,
      driver,
    },
    flags,
  };
}
