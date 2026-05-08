// Pure operating-point scale-up utilities.

import type { ImpellerType, VesselGeometry } from "@/lib/types";
import {
  getScaleupOperatingRange,
  IMPELLER_CONSTANTS,
  RHO,
} from "@/lib/constants";
import { deriveGasVelocity, deriveVesselGeometry } from "../derivations";
import { buildOperatingPoint, computeKlaEnsemble } from "../oxygen/kla_achievable";

export type ScaleupCriterion = "power_per_volume" | "kla" | "shear";

export interface ScaleupCriteriaInput {
  v_lab: number;
  v_target: number;
  rpm_lab: number;
  vvm_lab: number;
  h_t_lab: number;
  d_t_lab: number;
  h_t_target: number;
  d_t_target: number;
  impeller_type: ImpellerType;
  n_impellers: number;
  mu: number;
  biomass_cdw: number;
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
  lab_tip_speed_m_s: number;
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
  tip_speed_m_s: number;
}

function calculatePowerAtRpm(
  rpm: number,
  geometry: VesselGeometry,
  impeller_type: ImpellerType,
  n_impellers: number,
): number {
  const impeller = IMPELLER_CONSTANTS[impeller_type];
  const n_rps = rpm / 60;
  const p_ungassed = impeller.np * RHO * n_rps ** 3 * geometry.d_imp ** 5;
  return n_impellers * impeller.pg_p_factor * p_ungassed;
}

function calculatePvAtRpm(
  rpm: number,
  geometry: VesselGeometry,
  impeller_type: ImpellerType,
  n_impellers: number,
): number {
  return calculatePowerAtRpm(rpm, geometry, impeller_type, n_impellers) / geometry.volume_m3;
}

function calculateRpmForPower(
  power_w: number,
  geometry: VesselGeometry,
  impeller_type: ImpellerType,
  n_impellers: number,
): number {
  const impeller = IMPELLER_CONSTANTS[impeller_type];
  const denominator =
    n_impellers * impeller.pg_p_factor * impeller.np * RHO * geometry.d_imp ** 5;
  if (denominator <= 0 || power_w <= 0) return 0;
  return Math.cbrt(power_w / denominator) * 60;
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
  biomass_cdw: number,
): OperatingPointMetrics {
  const power_w = calculatePowerAtRpm(rpm, geometry, impeller_type, n_impellers);
  const pv_w_m3 = calculatePvAtRpm(rpm, geometry, impeller_type, n_impellers);
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
  const kla = computeKlaEnsemble(op, power_w, biomass_cdw);

  return {
    rpm,
    vvm,
    power_w,
    pv_w_m3,
    kla_h: kla.mean,
    tip_speed_m_s: calculateTipSpeed(rpm, geometry.d_imp),
  };
}

function applyRpmAndPvMax(
  rpm: number,
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
    geometry,
    input.impeller_type,
    input.n_impellers,
  );
  if (pvAtRpm > max_pv_w_m3) {
    targetRpm = calculateRpmForPower(
      max_pv_w_m3 * geometry.volume_m3,
      geometry,
      input.impeller_type,
      input.n_impellers,
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
    lab_pv_w_m3: params.lab.pv_w_m3,
    lab_power_w: params.lab.power_w,
    lab_kla_h: params.lab.kla_h,
    lab_tip_speed_m_s: params.lab.tip_speed_m_s,
    target_scale_label: params.target_scale_label,
    clamped: params.flags.length > 0,
    flags: params.flags,
  };
}

function prepare(input: ScaleupCriteriaInput) {
  const labGeometry = deriveVesselGeometry(
    input.v_lab,
    input.h_t_lab,
    input.impeller_type,
    input.d_t_lab,
  );
  const targetGeometry = deriveVesselGeometry(
    input.v_target,
    input.h_t_target,
    input.impeller_type,
    input.d_t_target,
  );
  const lab = calculateMetrics(
    input.rpm_lab,
    input.vvm_lab,
    labGeometry,
    input.impeller_type,
    input.n_impellers,
    input.mu,
    input.biomass_cdw,
  );
  const limits = getScaleupOperatingRange(input.v_target);

  return { labGeometry, targetGeometry, lab, limits };
}

function solveRpmForKla(
  target_kla_h: number,
  vvm: number,
  geometry: VesselGeometry,
  impeller_type: ImpellerType,
  n_impellers: number,
  mu: number,
  biomass_cdw: number,
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
      biomass_cdw,
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
    input.n_impellers,
    input.mu,
    input.biomass_cdw,
  ).kla_h;

  while (hiKla < target_kla_h && hi < 100000) {
    hi *= 2;
    hiKla = calculateMetrics(
      hi,
      vvm,
      geometry,
      input.impeller_type,
      input.n_impellers,
      input.mu,
      input.biomass_cdw,
    ).kla_h;
  }

  return solveRpmForKla(
    target_kla_h,
    vvm,
    geometry,
    input.impeller_type,
    input.n_impellers,
    input.mu,
    input.biomass_cdw,
    hi,
  );
}

export function scaleUpByPowerPerVolume(input: ScaleupCriteriaInput): ScaleupCriteriaResult {
  const { targetGeometry, lab, limits } = prepare(input);
  const flags: string[] = [];

  const idealPower = lab.pv_w_m3 * targetGeometry.volume_m3;
  const idealRpm = calculateRpmForPower(
    idealPower,
    targetGeometry,
    input.impeller_type,
    input.n_impellers,
  );
  const ideal = calculateMetrics(
    idealRpm,
    input.vvm_lab,
    targetGeometry,
    input.impeller_type,
    input.n_impellers,
    input.mu,
    input.biomass_cdw,
  );

  let targetPv = lab.pv_w_m3;
  const pvClamp = clampToMax(targetPv, limits.max_pv_w_m3.max, "Target P/V");
  targetPv = pvClamp.value;
  if (pvClamp.flag) flags.push(pvClamp.flag);

  const targetRpmFromPv = calculateRpmForPower(
    targetPv * targetGeometry.volume_m3,
    targetGeometry,
    input.impeller_type,
    input.n_impellers,
  );
  const targetRpm = applyRpmAndPvMax(
    targetRpmFromPv,
    targetGeometry,
    input,
    limits.max_rpm.max,
    limits.max_pv_w_m3.max,
    flags,
  );

  let targetVvm = input.vvm_lab;
  const vvmClamp = clampToMax(targetVvm, limits.max_aeration_vvm.max, "Target aeration");
  targetVvm = vvmClamp.value;
  if (vvmClamp.flag) flags.push(vvmClamp.flag);

  const target = calculateMetrics(
    targetRpm,
    targetVvm,
    targetGeometry,
    input.impeller_type,
    input.n_impellers,
    input.mu,
    input.biomass_cdw,
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
    input.n_impellers,
    input.mu,
    input.biomass_cdw,
  );

  const targetRpm = applyRpmAndPvMax(
    idealRpm,
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
    input.n_impellers,
    input.mu,
    input.biomass_cdw,
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
    input.n_impellers,
    input.mu,
    input.biomass_cdw,
  );

  const targetRpm = applyRpmAndPvMax(
    idealRpm,
    targetGeometry,
    input,
    limits.max_rpm.max,
    limits.max_pv_w_m3.max,
    flags,
  );

  let targetVvm = input.vvm_lab;
  const vvmClamp = clampToMax(targetVvm, limits.max_aeration_vvm.max, "Target aeration");
  targetVvm = vvmClamp.value;
  if (vvmClamp.flag) flags.push(vvmClamp.flag);

  const target = calculateMetrics(
    targetRpm,
    targetVvm,
    targetGeometry,
    input.impeller_type,
    input.n_impellers,
    input.mu,
    input.biomass_cdw,
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
