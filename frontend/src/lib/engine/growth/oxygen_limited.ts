// Oxygen-limited specific growth rate — shared by batch and fed-batch.
//
// Full dissolved-O₂ balance at quasi-SS (dC_L/dt ≈ 0):
//   kLa·(C*−C_L) = OUR + C_L·(F/V)
//                         └── dilution term: feed displaces dissolved O₂
//   OUR = μ·X / (Y_O2 · 1/(31.25))   →   μ = [kLa·(C*−C_L) − C_L·F/V]·Y_O2 / (31.25·X)
//
// For batch: dilution_rate_h = 0 (no feed), term vanishes.
// For fed-batch: dilution_rate_h = F/V (≈ 0.013 h⁻¹ typically), ~5 orders of
//   magnitude below OUR in high-density culture, but kept for completeness.
//
// 31.25 = 1000/32 (mmol O₂ per g O₂)

const MMOL_PER_G_O2 = 31.25;

export interface OxygenLimitedMuParams {
  kla_h:             number;  // h⁻¹    — volumetric mass transfer coefficient
  c_star:            number;  // mmol/L — equilibrium dissolved oxygen
  c_l:               number;  // mmol/L — actual dissolved oxygen at DO setpoint
  yield_o2:          number;  // g CDW/g O₂ — Y_O2
  biomass_cdw:       number;  // g/L    — biomass concentration
  dilution_rate_h?:  number;  // h⁻¹    — F/V; omit or 0 for batch
}

export interface OxygenLimitedMuResult {
  mu_o2:        number; // h⁻¹       — oxygen-limited specific growth rate
  otr:          number; // mmol/L/h  — gross oxygen transfer rate (kLa·ΔC)
  our_max:      number; // mmol/L/h  — OUR at this μ (= OTR − dilution_o2 at SS)
  dilution_o2:  number; // mmol/L/h  — oxygen demand from feed dilution
}

export function deriveOxygenLimitedMu(
  params: OxygenLimitedMuParams,
): OxygenLimitedMuResult {
  const { kla_h, c_star, c_l, yield_o2, biomass_cdw } = params;
  const dilution_rate_h = params.dilution_rate_h ?? 0;

  const driving_force = Math.max(0, c_star - c_l);
  const otr           = kla_h * driving_force;          // mmol/L/h
  const dilution_o2   = dilution_rate_h * c_l;          // mmol/L/h (typically ~0)
  const net_otr       = Math.max(0, otr - dilution_o2); // available for cell growth

  if (biomass_cdw <= 0) {
    return { mu_o2: 0, otr, our_max: net_otr, dilution_o2 };
  }

  const mu_o2  = (net_otr * yield_o2) / (biomass_cdw * MMOL_PER_G_O2);
  const our_max = net_otr;

  return { mu_o2, otr, our_max, dilution_o2 };
}

// --- OUR from growth ---

/**
 * OUR [mmol O₂/L/h] = μ · X · 31.25 / Y_O2
 *
 * Use mu_effective (the binding constraint) and the biomass at the
 * operating point of interest (X* for batch, biomass_cdw for fed-batch).
 */
export function calculateOur(
  mu:          number, // h⁻¹       — limiting specific growth rate
  biomass_cdw: number, // g CDW/L   — biomass at operating point
  yield_o2:    number, // g CDW/g O₂ — Y_O2
): number {
  return (mu * biomass_cdw * MMOL_PER_G_O2) / yield_o2;
}
