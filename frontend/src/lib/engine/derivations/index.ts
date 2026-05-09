// Derivations orchestrator — D1-D7.
// Re-exports all sub-module types and functions, plus runAllDerivations().

export { deriveVesselGeometry }            from "./geometry";
export { deriveBiomassCdw }                from "./biomass";
export type { OurResult }                  from "./our";
export { deriveOur }                       from "./our";
export type { PowerResult }                from "./power";
export { derivePowerInput, derivePowerFlags } from "./power";
export type { GasVelocityResult }          from "./gas";
export { deriveGasVelocity }               from "./gas";
export type { FlowRegime, ReynoldsResult } from "./fluid";
export { deriveViscosity, deriveReynolds, deriveReynoldsFlags } from "./fluid";
export type { OxygenSolubilityResult }     from "./oxygen_solubility";
export { deriveOxygenSolubility }          from "./oxygen_solubility";

// DrivingForceResult kept for any external consumers; points to oxygen_solubility now
export type { OxygenSolubilityResult as DrivingForceResult } from "./oxygen_solubility";

import { deriveVesselGeometry }            from "./geometry";
import { deriveBiomassCdw }                from "./biomass";
import { deriveOur }                       from "./our";
import { derivePowerInput, derivePowerFlags } from "./power";
import { deriveGasVelocity }               from "./gas";
import { deriveViscosity, deriveReynolds, deriveReynoldsFlags } from "./fluid";
import { deriveOxygenSolubility }          from "./oxygen_solubility";

import type { ProcessInputs, DerivedParameters, AssessmentFlag } from "@/lib/types";

export interface DerivationOutput {
  derived: DerivedParameters;
  flags:   AssessmentFlag[];
}

export function runAllDerivations(inputs: ProcessInputs): DerivationOutput {
  const flags: AssessmentFlag[] = [];

  // D7 — Biomass conversion (must precede D1)
  const biomass_cdw = deriveBiomassCdw(
    inputs.biomass,
    inputs.biomass_unit,
    inputs.organism_species,
  );

  // D1 — OUR
  const our = deriveOur(
    inputs.our_mode as "measured" | "estimate",
    inputs.our_measured,
    biomass_cdw,
    inputs.organism_species,
    inputs.biomass_density_category,
  );

  // D2 — Vessel geometry
  const lab_geometry    = deriveVesselGeometry(inputs.v_lab,    inputs.h_d_lab,    inputs.impeller_type, inputs.dt_ratio_lab);
  const target_geometry = deriveVesselGeometry(inputs.v_target, inputs.h_d_target, inputs.impeller_type, inputs.dt_ratio_target);

  // D3 — Power input
  const power = derivePowerInput(inputs.impeller_type, inputs.n_impellers, inputs.rpm, lab_geometry, inputs.vvm);
  flags.push(...derivePowerFlags(inputs.vvm, power.pv_lab));

  // Viscosity
  const mu = deriveViscosity(inputs.temperature);

  // D4 — Reynolds number
  const reynolds = deriveReynolds(power.n_rps, lab_geometry.d_imp, mu);
  flags.push(...deriveReynoldsFlags(reynolds.regime));

  // D5 — Superficial gas velocity (lab and target)
  const gasLab    = deriveGasVelocity(inputs.vvm, inputs.v_lab,    lab_geometry.a_cross);
  const gasTarget = deriveGasVelocity(inputs.vvm, inputs.v_target, target_geometry.a_cross);

  // D6 — O₂ solubility: Tier-2 (hydrostatic pressure + inlet O₂ fraction)
  //      Computed separately for each scale — H_L differs between lab and target.
  const o2_inlet_pct = inputs.o2_inlet ?? 20.9;

  const solLab    = deriveOxygenSolubility(
    inputs.temperature, inputs.do_setpoint,
    lab_geometry.h_liquid, o2_inlet_pct,
  );
  const solTarget = deriveOxygenSolubility(
    inputs.temperature, inputs.do_setpoint,
    target_geometry.h_liquid, o2_inlet_pct,
  );

  const derived: DerivedParameters = {
    our_peak: our.our_peak,
    our_min:  our.our_min,
    our_max:  our.our_max,

    lab_geometry,
    target_geometry,

    n_rps:      power.n_rps,
    p_ungassed: power.p_ungassed,
    p_gassed:   power.p_gassed,
    p_total:    power.p_total,
    pv_lab:     power.pv_lab,

    re: reynolds.re,

    q_gas_lab:    gasLab.q_gas,
    vs_lab:       gasLab.vs,
    q_gas_target: gasTarget.q_gas,
    vs_target:    gasTarget.vs,

    // Lab-scale O₂ solubility
    c_star_lab:  solLab.c_star_avg,
    c_l_lab:     solLab.c_l,
    df_lm_lab:   solLab.driving_force_lm,

    // Target-scale O₂ solubility (primary for OTR risk)
    c_star:        solTarget.c_star_avg,
    c_star_bot:    solTarget.c_star_bot,
    c_star_top:    solTarget.c_star_top,
    c_l:           solTarget.c_l,
    driving_force: solTarget.driving_force_lm,
    p_bot_pa:      solTarget.p_bot_pa,
    p_top_pa:      solTarget.p_top_pa,

    biomass_cdw,
    mu,
  };

  return { derived, flags };
}
