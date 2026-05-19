import type { ProcessInputs, FeedingFrequency } from "../../types";
import { IMPELLER_CONSTANTS, getScaleupOperatingRange } from "../../constants";
import { buildReactorScaleConfigs } from "../reactor_configs";
import type { ModificationId, WhatIfParams } from "./types";

// Public catalog metadata (labels, domain mapping, conflict pairs, stepper
// helpers) lives in @torch/core-shared so the dashboard UI can consume it
// without pulling in any engine math. Re-exported here for the few engine
// callsites that already import from this module.
export {
  MODIFICATION_CATALOG,
  MODIFICATION_CONFLICTS,
  OXYGEN_LEVELS_DEFAULT,
  oxygenLevelsFromBaseline,
  stepOxygenLevel,
  stepFeedFrequency,
} from "@torch/core-shared";

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

// stepOxygenLevel and stepFeedFrequency now live in @torch/core-shared
// (re-exported above).
