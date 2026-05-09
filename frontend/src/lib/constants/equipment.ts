// Equipment and vessel configuration constants.
// Source: /docs/lemnisca_scaleup_app_dev_spec.md Section 1.3

import type { ImpellerType } from "@/lib/types";

// --- Impeller Constants ---

export interface ImpellerConstants {
  np: number;           // Power number (Np)
  pg_p_factor: number;  // Gassed/ungassed power ratio (Pg/P)
  d_t_ratio: number;    // Impeller-to-tank diameter ratio (d/T)
}

export const IMPELLER_CONSTANTS: Record<ImpellerType, ImpellerConstants> = {
  rushton:       { np: 5.0,  pg_p_factor: 0.60, d_t_ratio: 0.33 },
  pitched_blade: { np: 1.5,  pg_p_factor: 0.80, d_t_ratio: 0.33 },
  marine:        { np: 0.35, pg_p_factor: 0.85, d_t_ratio: 0.40 },
  unknown:       { np: 5.0,  pg_p_factor: 0.60, d_t_ratio: 0.33 },
};

// --- VVM validity range for Pg/P flag (Section 2.1 D3) ---

export const VVM_VALID_LOW  = 0.3;
export const VVM_VALID_HIGH = 2.0;

// --- P/V sanity bounds (W/m³) — used in D3 flag ---

export const PV_LOW_SANITY  = 500;
export const PV_HIGH_SANITY = 8000;

// --- ARCHIVED ---
// FEED_TAU_MAP and its FeedFrequency dependency are deprecated.
// FeedFrequency type is marked @deprecated in types/index.ts.
// No active callers remain in the engine.
//
// import type { FeedFrequency } from "@/lib/types";
//
// export const FEED_TAU_MAP: Record<FeedFrequency, number> = {
//   continuous:   10,
//   "1_10min":    60,
//   "10_30min":   900,
//   "30plus_min": 2400,
// };
