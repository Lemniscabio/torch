// Subset of kinetic constants that needs to be exposed to the form UI for
// live conversion (OD₆₀₀ → CDW). The bulk of kinetic data (organism-specific
// OUR anchors, biomass interpolation, µ-mode scale factor, feed-pulse
// intervals) lives in @torch/core and is backend-only.

import type { OrganismSpecies } from "../types";

// OD₆₀₀ → CDW conversion factors (g/L CDW per OD unit).
// Textbook empirical values — kept public so the form can show the live
// "≈ X g/L CDW" hint when a user enters OD instead of CDW.
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
