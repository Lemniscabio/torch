// ARCHIVED — growth kinetics engine removed from active assessment flow.
// Not called in the active assessment flow. Preserved for reference.
//
// // Fed-batch feed rate derivation.
// //
// // Feed rate is estimated from the volume swing:
// //   F = (V_f − V_0) / batch_time_h   [L/h]
// //   V_0 = initial_fill_pct/100 × v_working
// //   V_f = final_fill_pct/100  × v_working
//
// import { FED_BATCH_FINAL_FILL_PCT } from "@/lib/constants";
//
// export interface FeedRateParams {
//   v_working_litres:  number; // working volume of the vessel (L)
//   initial_fill_pct:  number; // % of working volume at batch start
//   batch_time_h:      number; // duration of batch/feeding phase (h)
//   final_fill_pct?:   number; // % of working volume at end of fed-batch (default: FED_BATCH_FINAL_FILL_PCT)
// }
//
// export interface FeedRateResult {
//   v_initial:       number; // L — volume at start of feed phase
//   v_final:         number; // L — volume at end of feed phase
//   flow_rate_lph:   number; // L/h — average volumetric feed rate
//   delta_v_litres:  number; // L — total volume added during feed phase
// }
//
// export function deriveFeedRate(params: FeedRateParams): FeedRateResult {
//   const final_fill_pct = params.final_fill_pct ?? FED_BATCH_FINAL_FILL_PCT;
//   const v_initial      = (params.initial_fill_pct / 100) * params.v_working_litres;
//   const v_final        = (final_fill_pct           / 100) * params.v_working_litres;
//   const delta_v        = Math.max(0, v_final - v_initial);
//   const flow_rate_lph  = params.batch_time_h > 0 ? delta_v / params.batch_time_h : 0;
//   return {
//     v_initial,
//     v_final,
//     flow_rate_lph,
//     delta_v_litres: delta_v,
//   };
// }
