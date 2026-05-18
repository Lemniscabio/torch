import type { OrganismSpecies, FeedingFrequency } from "@/lib/types";

export interface OurPeakBounds {
  lower: number; // mmol/L/h — OUR at BIOMASS_INTERPOLATION_MIN_G_L
  upper: number; // mmol/L/h — OUR at BIOMASS_INTERPOLATION_MAX_G_L
}

// Biomass concentration anchors for linear OUR interpolation
export const BIOMASS_INTERPOLATION_MIN_G_L = 5;    // g/L CDW — lower anchor (maps to bounds.lower)
export const BIOMASS_INTERPOLATION_MAX_G_L = 150;  // g/L CDW — upper anchor (maps to bounds.upper)

// Threshold above which non-Newtonian viscosity treatment is applied
export const HIGH_DENSITY_BIOMASS_G_L = 60;        // g/L CDW

// OD₆₀₀ → CDW conversion factors (g/L CDW per OD unit)
export const OD_TO_CDW_G_L: Record<OrganismSpecies, number> = {
  e_coli:         0.43,
  s_cerevisiae:   0.38,
  p_pastoris:     0.36,
  b_subtilis:     0.42,
  other_bacteria: 0.43,
  other_yeast:    0.38,
};

export function getOdToCdwFactor(species: OrganismSpecies): number {
  return OD_TO_CDW_G_L[species] ?? 0.43;
}

export const OUR_PEAK_BOUNDS: Partial<Record<OrganismSpecies, OurPeakBounds>> = {
  e_coli:       { lower: 12, upper: 150 },
  p_pastoris:   { lower: 15, upper: 180 },
  s_cerevisiae: { lower: 8, upper: 55  },
  b_subtilis:   { lower: 10, upper: 90  },
} as const;

export function getOurPeakBounds(
  organism: OrganismSpecies,
): OurPeakBounds | undefined {
  return OUR_PEAK_BOUNDS[organism];
}

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
