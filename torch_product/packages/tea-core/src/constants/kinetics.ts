// Private kinetic constants — backend-only. The public OD→CDW conversion
// lives in @torch/core-shared (so the form UI can use it without pulling in
// any engine math).

import type { OrganismSpecies, FeedingFrequency } from "../types";

// Re-export the public OD→CDW pieces and the feeding-frequency catalog
// (labels + ordering) so existing engine code that imports from
// "../constants/kinetics" or "../constants" keeps working unchanged. These
// canonical defs live in @torch/core-shared.
export {
  OD_TO_CDW_G_L,
  getOdToCdwFactor,
  FEEDING_FREQUENCY_LABELS,
  FEEDING_FREQUENCY_ORDER,
} from "@torch/core-shared";

export interface OurPeakBounds {
  lower: number; // mmol/L/h — OUR at BIOMASS_INTERPOLATION_MIN_G_L
  upper: number; // mmol/L/h — OUR at BIOMASS_INTERPOLATION_MAX_G_L
}

// Biomass concentration anchors for linear OUR interpolation
export const BIOMASS_INTERPOLATION_MIN_G_L = 5;    // g/L CDW — lower anchor (maps to bounds.lower)
export const BIOMASS_INTERPOLATION_MAX_G_L = 150;  // g/L CDW — upper anchor (maps to bounds.upper)

// Threshold above which non-Newtonian viscosity treatment is applied
export const HIGH_DENSITY_BIOMASS_G_L = 60;        // g/L CDW

export const OUR_PEAK_BOUNDS: Partial<Record<OrganismSpecies, OurPeakBounds>> = {
  e_coli:         { lower: 12, upper: 150 },
  p_pastoris:     { lower: 15, upper: 180 },
  s_cerevisiae:   { lower: 8,  upper: 55  },
  b_subtilis:     { lower: 10, upper: 90  },
  other_bacteria: { lower: 10, upper: 90  },
  other_yeast:    { lower: 8,  upper: 55  },
} as const;

export function getOurPeakBounds(
  organism: OrganismSpecies,
): OurPeakBounds | undefined {
  return OUR_PEAK_BOUNDS[organism];
}

// Empirical correction applied to OUR estimated via the µ/Y_X/O₂ method.
// The stoichiometric formula assumes all growth-associated ATP comes from
// oxidative phosphorylation; in practice, partial overflow metabolism and
// maintenance energy reduce the observable OUR relative to the theoretical
// prediction, yielding a factor < 1.
export const OUR_ESTIMATE_MU_SCALE_FACTOR = 0.7;

// Feed pulse interval mapped to seconds — used for τ_feed in mixing risk scoring.
export const FEEDING_FREQUENCY_SECONDS: Record<FeedingFrequency, number> = {
  continuous:    10,
  "1_10min":     60,
  "10_30min":    900,
  "30plus_min": 2400,
};

// --- ARCHIVED: Monod kinetic parameters --- not used in any active calculation ---
// export const KINETIC_PARAMS: Record<OrganismSpecies, KineticParameters> = { ... };
