// EXPERIMENTAL: gradient-risk Damköhler assessment — not part of the active assessment flow.
// Kinetic Damköhler numbers for mixing-limited substrate gradient risk.
//
// Da_max = θ_mix · μ_max · X / (K_s · Y_X/S)
//   Uses saturated uptake rate — the rate cells consume inside the feed zone
//   where S >> K_s regardless of bulk conditions. Conservative. Correct for
//   gradient-formation and overflow-metabolism risk assessment.
//   Source: Larsson & Enfors (1996); Bylund et al. (1998).
//
// Da_eff = θ_mix · μ_eff · X / (K_s · Y_X/S)
//   Uses the bulk-average effective μ inferred from OUR (measured or estimated).
//   Informational only — answers "is average consumption keeping up with mixing?"
//   Underestimates gradient risk when overflow metabolism is active.

const MMOL_PER_G_O2 = 31.25; // 1000/32

export interface DamkohlerInputs {
  theta_mix_s:  number; // s     — mixing time at relevant scale
  mu_max:       number; // h⁻¹   — from KINETIC_PARAMS
  K_s:          number; // g/L   — from KINETIC_PARAMS
  yield_x_s:    number; // g/g   — Y_X/S from KINETIC_PARAMS
  yield_o2:     number; // g/g   — Y_O2 from KINETIC_PARAMS
  biomass_cdw:  number; // g/L   — peak biomass (X*)
  our_peak:     number; // mmol/L/h — used to derive μ_eff
}

export interface DamkohlerResult {
  tau_uptake_max_s: number; // s — characteristic consumption time (saturated rate)
  tau_uptake_eff_s: number; // s — characteristic consumption time (effective rate)
  mu_eff:           number; // h⁻¹ — bulk-average μ inferred from OUR
  da_max:           number; // dimensionless — conservative, primary risk indicator
  da_eff:           number; // dimensionless — informational
}

export function deriveDamkohler(inputs: DamkohlerInputs): DamkohlerResult {
  const { theta_mix_s, mu_max, K_s, yield_x_s, yield_o2, biomass_cdw, our_peak } = inputs;

  // τ_uptake = K_s · Y_X/S / (μ · X)   [h] → convert to seconds
  const tau_uptake_max_s = biomass_cdw > 0
    ? (K_s * yield_x_s / (mu_max * biomass_cdw)) * 3600
    : Infinity;

  // μ_eff inferred from OUR: μ = OUR · Y_O2 / (X · 31.25)
  const mu_eff = biomass_cdw > 0
    ? (our_peak * yield_o2) / (biomass_cdw * MMOL_PER_G_O2)
    : 0;

  const tau_uptake_eff_s = mu_eff > 0
    ? (K_s * yield_x_s / (mu_eff * biomass_cdw)) * 3600
    : Infinity;

  const da_max = tau_uptake_max_s > 0 ? theta_mix_s / tau_uptake_max_s : 0;
  const da_eff = tau_uptake_eff_s > 0 ? theta_mix_s / tau_uptake_eff_s : 0;

  return { tau_uptake_max_s, tau_uptake_eff_s, mu_eff, da_max, da_eff };
}
