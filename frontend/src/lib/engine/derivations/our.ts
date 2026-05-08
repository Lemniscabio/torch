// D1 — OUR derivation. exhaust_gas mode removed (Stage 3).

import type { OrganismSpecies } from "@/lib/types";
import { QO2_RANGES } from "@/lib/constants";

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
): OurResult {
  if (our_mode === "measured") {
    return { our_peak: our_measured! };
  }

  // estimate mode
  const qo2 = QO2_RANGES[organism_species];
  return {
    our_peak: qo2.qo2_midpoint * biomass_cdw,
    our_min:  qo2.qo2_min      * biomass_cdw,
    our_max:  qo2.qo2_max      * biomass_cdw,
  };
}
