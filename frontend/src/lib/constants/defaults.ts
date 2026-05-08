// Default input values and calculation scenario multipliers.
// Source: /docs/lemnisca_scaleup_app_dev_spec.md Section 1.1

import type { ImpellerType } from "@/lib/types";

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
  // New fields added in Stage 1:
  cooling_water_flowrate_lpm: 30, // L/min — conservative starting point
  do_at_bottom_pct:           20, // % — typically lower than DO setpoint
} as const;

// --- Batch mode defaults ---

export const BATCH_DEFAULTS = {
  x0_g_L: 0.5,  // Initial biomass (g/L CDW)
  s0_g_L: 20.0, // Initial substrate (g/L)
} as const;

// --- Fed-batch mode defaults ---

export const FED_BATCH_DEFAULTS = {
  initial_fill_pct: 60,   // % of working volume at batch start
  batch_time_h:     24,   // Duration of batch phase (h)
} as const;

// --- Fed-batch fill limit ---

/** Final fill fraction (%): fed-batch stops at 90 % of working volume */
export const FED_BATCH_FINAL_FILL_PCT = 90;

// --- P/V scenario multipliers for OTR risk (Section 2.2 R1) ---

export const PV_SCENARIO_MULTIPLIERS = {
  conservative: 0.5,
  moderate:     1.0,
  aggressive:   2.0,
} as const;
