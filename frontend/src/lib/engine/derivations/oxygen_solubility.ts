// Tier-2 oxygen solubility: hydrostatic pressure + inlet O₂ fraction.
//
// Depletion of O₂ in the rising bubble is intentionally ignored (Tier 3);
// kLa-correlation uncertainty (~30 %) exceeds the depletion effect (~10-15 %)
// except in extreme high-density production runs.
//
// Model:
//   P_bot = P_atm + ρ·g·H_L      (gauge pressure at sparger)
//   P_top = P_atm                  (headspace)
//   C*_bot = C*_table(T) · (P_bot/P_atm) · (y_in/0.209)
//   C*_top = C*_table(T) · (P_top/P_atm) · (y_in/0.209)
//   ΔC_lm  = log-mean of (C*_bot − C_L) and (C*_top − C_L)
//
// Called separately for lab and target geometries.

import {
  ATMOSPHERIC_PRESSURE_PA, RHO, G,
  C_STAR_TABLE, O2_REFERENCE_FRACTION,
  interpolateTable,
} from "@/lib/constants";

export interface OxygenSolubilityResult {
  p_bot_pa:         number; // Pa  — absolute pressure at sparger
  p_top_pa:         number; // Pa  — absolute pressure at liquid surface
  c_star_bot:       number; // mmol/L
  c_star_top:       number; // mmol/L
  c_star_avg:       number; // mmol/L — arithmetic mean (informational)
  c_l:              number; // mmol/L — dissolved O₂ at DO setpoint
  driving_force_lm: number; // mmol/L — log-mean (C* − C_L) across vessel height
}

export function deriveOxygenSolubility(
  temperature:      number, // °C
  do_setpoint:      number, // % saturation
  h_liquid:         number, // m  — liquid height for this scale
  o2_inlet_pct:     number, // %  — sparger O₂ mole fraction (typically 20.9)
): OxygenSolubilityResult {
  const y_in         = (o2_inlet_pct / 100);
  const y_scale      = y_in / O2_REFERENCE_FRACTION;

  const p_top_pa     = ATMOSPHERIC_PRESSURE_PA;
  const p_bot_pa     = ATMOSPHERIC_PRESSURE_PA + RHO * G * h_liquid;

  const c_star_1atm  = interpolateTable(C_STAR_TABLE, temperature); // mmol/L at 1 atm, air

  const c_star_bot   = c_star_1atm * (p_bot_pa / ATMOSPHERIC_PRESSURE_PA) * y_scale;
  const c_star_top   = c_star_1atm * (p_top_pa / ATMOSPHERIC_PRESSURE_PA) * y_scale;
  const c_star_avg   = (c_star_bot + c_star_top) / 2;

  const c_l          = (do_setpoint / 100) * c_star_avg; // referenced to average C*

  const dc_bot       = c_star_bot - c_l;
  const dc_top       = c_star_top - c_l;

  let driving_force_lm: number;
  if (dc_top <= 0) {
    // C*_top ≤ C_L: top of column cannot transfer O₂ at all
    driving_force_lm = Math.max(0, dc_bot);
  } else if (Math.abs(dc_bot - dc_top) < 1e-3 * (dc_bot + dc_top) / 2) {
    driving_force_lm = (dc_bot + dc_top) / 2; // arithmetic mean near equality
  } else {
    driving_force_lm = (dc_bot - dc_top) / Math.log(dc_bot / dc_top);
  }

  return { p_bot_pa, p_top_pa, c_star_bot, c_star_top, c_star_avg, c_l, driving_force_lm };
}
