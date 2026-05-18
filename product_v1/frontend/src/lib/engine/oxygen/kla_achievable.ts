// Compute achievable kLa using the correlation ensemble.

import type { ReactorOperatingPoint } from "../correlations/types";
import type { ImpellerType } from "@/lib/types";
import { IMPELLER_CONSTANTS, RHO, HIGH_DENSITY_MU_PA_S } from "@/lib/constants";
import { selectKlaEnsemble, getKlaCorrelationFn } from "../correlations/select";
import type { CorrelationKey } from "../correlations/select";
import { stdFromExtrema } from "../uncertainty/propagation";

export interface KlaEnsembleResult {
  mean:         number;                     // mean kLa [h⁻¹]
  std:          number;                     // std dev [h⁻¹]
  min:          number;                     // lower ensemble member kLa [h⁻¹]
  max:          number;                     // higher ensemble member kLa [h⁻¹]
  components:   Record<string, number>;     // per-correlation kLa [h⁻¹]
  correlations: string[];
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
  };
}

/**
 * Compute kLa ensemble (mean, std, per-correlation components).
 *
 * For high-density broths, mu_L is overridden with HIGH_DENSITY_MU_PA_S (100 cP)
 * and the Garcia-Ochoa correlation is selected in place of Linek.
 */
export function computeKlaEnsemble(
  op: ReactorOperatingPoint,
  Pg: number,
  is_high_density: boolean,
): KlaEnsembleResult {
  const keys: CorrelationKey[] = selectKlaEnsemble(op.n_imp, is_high_density);

  const effectiveOp = is_high_density
    ? { ...op, mu_L: HIGH_DENSITY_MU_PA_S }
    : op;

  const components: Record<string, number> = {};
  for (const key of keys) {
    const kla_s = getKlaCorrelationFn(key)(effectiveOp, Pg);
    components[key] = kla_s * 3600;
  }

  const values = Object.values(components);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const min  = Math.min(...values);
  const max  = Math.max(...values);
  const std  = stdFromExtrema(min, max);

  return { mean, std, min, max, components, correlations: keys };
}
