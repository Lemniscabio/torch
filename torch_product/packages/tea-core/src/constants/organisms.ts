// Organism-specific biological constants.
// Source: /docs/lemnisca_scaleup_app_dev_spec.md Section 1.3

import type { OrganismSpecies } from "../types";

// --- Shear Tip Speed Thresholds (m/s) ---

/** Relative uncertainty on shear tolerance thresholds. Literature values span ~±15% within a species. */
export const TIP_SPEED_THRESHOLD_RELATIVE_UNCERTAINTY = 0.15;

export const TIP_SPEED_THRESHOLDS: Record<OrganismSpecies, number> = {
  e_coli:         8.0,
  b_subtilis:     7.0,
  s_cerevisiae:   5.0,
  p_pastoris:     4.0,
  other_bacteria: 7.0,
  other_yeast:    5.0,
};

// --- RQ Defaults ---

export const RQ_DEFAULTS = {
  bacteria_aerobic:     1.0,
  s_cerevisiae_aerobic: 1.0,
  p_pastoris_methanol:  0.67,
} as const;

// --- Critical pCO₂ thresholds per organism (bar) ---
// Physiological inhibition onset: Mostafa & Gu 2003, Doran 2013.
export const PCO2_CRITICAL: Record<OrganismSpecies, number> = {
  e_coli:         0.20,
  b_subtilis:     0.15,
  s_cerevisiae:   0.10,
  p_pastoris:     0.15,
  other_bacteria: 0.15,
  other_yeast:    0.10,
};

// --- ARCHIVED (no active callers) ---

// export interface QO2Range {
//   qo2_min: number;
//   qo2_max: number;
//   qo2_midpoint: number;
// }

// // P. pastoris has two metabolic phases; main table uses glycerol defaults.
// export const QO2_RANGES: Record<OrganismSpecies, QO2Range> = {
//   e_coli:         { qo2_min: 5.0,  qo2_max: 15.0, qo2_midpoint: 8.0  },
//   b_subtilis:     { qo2_min: 3.0,  qo2_max: 8.0,  qo2_midpoint: 5.5  },
//   s_cerevisiae:   { qo2_min: 2.0,  qo2_max: 6.0,  qo2_midpoint: 3.5  },
//   p_pastoris:     { qo2_min: 3.0,  qo2_max: 8.0,  qo2_midpoint: 5.0  }, // glycerol phase
//   other_bacteria: { qo2_min: 3.0,  qo2_max: 10.0, qo2_midpoint: 6.0  },
//   other_yeast:    { qo2_min: 2.0,  qo2_max: 7.0,  qo2_midpoint: 4.0  },
// };

// export const QO2_P_PASTORIS_METHANOL: QO2Range = {
//   qo2_min: 8.0,
//   qo2_max: 20.0,
//   qo2_midpoint: 13.0,
// };

// RQ_DEFAULTS.s_cerevisiae_mixed = 1.1  (mixed aerobic/anaerobic — no active caller)
