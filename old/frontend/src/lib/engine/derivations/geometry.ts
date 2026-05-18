// D2 — Vessel geometry derivation.

import type { VesselGeometry, ImpellerType } from "@/lib/types";
import { IMPELLER_CONSTANTS } from "@/lib/constants";

export function deriveVesselGeometry(
  volume_litres: number,
  h_d: number,
  impeller_type: ImpellerType,
  dt_ratio?: number,
): VesselGeometry {
  const volume_m3 = volume_litres / 1000;
  const t_diameter = Math.pow((4 * volume_m3) / (Math.PI * h_d), 1 / 3);
  const h_liquid = h_d * t_diameter;
  const d_t_ratio = dt_ratio ?? IMPELLER_CONSTANTS[impeller_type].d_t_ratio;
  const d_imp = d_t_ratio * t_diameter;
  const a_cross = (Math.PI / 4) * t_diameter * t_diameter;
  return { t_diameter, h_liquid, d_imp, a_cross, volume_m3 };
}
