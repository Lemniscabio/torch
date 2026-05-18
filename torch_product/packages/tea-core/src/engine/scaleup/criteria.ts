// Pure operating-point scale-up utilities.

import type { ImpellerType, ScaleupCriterion, VesselGeometry } from "../../types";
import { getScaleupOperatingRange } from "../../constants";
import { deriveGasVelocity } from "../derivations";
import { buildOperatingPoint, computeKlaEnsemble } from "../oxygen/kla_achievable";
import type { KlaEnsembleResult } from "../oxygen/kla_achievable";
import { gassedPower } from "../correlations/gassed_power";

export type { ScaleupCriterion } from "../../types";

export interface ScaleupCriteriaInput {
  v_lab: number;
  v_target: number;
  rpm_lab: number;
  vvm_lab: number;
  impeller_type: ImpellerType;
  n_impellers_lab: number;
  n_impellers_target: number;
  mu: number;
  is_high_density: boolean;
  lab_geometry: VesselGeometry;
  target_geometry: VesselGeometry;
}

export interface ScaleupCriteriaResult {
  criterion: ScaleupCriterion;
  target_rpm: number;
  target_vvm: number;
  target_pv_w_m3: number;
  target_power_w: number;
  target_kla_h: number;
  target_tip_speed_m_s: number;
  ideal_target_rpm: number;
  ideal_target_vvm: number;
  ideal_target_pv_w_m3: number;
  ideal_target_power_w: number;
  ideal_target_kla_h: number;
  ideal_target_tip_speed_m_s: number;
  lab_pv_w_m3: number;
  lab_power_w: number;
  lab_kla_h: number;
  lab_kla_ensemble: KlaEnsembleResult;
  lab_tip_speed_m_s: number;
  target_kla_ensemble: KlaEnsembleResult;
  target_scale_label: string;
  clamped: boolean;
  flags: string[];
}

interface OperatingPointMetrics {
  rpm: number;
  vvm: number;
  power_w: number;
  pv_w_m3: number;
  kla_h: number;
  kla_ensemble: KlaEnsembleResult;
  tip_speed_m_s: number;
}

function calculatePowerAtRpm(
  rpm: number,
  vvm: number,
  geometry: VesselGeometry,
  impeller_type: ImpellerType,
  n_impellers: number,
  mu: number,
): number {
  const gas = deriveGasVelocity(vvm, geometry.volume_m3 * 1000, geometry.a_cross);
  const op = buildOperatingPoint({
    D_T: geometry.t_diameter,
    H_L: geometry.h_liquid,
    V_L: geometry.volume_m3,
    d_i: geometry.d_imp,
    impeller_type,
    n_imp: n_impellers,
    N_rps: rpm / 60,
    Q_gas: gas.q_gas,
    v_s: gas.vs,
    mu_L: mu,
  });
  return gassedPower(op);
}

function calculatePvAtRpm(
  rpm: number,
  vvm: number,
  geometry: VesselGeometry,
  impeller_type: ImpellerType,
  n_impellers: number,
  mu: number,
): number {
  return calculatePowerAtRpm(rpm, vvm, geometry, impeller_type, n_impellers, mu) / geometry.volume_m3;
}

function solveRpmForPower(
  target_power_w: number,
  vvm: number,
  geometry: VesselGeometry,
  impeller_type: ImpellerType,
  n_impellers: number,
  mu: number,
): number {
  if (target_power_w <= 0 || geometry.volume_m3 <= 0) return 0;

  let lo = 0;
  let hi = 1;
  while (
    calculatePowerAtRpm(hi, vvm, geometry, impeller_type, n_impellers, mu) < target_power_w &&
    hi < 100000
  ) {
    hi *= 2;
  }

  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    const power = calculatePowerAtRpm(mid, vvm, geometry, impeller_type, n_impellers, mu);
    if (power < target_power_w) lo = mid;
    else hi = mid;
  }

  return hi;
}

function calculateTipSpeed(rpm: number, d_imp: number): number {
  return Math.PI * (rpm / 60) * d_imp;
}

function clampToMax(value: number, max: number, label: string): { value: number; flag?: string } {
  if (value <= max) return { value };
  return {
    value: max,
    flag: `${label} clamped to ${max.toPrecision(4)}; selected scale-up criterion not fully matched.`,
  };
}

function calculateMetrics(
  rpm: number,
  vvm: number,
  geometry: VesselGeometry,
  impeller_type: ImpellerType,
  n_impellers: number,
  mu: number,
  is_high_density: boolean,
): OperatingPointMetrics {
  const gas = deriveGasVelocity(vvm, geometry.volume_m3 * 1000, geometry.a_cross);
  const op = buildOperatingPoint({
    D_T: geometry.t_diameter,
    H_L: geometry.h_liquid,
    V_L: geometry.volume_m3,
    d_i: geometry.d_imp,
    impeller_type,
    n_imp: n_impellers,
    N_rps: rpm / 60,
    Q_gas: gas.q_gas,
    v_s: gas.vs,
    mu_L: mu,
  });
  const power_w    = gassedPower(op);
  const pv_w_m3    = power_w / geometry.volume_m3;
  const kla        = computeKlaEnsemble(op, power_w, is_high_density);

  return {
    rpm,
    vvm,
    power_w,
    pv_w_m3,
    kla_h:        kla.mean,
    kla_ensemble: kla,
    tip_speed_m_s: calculateTipSpeed(rpm, geometry.d_imp),
  };
}

function applyRpmAndPvMax(
  rpm: number,
  vvm: number,
  geometry: VesselGeometry,
  input: ScaleupCriteriaInput,
  max_rpm: number,
  max_pv_w_m3: number,
  flags: string[],
): number {
  let targetRpm = rpm;
  const rpmClamp = clampToMax(targetRpm, max_rpm, "Target RPM");
  targetRpm = rpmClamp.value;
  if (rpmClamp.flag) flags.push(rpmClamp.flag);

  const pvAtRpm = calculatePvAtRpm(
    targetRpm,
    vvm,
    geometry,
    input.impeller_type,
    input.n_impellers_target,
    input.mu,
  );
  if (pvAtRpm > max_pv_w_m3) {
    targetRpm = solveRpmForPower(
      max_pv_w_m3 * geometry.volume_m3,
      vvm,
      geometry,
      input.impeller_type,
      input.n_impellers_target,
      input.mu,
    );
    flags.push(
      `Target P/V clamped to ${max_pv_w_m3.toPrecision(4)} W/m3; selected scale-up criterion not fully matched.`,
    );
  }

  return targetRpm;
}

function buildResult(params: {
  criterion: ScaleupCriterion;
  lab: OperatingPointMetrics;
  ideal: OperatingPointMetrics;
  target: OperatingPointMetrics;
  target_scale_label: string;
  flags: string[];
}): ScaleupCriteriaResult {
  return {
    criterion: params.criterion,
    target_rpm: params.target.rpm,
    target_vvm: params.target.vvm,
    target_pv_w_m3: params.target.pv_w_m3,
    target_power_w: params.target.power_w,
    target_kla_h: params.target.kla_h,
    target_tip_speed_m_s: params.target.tip_speed_m_s,
    ideal_target_rpm: params.ideal.rpm,
    ideal_target_vvm: params.ideal.vvm,
    ideal_target_pv_w_m3: params.ideal.pv_w_m3,
    ideal_target_power_w: params.ideal.power_w,
    ideal_target_kla_h: params.ideal.kla_h,
    ideal_target_tip_speed_m_s: params.ideal.tip_speed_m_s,
    lab_pv_w_m3:        params.lab.pv_w_m3,
    lab_power_w:        params.lab.power_w,
    lab_kla_h:          params.lab.kla_h,
    lab_kla_ensemble:   params.lab.kla_ensemble,
    lab_tip_speed_m_s:  params.lab.tip_speed_m_s,
    target_kla_ensemble: params.target.kla_ensemble,
    target_scale_label: params.target_scale_label,
    clamped: params.flags.length > 0,
    flags: params.flags,
  };
}

function prepare(input: ScaleupCriteriaInput) {
  const lab = calculateMetrics(
    input.rpm_lab,
    input.vvm_lab,
    input.lab_geometry,
    input.impeller_type,
    input.n_impellers_lab,
    input.mu,
    input.is_high_density,
  );
  const limits = getScaleupOperatingRange(input.v_target);

  return { labGeometry: input.lab_geometry, targetGeometry: input.target_geometry, lab, limits };
}

function solveRpmForKla(
  target_kla_h: number,
  vvm: number,
  geometry: VesselGeometry,
  impeller_type: ImpellerType,
  n_impellers: number,
  mu: number,
  is_high_density: boolean,
  upper_rpm: number,
): number {
  let lo = 0;
  let hi = upper_rpm;

  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    const kla = calculateMetrics(
      mid,
      vvm,
      geometry,
      impeller_type,
      n_impellers,
      mu,
      is_high_density,
    ).kla_h;
    if (kla < target_kla_h) lo = mid;
    else hi = mid;
  }

  return hi;
}

function findIdealRpmForKla(
  target_kla_h: number,
  vvm: number,
  geometry: VesselGeometry,
  input: ScaleupCriteriaInput,
  max_rpm: number,
): number {
  let hi = Math.max(max_rpm, 1);
  let hiKla = calculateMetrics(
    hi,
    vvm,
    geometry,
    input.impeller_type,
    input.n_impellers_target,
    input.mu,
    input.is_high_density,
  ).kla_h;

  while (hiKla < target_kla_h && hi < 100000) {
    hi *= 2;
    hiKla = calculateMetrics(
      hi,
      vvm,
      geometry,
      input.impeller_type,
      input.n_impellers_target,
      input.mu,
      input.is_high_density,
    ).kla_h;
  }

  return solveRpmForKla(
    target_kla_h,
    vvm,
    geometry,
    input.impeller_type,
    input.n_impellers_target,
    input.mu,
    input.is_high_density,
    hi,
  );
}

export function scaleUpByPowerPerVolume(input: ScaleupCriteriaInput): ScaleupCriteriaResult {
  const { targetGeometry, lab, limits } = prepare(input);
  const flags: string[] = [];

  const idealPower = lab.pv_w_m3 * targetGeometry.volume_m3;
  const idealRpm = solveRpmForPower(
    idealPower,
    input.vvm_lab,
    targetGeometry,
    input.impeller_type,
    input.n_impellers_target,
    input.mu,
  );
  const ideal = calculateMetrics(
    idealRpm,
    input.vvm_lab,
    targetGeometry,
    input.impeller_type,
    input.n_impellers_target,
    input.mu,
    input.is_high_density,
  );

  let targetPv = lab.pv_w_m3;
  const pvClamp = clampToMax(targetPv, limits.max_pv_w_m3.max, "Target P/V");
  targetPv = pvClamp.value;
  if (pvClamp.flag) flags.push(pvClamp.flag);

  let targetVvm = input.vvm_lab;
  const vvmClamp = clampToMax(targetVvm, limits.max_aeration_vvm.max, "Target aeration");
  targetVvm = vvmClamp.value;
  if (vvmClamp.flag) flags.push(vvmClamp.flag);

  const targetRpmFromPv = solveRpmForPower(
    targetPv * targetGeometry.volume_m3,
    targetVvm,
    targetGeometry,
    input.impeller_type,
    input.n_impellers_target,
    input.mu,
  );
  const targetRpm = applyRpmAndPvMax(
    targetRpmFromPv,
    targetVvm,
    targetGeometry,
    input,
    limits.max_rpm.max,
    limits.max_pv_w_m3.max,
    flags,
  );

  const target = calculateMetrics(
    targetRpm,
    targetVvm,
    targetGeometry,
    input.impeller_type,
    input.n_impellers_target,
    input.mu,
    input.is_high_density,
  );

  return buildResult({
    criterion: "power_per_volume",
    lab,
    ideal,
    target,
    target_scale_label: limits.scale_label,
    flags,
  });
}

export function scaleUpByKla(input: ScaleupCriteriaInput): ScaleupCriteriaResult {
  const { targetGeometry, lab, limits } = prepare(input);
  const flags: string[] = [];
  const targetVvm = limits.max_aeration_vvm.max;

  const idealRpm = findIdealRpmForKla(
    lab.kla_h,
    targetVvm,
    targetGeometry,
    input,
    limits.max_rpm.max,
  );
  const ideal = calculateMetrics(
    idealRpm,
    targetVvm,
    targetGeometry,
    input.impeller_type,
    input.n_impellers_target,
    input.mu,
    input.is_high_density,
  );

  const targetRpm = applyRpmAndPvMax(
    idealRpm,
    targetVvm,
    targetGeometry,
    input,
    limits.max_rpm.max,
    limits.max_pv_w_m3.max,
    flags,
  );

  const target = calculateMetrics(
    targetRpm,
    targetVvm,
    targetGeometry,
    input.impeller_type,
    input.n_impellers_target,
    input.mu,
    input.is_high_density,
  );

  return buildResult({
    criterion: "kla",
    lab,
    ideal,
    target,
    target_scale_label: limits.scale_label,
    flags,
  });
}

export function scaleUpByShear(input: ScaleupCriteriaInput): ScaleupCriteriaResult {
  const { targetGeometry, lab, limits } = prepare(input);
  const flags: string[] = [];

  const idealRpm = targetGeometry.d_imp > 0
    ? (lab.tip_speed_m_s / (Math.PI * targetGeometry.d_imp)) * 60
    : 0;
  const ideal = calculateMetrics(
    idealRpm,
    input.vvm_lab,
    targetGeometry,
    input.impeller_type,
    input.n_impellers_target,
    input.mu,
    input.is_high_density,
  );

  let targetVvm = input.vvm_lab;
  const vvmClamp = clampToMax(targetVvm, limits.max_aeration_vvm.max, "Target aeration");
  targetVvm = vvmClamp.value;
  if (vvmClamp.flag) flags.push(vvmClamp.flag);

  const targetRpm = applyRpmAndPvMax(
    idealRpm,
    targetVvm,
    targetGeometry,
    input,
    limits.max_rpm.max,
    limits.max_pv_w_m3.max,
    flags,
  );

  const target = calculateMetrics(
    targetRpm,
    targetVvm,
    targetGeometry,
    input.impeller_type,
    input.n_impellers_target,
    input.mu,
    input.is_high_density,
  );

  return buildResult({
    criterion: "shear",
    lab,
    ideal,
    target,
    target_scale_label: limits.scale_label,
    flags,
  });
}
