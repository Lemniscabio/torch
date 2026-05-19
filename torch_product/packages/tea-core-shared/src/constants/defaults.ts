// Default input values and calculation scenario multipliers.
// Source: /docs/lemnisca_scaleup_app_dev_spec.md Section 1.1

import type { ImpellerType } from "../types";

// --- Form input defaults (Section 1.1) ---

export const INPUT_DEFAULTS = {
  h_d_lab:              1.2,
  impeller_type:        "rushton" as ImpellerType,
  vvm:                  1.0,
  biomass_unit:         "g_L_CDW" as const,
  our_mode:             "estimate" as const,
  o2_inlet:             20.9,
  do_setpoint:          30,
  temperature_bacteria: 37,
  temperature_yeast:    30,
  t_cw_inlet:           12,
  cooling_water_flowrate_lpm: 30,
  do_at_bottom_pct:           20,
} as const;
