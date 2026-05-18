// R5 — Heat Removal Risk.

import type {
  ProcessInputs,
  DerivedParameters,
  HeatRiskResult,
  HeatScaleRiskResult,
  RiskScore,
  Confidence,
  AssessmentFlag,
} from "../../types";
import { HEAT_THRESHOLDS, INPUT_DEFAULTS, U_RELATIVE_UNCERTAINTY } from "../../constants";
import { runHeatCapacityCheck, type HeatCapacityResult } from "./heat_capacity";
import type { ReactorScaleConfig, ReactorScaleConfigs } from "../reactor_configs";

// Margin form for consistency with other domains:
// heat_transfer_margin = Q_cool_max / Q_metabolic
// lower margin => higher risk.
function scoreHeatMargin(margin: number): RiskScore {
  if (margin > 1 / HEAT_THRESHOLDS.low)      return "low";
  if (margin > 1 / HEAT_THRESHOLDS.moderate) return "moderate";
  if (margin > 1 / HEAT_THRESHOLDS.high)     return "high";
  return "critical";
}

function heatConfidence(our_mode: ProcessInputs["our_mode"]): { confidence: Confidence; driver: string } {
  if (our_mode === "measured") {
    return { confidence: "reliable", driver: "OUR user-provided; heat model uses correlation-derived U, jacket area, and LMTD." };
  }
  return { confidence: "directional", driver: "OUR estimated from literature; heat generation scales directly with OUR. Provide measured OUR to improve confidence." };
}

export function calculateHeatRisk(
  inputs: ProcessInputs,
  derived: DerivedParameters,
  reactorConfigs: ReactorScaleConfigs,
): { result: HeatRiskResult; flags: AssessmentFlag[] } {
  const flags: AssessmentFlag[] = [];
  const flowrate_lpm = inputs.cooling_water_flowrate_lpm ?? INPUT_DEFAULTS.cooling_water_flowrate_lpm;
  const labRaw = calculateScaleHeat(inputs, derived, reactorConfigs.lab, flowrate_lpm);
  const targetRaw = calculateScaleHeat(inputs, derived, reactorConfigs.target, flowrate_lpm);
  const lab = mapScaleHeat(labRaw);
  const target = mapScaleHeat(targetRaw);

  const q_metabolic = target.q_metabolic;
  const a_jacket = target.a_jacket;
  const dt_lm = target.dt_lm;
  const q_cool_max = target.q_cool_max;
  const heat_ratio = q_cool_max > 0 ? q_metabolic / q_cool_max : Infinity;
  const heat_transfer_margin = q_metabolic > 0 ? q_cool_max / q_metabolic : Infinity;
  const margin_score = scoreHeatMargin(heat_transfer_margin);
  const score = margin_score;

  const { confidence, driver } = heatConfidence(inputs.our_mode);
  if (!Number.isFinite(dt_lm) || dt_lm <= 0) {
    flags.push({
      domain: "heat",
      message: "Cooling-water inlet/outlet temperatures leave little or no thermal driving force for jacket cooling.",
    });
  }

  return {
    result: {
      score,
      q_metabolic,
      a_jacket,
      dt_lm,
      q_cool_max,
      heat_ratio,
      heat_transfer_margin,
      heat_transfer_margin_std: target.heat_transfer_margin_std,
      margin_score,
      t_cw_outlet: target.t_cw_outlet,
      u_overall: target.u_overall,
      h_broth: target.h_broth,
      h_jacket: target.h_jacket,
      r_broth: target.r_broth,
      r_wall: target.r_wall,
      r_jacket: target.r_jacket,
      r_total: target.r_total,
      cooling_water_delta_t: target.cooling_water_delta_t,
      jacket_re: target.jacket_re,
      wall_material: target.wall_material,
      lab,
      target,
      confidence,
      driver,
    },
    flags,
  };
}

function calculateScaleHeat(
  inputs: ProcessInputs,
  derived: DerivedParameters,
  scale: ReactorScaleConfig,
  flowrate_lpm: number,
): HeatCapacityResult {
  return runHeatCapacityCheck({
    organism: inputs.organism_species,
    our_mmol_Lh: derived.our_peak,
    volume_litres: scale.volume_litres,
    t_process: inputs.temperature,
    t_cw_in: inputs.t_cw_inlet,
    flowrate_lpm,
    D_T: scale.geometry.t_diameter,
    H_L: scale.geometry.h_liquid,
    d_imp: scale.geometry.d_imp,
    N_rps: scale.rpm / 60,
    mu: derived.mu,
    impeller_type: inputs.impeller_type,
  });
}

function mapScaleHeat(heat: HeatCapacityResult): HeatScaleRiskResult {
  const heat_transfer_margin     = heat.Q_metabolic_kW > 0 ? heat.Q_available_kW / heat.Q_metabolic_kW : Infinity;
  const heat_transfer_margin_std = Number.isFinite(heat_transfer_margin)
    ? heat_transfer_margin * U_RELATIVE_UNCERTAINTY
    : 0;
  const margin_score = scoreHeatMargin(heat_transfer_margin);
  const score = margin_score;

  return {
    q_metabolic: heat.Q_metabolic_kW,
    a_jacket: heat.area.A_total,
    dt_lm: heat.lmtd,
    q_cool_max: heat.Q_available_kW,
    heat_ratio: heat.Q_available_kW > 0 ? heat.Q_metabolic_kW / heat.Q_available_kW : Infinity,
    heat_transfer_margin,
    heat_transfer_margin_std,
    margin_score,
    score,
    t_cw_outlet: heat.t_cw_out,
    u_overall: heat.u_result.U,
    h_broth: heat.broth_film.h_i,
    h_jacket: heat.jacket_film.h_o,
    r_broth: heat.u_result.R_broth,
    r_wall: heat.u_result.R_wall,
    r_jacket: heat.u_result.R_jacket,
    r_total: heat.u_result.R_total,
    cooling_water_delta_t: heat.dt_cw,
    jacket_re: heat.jacket_film.Re_jkt,
    wall_material: heat.wall.material,
  };
}
