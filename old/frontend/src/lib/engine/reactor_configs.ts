// Scale-aware reactor operating configurations.

import type { ProcessInputs, VesselGeometry } from "@/lib/types";
import type {
  ScaleupCriterion,
  ScaleupCriteriaInput,
  ScaleupCriteriaResult,
} from "./scaleup/criteria";
import {
  deriveBiomassCdw,
  deriveGasVelocity,
  deriveOxygenSolubility,
  deriveViscosity,
  deriveVesselGeometry,
} from "./derivations";
import { buildOperatingPoint, computeKlaEnsemble } from "./oxygen/kla_achievable";
import { gassedPower } from "./correlations/gassed_power";
import {
  scaleUpByKla,
  scaleUpByPowerPerVolume,
  scaleUpByShear,
} from "./scaleup/criteria";
import type { GasVelocityResult, OxygenSolubilityResult } from "./derivations";

export interface ReactorScaleConfig {
  scale: "lab" | "target";
  volume_litres: number;
  geometry: VesselGeometry;
  n_impellers: number;
  rpm: number;
  vvm: number;
  power_w: number;
  pv_w_m3: number;
  kla_h: number;
  tip_speed_m_s: number;
  gas: GasVelocityResult;
  oxygen: OxygenSolubilityResult;
}

export interface ReactorScaleConfigOptions {
  method?: ScaleupCriterion;
}

export interface ReactorScaleConfigs {
  lab: ReactorScaleConfig;
  target: ReactorScaleConfig;
  scaleup: ScaleupCriteriaResult;
}

function buildScaleupInput(inputs: ProcessInputs): ScaleupCriteriaInput {
  const n_impellers_target = inputs.n_impellers_target ?? inputs.n_impellers;
  return {
    v_lab:          inputs.v_lab,
    v_target:       inputs.v_target,
    rpm_lab:        inputs.rpm,
    vvm_lab:        inputs.vvm,
    h_t_lab:        inputs.h_d_lab,
    d_t_lab:        inputs.dt_ratio_lab,
    h_t_target:     inputs.h_d_target,
    d_t_target:     inputs.dt_ratio_target,
    impeller_type:  inputs.impeller_type,
    n_impellers_lab:    inputs.n_impellers,
    n_impellers_target,
    mu:             deriveViscosity(inputs.temperature),
    biomass_cdw:    deriveBiomassCdw(inputs.biomass, inputs.biomass_unit, inputs.organism_species),
  };
}

function runScaleup(
  input: ScaleupCriteriaInput,
  method: ScaleupCriterion,
): ScaleupCriteriaResult {
  switch (method) {
    case "kla":
      return scaleUpByKla(input);
    case "shear":
      return scaleUpByShear(input);
    case "power_per_volume":
      return scaleUpByPowerPerVolume(input);
  }
}

function buildScaleConfig(params: {
  scale: "lab" | "target";
  volume_litres: number;
  geometry: VesselGeometry;
  n_impellers: number;
  rpm: number;
  vvm: number;
  power_w: number;
  pv_w_m3: number;
  kla_h: number;
  tip_speed_m_s: number;
  inputs: ProcessInputs;
}): ReactorScaleConfig {
  const gas = deriveGasVelocity(
    params.vvm,
    params.volume_litres,
    params.geometry.a_cross,
  );
  const oxygen = deriveOxygenSolubility(
    params.inputs.temperature,
    params.inputs.do_setpoint,
    params.geometry.h_liquid,
    params.inputs.o2_inlet ?? 20.9,
  );

  return {
    scale: params.scale,
    volume_litres: params.volume_litres,
    geometry: params.geometry,
    n_impellers: params.n_impellers,
    rpm: params.rpm,
    vvm: params.vvm,
    power_w: params.power_w,
    pv_w_m3: params.pv_w_m3,
    kla_h: params.kla_h,
    tip_speed_m_s: params.tip_speed_m_s,
    gas,
    oxygen,
  };
}

export function buildReactorScaleConfigs(
  inputs: ProcessInputs,
  options: ReactorScaleConfigOptions = {},
): ReactorScaleConfigs {
  const method = options.method ?? "power_per_volume";
  const scaleupInput = buildScaleupInput(inputs);
  const scaleup = runScaleup(scaleupInput, method);

  const labGeometry = deriveVesselGeometry(
    inputs.v_lab,
    inputs.h_d_lab,
    inputs.impeller_type,
    inputs.dt_ratio_lab,
  );
  const targetGeometry = deriveVesselGeometry(
    inputs.v_target,
    inputs.h_d_target,
    inputs.impeller_type,
    inputs.dt_ratio_target,
  );

  let targetRpm        = scaleup.target_rpm;
  let targetVvm        = scaleup.target_vvm;
  let targetPowerW     = scaleup.target_power_w;
  let targetPvWM3      = scaleup.target_pv_w_m3;
  let targetKlaH       = scaleup.target_kla_h;
  let targetTipSpeedMS = scaleup.target_tip_speed_m_s;

  if (inputs.target_rpm_override !== undefined) {
    // Fix target RPM (typically the baseline target RPM before a geometry
    // change). Recompute power, kLa and tip speed so they reflect the new
    // impeller diameter at that RPM rather than the criterion-equalised P/V.
    targetRpm = inputs.target_rpm_override;
    const mu          = deriveViscosity(inputs.temperature);
    const biomass_cdw = deriveBiomassCdw(inputs.biomass, inputs.biomass_unit, inputs.organism_species);
    const gas         = deriveGasVelocity(targetVvm, inputs.v_target, targetGeometry.a_cross);
    const op          = buildOperatingPoint({
      D_T:           targetGeometry.t_diameter,
      H_L:           targetGeometry.h_liquid,
      V_L:           targetGeometry.volume_m3,
      d_i:           targetGeometry.d_imp,
      impeller_type: inputs.impeller_type,
      n_imp:         inputs.n_impellers_target ?? inputs.n_impellers,
      N_rps:         targetRpm / 60,
      Q_gas:         gas.q_gas,
      v_s:           gas.vs,
      mu_L:          mu,
    });
    targetPowerW     = gassedPower(op);
    targetPvWM3      = targetPowerW / targetGeometry.volume_m3;
    const kla        = computeKlaEnsemble(op, targetPowerW, biomass_cdw);
    targetKlaH       = kla.mean;
    targetTipSpeedMS = Math.PI * (targetRpm / 60) * targetGeometry.d_imp;
  }

  return {
    lab: buildScaleConfig({
      scale: "lab",
      volume_litres: inputs.v_lab,
      geometry: labGeometry,
      n_impellers: inputs.n_impellers,
      rpm: inputs.rpm,
      vvm: inputs.vvm,
      power_w: scaleup.lab_power_w,
      pv_w_m3: scaleup.lab_pv_w_m3,
      kla_h: scaleup.lab_kla_h,
      tip_speed_m_s: scaleup.lab_tip_speed_m_s,
      inputs,
    }),
    target: buildScaleConfig({
      scale: "target",
      volume_litres: inputs.v_target,
      geometry: targetGeometry,
      n_impellers: inputs.n_impellers_target ?? inputs.n_impellers,
      rpm: targetRpm,
      vvm: targetVvm,
      power_w: targetPowerW,
      pv_w_m3: targetPvWM3,
      kla_h: targetKlaH,
      tip_speed_m_s: targetTipSpeedMS,
      inputs,
    }),
    scaleup,
  };
}
