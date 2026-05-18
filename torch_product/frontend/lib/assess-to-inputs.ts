// Converts the react-hook-form values from the assess wizard into the
// strictly-typed ProcessInputs the engine expects. Mirrors old/frontend's
// per-field mapping (old:732-766) — defensive numeric coercion, defaults
// from INPUT_DEFAULTS, omitted conditional fields, and OD→CDW conversion
// when the user entered biomass in OD₆₀₀ units.

import {
  INPUT_DEFAULTS,
  IMPELLER_CONSTANTS,
  getOdToCdwFactor,
  type ProcessInputs,
} from '@torch/core';
import type { AssessFormValues } from './assess-schema';

function num(v: unknown, fallback: number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const parsed = Number(v);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function intOr(v: unknown, fallback: number): number {
  const n = num(v, fallback);
  return Math.trunc(n);
}

export function toProcessInputs(form: AssessFormValues): ProcessInputs {
  const impellerType = form.impeller_type ?? INPUT_DEFAULTS.impeller_type;
  const impellerDefaults = IMPELLER_CONSTANTS[impellerType];

  const nImpellersLab = intOr(form.n_impellers, 1);

  // Target geometry: when "same as lab" is on, mirror lab; otherwise use
  // whatever the user picked (or the auto-synced value from the form).
  const hdLab = num(form.h_d_lab, INPUT_DEFAULTS.h_d_lab);
  const hdTarget = form.h_d_target_same_as_lab
    ? hdLab
    : num(form.h_d_target, hdLab);

  const dtLab = num(form.dt_ratio_lab, impellerDefaults.d_t_ratio);
  const dtTarget = form.dt_ratio_target_same_as_lab
    ? dtLab
    : num(form.dt_ratio_target, dtLab);

  const nTarget = form.n_impellers_target_same_as_lab
    ? nImpellersLab
    : intOr(form.n_impellers_target, nImpellersLab);

  // OD → CDW conversion. The form stores the raw entered value in
  // biomass_cdw_g_l regardless of the input mode; we convert here so the
  // engine always sees grams-per-litre CDW.
  const rawBiomass = num(form.biomass_cdw_g_l, 0);
  const biomassCdw =
    form.biomass_input_mode === 'od'
      ? rawBiomass * getOdToCdwFactor(form.organism_species)
      : rawBiomass;

  return {
    organism_class: form.organism_class,
    organism_species: form.organism_species,

    v_lab: num(form.v_lab, 0),
    v_target: num(form.v_target, 0),
    scaleup_criterion: form.scaleup_criterion,

    h_d_lab: hdLab,
    h_d_target: hdTarget,
    dt_ratio_lab: dtLab,
    dt_ratio_target: dtTarget,
    n_impellers: nImpellersLab,
    n_impellers_target: nTarget,
    impeller_type: impellerType,
    rpm: num(form.rpm, 0),
    vvm: num(form.vvm, INPUT_DEFAULTS.vvm),

    biomass_cdw_g_l: biomassCdw,
    our_mode: form.our_mode,
    our_measured: form.our_mode === 'measured' ? num(form.our_measured, 0) : undefined,
    specific_growth_rate:
      form.our_mode === 'estimate_mu' ? num(form.specific_growth_rate, 0) : undefined,
    o2_inlet: num(form.o2_inlet, INPUT_DEFAULTS.o2_inlet),
    do_setpoint: num(form.do_setpoint, INPUT_DEFAULTS.do_setpoint),

    process_type: form.process_type,
    feeding_frequency:
      form.process_type === 'fed_batch' ? form.feeding_frequency : undefined,

    temperature: num(
      form.temperature,
      form.organism_class === 'yeast'
        ? INPUT_DEFAULTS.temperature_yeast
        : INPUT_DEFAULTS.temperature_bacteria,
    ),
    t_cw_inlet: num(form.t_cw_inlet, INPUT_DEFAULTS.t_cw_inlet),
    cooling_water_flowrate_lpm: INPUT_DEFAULTS.cooling_water_flowrate_lpm,
  };
}
