// Shared uncertainty propagation utilities.
//
// Convention: all std values are 1-sigma (68% CI).
// The 95%-CI extrema assumption (1.96 σ) is used when deriving σ from ensemble min/max.

export interface EnsembleStats {
  mean:       number;
  std:        number;
  min:        number;
  max:        number;
  components: Record<string, number>;
}

/**
 * Estimate σ from ensemble extrema, assuming min/max span the 95% CI:
 *   σ = (max − min) / (2 × 1.96)
 */
export function stdFromExtrema(min: number, max: number): number {
  return Math.max(0, (max - min) / 3.92);
}

/**
 * Summarise a keyed record of correlation outputs into EnsembleStats.
 * Uses stdFromExtrema — extrema are treated as the 95% CI.
 */
export function summariseEnsemble(components: Record<string, number>): EnsembleStats {
  const values = Object.values(components).filter(Number.isFinite);
  if (values.length === 0) return { mean: 0, std: 0, min: 0, max: 0, components };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const min  = Math.min(...values);
  const max  = Math.max(...values);
  const std  = stdFromExtrema(min, max);
  return { mean, std, min, max, components };
}

/**
 * Propagate σ through f(x) = C + B/x (affine-inverse form).
 *   df/dx = −B/x²  →  σ_f = |B/x²| · σ_x
 *
 * Used for pCO₂ bulk calculation where pco2_bulk depends on 1/kla_co2.
 */
export function stdAffineInverse(B: number, x: number, sigma_x: number): number {
  if (x <= 0) return 0;
  return Math.abs(B / (x * x)) * sigma_x;
}

/**
 * Relative σ of f = A / x equals relative σ of x (inverse proportionality).
 * Returns the relative std (unitless), not absolute.
 */
export function relStdInverse(rel_std_x: number): number {
  return rel_std_x;
}
