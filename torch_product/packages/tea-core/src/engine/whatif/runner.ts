import type { ProcessInputs, PrimaryBottleneck, RiskDomain, RiskScore, AssessmentFlag } from "../../types";
import { runAllDerivations } from "../derivations/index";
import { buildReactorScaleConfigs } from "../reactor_configs";
import { calculateOtrRisk }   from "../oxygen/otr_risk";
import { calculateMixingRisk } from "../mixing/mixing_risk";
import { calculateShearRisk }  from "../shear/shear_risk";
import { calculateCo2Risk }    from "../co2/co2_risk";
import { calculateHeatRisk }   from "../heat/heat_risk";
import { scoreHeatMargin }     from "../heat/heat_risk";
import { applyModifications }  from "./modifications";
import type { WhatIfParams, WhatIfResult, WhatIfTargetOtr, WhatIfTargetMixing, WhatIfTargetShear, WhatIfTargetCo2, WhatIfTargetHeat } from "./types";

const SCORE_ORDER: Record<RiskScore, number> = { low: 0, moderate: 1, high: 2, critical: 3 };

function worstScore(a: RiskScore, b: RiskScore): RiskScore {
  return SCORE_ORDER[a] >= SCORE_ORDER[b] ? a : b;
}

function simplePrimaryBottleneck(
  scores: Record<RiskDomain, RiskScore>,
): PrimaryBottleneck {
  let worst: RiskScore = "low";
  let worstDomain: RiskDomain | null = null;
  for (const [domain, score] of Object.entries(scores) as [RiskDomain, RiskScore][]) {
    if (SCORE_ORDER[score] > SCORE_ORDER[worst]) {
      worst = score;
      worstDomain = domain;
    }
  }
  if (worstDomain === null) {
    return { domain: null, statement: "Low risk across all domains, no bottlenecks to scale-up" };
  }
  return { domain: worstDomain, statement: `${worstDomain} is the primary constraint.` };
}

export function runWhatIf(inputs: ProcessInputs, params: WhatIfParams): WhatIfResult {
  const modifiedInputs = applyModifications(inputs, params);
  const { derived, flags } = runAllDerivations(modifiedInputs);

  const reactorConfigs = buildReactorScaleConfigs(modifiedInputs, {
    method: modifiedInputs.scaleup_criterion ?? "power_per_volume",
  });

  const otrRaw     = calculateOtrRisk(modifiedInputs, derived, reactorConfigs);
  const mixingRaw  = calculateMixingRisk(modifiedInputs, derived, reactorConfigs);
  const shearRaw   = calculateShearRisk(modifiedInputs, derived, reactorConfigs);
  const co2Raw     = calculateCo2Risk(modifiedInputs, derived, reactorConfigs);
  const heatRaw    = calculateHeatRisk(modifiedInputs, derived, reactorConfigs);

  flags.push(...otrRaw.flags, ...mixingRaw.flags, ...shearRaw.flags, ...co2Raw.flags, ...heatRaw.flags);

  const otrResult   = otrRaw.result;
  const mixResult   = mixingRaw.result;
  const shearResult = shearRaw.result;
  const co2Result   = co2Raw.result;
  const heatResult  = heatRaw.result;

  let heatScore  = heatResult.target?.score ?? heatResult.score;
  let heatCoolMax = heatResult.target?.q_cool_max ?? heatResult.q_cool_max;
  let heatMargin  = heatResult.target?.heat_transfer_margin ?? heatResult.heat_transfer_margin ?? 0;
  let heatMarginStd = heatResult.target?.heat_transfer_margin_std ?? heatResult.heat_transfer_margin_std ?? 0;

  if (params.active.has("add_internal_cooling_coils")) {
    const qMet  = heatResult.q_metabolic;
    heatCoolMax = heatCoolMax * 1.5;
    heatMargin  = qMet > 0 ? heatCoolMax / qMet : Infinity;
    heatMarginStd = Number.isFinite(heatMargin) ? heatMarginStd * 1.5 : 0; // rough scaling
    heatScore   = scoreHeatMargin(heatMargin);
  }

  const otr: WhatIfTargetOtr = {
    score:              otrResult.score_target ?? otrResult.score,
    kla_h:              otrResult.kla_target_moderate,
    kla_std:            otrResult.kla_target_std ?? 0,
    otr_our_ratio:      otrResult.otr_our_ratio_target ?? otrResult.kla_ratio,
    otr_our_ratio_std:  otrResult.otr_our_ratio_target_std ?? 0,
    otr_capacity:       otrResult.otr_capacity_target ?? 0,
    pv_w_m3:            otrResult.pv_target,
  };

  const mixing: WhatIfTargetMixing = {
    score:                     mixResult.score_target ?? mixResult.score,
    theta_mix:                 mixResult.theta_mix_target,
    theta_mix_std:             mixResult.theta_mix_target_std,
    process_mixing_ratio:      mixResult.process_mixing_ratio_target,
    process_mixing_ratio_std:  mixResult.process_mixing_ratio_target_std,
  };

  const shear: WhatIfTargetShear = {
    score:                 shearResult.score_target ?? shearResult.score,
    tip_speed:             shearResult.tip_speed,
    tip_speed_margin:      shearResult.tip_speed_margin,
    tip_speed_margin_std:  shearResult.tip_speed_margin_std ?? 0,
  };

  const co2: WhatIfTargetCo2 = {
    score:           co2Result.target?.score ?? co2Result.score,
    pco2_bottom:     co2Result.target?.pco2_bottom ?? co2Result.pco2_bottom ?? 0,
    pco2_margin:     co2Result.target?.pco2_margin ?? co2Result.pco2_margin ?? Infinity,
    pco2_margin_std: co2Result.target?.pco2_margin_std ?? co2Result.pco2_margin_std ?? 0,
  };

  const heat: WhatIfTargetHeat = {
    score:                    heatScore,
    q_cool_max:               heatCoolMax,
    heat_transfer_margin:     heatMargin,
    heat_transfer_margin_std: heatMarginStd,
  };

  const primary_bottleneck = simplePrimaryBottleneck({
    otr:   otr.score,
    mixing: mixing.score,
    shear:  shear.score,
    co2:    co2.score,
    heat:   heat.score,
  });

  return { otr, mixing, shear, co2, heat, modified_inputs: modifiedInputs, primary_bottleneck, flags };
}
