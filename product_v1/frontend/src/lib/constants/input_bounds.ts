// Hard validation limits and soft advisory thresholds for all process inputs.
// Source: /docs/lemnisca_scaleup_app_dev_spec.md Section 4.
//
// PROCESS_INPUT_BOUNDS  — values outside these trigger a blocking form error.
// SOFT_WARNING_BOUNDS   — values outside these trigger an advisory warning only.
//
// Both are referenced by InputForm.tsx; keep all numeric decisions here, not in the form.

export const PROCESS_INPUT_BOUNDS = {
  v_lab: {
    max: 1000,          // L — lab vessels > 1000 L are outside supported range
  },
  h_d: {
    min: 0.5,
    max: 4.0,
  },
  dt_ratio: {
    min: 0.1,
    max: 0.8,
  },
  temperature: {
    min: 15,            // °C
    max: 55,            // °C
  },
  our_measured: {
    max: 500,           // mmol/L/h
  },
} as const;

export const SOFT_WARNING_BOUNDS = {
  scale_ratio_extreme:        10_000,  // v_target/v_lab — predictions carry very high uncertainty above this
  temperature_correlation: {
    min: 20,                           // °C — lower edge of validated C* and viscosity correlations
    max: 45,                           // °C — upper edge
  },
  h_d_mixing_uncertainty:     1.5,     // H/D — Ruszkowski correlation validated for H/D ≤ 1.5 only
  vvm_gassed_power: {
    min: 0.3,                          // VVM — lower edge of validated gassed power correction
    max: 2.0,                          // VVM — upper edge
  },
} as const;

// Scale-dependent H/D default suggestion used to pre-fill the target vessel geometry field.
export function inferHdFromVolume(volumeL: number): number {
  if (volumeL > 10_000) return 2.8;
  if (volumeL > 5_000)  return 2.5;
  if (volumeL > 1_000)  return 2.2;
  if (volumeL > 100)    return 1.8;
  return 1.2;
}
