import type { OrganismSpecies, FeedingFrequency } from "../types";

export interface OurPeakBounds {
  lower: number; // mmol/L/h — OUR at BIOMASS_INTERPOLATION_MIN_G_L
  upper: number; // mmol/L/h — OUR at BIOMASS_INTERPOLATION_MAX_G_L
}

// Biomass concentration anchors for linear OUR interpolation
export const BIOMASS_INTERPOLATION_MIN_G_L = 5;    // g/L CDW — lower anchor (maps to bounds.lower)
export const BIOMASS_INTERPOLATION_MAX_G_L = 150;  // g/L CDW — upper anchor (maps to bounds.upper)

// Threshold above which non-Newtonian viscosity treatment is applied
export const HIGH_DENSITY_BIOMASS_G_L = 60;        // g/L CDW

// Wet cell weight → dry cell weight conversion factors (g DCW / g WCW)
export const OD_TO_CDW_G_L: Record<OrganismSpecies, number> = {
  e_coli:         0.22,  // Glazyrina et al. (2010) Microb. Cell Fact.
  b_subtilis:     0.22,  // Bratbak & Dundas (1984) Appl. Environ. Microbiol.
  s_cerevisiae:   0.22,  // Huang et al. (2018) Biotechnol. Biofuels
  p_pastoris:     0.20,  // Zhang et al. (2002); Looser et al. (2015) Biotechnol. Adv.
  other_bacteria: 0.22,
  other_yeast:    0.20,
};

export function getOdToCdwFactor(species: OrganismSpecies): number {
  return OD_TO_CDW_G_L[species] ?? 0.22;
}

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

export const FEEDING_FREQUENCY_LABELS: Record<FeedingFrequency, string> = {
  continuous:    "Continuous",
  "1_10min":     "Every 1–10 min",
  "10_30min":    "Every 10–30 min",
  "30plus_min":  "> 30 min",
};

// Ordered most-frequent → least-frequent; used for cycling arrows (◀ = less frequent).
export const FEEDING_FREQUENCY_ORDER: FeedingFrequency[] = [
  "continuous", "1_10min", "10_30min", "30plus_min",
];

// --- ARCHIVED: Monod kinetic parameters --- not used in any active calculation ---
// export const KINETIC_PARAMS: Record<OrganismSpecies, KineticParameters> = { ... };
