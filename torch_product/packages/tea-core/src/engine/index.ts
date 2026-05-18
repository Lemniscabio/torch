// Calculation engine — derivations D1–D7, risks R1–R5.

import type {
  ProcessInputs,
  DerivedParameters,
  AssessmentFlag,
  GrowthOxygenRiskResult,
  OtrRiskResult,
  MixingRiskResult,
  ShearRiskResult,
  Co2RiskResult,
  HeatRiskResult,
  PrimaryBottleneck,
  RiskDomain,
  RiskScore,
} from "../types";

import { runAllDerivations } from "./derivations/index";
import { buildReactorScaleConfigs } from "./reactor_configs";
import { calculateOtrRisk }   from "./oxygen/otr_risk";
import { calculateMixingRisk } from "./mixing/mixing_risk";
import { calculateShearRisk }  from "./shear/shear_risk";
import { calculateCo2Risk }    from "./co2/co2_risk";
import { calculateHeatRisk }   from "./heat/heat_risk";

// Re-export derivation helpers for consumers that import from engine
export {
  deriveOur,
  deriveVesselGeometry,
  derivePowerInput,
  derivePowerFlags,
  deriveReynolds,
  deriveReynoldsFlags,
  deriveGasVelocity,
  runAllDerivations,
} from "./derivations/index";

export type {
  OurResult,
  PowerResult,
  ReynoldsResult,
  FlowRegime,
  GasVelocityResult,
  OxygenSolubilityResult,
  deriveOxygenSolubility,
  DerivationOutput,
} from "./derivations/index";

export { calculateOtrRisk }    from "./oxygen/otr_risk";
// Legacy growth-kinetics oxygen risk path archived from active assessment flow.
export { calculateMixingRisk, ruszkowskiMixingTime } from "./mixing/mixing_risk";
export { calculateShearRisk }  from "./shear/shear_risk";
export { calculateCo2Risk, resolveRq } from "./co2/co2_risk";
export { calculateHeatRisk }   from "./heat/heat_risk";
export {
  scaleUpByPowerPerVolume,
  scaleUpByKla,
  scaleUpByShear,
} from "./scaleup/criteria";
export { buildReactorScaleConfigs } from "./reactor_configs";
export type {
  ReactorScaleConfig,
  ReactorScaleConfigOptions,
  ReactorScaleConfigs,
} from "./reactor_configs";
export type {
  ScaleupCriterion,
  ScaleupCriteriaInput,
  ScaleupCriteriaResult,
} from "./scaleup/criteria";

// --- Full assessment result ---

export interface PartialAssessmentResult {
  growth_oxygen:      GrowthOxygenRiskResult;
  otr:                OtrRiskResult;
  mixing:             MixingRiskResult;
  shear:              ShearRiskResult;
  co2:                Co2RiskResult;
  heat:               HeatRiskResult;
  primary_bottleneck: PrimaryBottleneck;
  flags:              AssessmentFlag[];
  derived:            DerivedParameters;
}

// --- Risk score ordering ---

const SCORE_ORDER: Record<RiskScore, number> = {
  low: 0, moderate: 1, high: 2, critical: 3,
};

function normalizedRiskPressure(domain: RiskDomain, score: RiskScore, result: PartialAssessmentResult): number {
  switch (domain) {
    case "otr": {
      const ratio = result.otr.otr_our_ratio_target ?? result.otr.kla_ratio;
      if (ratio <= 0) return Infinity;
      if (score === "critical") return 0.7 / ratio;
      if (score === "high") return 1.0 / ratio;
      if (score === "moderate") return 1.5 / ratio;
      return 0;
    }
    case "mixing": {
      const ratio = result.mixing.process_mixing_ratio_target ?? 0;
      if (ratio <= 0) return Infinity;
      if (score === "critical") return 0.1 / ratio;
      if (score === "high") return 1.0 / ratio;
      if (score === "moderate") return 10.0 / ratio;
      return 0;
    }
    case "shear": {
      const ratio = result.shear.tip_speed_ratio;
      if (score === "critical") return ratio / 1.3;
      if (score === "high") return ratio / 1.0;
      if (score === "moderate") return ratio / 0.7;
      return 0;
    }
    case "co2": {
      const bottom = result.co2.target?.pco2_bottom ?? result.co2.pco2_bottom ?? 0;
      const critical = result.co2.pco2_critical ?? 0.15;
      return critical > 0 ? bottom / critical : Infinity;
    }
    case "heat": {
      const ratio = result.heat.target?.heat_transfer_margin ?? result.heat.heat_transfer_margin ?? 0;
      if (ratio <= 0) return Infinity;
      if (score === "critical") return 1.0 / ratio;
      if (score === "high") return (1 / 0.85) / ratio;
      if (score === "moderate") return (1 / 0.60) / ratio;
      return 0;
    }
  }
}

function determinePrimaryBottleneck(result: PartialAssessmentResult): PrimaryBottleneck {
  const domains: { domain: RiskDomain; score: RiskScore }[] = [
    { domain: "otr",    score: result.otr.score_target ?? result.otr.score },
    { domain: "mixing", score: result.mixing.score_target ?? result.mixing.score },
    { domain: "shear",  score: result.shear.score_target ?? result.shear.score },
    { domain: "co2",    score: result.co2.target?.score ?? result.co2.score },
    { domain: "heat",   score: result.heat.target?.score ?? result.heat.score },
  ];

  if (domains.every((d) => d.score === "low")) {
    return {
      domain: null,
      statement: "Low risk across all domains, no bottlenecks to scale-up",
    };
  }

  const worstSeverity = Math.max(...domains.map((d) => SCORE_ORDER[d.score]));
  const mostAdverse = domains.filter((d) => SCORE_ORDER[d.score] === worstSeverity);
  mostAdverse.sort((a, b) => (
    normalizedRiskPressure(b.domain, b.score, result) - normalizedRiskPressure(a.domain, a.score, result)
  ));

  const primary = mostAdverse[0];
  return {
    domain: primary.domain,
    statement: generateBottleneckStatement(primary.domain, result),
  };
}

const DOMAIN_LABELS: Record<RiskDomain, string> = {
  otr: "Oxygen transfer", mixing: "Mixing", shear: "Shear stress",
  co2: "CO₂ accumulation", heat: "Heat removal",
};

function generateBottleneckStatement(domain: RiskDomain, result: PartialAssessmentResult): string {
  const label = DOMAIN_LABELS[domain];
  switch (domain) {
    case "otr":
      return `${label} is your critical constraint. Required oxygen uptake rate (OUR) of ${result.derived.our_peak.toFixed(1)} mmol/L/h is proximal to or higher than the achievable oxygen transfer rate (OTR) of ${(result.otr.otr_capacity_target ?? 0).toFixed(1)} mmol/L/h, leading to potential oxygen-limited growth.`;
    case "mixing":
      return `${label} is your critical constraint. Mixing time of ${result.mixing.theta_mix_target.toFixed(1)} s is proximal to or higher than the process timescale of ${(result.mixing.oxygen_depletion_time_target_s ?? 0).toFixed(1)} s, leading to gradients in the reactor.`;
    case "shear":
      return `${label} is your critical constraint. Tip speed of impeller of ${result.shear.tip_speed.toFixed(2)} m/s is proximal to or higher than the tip speed threshold of the microbe of ${result.shear.tip_speed_threshold.toFixed(2)} m/s, which can cause potential shear damage.`;
    case "co2":
      return `${label} is your critical constraint. CO₂ partial pressure at the bottom of the reactor of ${(result.co2.target?.pco2_bottom ?? result.co2.pco2_bottom ?? 0).toFixed(3)} bar is proximal to or higher than the CO₂ partial pressure threshold of the microbe of ${(result.co2.pco2_critical ?? 0).toFixed(3)} bar, leading to hampered growth.`;
    case "heat":
      return `${label} is your critical constraint. Heat removal capacity of the reactor of ${result.heat.q_cool_max.toFixed(2)} kW is proximal to or lower than the metabolic heat generated during fermentation of ${result.heat.q_metabolic.toFixed(2)} kW, leading to a potential temperature rise during reaction.`;
  }
}

export function runAssessment(inputs: ProcessInputs): PartialAssessmentResult {
  const { derived, flags } = runAllDerivations(inputs);

  const reactorConfigs = buildReactorScaleConfigs(inputs, {
    method: inputs.scaleup_criterion ?? "power_per_volume",
  });
  // Growth-kinetics oxygen risk is intentionally not part of the active flow.
  const growthOxygen: GrowthOxygenRiskResult = {
    score: "low",
    lab: {
      score: "low",
      mu_o2: 0,
      mu_substrate: 0,
      mu_ratio: Infinity,
      limiting: "substrate",
      confidence: "directional",
      driver: "Archived legacy growth-kinetics path.",
    },
    target: {
      score: "low",
      mu_o2: 0,
      mu_substrate: 0,
      mu_ratio: Infinity,
      limiting: "substrate",
      confidence: "directional",
      driver: "Archived legacy growth-kinetics path.",
    },
    confidence: "directional",
    driver: "Archived legacy growth-kinetics path; oxygen risk is based on OTR/OUR.",
  };

  const otr     = calculateOtrRisk(inputs, derived, reactorConfigs);
  flags.push(...otr.flags);

  const mixing  = calculateMixingRisk(inputs, derived, reactorConfigs);
  flags.push(...mixing.flags);

  const shear   = calculateShearRisk(inputs, derived, reactorConfigs);
  flags.push(...shear.flags);

  const co2     = calculateCo2Risk(inputs, derived, reactorConfigs);
  flags.push(...co2.flags);

  const heat    = calculateHeatRisk(inputs, derived, reactorConfigs);
  flags.push(...heat.flags);

  const partialResult: PartialAssessmentResult = {
    growth_oxygen:      growthOxygen,
    otr:                otr.result,
    mixing:             mixing.result,
    shear:              shear.result,
    co2:                co2.result,
    heat:               heat.result,
    primary_bottleneck: null as unknown as PrimaryBottleneck,
    flags,
    derived,
  };

  partialResult.primary_bottleneck = determinePrimaryBottleneck(partialResult);
  return partialResult;
}
