// Subset of kinetic constants exposed to the form UI for live biomass
// conversion. The bulk of kinetic data (organism-specific OUR anchors,
// biomass interpolation, µ-mode scale factor, feed-pulse intervals) lives
// in @torch/core and is backend-only.

import type { OrganismSpecies } from "../types";

// Wet cell weight → dry cell weight conversion factors (g DCW / g WCW).
// Per the whatif_analysis branch (origin/whatif_analysis), literature
// references inline:
//   - Glazyrina et al. (2010) Microb. Cell Fact.        — E. coli
//   - Bratbak & Dundas (1984) Appl. Environ. Microbiol. — B. subtilis
//   - Huang et al. (2018) Biotechnol. Biofuels           — S. cerevisiae
//   - Zhang et al. (2002); Looser et al. (2015) Biotechnol. Adv. — P. pastoris
//
// NOTE: variable name kept as OD_TO_CDW_G_L for backwards compatibility,
// but the values now represent WCW→DCW conversion, not OD→CDW. Frontend
// callers (ProcessStep's biomass-mode toggle) should be audited if/when
// the meaning of the form's "OD" input changes.
export const OD_TO_CDW_G_L: Record<OrganismSpecies, number> = {
  e_coli:         0.22,
  b_subtilis:     0.22,
  s_cerevisiae:   0.22,
  p_pastoris:     0.20,
  other_bacteria: 0.22,
  other_yeast:    0.20,
};

export function getOdToCdwFactor(species: OrganismSpecies): number {
  return OD_TO_CDW_G_L[species] ?? 0.22;
}
