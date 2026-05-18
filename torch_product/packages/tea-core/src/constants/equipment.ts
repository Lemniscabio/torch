// Equipment and vessel configuration constants.
// Source: /docs/lemnisca_scaleup_app_dev_spec.md Section 1.3

import type { ImpellerType } from "../types";

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

