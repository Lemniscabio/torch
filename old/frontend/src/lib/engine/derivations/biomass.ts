// D7 — OD600 → CDW conversion.

import type { BiomassUnit, OrganismSpecies } from "@/lib/types";
import { CDW_OD_FACTORS } from "@/lib/constants";

export function deriveBiomassCdw(
  biomass: number,
  biomass_unit: BiomassUnit,
  organism_species: OrganismSpecies,
): number {
  if (biomass_unit === "OD600") {
    return biomass * CDW_OD_FACTORS[organism_species];
  }
  return biomass;
}
