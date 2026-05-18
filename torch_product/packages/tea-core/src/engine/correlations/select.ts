// kLa correlation ensemble selector.
//
// Selection rules:
//   High-density (is_non_newtonian): ["garcia_ochoa_2004", "vant_riet_non_coalescing"]
//   Normal density:                  ["linek_2004", "vant_riet_non_coalescing"]
//
// Multi-impeller kLa correlations are intentionally excluded. Callers pass
// total gassed power Pg, so single-impeller kLa correlations use n_imp * Pg/V.

import { KLA_CORRELATION_REGISTRY } from "./kla";
import type { KlaCorrelationFn } from "./types";

export type CorrelationKey = keyof typeof KLA_CORRELATION_REGISTRY;

export function selectKlaEnsemble(
  _n_imp: number,
  is_non_newtonian: boolean,
): CorrelationKey[] {
  if (is_non_newtonian) {
    return ["garcia_ochoa_2004", "vant_riet_non_coalescing"];
  }
  return ["linek_2004", "vant_riet_non_coalescing"];
}

export function getKlaCorrelationFn(key: CorrelationKey): KlaCorrelationFn {
  const fn = KLA_CORRELATION_REGISTRY[key];
  if (!fn) throw new Error(`Unknown kLa correlation: "${key}"`);
  return fn;
}
