// Compute achievable kLa using the correlation ensemble.

import type { ReactorOperatingPoint } from "../correlations/types";
import type { ImpellerType } from "@/lib/types";
import {
  IMPELLER_CONSTANTS, RHO,
  NON_NEWTONIAN_BIOMASS_THRESHOLD,
  NON_NEWTONIAN_MU_A,
  NON_NEWTONIAN_MU_B,
} from "@/lib/constants";
import { selectKlaEnsemble, getKlaCorrelationFn } from "../correlations/select";
import type { CorrelationKey } from "../correlations/select";

export interface KlaEnsembleResult {
  mean:         number;                     // mean kLa [h⁻¹]
  std:          number;                     // std dev [h⁻¹]
  min:          number;                     // lower ensemble member kLa [h⁻¹]
  max:          number;                     // higher ensemble member kLa [h⁻¹]
  components:   Record<string, number>;     // per-correlation kLa [h⁻¹]
  correlations: string[];
}

/**
 * μ_app (Pa·s) — quadratic in (X − threshold):
 *   μ_cP = A·Y² + B·Y + 1,  Y = max(0, X − 60)
 * Gives 1 cP at X=60, 10 cP at X=100, 50 cP at X=200 g/L CDW.
 */
export function computeApparentViscosity(biomass_cdw: number): number {
  const Y = Math.max(0, biomass_cdw - NON_NEWTONIAN_BIOMASS_THRESHOLD);
  const mu_cP = NON_NEWTONIAN_MU_A * Y * Y + NON_NEWTONIAN_MU_B * Y + 1.0;
  return mu_cP * 1e-3; // Pa·s
}

export function isNonNewtonian(biomass_cdw: number): boolean {
  return biomass_cdw > NON_NEWTONIAN_BIOMASS_THRESHOLD;
}

export function buildOperatingPoint(params: {
  D_T: number; H_L: number; V_L: number;
  d_i: number; impeller_type: ImpellerType; n_imp: number;
  N_rps: number; Q_gas: number; v_s: number;
  mu_L: number;
}): ReactorOperatingPoint {
  const Np = IMPELLER_CONSTANTS[params.impeller_type]?.np ?? 5.0;
  return {
    D_T: params.D_T,
    H_L: params.H_L,
    V_L: params.V_L,
    d_i: params.d_i,
    impeller_type: params.impeller_type,
    Np,
    n_imp: params.n_imp,
    N_rps: params.N_rps,
    Q_gas: params.Q_gas,
    v_s: params.v_s,
    rho_L: RHO,
    mu_L: params.mu_L,
    broth_type: "coalescing",
  };
}

/**
 * Compute kLa ensemble (mean, std, per-correlation components).
 *
 * For non-Newtonian broths, mu_L is overridden with the apparent viscosity
 * derived from biomass_cdw before Garcia-Ochoa & Gomez is evaluated.
 *
 * Pg is the total gassed power [W] for the operating scenario.
 */
export function computeKlaEnsemble(
  op: ReactorOperatingPoint,
  Pg: number,
  biomass_cdw: number,
): KlaEnsembleResult {
  const non_newt = isNonNewtonian(biomass_cdw);
  const keys: CorrelationKey[] = selectKlaEnsemble(op.n_imp, non_newt);

  // Build the effective operating point (override viscosity for non-Newtonian)
  let effectiveOp = op;
  if (non_newt) {
    const mu_app = computeApparentViscosity(biomass_cdw);
    effectiveOp = {
      ...op,
      mu_L:  mu_app,
    };
  }

  const components: Record<string, number> = {};
  for (const key of keys) {
    const kla_s = getKlaCorrelationFn(key)(effectiveOp, Pg);
    components[key] = kla_s * 3600;
  }

  const values = Object.values(components);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
  const std = Math.sqrt(variance);
  const min = Math.min(...values);
  const max = Math.max(...values);

  return { mean, std, min, max, components, correlations: keys };
}
