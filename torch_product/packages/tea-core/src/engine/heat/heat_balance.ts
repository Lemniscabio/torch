// Heat balance: metabolic heat generation, cooling water outlet T, and LMTD.

import { METABOLIC_HEAT_COEFF_KJ_PER_MMOL, WATER_CP_J_KGK, WATER_RHO_KG_M3 } from "../../constants";
import type { OrganismSpecies } from "../../types";

// Q [kW] = coeff [kJ/mmol] × OUR [mmol/L/h] × V [L] / 3600 [s/h]
export function deriveMetabolicHeat(
  our_mmol_Lh: number,
  volume_litres: number,
  organism: OrganismSpecies,
): number {
  const coeff = METABOLIC_HEAT_COEFF_KJ_PER_MMOL[organism];
  return (coeff * our_mmol_Lh * volume_litres) / 3600; // kW
}

export interface CoolingWaterResult {
  t_cw_out: number; // °C
  dt_cw:    number; // °C — temperature rise across jacket
  m_cw_kgs: number; // kg/s — mass flow rate
}

// Energy balance: Q = m_cw · Cp · ΔT  →  T_cw_out = T_cw_in + Q·1000 / (m_cw · Cp)
export function deriveCoolingWaterOutlet(
  Q_kW: number,
  flowrate_lpm: number,
  t_cw_in: number,
): CoolingWaterResult {
  const m_cw_kgs = (flowrate_lpm / 60) * (WATER_RHO_KG_M3 / 1000); // kg/s
  const dt_cw    = m_cw_kgs > 0 ? (Q_kW * 1000) / (m_cw_kgs * WATER_CP_J_KGK) : Infinity;
  return { t_cw_out: t_cw_in + dt_cw, dt_cw, m_cw_kgs };
}

// LMTD for co-current/counter-current jacket with broth at uniform T_proc.
// Falls back to arithmetic mean when ΔT₁ ≈ ΔT₂ to avoid ln(1) singularity.
export function deriveLmtd(
  t_proc:   number, // °C
  t_cw_in:  number, // °C
  t_cw_out: number, // °C
): number {
  const dt1 = t_proc - t_cw_in;
  const dt2 = t_proc - t_cw_out;
  if (Math.abs(dt1 - dt2) < 1e-3 * Math.abs(dt1 + dt2) / 2) return (dt1 + dt2) / 2;
  // Degenerate: cooling water would exit at/above broth temperature, so there is
  // no (or reversed) driving force. Return 0 rather than Math.max(dt1, dt2), which
  // previously over-reported available cooling (Q_available = U·A·dt1) in exactly
  // the under-capacity regime that should score critical. Zero LMTD drives
  // Q_available → 0 and trips the heat-risk driving-force flag (dt_lm <= 0).
  if (dt1 <= 0 || dt2 <= 0) return 0;
  return (dt1 - dt2) / Math.log(dt1 / dt2);
}
