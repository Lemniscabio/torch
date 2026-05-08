// Heat-transfer constants for jacket-cooled bioreactors.

import type { ImpellerType } from "@/lib/types";

// --- Metabolic heat yield (kJ / mmol O₂ consumed) ---
// Source: Cooney, Wang & Mateles (1968) Biotechnol. Bioeng. 11:269 (default 0.46).
// P. pastoris uses methanol substrate; higher heat of combustion → Roels (1983).

import type { OrganismSpecies } from "@/lib/types";

export const METABOLIC_HEAT_COEFF_KJ_PER_MMOL: Record<OrganismSpecies, number> = {
  e_coli:         0.46,
  b_subtilis:     0.46,
  s_cerevisiae:   0.46,
  p_pastoris:     0.52, // methanol; Roels (1983) Energetics and Kinetics in Biotechnology
  other_bacteria: 0.46,
  other_yeast:    0.46,
};

// --- Broth (process-side) thermal properties (water-like approximation) ---

export const BROTH_K_W_MK   = 0.600; // W/m·K
export const BROTH_CP_J_KGK = 4180;  // J/kg·K

// --- Cooling water thermal properties (~15 °C average jacket temperature) ---

export const JACKET_WATER_MU_PA_S = 1.14e-3; // Pa·s
export const JACKET_WATER_K_W_MK  = 0.589;   // W/m·K
export const JACKET_WATER_PR      = 8.1;      // Pr = Cp·μ/k
export const WATER_CP_J_KGK       = 4184;     // J/kg·K
export const WATER_RHO_KG_M3      = 999;      // kg/m³

// --- Vessel wall materials ---
// Glass for V ≤ threshold (lab), stainless steel (SS316) for V > threshold (pilot/production).

export const VESSEL_GLASS_THRESHOLD_LITRES = 10;

export const GLASS_K_W_MK       = 1.1;   // W/m·K (borosilicate; Incropera Table A.3)
export const GLASS_WALL_M       = 0.006; // m (6 mm)

export const SS316_K_W_MK       = 16.0;  // W/m·K (SS 316L; Incropera Table A.1)
export const SS316_WALL_M       = 0.005; // m (5 mm)

// --- Chilton-Drew constant C for h_i correlation ---
// Nu = C · Re_imp^(2/3) · Pr^(1/3) · (μ/μ_w)^0.14
// Sources: Chilton & Drew (1944); pitched_blade/marine from Bondy & Lippa (1983).

export const CHILTON_DREW_C: Record<ImpellerType, number> = {
  rushton:       0.74,
  pitched_blade: 0.55,
  marine:        0.54,
  unknown:       0.74,
};

// --- Jacket geometry assumption ---
// Annular gap is estimated as JACKET_GAP_FRACTION × D_T, clamped to [20, 80] mm.

export const JACKET_GAP_FRACTION = 0.05;
export const JACKET_GAP_MIN_M    = 0.020; // m
export const JACKET_GAP_MAX_M    = 0.080; // m

// --- Safe bounds for overall heat-transfer coefficient U ---
// Applied to correlation-derived U to keep estimates in a conservative,
// physically plausible range for jacketed bioreactors.
export const U_OVERALL_MIN_W_M2K = 100;
export const U_OVERALL_MAX_W_M2K = 400;
