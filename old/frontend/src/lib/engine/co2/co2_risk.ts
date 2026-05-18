// R4 — CO₂ Accumulation Risk.

import type {
  ProcessInputs,
  DerivedParameters,
  Co2RiskResult,
  Co2ScaleRiskResult,
  RiskScore,
  Confidence,
  AssessmentFlag,
} from "@/lib/types";
import {
  RQ_DEFAULTS,
  KLA_CO2_O2_RATIO,
  H_CO2,
  RHO,
  G,
  ATMOSPHERIC_PRESSURE_PA,
  CO2_BIOMASS_THRESHOLD,
  CO2_OUR_THRESHOLD,
  CO2_THRESHOLDS,
  PCO2_CRITICAL,
} from "@/lib/constants";
import type { ReactorScaleConfig, ReactorScaleConfigs } from "../reactor_configs";

// Y_in for ambient air (mole fraction CO₂ ≈ 400 ppm).
const Y_CO2_IN  = 4e-4;
// Molar volume at STP (0°C, 1 atm), L/mol.
const MOLAR_VOL = 22.4;

// margin = pco2_critical / pco2_bottom; higher is safer.
function scorePco2Margin(margin: number): RiskScore {
  if (margin > CO2_THRESHOLDS.low)      return "low";
  if (margin > CO2_THRESHOLDS.moderate) return "moderate";
  if (margin > CO2_THRESHOLDS.high)     return "high";
  return "critical";
}

function resolveRq(inputs: ProcessInputs): number {
  if (inputs.organism_species === "p_pastoris")   return RQ_DEFAULTS.p_pastoris_methanol;
  if (inputs.organism_species === "s_cerevisiae") return RQ_DEFAULTS.s_cerevisiae_aerobic;
  return RQ_DEFAULTS.bacteria_aerobic;
}

function co2Confidence(our_mode: ProcessInputs["our_mode"]): { confidence: Confidence; driver: string } {
  const prefix = "Widest confidence interval of the five domains.";
  if (our_mode === "measured") {
    return { confidence: "reliable",    driver: `${prefix} OUR user-provided; CO₂ model is a simplified mass-balance estimate.` };
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

  const activated =
    derived.biomass_cdw > CO2_BIOMASS_THRESHOLD ||
    derived.our_peak    > CO2_OUR_THRESHOLD;

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
          y_co2_out: Y_CO2_IN,
          pco2_gas_avg: 0,
          pco2_bulk: 0,
          pco2_bottom: 0,
          dp_hydro: 0,
          pco2_margin: Infinity,
          margin_score: "low",
          score: "low",
        },
        target: {
          cer: 0,
          kla_co2: 0,
          y_co2_out: Y_CO2_IN,
          pco2_gas_avg: 0,
          pco2_bulk: 0,
          pco2_bottom: 0,
          dp_hydro: 0,
          pco2_margin: Infinity,
          margin_score: "low",
          score: "low",
        },
        confidence,
        driver,
      },
      flags,
    };
  }

  const rq = resolveRq(inputs);
  const lab = calculateScaleCo2(reactorConfigs.lab, derived.our_peak, rq, pco2_critical);
  const target = calculateScaleCo2(reactorConfigs.target, derived.our_peak, rq, pco2_critical);
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
): Co2ScaleRiskResult {
  const cer = rq * our_peak; // mmol CO2 / L / h
  const kla_co2 = KLA_CO2_O2_RATIO * scale.kla_h;
  const v_liquid_l = scale.geometry.volume_m3 * 1000;
  const q_gas_nl_h = scale.gas.q_gas * 1e3 * 3600; // NL/h
  const n_dot_gas_mol = q_gas_nl_h / MOLAR_VOL;
  const cer_mol_h = (cer / 1000) * v_liquid_l;
  const y_co2_out = Math.min(Y_CO2_IN + cer_mol_h / n_dot_gas_mol, 0.20);

  const p_total_bar = (ATMOSPHERIC_PRESSURE_PA + RHO * G * scale.geometry.h_liquid / 2) / 1e5;
  const pco2_gas_in = Y_CO2_IN * 1.01325;
  const pco2_gas_out = y_co2_out * p_total_bar;
  const pco2_gas_avg = logMean(pco2_gas_out, pco2_gas_in);

  const pco2_gas_avg_atm = pco2_gas_avg / 1.01325;
  const pco2_bulk_atm = pco2_gas_avg_atm + (cer / 1000) / (kla_co2 * H_CO2);
  const pco2_bulk = pco2_bulk_atm * 1.01325;
  const dp_hydro = RHO * G * scale.geometry.h_liquid;
  const pco2_bottom = pco2_bulk * (ATMOSPHERIC_PRESSURE_PA + dp_hydro) / ATMOSPHERIC_PRESSURE_PA;
  const pco2_margin = pco2_critical / pco2_bottom;
  const margin_score = scorePco2Margin(pco2_margin);
  const score = margin_score;

  return {
    cer,
    kla_co2,
    y_co2_out,
    pco2_gas_avg,
    pco2_bulk,
    pco2_bottom,
    dp_hydro,
    pco2_margin,
    margin_score,
    score,
  };
}
