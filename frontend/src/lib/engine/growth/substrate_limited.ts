// Substrate-limited specific growth rate for fed-batch quasi-steady state.
//
// At quasi-SS the substrate concentration stays approximately constant
// (feed exactly meets demand), so a carbon balance on the fed-batch gives:
//
//   μ_S = (Y_X/S × F × S_F) / (X × V)
//
// where:
//   F   — volumetric feed rate (L/h)
//   S_F — feed substrate concentration (g/L)
//   X   — biomass concentration (g CDW/L)
//   V   — current culture volume (L)
//   Y_X/S — biomass yield on substrate (g CDW/g substrate)
//
// Returns 0 when X × V = 0 to avoid division by zero.

export interface SubstrateLimitedMuParams {
  flow_rate_lph:         number; // L/h — feed flow rate
  feed_substrate_g_L:    number; // g/L — substrate concentration in feed
  yield_x_s:             number; // g CDW/g substrate — Y_X/S
  biomass_cdw:           number; // g/L — current biomass concentration
  volume_litres:         number; // L   — current culture volume
}

export interface SubstrateLimitedMuResult {
  mu_s:         number; // h⁻¹ — substrate-limited specific growth rate
  supply_rate:  number; // g CDW/h — rate of biomass production from feed
  demand_check: number; // dimensionless — mu_s / mu_max (caller supplies mu_max if needed)
}

export function deriveSubstrateLimitedMu(
  params: SubstrateLimitedMuParams,
): SubstrateLimitedMuResult {
  const { flow_rate_lph, feed_substrate_g_L, yield_x_s, biomass_cdw, volume_litres } = params;

  const biomass_total = biomass_cdw * volume_litres; // g CDW in vessel
  if (biomass_total <= 0) {
    return { mu_s: 0, supply_rate: 0, demand_check: 0 };
  }

  const supply_rate = yield_x_s * flow_rate_lph * feed_substrate_g_L; // g CDW/h
  const mu_s        = supply_rate / biomass_total;                     // h⁻¹

  return {
    mu_s,
    supply_rate,
    demand_check: mu_s, // caller can divide by mu_max
  };
}
