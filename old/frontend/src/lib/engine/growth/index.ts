// ARCHIVED — growth kinetics engine removed from active assessment flow.
// Not called in the active assessment flow. Preserved for reference.
//
// // Growth rate orchestrators — fed-batch and batch.
// //
// // Both modes use the same deriveOxygenLimitedMu function; the dilution
// // term (C_L·F/V) is non-zero only in fed-batch, passed as dilution_rate_h.
//
// // --- Re-exports ---
//
// export { deriveFeedRate }              from "./feed_rate";
// export type { FeedRateParams, FeedRateResult } from "./feed_rate";
//
// export { deriveSubstrateLimitedMu }    from "./substrate_limited";
// export type { SubstrateLimitedMuParams, SubstrateLimitedMuResult } from "./substrate_limited";
//
// export { deriveSubstrateLimitedMuBatch } from "./substrate_limited_batch";
// export type { SubstrateLimitedMuBatchParams, SubstrateLimitedMuBatchResult } from "./substrate_limited_batch";
//
// export { deriveOxygenLimitedMu, calculateOur }       from "./oxygen_limited";
// export type { OxygenLimitedMuParams, OxygenLimitedMuResult } from "./oxygen_limited";
//
// // --- Imports for orchestrators ---
//
// import { deriveFeedRate }               from "./feed_rate";
// import { deriveSubstrateLimitedMu }     from "./substrate_limited";
// import { deriveSubstrateLimitedMuBatch } from "./substrate_limited_batch";
// import { deriveOxygenLimitedMu }        from "./oxygen_limited";
// import type { FeedRateResult }          from "./feed_rate";
// import type { SubstrateLimitedMuResult } from "./substrate_limited";
// import type { SubstrateLimitedMuBatchResult } from "./substrate_limited_batch";
// import type { OxygenLimitedMuResult }   from "./oxygen_limited";
//
// // ─────────────────────────────────────────────────────────────────────────────
// // Fed-batch orchestrator
// // ─────────────────────────────────────────────────────────────────────────────
//
// export interface FedBatchGrowthParams {
//   v_working_litres:   number; // L     — vessel working volume
//   initial_fill_pct:   number; // %     — volume at batch start
//   batch_time_h:       number; // h     — duration of feed phase
//   feed_substrate_g_L: number; // g/L   — substrate concentration in feed
//   yield_x_s:          number; // g/g   — Y_X/S
//   yield_o2:           number; // g/g   — Y_O2
//   biomass_cdw:        number; // g/L   — biomass (mid-batch estimate)
//   volume_litres:      number; // L     — current culture volume
//   kla_h:              number; // h⁻¹   — kLa at this scale
//   c_star:             number; // mmol/L — O₂ saturation
//   c_l:                number; // mmol/L — DO at setpoint
// }
//
// export interface FedBatchGrowthResult {
//   feed_rate:    FeedRateResult;
//   substrate:    SubstrateLimitedMuResult;
//   oxygen:       OxygenLimitedMuResult;
//   mu_effective: number;              // h⁻¹ — min(μ_S, μ_O2)
//   limiting:     "substrate" | "oxygen";
// }
//
// export function runFedBatchGrowth(params: FedBatchGrowthParams): FedBatchGrowthResult {
//   const feed_rate = deriveFeedRate({
//     v_working_litres: params.v_working_litres,
//     initial_fill_pct: params.initial_fill_pct,
//     batch_time_h:     params.batch_time_h,
//   });
//
//   const substrate = deriveSubstrateLimitedMu({
//     flow_rate_lph:      feed_rate.flow_rate_lph,
//     feed_substrate_g_L: params.feed_substrate_g_L,
//     yield_x_s:          params.yield_x_s,
//     biomass_cdw:        params.biomass_cdw,
//     volume_litres:      params.volume_litres,
//   });
//
//   // dilution_rate_h = F/V — feed dilutes dissolved O₂ in broth
//   const dilution_rate_h = params.volume_litres > 0
//     ? feed_rate.flow_rate_lph / params.volume_litres
//     : 0;
//
//   const oxygen = deriveOxygenLimitedMu({
//     kla_h:            params.kla_h,
//     c_star:           params.c_star,
//     c_l:              params.c_l,
//     yield_o2:         params.yield_o2,
//     biomass_cdw:      params.biomass_cdw,
//     dilution_rate_h,
//   });
//
//   const mu_effective = Math.min(substrate.mu_s, oxygen.mu_o2);
//   const limiting     = substrate.mu_s <= oxygen.mu_o2 ? "substrate" : "oxygen";
//
//   return { feed_rate, substrate, oxygen, mu_effective, limiting };
// }
//
// // ─────────────────────────────────────────────────────────────────────────────
// // Batch orchestrator
// // ─────────────────────────────────────────────────────────────────────────────
//
// export interface BatchGrowthParams {
//   mu_max:    number; // h⁻¹   — from KINETIC_PARAMS
//   K_s:       number; // g/L   — from KINETIC_PARAMS
//   yield_x_s: number; // g/g   — Y_X/S
//   yield_o2:  number; // g/g   — Y_O2
//   X_0:       number; // g/L   — initial biomass
//   S_0:       number; // g/L   — initial substrate
//   kla_h:     number; // h⁻¹   — kLa at this scale
//   c_star:    number; // mmol/L — O₂ saturation
//   c_l:       number; // mmol/L — DO at setpoint
// }
//
// export interface BatchGrowthResult {
//   substrate:    SubstrateLimitedMuBatchResult;
//   oxygen:       OxygenLimitedMuResult;    // evaluated at X* — same operating point
//   mu_effective: number;                   // h⁻¹ — min(μ_S, μ_O2)
//   limiting:     "substrate" | "oxygen";
// }
//
// export function runBatchGrowth(params: BatchGrowthParams): BatchGrowthResult {
//   const substrate = deriveSubstrateLimitedMuBatch({
//     mu_max:    params.mu_max,
//     K_s:       params.K_s,
//     yield_x_s: params.yield_x_s,
//     X_0:       params.X_0,
//     S_0:       params.S_0,
//   });
//
//   // Evaluate oxygen limit at X* so both constraints describe the same
//   // moment in the batch (peak volumetric activity). dilution_rate_h = 0.
//   const oxygen = deriveOxygenLimitedMu({
//     kla_h:       params.kla_h,
//     c_star:      params.c_star,
//     c_l:         params.c_l,
//     yield_o2:    params.yield_o2,
//     biomass_cdw: substrate.X_star,
//   });
//
//   const mu_effective = Math.min(substrate.mu_s_batch, oxygen.mu_o2);
//   const limiting     = substrate.mu_s_batch <= oxygen.mu_o2 ? "substrate" : "oxygen";
//
//   return { substrate, oxygen, mu_effective, limiting };
// }
