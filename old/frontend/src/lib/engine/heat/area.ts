// Jacket heat-transfer area for a cylindrical vessel with dished bottom.
//
// A = π·D_T·H_L  (wetted side wall)
//   + π·D_T²/4   (flat / shallow-dished bottom approximation)
//
// Overriding A_total directly is the extension point for vessels with
// half-pipe coils or non-standard jacket coverage.

export interface JacketAreaResult {
  A_side:   number; // m² — cylindrical side wall
  A_bottom: number; // m² — vessel bottom
  A_total:  number; // m²
}

export function deriveJacketArea(D_T: number, H_L: number): JacketAreaResult {
  const A_side   = Math.PI * D_T * H_L;
  const A_bottom = (Math.PI / 4) * D_T * D_T;
  return { A_side, A_bottom, A_total: A_side + A_bottom };
}
