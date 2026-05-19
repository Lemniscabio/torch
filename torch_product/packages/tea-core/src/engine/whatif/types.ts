import type { ProcessInputs, RiskScore, FeedingFrequency, PrimaryBottleneck, AssessmentFlag } from "../../types";
import type { ModificationId } from "@torch/core-shared";

// ModificationId + ModificationDefinition live in @torch/core-shared (the
// catalog is presentation metadata, not math). Re-exported here for engine
// callsites that import from "./types".
export type { ModificationId, ModificationDefinition } from "@torch/core-shared";

export interface WhatIfParams {
  active: ReadonlySet<ModificationId>;
  oxygen_level?: number;           // o2_inlet override (%); undefined = no change
  feed_frequency?: FeedingFrequency; // feed interval override; undefined = no change
}

export interface WhatIfTargetOtr {
  score: RiskScore;
  kla_h: number;
  kla_std: number;
  otr_our_ratio: number;
  otr_our_ratio_std: number;
  otr_capacity: number;
  pv_w_m3: number;
}

export interface WhatIfTargetMixing {
  score: RiskScore;
  theta_mix: number;
  theta_mix_std: number;
  process_mixing_ratio: number;
  process_mixing_ratio_std: number;
}

export interface WhatIfTargetShear {
  score: RiskScore;
  tip_speed: number;
  tip_speed_margin: number;
  tip_speed_margin_std: number;
}

export interface WhatIfTargetCo2 {
  score: RiskScore;
  pco2_bottom: number;
  pco2_margin: number;
  pco2_margin_std: number;
}

export interface WhatIfTargetHeat {
  score: RiskScore;
  q_cool_max: number;
  heat_transfer_margin: number;
  heat_transfer_margin_std: number;
}

export interface WhatIfResult {
  otr:    WhatIfTargetOtr;
  mixing: WhatIfTargetMixing;
  shear:  WhatIfTargetShear;
  co2:    WhatIfTargetCo2;
  heat:   WhatIfTargetHeat;
  modified_inputs: ProcessInputs;
  primary_bottleneck: PrimaryBottleneck;
  flags: AssessmentFlag[];
}
