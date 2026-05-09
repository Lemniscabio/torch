// ARCHIVED — growth kinetics engine removed from active assessment flow.
// Not called in the active assessment flow. Preserved for reference.
//
// // Substrate-limited peak specific growth rate for batch culture (analytical).
// //
// // Starting from Monod kinetics and the yield relation:
// //   dX/dS = -Y_X/S  →  X(S) = X_0 + Y_X/S·(S_0 - S)
// //
// // Setting d(μ·X)/dS = 0 and solving the resulting quadratic in S gives the
// // substrate concentration S* at which the volumetric growth rate μ·X peaks.
// // The specific growth rate at that moment is μ_S = μ_max·S*/(K_s + S*).
// //
// // Closed-form S* (positive root of the quadratic):
// //   B   = S_0 + X_0 / Y_X/S
// //   S*  = √( K_s · (K_s + B) ) - K_s         (guaranteed ∈ (0, S_0) for S_0 > 0)
// //   X*  = X_0 + Y_X/S · (S_0 - S*)
// //   μ_S = μ_max · S* / (K_s + S*)
// //
// // μ_S is the specific growth rate at peak volumetric activity — the same
// // moment at which peak OUR and peak heat load occur, making it the correct
// // value for cross-domain risk comparison.
// //
// // Model assumes: single Monod substrate, no O₂ coupling, no inhibition.
// // μ_S is therefore an upper bound in the substrate channel.
//
// export interface SubstrateLimitedMuBatchParams {
//   mu_max:    number; // h⁻¹      — maximum specific growth rate
//   K_s:       number; // g/L      — substrate half-saturation constant
//   yield_x_s: number; // g CDW/g  — Y_X/S
//   X_0:       number; // g CDW/L  — initial biomass
//   S_0:       number; // g/L      — initial substrate
// }
//
// export interface SubstrateLimitedMuBatchResult {
//   S_star:     number; // g/L      — substrate at peak μ·X
//   X_star:     number; // g CDW/L  — biomass at peak μ·X
//   mu_s_batch: number; // h⁻¹      — substrate-limited μ at peak activity
//   mu_x_peak:  number; // g CDW/L/h — peak volumetric growth rate μ·X
// }
//
// export function deriveSubstrateLimitedMuBatch(
//   params: SubstrateLimitedMuBatchParams,
// ): SubstrateLimitedMuBatchResult {
//   const { mu_max, K_s, yield_x_s, X_0, S_0 } = params;
//
//   const B      = S_0 + X_0 / yield_x_s;
//   const S_star = Math.max(0, Math.sqrt(K_s * (K_s + B)) - K_s);
//   const X_star = X_0 + yield_x_s * (S_0 - S_star);
//   const mu_s_batch = mu_max * S_star / (K_s + S_star);
//   const mu_x_peak  = mu_s_batch * X_star;
//
//   return { S_star, X_star, mu_s_batch, mu_x_peak };
// }
