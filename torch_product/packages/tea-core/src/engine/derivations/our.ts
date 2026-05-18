// D1 — OUR derivation.

import type { OrganismSpecies } from "../../types";
import { getOurPeakBounds, BIOMASS_INTERPOLATION_MIN_G_L, BIOMASS_INTERPOLATION_MAX_G_L } from "../../constants";

export interface OurResult {
  our_peak: number;
  our_min?: number;
  our_max?: number;
}

export function deriveOur(
  our_mode: "measured" | "estimate",
  our_measured: number | undefined,
  organism_species: OrganismSpecies,
  biomass_cdw_g_l: number,
): OurResult {
  if (our_mode === "measured") {
    return { our_peak: our_measured! };
  }

  const bounds = getOurPeakBounds(organism_species);
  if (!bounds) {
    throw new Error(`OUR estimate is unavailable for organism "${organism_species}". Provide measured OUR.`);
  }
  const t = Math.max(0, Math.min(1,
    (biomass_cdw_g_l - BIOMASS_INTERPOLATION_MIN_G_L) /
    (BIOMASS_INTERPOLATION_MAX_G_L - BIOMASS_INTERPOLATION_MIN_G_L)
  ));
  const our_peak = bounds.lower + t * (bounds.upper - bounds.lower);
  return {
    our_peak,
    our_min: bounds.lower,
    our_max: bounds.upper,
  };
}
