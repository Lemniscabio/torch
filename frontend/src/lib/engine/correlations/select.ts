// kLa correlation ensemble selector.
//
// Selection rules:
//   Non-Newtonian (biomass_cdw > threshold):
//     → ["garcia_ochoa_2004", "zhu_2001"]  (any n_imp)
//   Newtonian, n_imp >= 2:
//     → ["vant_riet_coalescing", "vant_riet_non_coalescing",
//         "linek_1987", "linek_2004", "garcia_ochoa_2004", "moucha_2003"]
//   Newtonian, n_imp == 1:
//     → ["vant_riet_coalescing", "vant_riet_non_coalescing",
//         "linek_1987", "linek_2004", "garcia_ochoa_2004"]

import { KLA_CORRELATION_REGISTRY } from "./kla";
import type { KlaCorrelationFn } from "./types";

export type CorrelationKey = keyof typeof KLA_CORRELATION_REGISTRY;

export function selectKlaEnsemble(
  n_imp: number,
  is_non_newtonian: boolean,
): CorrelationKey[] {
  if (is_non_newtonian) {
    return ["garcia_ochoa_2004", "zhu_2001"];
  }
  const base: CorrelationKey[] = [
    "vant_riet_coalescing",
    "vant_riet_non_coalescing",
    "linek_1987",
    "linek_2004",
    "garcia_ochoa_2004",
  ];
  return n_imp >= 2 ? [...base, "moucha_2003"] : base;
}

export function getKlaCorrelationFn(key: CorrelationKey): KlaCorrelationFn {
  const fn = KLA_CORRELATION_REGISTRY[key];
  if (!fn) throw new Error(`Unknown kLa correlation: "${key}"`);
  return fn;
}
