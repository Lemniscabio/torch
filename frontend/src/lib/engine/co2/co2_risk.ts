// R4 — CO₂ Accumulation Risk.

import type { ProcessInputs, DerivedParameters, Co2RiskResult, RiskScore, Confidence, AssessmentFlag } from "@/lib/types";
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
  PV_SCENARIO_MULTIPLIERS,
} from "@/lib/constants";
import { buildOperatingPoint, computeKlaEnsemble } from "../oxygen/kla_achievable";

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
): { result: Co2RiskResult; flags: AssessmentFlag[] } {
  const flags: AssessmentFlag[] = [];
  const { confidence, driver } = co2Confidence(inputs.our_mode);

  const activated =
    derived.biomass_cdw > CO2_BIOMASS_THRESHOLD ||
    derived.our_peak    > CO2_OUR_THRESHOLD;

  const pco2_critical = PCO2_CRITICAL[inputs.organism_species];

  if (!activated) {
    return { result: { score: "low", activated: false, pco2_critical, confidence, driver }, flags };
  }

  const rq  = resolveRq(inputs);
  const cer = rq * derived.our_peak; // mmol CO₂ / L / h

  // kLa_O2 at target, moderate P/V
  const V_target    = derived.target_geometry.volume_m3;
  const Pg_moderate = PV_SCENARIO_MULTIPLIERS.moderate * derived.pv_lab * V_target;

  const opTarget = buildOperatingPoint({
    D_T: derived.target_geometry.t_diameter,
    H_L: derived.target_geometry.h_liquid,
    V_L: V_target,
    d_i: derived.target_geometry.d_imp,
    impeller_type: inputs.impeller_type,
    n_imp: inputs.n_impellers,
    N_rps: derived.n_rps,
    Q_gas: derived.q_gas_target,
    v_s:   derived.vs_target,
    mu_L:  derived.mu,
  });

  const { mean: kla_o2_target } = computeKlaEnsemble(opTarget, Pg_moderate, derived.biomass_cdw);
  const kla_co2 = KLA_CO2_O2_RATIO * kla_o2_target;

  // --- Gas-phase CO₂ mass balance ---
  // q_gas_target is m³/s; convert to NL/h for molar flow (STP: 1 mol = 22.4 L).
  const v_liquid_l    = derived.target_geometry.volume_m3 * 1000;
  const q_gas_nl_h    = derived.q_gas_target * 1e3 * 3600;          // NL/h
  const n_dot_gas_mol = q_gas_nl_h / MOLAR_VOL;                     // mol/h
  const cer_mol_h     = (cer / 1000) * v_liquid_l;                  // mol CO₂/h from broth
  const y_co2_out     = Math.min(Y_CO2_IN + cer_mol_h / n_dot_gas_mol, 0.20); // cap at 20%

  // Log-mean gas-phase pCO₂ across vessel height (bar).
  const p_total_bar   = (ATMOSPHERIC_PRESSURE_PA + RHO * G * derived.target_geometry.h_liquid / 2) / 1e5;
  const pco2_gas_in   = Y_CO2_IN  * 1.01325;  // bar (inlet ≈ air)
  const pco2_gas_out  = y_co2_out * p_total_bar;
  const pco2_gas_avg  = logMean(pco2_gas_out, pco2_gas_in);

  // Dissolved CO₂ = gas-phase equilibrium + transfer driving force contribution.
  // Steady-state: kLa·(C_L − C*) = CER  →  C_L − C* = CER/kLa
  // C* ≈ pco2_gas_avg / H_CO2 (Henry's law; H_CO2 in mmol/L/atm, pco2_gas_avg in bar ≈ atm)
  const pco2_gas_avg_atm = pco2_gas_avg / 1.01325;
  const pco2_bulk_atm    = pco2_gas_avg_atm + (cer / 1000) / (kla_co2 * H_CO2);
  const pco2_bulk        = pco2_bulk_atm * 1.01325;

  // Hydrostatic correction: pCO₂ at sparger reflects higher local pressure.
  const dp_hydro    = RHO * G * derived.target_geometry.h_liquid;
  const pco2_bottom = pco2_bulk * (ATMOSPHERIC_PRESSURE_PA + dp_hydro) / ATMOSPHERIC_PRESSURE_PA;

  const pco2_margin = pco2_critical / pco2_bottom;
  const score       = scorePco2Margin(pco2_margin);

  return {
    result: {
      score, activated: true,
      cer, kla_co2,
      y_co2_out, pco2_gas_avg,
      pco2_bulk, pco2_bottom, dp_hydro,
      pco2_critical, pco2_margin,
      confidence, driver,
    },
    flags,
  };
}
