// Frontend-side helpers for the what-if UI.
// The "real" canApplyModification lives in @torch/core (it needs the
// reactor-config builder), but for UI dimming we use a cheap heuristic:
// check the easy at-limit conditions from inputs + the scale envelope.

import type {
  ProcessInputs,
  ReactorScaleConfigs,
} from '@torch/core-shared';
import {
  IMPELLER_CONSTANTS,
  getScaleupOperatingRange,
  type ModificationId,
} from '@torch/core-shared';

// A short "current → target" hint for a modification button. Returns
// undefined if there's nothing meaningful to show (e.g. add cooling coils
// is a yes/no toggle without a numeric target).
export function modificationHint(
  id: ModificationId,
  inputs: ProcessInputs,
  reactorConfigs: ReactorScaleConfigs | undefined,
): string | undefined {
  const limits = getScaleupOperatingRange(inputs.v_target);
  const dt =
    inputs.dt_ratio_target ?? IMPELLER_CONSTANTS[inputs.impeller_type]?.d_t_ratio ?? 0.33;
  const targetRpm = reactorConfigs?.target.rpm;

  const fmt = (n: number, digits = 0) => n.toFixed(digits);

  switch (id) {
    case 'increase_impeller_rpm':
      if (targetRpm === undefined) return `up to ${fmt(limits.max_rpm.max)} rpm`;
      return `${fmt(targetRpm)} → ${fmt(limits.max_rpm.max)} rpm`;
    case 'decrease_impeller_rpm': {
      if (targetRpm === undefined) return `down to ${fmt(limits.max_rpm.min)} rpm`;
      const next = Math.max(targetRpm - 50, limits.max_rpm.min);
      return `${fmt(targetRpm)} → ${fmt(next)} rpm`;
    }
    case 'increase_aeration_rate':
      return `${fmt(inputs.vvm, 2)} → ${fmt(limits.max_aeration_vvm.max, 2)} vvm`;
    case 'increase_oxygen_saturation':
      return undefined; // handled by the Inlet O₂ stepper
    case 'increase_impeller_diameter': {
      const next = Math.min(dt + 0.1, 0.8);
      return `D/T ${fmt(dt, 2)} → ${fmt(next, 2)}`;
    }
    case 'decrease_impeller_diameter': {
      const next = Math.max(dt - 0.1, 0.1);
      return `D/T ${fmt(dt, 2)} → ${fmt(next, 2)}`;
    }
    case 'switch_to_rushton_impeller':
      return inputs.impeller_type === 'rushton'
        ? 'already Rushton'
        : `${inputs.impeller_type} → rushton`;
    case 'switch_to_pitched_blade_impeller':
      return inputs.impeller_type === 'pitched_blade'
        ? 'already pitched blade'
        : `${inputs.impeller_type} → pitched blade`;
    case 'add_internal_cooling_coils':
      return 'cooling capacity ×1.5';
    case 'reduce_feeding_frequency':
      return undefined; // handled by the Feeding frequency stepper
  }
}

export function canApplyModificationHeuristic(
  id: ModificationId,
  inputs: ProcessInputs,
  reactorConfigs: ReactorScaleConfigs | undefined,
): boolean {
  const limits = getScaleupOperatingRange(inputs.v_target);
  const dt =
    inputs.dt_ratio_target ?? IMPELLER_CONSTANTS[inputs.impeller_type]?.d_t_ratio ?? 0.33;
  const targetRpm = reactorConfigs?.target.rpm;

  switch (id) {
    case 'increase_impeller_rpm':
      return targetRpm === undefined || targetRpm < limits.max_rpm.max - 1e-6;
    case 'decrease_impeller_rpm':
      return targetRpm === undefined || targetRpm > limits.max_rpm.min + 1e-6;
    case 'increase_aeration_rate':
      return inputs.vvm < limits.max_aeration_vvm.max - 1e-6;
    case 'increase_oxygen_saturation':
      // Stepper — drive via params.oxygen_level. Always interactive.
      return true;
    case 'increase_impeller_diameter':
      return dt < 0.8 - 1e-6;
    case 'decrease_impeller_diameter':
      return dt > 0.1 + 1e-6;
    case 'switch_to_rushton_impeller':
      return inputs.impeller_type !== 'rushton';
    case 'switch_to_pitched_blade_impeller':
      return inputs.impeller_type === 'marine' || inputs.impeller_type === 'unknown';
    case 'add_internal_cooling_coils':
      return true;
    case 'reduce_feeding_frequency':
      // Stepper — drive via params.feed_frequency. Only meaningful on fed-batch.
      return inputs.process_type === 'fed_batch';
  }
}

// Build a human-readable diff between the original inputs and the engine's
// modified_inputs. Returns only fields that changed; order is stable.
export function describeModificationDiff(
  original: ProcessInputs,
  modified: ProcessInputs,
): { label: string; from: string; to: string }[] {
  const out: { label: string; from: string; to: string }[] = [];
  const fmtNum = (n: number | undefined, digits = 2) =>
    n === undefined || !Number.isFinite(n) ? '—' : n.toFixed(digits);

  // Operating-point fields
  if (Math.abs((original.rpm ?? 0) - (modified.rpm ?? 0)) > 1e-6) {
    out.push({ label: 'Agitation', from: `${fmtNum(original.rpm, 0)} rpm`, to: `${fmtNum(modified.rpm, 0)} rpm` });
  }
  if (
    original.target_rpm_override !== modified.target_rpm_override &&
    modified.target_rpm_override !== undefined
  ) {
    out.push({
      label: 'Target RPM pin',
      from: original.target_rpm_override === undefined ? '—' : `${fmtNum(original.target_rpm_override, 0)} rpm`,
      to: `${fmtNum(modified.target_rpm_override, 0)} rpm`,
    });
  }
  if (Math.abs((original.vvm ?? 0) - (modified.vvm ?? 0)) > 1e-6) {
    out.push({ label: 'Aeration', from: `${fmtNum(original.vvm, 2)} vvm`, to: `${fmtNum(modified.vvm, 2)} vvm` });
  }
  if (Math.abs((original.o2_inlet ?? 0) - (modified.o2_inlet ?? 0)) > 1e-6) {
    out.push({ label: 'Inlet O₂', from: `${fmtNum(original.o2_inlet, 1)}%`, to: `${fmtNum(modified.o2_inlet, 1)}%` });
  }
  if (
    Math.abs((original.dt_ratio_target ?? 0) - (modified.dt_ratio_target ?? 0)) > 1e-6
  ) {
    out.push({
      label: 'Impeller D/T (target)',
      from: fmtNum(original.dt_ratio_target, 2),
      to: fmtNum(modified.dt_ratio_target, 2),
    });
  }
  if (original.impeller_type !== modified.impeller_type) {
    out.push({ label: 'Impeller type', from: original.impeller_type, to: modified.impeller_type });
  }
  if (
    original.process_type === 'fed_batch' &&
    original.feeding_frequency !== modified.feeding_frequency &&
    modified.feeding_frequency !== undefined
  ) {
    out.push({
      label: 'Feeding frequency',
      from: original.feeding_frequency ?? '—',
      to: modified.feeding_frequency,
    });
  }
  return out;
}
