// What-if analysis catalog — used by the results dashboard UI to render
// the target-scale modification buttons + steppers.
//
// All metadata here is presentation-layer (button labels, which domains
// each modification affects, conflict pairs). The actual math that applies
// each modification lives in @torch/core/engine/whatif (backend-only).

import type { FeedingFrequency, RiskDomain } from "../types";

export type ModificationId =
  | "increase_impeller_rpm"
  | "decrease_impeller_rpm"
  | "increase_aeration_rate"
  | "increase_oxygen_saturation"
  | "increase_impeller_diameter"
  | "decrease_impeller_diameter"
  | "switch_to_rushton_impeller"
  | "switch_to_pitched_blade_impeller"
  | "add_internal_cooling_coils"
  | "reduce_feeding_frequency";

export interface ModificationDefinition {
  id: ModificationId;
  label: string;
  domains: RiskDomain[];
  section: "operational" | "design";
}

export const MODIFICATION_CATALOG: ModificationDefinition[] = [
  { id: "increase_impeller_rpm",            label: "Increase impeller RPM",              domains: ["otr", "mixing", "co2", "heat"], section: "operational" },
  { id: "decrease_impeller_rpm",            label: "Decrease impeller RPM",              domains: ["shear"],                        section: "operational" },
  { id: "increase_aeration_rate",           label: "Increase aeration rate",             domains: ["otr", "co2", "heat"],           section: "operational" },
  { id: "increase_oxygen_saturation",       label: "Increase oxygen saturation",         domains: ["otr"],                          section: "operational" },
  { id: "increase_impeller_diameter",       label: "Increase impeller diameter",         domains: ["otr", "mixing", "co2"],         section: "design" },
  { id: "decrease_impeller_diameter",       label: "Decrease impeller diameter",         domains: ["shear"],                        section: "design" },
  { id: "switch_to_rushton_impeller",       label: "Switch to Rushton impeller",         domains: ["otr", "mixing", "co2", "heat"], section: "design" },
  { id: "switch_to_pitched_blade_impeller", label: "Switch to pitched blade impeller",   domains: ["shear"],                        section: "design" },
  { id: "add_internal_cooling_coils",       label: "Add internal cooling coils",         domains: ["heat"],                         section: "design" },
  { id: "reduce_feeding_frequency",         label: "Reduce feeding frequency",           domains: ["mixing"],                       section: "operational" },
];

export const MODIFICATION_CONFLICTS: Record<ModificationId, ModificationId[]> = {
  increase_impeller_rpm:            ["decrease_impeller_rpm"],
  decrease_impeller_rpm:            ["increase_impeller_rpm"],
  increase_aeration_rate:           [],
  increase_oxygen_saturation:       [],
  increase_impeller_diameter:       ["decrease_impeller_diameter"],
  decrease_impeller_diameter:       ["increase_impeller_diameter"],
  switch_to_rushton_impeller:       ["switch_to_pitched_blade_impeller"],
  switch_to_pitched_blade_impeller: ["switch_to_rushton_impeller"],
  add_internal_cooling_coils:       [],
  reduce_feeding_frequency:         [],
};

// Continuous oxygen-saturation stepper.
export const OXYGEN_LEVELS_DEFAULT = [20.9, 40, 60, 80] as const;

export function oxygenLevelsFromBaseline(baseline: number): number[] {
  const levels = new Set<number>(OXYGEN_LEVELS_DEFAULT);
  levels.add(Number(baseline.toFixed(1)));
  return Array.from(levels).sort((a, b) => a - b);
}

export function stepOxygenLevel(current: number, baseline: number, dir: "left" | "right"): number {
  const levels = oxygenLevelsFromBaseline(baseline);
  const idx = Math.max(0, levels.findIndex((v) => Math.abs(v - current) < 1e-9));
  const nextIdx = dir === "left" ? Math.max(0, idx - 1) : Math.min(levels.length - 1, idx + 1);
  return levels[nextIdx];
}

// Feeding-frequency stepper (fed-batch only). Order: most-frequent first.
export const FEEDING_FREQUENCY_ORDER: FeedingFrequency[] = [
  "continuous",
  "1_10min",
  "10_30min",
  "30plus_min",
];

export const FEEDING_FREQUENCY_LABELS: Record<FeedingFrequency, string> = {
  continuous:   "Continuous",
  "1_10min":    "Every 1–10 min",
  "10_30min":   "Every 10–30 min",
  "30plus_min": "> 30 min",
};

// ◀ = less frequent (longer interval, higher index in ORDER) — improves mixing
// ▶ = more frequent (shorter interval, lower index)
export function stepFeedFrequency(current: FeedingFrequency, dir: "left" | "right"): FeedingFrequency {
  const idx = FEEDING_FREQUENCY_ORDER.indexOf(current);
  const nextIdx = dir === "left"
    ? Math.min(FEEDING_FREQUENCY_ORDER.length - 1, idx + 1)
    : Math.max(0, idx - 1);
  return FEEDING_FREQUENCY_ORDER[nextIdx];
}
