// Oxygen-supported growth capacity vs substrate-implied growth demand.

import type {
  AssessmentFlag,
  Confidence,
  GrowthOxygenRiskResult,
  GrowthOxygenScaleRiskResult,
  ProcessInputs,
  RiskScore,
} from "@/lib/types";
import {
  BATCH_DEFAULTS,
  FED_BATCH_DEFAULTS,
  FED_BATCH_FINAL_FILL_PCT,
  KINETIC_PARAMS,
  MU_RATIO_THRESHOLDS,
  STANDARD_GLUCOSE_FEED_CONC,
} from "@/lib/constants";
import type { ReactorScaleConfig, ReactorScaleConfigs } from "../reactor_configs";
import { deriveBiomassCdw } from "../derivations";
import { runBatchGrowth, runFedBatchGrowth } from "../growth";

const SCORE_ORDER: Record<RiskScore, number> = {
  low: 0,
  moderate: 1,
  high: 2,
  critical: 3,
};

export function scoreMuRatio(ratio: number): RiskScore {
  if (ratio >= MU_RATIO_THRESHOLDS.low) return "low";
  if (ratio >= MU_RATIO_THRESHOLDS.moderate) return "moderate";
  if (ratio >= MU_RATIO_THRESHOLDS.high) return "high";
  return "critical";
}

function worstScore(...scores: RiskScore[]): RiskScore {
  return scores.reduce((a, b) => SCORE_ORDER[a] >= SCORE_ORDER[b] ? a : b);
}

function growthConfidence(inputs: ProcessInputs): { confidence: Confidence; driver: string } {
  if (inputs.process_type === "fed_batch") {
    return {
      confidence: "directional",
      driver: "Fed-batch substrate demand uses default feed concentration until feed concentration is collected.",
    };
  }
  return {
    confidence: "reliable",
    driver: "Batch oxygen and substrate growth limits use organism kinetic defaults and batch initial conditions.",
  };
}

function muRatio(mu_o2: number, mu_substrate: number): number {
  if (mu_substrate <= 0) return mu_o2 > 0 ? Infinity : 0;
  return mu_o2 / mu_substrate;
}

function effectiveCStar(scale: ReactorScaleConfig): number {
  return scale.oxygen.c_l + scale.oxygen.driving_force_lm;
}

function calculateBatchScaleRisk(
  inputs: ProcessInputs,
  scale: ReactorScaleConfig,
  confidence: Confidence,
  driver: string,
): GrowthOxygenScaleRiskResult {
  const kinetics = KINETIC_PARAMS[inputs.organism_species];
  const batch = runBatchGrowth({
    mu_max:    kinetics.mu_max,
    K_s:       kinetics.Ks,
    yield_x_s: kinetics.Y_X_S,
    yield_o2:  kinetics.Y_O2,
    X_0:       inputs.batch_config?.x0_g_L ?? BATCH_DEFAULTS.x0_g_L,
    S_0:       inputs.batch_config?.s0_g_L ?? BATCH_DEFAULTS.s0_g_L,
    kla_h:     scale.kla_h,
    c_star:    effectiveCStar(scale),
    c_l:       scale.oxygen.c_l,
  });
  const mu_substrate = batch.substrate.mu_s_batch;
  const ratio = muRatio(batch.oxygen.mu_o2, mu_substrate);

  return {
    score: scoreMuRatio(ratio),
    mu_o2: batch.oxygen.mu_o2,
    mu_substrate,
    mu_ratio: ratio,
    limiting: batch.limiting,
    confidence,
    driver,
    batch,
  };
}

function calculateFedBatchScaleRisk(
  inputs: ProcessInputs,
  scale: ReactorScaleConfig,
  confidence: Confidence,
  driver: string,
): GrowthOxygenScaleRiskResult {
  const kinetics = KINETIC_PARAMS[inputs.organism_species];
  const biomassCdw = deriveBiomassCdw(
    inputs.biomass,
    inputs.biomass_unit,
    inputs.organism_species,
  );
  const currentVolumeLitres = scale.volume_litres * (FED_BATCH_FINAL_FILL_PCT / 100);
  const fedBatch = runFedBatchGrowth({
    v_working_litres:   scale.volume_litres,
    initial_fill_pct:   inputs.fed_batch_config?.initial_fill_pct ?? FED_BATCH_DEFAULTS.initial_fill_pct,
    batch_time_h:       inputs.fed_batch_config?.batch_time_h ?? FED_BATCH_DEFAULTS.batch_time_h,
    feed_substrate_g_L: STANDARD_GLUCOSE_FEED_CONC,
    yield_x_s:          kinetics.Y_X_S,
    yield_o2:           kinetics.Y_O2,
    biomass_cdw:        biomassCdw,
    volume_litres:      currentVolumeLitres,
    kla_h:              scale.kla_h,
    c_star:             effectiveCStar(scale),
    c_l:                scale.oxygen.c_l,
  });
  const mu_substrate = fedBatch.substrate.mu_s;
  const ratio = muRatio(fedBatch.oxygen.mu_o2, mu_substrate);

  return {
    score: scoreMuRatio(ratio),
    mu_o2: fedBatch.oxygen.mu_o2,
    mu_substrate,
    mu_ratio: ratio,
    limiting: fedBatch.limiting,
    confidence,
    driver,
    fed_batch: fedBatch,
  };
}

function calculateScaleRisk(
  inputs: ProcessInputs,
  scale: ReactorScaleConfig,
  confidence: Confidence,
  driver: string,
): GrowthOxygenScaleRiskResult {
  if (inputs.process_type === "fed_batch") {
    return calculateFedBatchScaleRisk(inputs, scale, confidence, driver);
  }
  return calculateBatchScaleRisk(inputs, scale, confidence, driver);
}

export function calculateGrowthOxygenRisk(
  inputs: ProcessInputs,
  configs: ReactorScaleConfigs,
): { result: GrowthOxygenRiskResult; flags: AssessmentFlag[] } {
  const flags: AssessmentFlag[] = configs.scaleup.flags.map((message) => ({
    domain: "otr",
    message,
  }));
  const { confidence, driver } = growthConfidence(inputs);

  const lab = calculateScaleRisk(inputs, configs.lab, confidence, driver);
  const target = calculateScaleRisk(inputs, configs.target, confidence, driver);

  if (lab.limiting === "oxygen") {
    flags.push({
      domain: "otr",
      message: `Lab scale oxygen capacity is below substrate-implied growth demand (μ_O₂/μ_S = ${lab.mu_ratio.toFixed(2)}).`,
    });
  }
  if (target.limiting === "oxygen") {
    flags.push({
      domain: "otr",
      message: `Target scale oxygen capacity is below substrate-implied growth demand (μ_O₂/μ_S = ${target.mu_ratio.toFixed(2)}).`,
    });
  }

  return {
    result: {
      score: worstScore(lab.score, target.score),
      lab,
      target,
      confidence,
      driver,
    },
    flags,
  };
}
