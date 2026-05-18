// D1 — OUR derivation.

import type { OrganismSpecies } from "../../types";
import {
  getOurPeakBounds,
  BIOMASS_INTERPOLATION_MIN_G_L,
  BIOMASS_INTERPOLATION_MAX_G_L,
  OXYGEN_YIELD_COEFFICIENT,
  OUR_ESTIMATE_MU_SCALE_FACTOR,
} from "../../constants";

// Organisms for which species-specific Y_X/O₂ data exists; estimate_mu is not
// permitted for generic catch-all species because their Y_X/O₂ values are too
// uncertain to support this method meaningfully.
const ESTIMATE_MU_ALLOWED: ReadonlySet<OrganismSpecies> = new Set([
  "e_coli", "b_subtilis", "s_cerevisiae", "p_pastoris",
]);

// MW of O₂ (g/mol) — used to convert g O₂/L/h → mmol O₂/L/h.
const O2_MW = 32;

export interface OurResult {
  our_peak: number;
  our_min?: number;
  our_max?: number;
}

export function deriveOur(
  our_mode: "measured" | "estimate" | "estimate_mu",
  our_measured: number | undefined,
  organism_species: OrganismSpecies,
  biomass_cdw_g_l: number,
  mu?: number,
): OurResult {
  if (our_mode === "measured") {
    return { our_peak: our_measured! };
  }

  if (our_mode === "estimate_mu") {
    if (!ESTIMATE_MU_ALLOWED.has(organism_species)) {
      throw new Error(
        `estimate_mu is not supported for "${organism_species}". ` +
        `Species-specific Y_X/O₂ data is required; provide measured OUR instead.`
      );
    }
    if (mu === undefined || mu <= 0) {
      throw new Error(`estimate_mu requires a positive specific growth rate (µ).`);
    }
    // Unit derivation:
    //   biomass [g DCW/L] × µ [h⁻¹] / Y_X/O₂ [g DCW/g O₂] = g O₂/L/h
    //   × (1000 mmol/mol) / (32 g/mol)                      = mmol O₂/L/h
    const our_peak =
      (biomass_cdw_g_l * mu / OXYGEN_YIELD_COEFFICIENT[organism_species]) *
      (1000 / O2_MW) * OUR_ESTIMATE_MU_SCALE_FACTOR;
    return { our_peak };
  }

  // estimate — interpolate from species biomass bounds
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
