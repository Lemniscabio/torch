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
} from "@/lib/types";

import { runAllDerivations } from "./derivations/index";
import { buildReactorScaleConfigs } from "./reactor_configs";
import { calculateGrowthOxygenRisk } from "./oxygen/growth_oxygen_risk";
import { calculateOtrRisk }   from "./oxygen/otr_risk";
import { calculateMixingRisk } from "./mixing/mixing_risk";
import { calculateShearRisk }  from "./shear/shear_risk";
import { calculateCo2Risk }    from "./co2/co2_risk";
import { calculateHeatRisk }   from "./heat/heat_risk";

// Re-export derivation helpers for consumers that import from engine
export {
  deriveBiomassCdw,
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
export { calculateGrowthOxygenRisk, scoreMuRatio } from "./oxygen/growth_oxygen_risk";
export { calculateMixingRisk } from "./mixing/mixing_risk";
export { calculateShearRisk }  from "./shear/shear_risk";
export { calculateCo2Risk }    from "./co2/co2_risk";
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

function domainRatio(domain: RiskDomain, result: PartialAssessmentResult): number {
  switch (domain) {
    case "otr":     return result.otr.kla_ratio > 0 ? 1 / result.otr.kla_ratio : Infinity;
    case "mixing":  return result.mixing.da_eff_target ?? result.mixing.da_eff ?? result.mixing.theta_mix_target / 30;
    case "shear":   return result.shear.tip_speed_ratio;
    case "co2":     return result.co2.pco2_bottom != null ? result.co2.pco2_bottom / 0.15 : 0;
    case "heat":    return result.heat.heat_ratio;
  }
}

function determinePrimaryBottleneck(result: PartialAssessmentResult): PrimaryBottleneck {
  const domains: { domain: RiskDomain; score: RiskScore }[] = [
    { domain: "otr",    score: result.otr.score },
    { domain: "mixing", score: result.mixing.score },
    { domain: "shear",  score: result.shear.score },
    { domain: "co2",    score: result.co2.score },
    { domain: "heat",   score: result.heat.score },
  ];

  domains.sort((a, b) => {
    const diff = SCORE_ORDER[b.score] - SCORE_ORDER[a.score];
    return diff !== 0 ? diff : domainRatio(b.domain, result) - domainRatio(a.domain, result);
  });

  const primary = domains[0];
  return {
    domain:           primary.domain,
    statement:        generateBottleneckStatement(primary.domain, result),
    what_would_change: generateWhatWouldChange(primary.domain, result),
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
      return `${label} is your critical constraint. Required kLa of ${result.otr.kla_required.toFixed(0)} h⁻¹ versus achievable ${result.otr.kla_target_moderate.toFixed(0)} h⁻¹ at constant P/V.`;
    case "mixing":
      if (result.mixing.da_eff != null) {
        return `${label} is your critical constraint. Mixing time of ${result.mixing.theta_mix_target.toFixed(0)} s at target scale produces Da_eff = ${result.mixing.da_eff.toFixed(2)} — mixing/uptake mismatch expected.`;
      }
      return `${label} is your critical constraint. Mixing time of ${result.mixing.theta_mix_target.toFixed(0)} s at target scale may compromise pH homogeneity.`;
    case "shear":
      return `${label} is your critical constraint. Tip speed of ${result.shear.tip_speed.toFixed(1)} m/s at constant P/V exceeds organism threshold of ${result.shear.tip_speed_threshold.toFixed(1)} m/s (ratio ${result.shear.tip_speed_ratio.toFixed(2)}).`;
    case "co2":
      return `${label} is your critical constraint. Estimated pCO₂ at vessel bottom is ${(result.co2.pco2_bottom ?? 0).toFixed(2)} bar.`;
    case "heat":
      return `${label} is your critical constraint. Metabolic heat of ${result.heat.q_metabolic.toFixed(1)} kW versus cooling capacity of ${result.heat.q_cool_max.toFixed(1)} kW (ratio ${result.heat.heat_ratio.toFixed(2)}).`;
  }
}

function generateWhatWouldChange(domain: RiskDomain, result: PartialAssessmentResult): string {
  switch (domain) {
    case "otr": {
      const klaReqNeeded = result.otr.kla_target_moderate /
        (result.otr.kla_ratio < 0.7 ? 0.7 : result.otr.kla_ratio < 1.0 ? 1.0 : 1.5);
      return `If your measured OUR is below ${(klaReqNeeded * result.derived.driving_force).toFixed(0)} mmol/L/h, OTR risk improves by one level.`;
    }
    case "mixing":
      if (result.mixing.da_eff != null && result.mixing.da_eff > 0.1) {
        return "Switching to continuous feed would reduce Da and may lower mixing risk.";
      }
      return "Increasing agitation or reducing target vessel H/D ratio would improve mixing time.";
    case "shear":
      return "Switching to a pitched blade turbine or scaling at constant tip speed instead of constant P/V would reduce shear risk.";
    case "co2":
      return "Increasing sparging rate to enhance CO₂ stripping or reducing target vessel H/D ratio would lower pCO₂ at vessel bottom.";
    case "heat": {
      const targetHeatRatio = result.heat.heat_ratio > 1.0 ? 1.0 : result.heat.heat_ratio > 0.85 ? 0.85 : 0.6;
      const dtLmNeeded = (result.heat.q_metabolic / targetHeatRatio * 1000) / (400 * result.heat.a_jacket);
      return `If cooling water is available at a temperature giving ΔT_lm of ${dtLmNeeded.toFixed(1)}°C, heat removal risk improves by one level.`;
    }
  }
}

export function runAssessment(inputs: ProcessInputs): PartialAssessmentResult {
  const { derived, flags } = runAllDerivations(inputs);

  const reactorConfigs = buildReactorScaleConfigs(inputs, {
    method: inputs.scaleup_criterion ?? "power_per_volume",
  });
  const growthOxygen = calculateGrowthOxygenRisk(inputs, reactorConfigs);
  flags.push(...growthOxygen.flags);

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
    growth_oxygen:      growthOxygen.result,
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
