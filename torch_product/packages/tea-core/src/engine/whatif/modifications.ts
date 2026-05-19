import type { ProcessInputs, FeedingFrequency } from "../../types";
import { IMPELLER_CONSTANTS, getScaleupOperatingRange, FEEDING_FREQUENCY_ORDER } from "../../constants";
import { buildReactorScaleConfigs } from "../reactor_configs";
import type { ModificationId, ModificationDefinition, WhatIfParams } from "./types";

export const OXYGEN_LEVELS_DEFAULT = [20.9, 40, 60, 80] as const;

export function oxygenLevelsFromBaseline(baseline: number): number[] {
  const levels = new Set<number>(OXYGEN_LEVELS_DEFAULT);
  levels.add(Number(baseline.toFixed(1)));
  return Array.from(levels).sort((a, b) => a - b);
}

export const MODIFICATION_CATALOG: ModificationDefinition[] = [
  { id: "increase_impeller_rpm",           label: "Increase impeller RPM",              domains: ["otr", "mixing", "co2", "heat"], section: "operational" },
  { id: "decrease_impeller_rpm",           label: "Decrease impeller RPM",              domains: ["shear"],                        section: "operational" },
  { id: "increase_aeration_rate",          label: "Increase aeration rate",             domains: ["otr", "co2", "heat"],           section: "operational" },
  { id: "increase_oxygen_saturation",      label: "Increase oxygen saturation",         domains: ["otr"],                          section: "operational" },
  { id: "increase_impeller_diameter",      label: "Increase impeller diameter",         domains: ["otr", "mixing", "co2"],         section: "design" },
  { id: "decrease_impeller_diameter",      label: "Decrease impeller diameter",         domains: ["shear"],                        section: "design" },
  { id: "switch_to_rushton_impeller",      label: "Switch to Rushton impeller",         domains: ["otr", "mixing", "co2", "heat"], section: "design" },
  { id: "switch_to_pitched_blade_impeller", label: "Switch to pitched blade impeller", domains: ["shear"],                        section: "design" },
  { id: "add_internal_cooling_coils",      label: "Add internal cooling coils",         domains: ["heat"],                         section: "design" },
  { id: "reduce_feeding_frequency",        label: "Reduce feeding frequency",           domains: ["mixing"],                       section: "operational" },
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

export function applyModifications(inputs: ProcessInputs, params: WhatIfParams): ProcessInputs {
  const { active, oxygen_level, feed_frequency } = params;
  const limits = getScaleupOperatingRange(inputs.v_target);
  const out: ProcessInputs = { ...inputs };

  let dtTarget = out.dt_ratio_target ?? IMPELLER_CONSTANTS[out.impeller_type].d_t_ratio;

  if (active.has("switch_to_rushton_impeller"))       out.impeller_type = "rushton";
  if (active.has("switch_to_pitched_blade_impeller")) out.impeller_type = "pitched_blade";
  if (active.has("increase_impeller_rpm"))            out.target_rpm_override = limits.max_rpm.max;
  if (active.has("increase_aeration_rate"))           out.vvm = limits.max_aeration_vvm.max;
  if (oxygen_level != null)                           out.o2_inlet = oxygen_level;
  if (feed_frequency != null && inputs.process_type === "fed_batch") {
    out.feeding_frequency = feed_frequency;
  }

  if (active.has("increase_impeller_diameter")) {
    dtTarget = Math.min(dtTarget + 0.1, 0.8);
    // Pin target RPM so the larger impeller at the same speed produces higher kLa
    // rather than having the criterion solver reduce RPM to match original P/V.
    const baselineTargetRpm = buildReactorScaleConfigs(inputs, {
      method: inputs.scaleup_criterion ?? "power_per_volume",
    }).target.rpm;
    out.target_rpm_override = baselineTargetRpm;
  }

  if (active.has("decrease_impeller_diameter")) {
    dtTarget = Math.max(dtTarget - 0.1, 0.1);
  }

  out.dt_ratio_target = dtTarget;

  if (active.has("decrease_impeller_rpm")) {
    const method = out.scaleup_criterion ?? "power_per_volume";
    const currentTargetRpm = buildReactorScaleConfigs(out, { method }).target.rpm;
    out.target_rpm_override = Math.max(currentTargetRpm - 50, limits.max_rpm.min);
  }

  return out;
}

export function canApplyModification(
  id: ModificationId,
  inputs: ProcessInputs,
  params: WhatIfParams,
): boolean {
  const current = applyModifications(inputs, params);
  const limits = getScaleupOperatingRange(inputs.v_target);
  const dt = current.dt_ratio_target ?? IMPELLER_CONSTANTS[current.impeller_type].d_t_ratio;
  const method = current.scaleup_criterion ?? "power_per_volume";

  switch (id) {
    case "increase_impeller_rpm":
      return buildReactorScaleConfigs(current, { method }).target.rpm < limits.max_rpm.max;
    case "decrease_impeller_rpm":
      return buildReactorScaleConfigs(current, { method }).target.rpm > limits.max_rpm.min + 1e-6;
    case "increase_aeration_rate":
      return current.vvm < limits.max_aeration_vvm.max;
    case "increase_oxygen_saturation":
      return true;
    case "increase_impeller_diameter":
      return dt < 0.8;
    case "decrease_impeller_diameter":
      return dt > 0.1;
    case "switch_to_rushton_impeller":
      return current.impeller_type !== "rushton";
    case "switch_to_pitched_blade_impeller":
      return current.impeller_type === "marine" || current.impeller_type === "unknown";
    case "add_internal_cooling_coils":
      return true;
    case "reduce_feeding_frequency":
      return true;
  }
}

export function stepOxygenLevel(current: number, baseline: number, dir: "left" | "right"): number {
  const levels = oxygenLevelsFromBaseline(baseline);
  const idx = Math.max(0, levels.findIndex((v) => Math.abs(v - current) < 1e-9));
  const nextIdx = dir === "left"
    ? Math.max(0, idx - 1)
    : Math.min(levels.length - 1, idx + 1);
  return levels[nextIdx];
}

// ◀ = less frequent (longer interval, higher index in ORDER) — improves mixing score
// ▶ = more frequent (shorter interval, lower index)
export function stepFeedFrequency(current: FeedingFrequency, dir: "left" | "right"): FeedingFrequency {
  const idx = FEEDING_FREQUENCY_ORDER.indexOf(current);
  const nextIdx = dir === "left"
    ? Math.min(FEEDING_FREQUENCY_ORDER.length - 1, idx + 1)
    : Math.max(0, idx - 1);
  return FEEDING_FREQUENCY_ORDER[nextIdx];
}
