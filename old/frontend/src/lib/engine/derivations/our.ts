// D1 — OUR derivation. exhaust_gas mode removed (Stage 3).

import type { BiomassDensityCategory, OrganismSpecies } from "@/lib/types";
import { getBiomassDensityCategory, getOurPeakBounds } from "@/lib/constants";

export interface OurResult {
  our_peak: number;
  our_min?: number;
  our_max?: number;
}

export function deriveOur(
  our_mode: "measured" | "estimate",
  our_measured: number | undefined,
  biomass_cdw: number,
  organism_species: OrganismSpecies,
  biomass_density_category?: BiomassDensityCategory,
): OurResult {
  if (our_mode === "measured") {
    return { our_peak: our_measured! };
  }

  // estimate mode
  const bounds = getOurPeakBounds(organism_species);
  if (!bounds) {
    throw new Error(`OUR estimate is unavailable for organism "${organism_species}". Provide measured OUR.`);
  }
  const category = biomass_density_category ?? getBiomassDensityCategory(biomass_cdw);
  const our_peak = category === "high_density" ? bounds.upper : bounds.lower;
  return {
    our_peak,
    our_min: bounds.lower,
    our_max: bounds.upper,
  };
}
