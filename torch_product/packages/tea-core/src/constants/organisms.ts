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

// --- Oxygen Yield Coefficients Y_X/O2 (g DCW / g O2) ---
// Biomass yield per gram of oxygen consumed under aerobic, substrate-limited conditions
// at moderate growth rates. Values are condition-dependent: overflow metabolism (acetate
// in E. coli / B. subtilis, ethanol in S. cerevisiae above the Crabtree threshold) reduces
// Y_X/O2 at high growth rates.
//
// Sources:
//   Heijnen & van Dijken (1992) Biotechnol. Bioeng. 39:833-858  https://doi.org/10.1002/bit.260390806
//     -- multi-organism thermodynamic compilation; basis for E. coli and B. subtilis values.
//   Dauner & Sauer (2001) Biotechnol. Bioeng. 76:132-143  https://doi.org/10.1002/bit.1153
//     -- stoichiometric chemostat data for B. subtilis on glucose.
//   Verduyn et al. (1991) Yeast 8:501-517  https://doi.org/10.1002/yea.320080703
//     -- aerobic glucose-limited chemostat (D = 0.10 h^-1); authoritative S. cerevisiae value.
//   Looser et al. (2015) Biotechnol. Adv. 33:517-533  https://doi.org/10.1016/j.biotechadv.2015.02.006
//     -- P. pastoris bioprocess review; glycerol-phase OUR-to-biomass stoichiometry.
//   Doran P.M. (2013) Bioprocess Engineering Principles, 2nd ed. Elsevier.
export const OXYGEN_YIELD_COEFFICIENT: Record<OrganismSpecies, number> = {
  // E. coli, glucose, aerobic, μ < 0.3 h^-1 (no acetate overflow).
  // Shiloach & Fass (2005); BNID 105317. Range in lit: 0.9–1.1 g/g.
  e_coli:         1.00,

  // B. subtilis, glucose, aerobic minimal media. Dauner & Sauer (2001).
  // Computed from Yx/s ≈ 0.40 g/g and Yo/s ≈ 4 mol/mol → ~0.55–1.0 g/g.
  b_subtilis:     0.80,

  // S. cerevisiae, glucose, fully respiratory (D < 0.30 h^-1, below Crabtree).
  // Verduyn et al. (1991); confirmed by Pronk et al. (1994).
  // Drops to ~0.10 g/g under respiro-fermentative conditions.
  s_cerevisiae:   1.00,

  // P. pastoris, glycerol phase, fed-batch. Looser et al. (2015); Cos et al. (2006).
  // Note: methanol phase is MUCH more O2-demanding — use ~0.20 g/g if modelling
  // the induction phase (methanol is more reduced AND alcohol oxidase is wasteful).
  p_pastoris:     0.65,

  // Conservative midpoints for unspecified strains. The aerobic Y_X/O2 envelope
  // for heterotrophic growth on hexose-equivalent carbon is ~0.5–1.1 g/g.
  other_bacteria: 0.80,
  other_yeast:    0.85,
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
