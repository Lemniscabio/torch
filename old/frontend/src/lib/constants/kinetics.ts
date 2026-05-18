// Monod kinetic parameters for organisms supported by Lemnisca.
//
// Parameters:
//   mu_max  [h⁻¹]          — maximum specific growth rate
//   Ks      [g/L]          — substrate half-saturation constant (glucose unless noted)
//   Ko      [mmol O₂/L]    — oxygen half-saturation constant
//   Y_X_S   [g CDW/g S]    — biomass yield on substrate
//   Y_O2    [g CDW/g O₂]   — biomass yield on oxygen
//
// Approximation flag:
//   Values marked [~] are estimated from analogous organisms or textbook
//   ranges where no direct primary-literature measurement was located.

import type { BiomassDensityCategory, OrganismSpecies } from "@/lib/types";

export interface OurPeakBounds {
  lower: number; // mmol/L/h
  upper: number; // mmol/L/h
}

export interface KineticParameters {
  mu_max: number;  // h⁻¹
  Ks:     number;  // g/L  (primary carbon source; see per-organism notes)
  Ko:     number;  // mmol O₂/L
  Y_X_S:  number;  // g CDW / g substrate
  Y_O2:   number;  // g CDW / g O₂
}

export const PEAK_BIOMASS_HIGH_DENSITY_THRESHOLD_G_L = 60;

export const BIOMASS_DENSITY_REPRESENTATIVE_CDW: Record<BiomassDensityCategory, number> = {
  low_density: 20,
  high_density: 100,
} as const;

export const OUR_PEAK_BOUNDS: Partial<Record<OrganismSpecies, OurPeakBounds>> = {
  e_coli:       { lower: 70, upper: 150 },
  p_pastoris:   { lower: 25, upper: 160 },
  s_cerevisiae: { lower: 20,  upper: 55 },
  b_subtilis:   { lower: 35,  upper: 80 },
} as const;

export function getBiomassDensityCategory(
  biomass_cdw_g_L: number,
): BiomassDensityCategory {
  return biomass_cdw_g_L >= PEAK_BIOMASS_HIGH_DENSITY_THRESHOLD_G_L
    ? "high_density"
    : "low_density";
}

export function getOurPeakBounds(
  organism: OrganismSpecies,
): OurPeakBounds | undefined {
  return OUR_PEAK_BOUNDS[organism];
}

export function getRepresentativeOurPeakByDensity(
  organism: OrganismSpecies,
  biomass_cdw_g_L: number,
): number | undefined {
  const bounds = getOurPeakBounds(organism);
  if (!bounds) return undefined;
  return getBiomassDensityCategory(biomass_cdw_g_L) === "high_density"
    ? bounds.upper
    : bounds.lower;
}

export function getRepresentativeBiomassCdw(
  category: BiomassDensityCategory,
): number {
  return BIOMASS_DENSITY_REPRESENTATIVE_CDW[category];
}

export function getOurPeakByCategory(
  organism: OrganismSpecies,
  category: BiomassDensityCategory,
): number | undefined {
  const bounds = getOurPeakBounds(organism);
  if (!bounds) return undefined;
  return category === "high_density" ? bounds.upper : bounds.lower;
}

export const KINETIC_PARAMS: Record<OrganismSpecies, KineticParameters> = {

  // ── Escherichia coli ─────────────────────────────────────────────────────
  // Carbon source: glucose, aerobic, 37 °C.
  // mu_max: Åkesson et al. (1999) Biotechnol Bioeng 73:223–230.
  //         Bailey & Ollis (1986) "Biochemical Engineering Fundamentals"
  //         2nd ed., p. 394 cite 0.8–1.0 h⁻¹; 0.85 h⁻¹ used as midpoint.
  // Ks:     Bailey & Ollis (1986) Table C.1: 0.1 g/L for glucose.
  //         Senn & Lendenmann (1994) J Biotechnol 35:105 report 0.07 g/L;
  //         0.10 g/L used as conservative round value.
  // Ko:     Tsai & Lee (1990) Biotechnol Bioeng 35:809–819: Ko ≈ 0.003 mmol/L
  //         at 37 °C; 0.004 mmol/L used as representative mid-range.
  // Y_X_S:  Bailey & Ollis (1986) Table C.1: 0.43 g CDW/g glucose aerobic.
  //         Consistent with Tempest & Neijssel (1984) Adv Microb Physiol 25:459.
  // Y_O2:   Blanch & Clark (1996) "Biochemical Engineering" McGraw-Hill: 
  //         ~0.9 g CDW/g O₂ for aerobic bacteria on glucose.
  e_coli: {
    mu_max: 0.85,
    Ks:     0.10,
    Ko:     0.004,
    Y_X_S:  0.43,
    Y_O2:   0.90,
  },

  // ── Bacillus subtilis ────────────────────────────────────────────────────
  // Carbon source: glucose, aerobic, 37 °C.
  // mu_max: Dauner et al. (2001) Biotechnol Bioeng 76:144–156 report ~0.7 h⁻¹
  //         aerobic on glucose; de Jong et al. (2010) Metab Eng 12:252 report
  //         ~0.45 h⁻¹ in minimal medium. 0.60 h⁻¹ used as mid-range estimate.
  // Ks:     [~] No reliable direct measurement found in primary literature.
  //         Approximated at 0.10 g/L from similarity to E. coli on glucose
  //         (aerobic gram-positive bacteria); treat with caution.
  // Ko:     [~] Not well-characterised in primary literature. Approximated at
  //         0.005 mmol/L from the 0.003–0.010 mmol/L range for aerobic
  //         heterotrophs (Doran 2012 "Bioprocess Engineering Principles" 2nd ed.).
  // Y_X_S:  de Jong et al. (2010) Metab Eng 12:252: ~0.44 g CDW/g glucose
  //         aerobic; consistent with Dauner et al. (2001).
  // Y_O2:   [~] Approximated at 0.85 g CDW/g O₂ from aerobic heterotrophic
  //         bacterium energetics (Blanch & Clark 1996); no direct B. subtilis
  //         measurement located.
  b_subtilis: {
    mu_max: 0.60,
    Ks:     0.10,
    Ko:     0.005,
    Y_X_S:  0.44,
    Y_O2:   0.85,
  },

  // ── Saccharomyces cerevisiae ──────────────────────────────────────────────
  // Carbon source: glucose, fully respiratory aerobic, 30 °C.
  // Note: Under fermentative/overflow conditions mu_max can be higher and
  //       Y_X_S drops significantly (0.05–0.10 g/g); values below are for
  //       the respiratory regime relevant to scale-up oxygen calculations.
  // mu_max: Sonnleitner & Käppeli (1986) Biotechnol Bioeng 28:927–937:
  //         mu_max (respiratory) = 0.40 h⁻¹ (critical dilution rate, D_crit).
  //         Rieger et al. (1983) Biotechnol Bioeng 25:1737 report 0.35–0.45 h⁻¹.
  // Ks:     Sonnleitner & Käppeli (1986): Ks = 0.05 g glucose/L for respiratory
  //         growth. Rieger et al. (1983) report similar.
  // Ko:     Sonnleitner & Käppeli (1986): Ko = 0.004 mmol/L (critical dissolved
  //         O₂ below which respiratory capacity is impaired). Reyes & Leal (1991)
  //         Biotechnol Bioeng 37:945 report a similar threshold.
  // Y_X_S:  Verduyn et al. (1990) Yeast 6:477–492: 0.49–0.51 g CDW/g glucose
  //         under fully respiratory conditions. 0.50 g/g adopted.
  // Y_O2:   Verduyn et al. (1991) Yeast 7:185–201: Y_X/O₂ = 0.71 g CDW/g O₂
  //         under respiratory conditions; 0.70 g/g used.
  s_cerevisiae: {
    mu_max: 0.40,
    Ks:     0.05,
    Ko:     0.004,
    Y_X_S:  0.50,
    Y_O2:   0.70,
  },

  // ── Komagataella phaffii (Pichia pastoris) ───────────────────────────────
  // Carbon source: glycerol (batch/growth phase), 30 °C.
  // Note: Parameters differ substantially between the glycerol batch phase
  //       (mu_max ~0.25–0.30 h⁻¹) and the methanol induction phase
  //       (mu_set typically 0.02–0.06 h⁻¹). Values below represent the
  //       glycerol growth phase. Use methanol-phase QO₂ values for the
  //       production phase oxygen demand (see QO2_P_PASTORIS_METHANOL).
  // mu_max: Krainer et al. (2012) Microb Cell Fact 11:116: mu_max = 0.27 h⁻¹
  //         on glycerol; Looser et al. (2015) Biotechnol Adv 33:1177 report
  //         0.25–0.30 h⁻¹. 0.27 h⁻¹ adopted.
  // Ks:     [~] Ks on glycerol not reliably determined in primary literature.
  //         Shi et al. (2006) Biochem Eng J 28:205 suggest ~1.0 g/L; 0.50 g/L
  //         used as a conservative lower-bound approximation.
  // Ko:     [~] Not well-characterised; approximated at 0.005 mmol/L from
  //         similarity to S. cerevisiae. P. pastoris has higher qO₂ demand
  //         suggesting Ko may be slightly higher; treat with caution.
  // Y_X_S:  Çelik et al. (2010) J Ind Microbiol Biotechnol 37:1273: 
  //         ~0.43 g CDW/g glycerol. 0.43 g/g adopted.
  // Y_O2:   Çelik & Çalik (2012) Biotechnol Adv 30:1108–1118: on glycerol
  //         0.50–0.60 g CDW/g O₂; 0.50 g/g adopted as a conservative estimate.
  p_pastoris: {
    mu_max: 0.27,
    Ks:     0.50,
    Ko:     0.005,
    Y_X_S:  0.43,
    Y_O2:   0.50,
  },

  // ── Generic aerobic bacteria ──────────────────────────────────────────────
  // [~] All values approximated from the aerobic heterotrophic bacteria range
  //     reported in Doran (2012) "Bioprocess Engineering Principles" 2nd ed.,
  //     Chapters 11–12, and Blanch & Clark (1996). Use only when species-
  //     specific data are unavailable.
  other_bacteria: {
    mu_max: 0.50,
    Ks:     0.10,
    Ko:     0.005,
    Y_X_S:  0.40,
    Y_O2:   0.85,
  },

  // ── Generic yeast ─────────────────────────────────────────────────────────
  // [~] All values approximated from S. cerevisiae respiratory parameters
  //     (Sonnleitner & Käppeli 1986; Verduyn et al. 1990, 1991) as a surrogate.
  //     Yields adjusted slightly downward to reflect the wider diversity of
  //     yeast metabolic strategies. Use only when species-specific data are
  //     unavailable.
  other_yeast: {
    mu_max: 0.35,
    Ks:     0.07,
    Ko:     0.005,
    Y_X_S:  0.45,
    Y_O2:   0.65,
  },
};

// --- ARCHIVED ---
// STANDARD_GLUCOSE_FEED_CONC was only used by growth_oxygen_risk.ts (archived).
// export const STANDARD_GLUCOSE_FEED_CONC = 500; // g/L — Lee (1996) Biotechnol. Bioeng. 49:348
