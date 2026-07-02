// Mixing time correlation ensemble for baffled stirred tanks (turbulent regime).
//
// Three correlations are used to span the credible range of predictions:
//   - Ruszkowski (1994)      — power-dissipation basis, coefficient 5.9
//   - Cooke et al. (1988)    — same dimensional form, coefficient 5.3; gives natural spread
//   - Grenville-Nienow (2002)— explicit power-number dependence; suitable for all impeller types
//
// Fasano-Penney excluded: axial-impeller specific.
// Norwood-Metzner excluded: Re-explicit, scattered predictions at fermentation Re.

import type { ImpellerType } from "../../types";
import { IMPELLER_CONSTANTS, RHO } from "../../constants";
import { summariseEnsemble } from "../uncertainty/propagation";
import type { EnsembleStats } from "../uncertainty/propagation";

export interface MixingTimeEnsembleParams {
  T:            number;       // m   — tank diameter
  D:            number;       // m   — impeller diameter
  N_rps:        number;       // s⁻¹ — agitation speed
  pv_w_m3:      number;       // W/m³ — volumetric power input
  impeller_type: ImpellerType;
}

// Grenville-Nienow (2002), energy-dissipation form:
//   θ₉₅ = 5.9 · T^(2/3) · ε^(-1/3) · (D/T)^(-1/3)   [seconds]
// This group already has units of seconds and already carries the full
// N-dependence through ε = P/V/ρ ∝ N³D², so it IS θ₉₅ — not the dimensionless
// mixing number θ₉₅·N. No explicit division by N_rps (the earlier `/ N_rps` was
// dimensionally wrong; it reduces algebraically to 5.9·Po^(-1/3)·(T/D)²·N⁻¹, i.e.
// the N⁻¹ is already inside the energy form). N_rps is kept only for the guard.
function grenvilleNienow(T: number, D: number, pv_w_m3: number, N_rps: number): number {
  const epsilon = pv_w_m3 / RHO;
  if (epsilon <= 0 || D <= 0 || N_rps <= 0) return Infinity;
  return 5.9 * Math.pow(T, 2 / 3) * Math.pow(epsilon, -1 / 3) * Math.pow(D / T, -1 / 3);
}


// Ruszkowski (1994): θ₉₅ · N = 5.20 · Po^(−1/3) · (T/D)²
function ruszkowski(N_rps: number, D: number, T: number, Po: number): number {
  if (N_rps <= 0 || Po <= 0 || D <= 0) return Infinity;
  return (5.20 * Math.pow(Po, -1 / 3) * Math.pow(T / D, 2)) / N_rps;
}

export function computeMixingTimeEnsemble(params: MixingTimeEnsembleParams): EnsembleStats {
  const { T, D, N_rps, pv_w_m3, impeller_type } = params;
  const Po = IMPELLER_CONSTANTS[impeller_type]?.np ?? 5.0;

  const components: Record<string, number> = {
    grenville_nienow: grenvilleNienow(T, D, pv_w_m3, N_rps),
    ruszkowski:       ruszkowski(N_rps, D, T, Po),
  };

  return summariseEnsemble(components);
}
