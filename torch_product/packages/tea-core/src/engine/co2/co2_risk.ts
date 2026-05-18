// R4 — CO₂ Accumulation Risk.

import type {
  ProcessInputs,
  DerivedParameters,
  Co2RiskResult,
  Co2ScaleRiskResult,
  RiskScore,
  Confidence,
  AssessmentFlag,
} from "../../types";
import {
  RQ_DEFAULTS,
  KLA_CO2_O2_RATIO,
  H_CO2,
  RHO,
  G,
  ATMOSPHERIC_PRESSURE_PA,
  ATMOSPHERIC_PRESSURE_BAR,
  Y_CO2_INLET,
  MAX_CO2_MOLE_FRACTION,
  molarVolumeIdealGas,
  CO2_OUR_THRESHOLD,
  CO2_THRESHOLDS,
  PCO2_CRITICAL,
} from "../../constants";
import type { ReactorScaleConfig, ReactorScaleConfigs } from "../reactor_configs";
import { stdAffineInverse } from "../uncertainty/propagation";

// margin = pco2_critical / pco2_bottom; higher is safer.
function scorePco2Margin(margin: number): RiskScore {
  if (margin > CO2_THRESHOLDS.low)      return "low";
  if (margin > CO2_THRESHOLDS.moderate) return "moderate";
  if (margin > CO2_THRESHOLDS.high)     return "high";
  return "critical";
}

export function resolveRq(species: ProcessInputs["organism_species"]): number {
  if (species === "p_pastoris")   return RQ_DEFAULTS.p_pastoris_methanol;
  if (species === "s_cerevisiae") return RQ_DEFAULTS.s_cerevisiae_aerobic;
  return RQ_DEFAULTS.bacteria_aerobic;
}

function co2Confidence(our_mode: ProcessInputs["our_mode"]): { confidence: Confidence; driver: string } {
  const prefix = "Widest confidence interval of the five domains.";
  if (our_mode === "measured") {
    return { confidence: "reliable",    driver: `${prefix} OUR user-provided; CO₂ model is a simplified mass-balance estimate.` };
  }
  if (our_mode === "estimate_mu") {
    return { confidence: "directional", driver: `${prefix} OUR estimated from µ and literature Y_X/O₂; provide measured OUR to improve confidence.` };
  }
  return { confidence: "directional", driver: `${prefix} OUR estimated from literature; provide measured OUR to improve confidence.` };
}

function logMean(a: number, b: number): number {
  if (Math.abs(a - b) < 1e-12) return a;
  return (a - b) / Math.log(a / b);
}

export function calculateCo2Risk(
  inputs: ProcessInputs,
  derived: DerivedParameters,
  reactorConfigs: ReactorScaleConfigs,
): { result: Co2RiskResult; flags: AssessmentFlag[] } {
  const flags: AssessmentFlag[] = [];
  const { confidence, driver } = co2Confidence(inputs.our_mode);

  const activated = derived.our_peak > CO2_OUR_THRESHOLD;

  const pco2_critical = PCO2_CRITICAL[inputs.organism_species];

  if (!activated) {
    return {
      result: {
        score: "low",
        margin_score: "low",
        activated: false,
        pco2_critical,
        lab: {
          cer: 0,
          kla_co2: 0,
          y_co2_out: Y_CO2_INLET,
          pco2_gas_avg: 0,
          pco2_bulk: 0,
          pco2_bottom: 0,
          pco2_bottom_std: 0,
          dp_hydro: 0,
          pco2_margin: Infinity,
          pco2_margin_std: 0,
          margin_score: "low",
          score: "low",
        },
        target: {
          cer: 0,
          kla_co2: 0,
          y_co2_out: Y_CO2_INLET,
          pco2_gas_avg: 0,
          pco2_bulk: 0,
          pco2_bottom: 0,
          pco2_bottom_std: 0,
          dp_hydro: 0,
          pco2_margin: Infinity,
          pco2_margin_std: 0,
          margin_score: "low",
          score: "low",
        },
        confidence,
        driver,
      },
      flags,
    };
  }

  const rq = resolveRq(inputs.organism_species);
  const lab = calculateScaleCo2(reactorConfigs.lab, derived.our_peak, rq, pco2_critical, inputs.temperature);
  const target = calculateScaleCo2(reactorConfigs.target, derived.our_peak, rq, pco2_critical, inputs.temperature);
  const margin_score = scorePco2Margin(target.pco2_margin);
  const score = margin_score;

  return {
    result: {
      score,
      margin_score,
      activated: true,
      cer: target.cer,
      kla_co2: target.kla_co2,
      y_co2_out: target.y_co2_out,
      pco2_gas_avg: target.pco2_gas_avg,
      pco2_bulk: target.pco2_bulk,
      pco2_bottom: target.pco2_bottom,
      dp_hydro: target.dp_hydro,
      pco2_critical,
      pco2_margin: target.pco2_margin,
      pco2_margin_std: target.pco2_margin_std,
      lab,
      target,
      confidence, driver,
    },
    flags,
  };
}

function calculateScaleCo2(
  scale: ReactorScaleConfig,
  our_peak: number,
  rq: number,
  pco2_critical: number,
  temperature: number,
): Co2ScaleRiskResult {
  const cer = rq * our_peak; // mmol CO2 / L / h
  const kla_co2 = KLA_CO2_O2_RATIO * scale.kla_h;
  const v_liquid_l = scale.geometry.volume_m3 * 1000;
  const q_gas_nl_h = scale.gas.q_gas * 1e3 * 3600; // NL/h
  const n_dot_gas_mol = q_gas_nl_h / molarVolumeIdealGas(temperature);
  const cer_mol_h = (cer / 1000) * v_liquid_l;
  const y_co2_out = Math.min(Y_CO2_INLET + cer_mol_h / n_dot_gas_mol, MAX_CO2_MOLE_FRACTION);

  const pco2_gas_in  = Y_CO2_INLET * ATMOSPHERIC_PRESSURE_BAR;
  const pco2_gas_out = y_co2_out   * ATMOSPHERIC_PRESSURE_BAR; // outlet exits at top of vessel, atmospheric
  const pco2_gas_avg = logMean(pco2_gas_out, pco2_gas_in);

  const pco2_gas_avg_atm = pco2_gas_avg / ATMOSPHERIC_PRESSURE_BAR;
  const pco2_bulk_atm = pco2_gas_avg_atm + (cer / 1000) / (kla_co2 * H_CO2);
  const pco2_bulk = pco2_bulk_atm * ATMOSPHERIC_PRESSURE_BAR;
  const dp_hydro = RHO * G * scale.geometry.h_liquid;
  const hydro_factor = (ATMOSPHERIC_PRESSURE_PA + dp_hydro) / ATMOSPHERIC_PRESSURE_PA;
  const pco2_bottom = pco2_bulk * hydro_factor;
  const pco2_margin = pco2_critical / pco2_bottom;
  const margin_score = scorePco2Margin(pco2_margin);
  const score = margin_score;

  // Uncertainty propagation: pco2_bulk = C + B/kla_co2 where B = ATM_BAR*(cer/1000)/H_CO2
  const sigma_kla_co2 = KLA_CO2_O2_RATIO * scale.kla_ensemble.std;
  const B_bulk = ATMOSPHERIC_PRESSURE_BAR * (cer / 1000) / H_CO2;
  const pco2_bulk_std = stdAffineInverse(B_bulk, kla_co2, sigma_kla_co2);
  const pco2_bottom_std = pco2_bulk_std * hydro_factor;
  const pco2_margin_std = pco2_bottom > 0
    ? pco2_margin * (pco2_bottom_std / pco2_bottom)
    : 0;

  return {
    cer,
    kla_co2,
    y_co2_out,
    pco2_gas_avg,
    pco2_bulk,
    pco2_bottom,
    pco2_bottom_std,
    dp_hydro,
    pco2_margin,
    pco2_margin_std,
    margin_score,
    score,
  };
}
