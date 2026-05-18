// Shared types for the kLa correlation bank.
// Analogous to ReactorConfig in kla_correlations.py.

export interface ReactorOperatingPoint {
  // Geometry
  D_T: number;     // Tank diameter (m)
  H_L: number;     // Liquid height (m)
  V_L: number;     // Working volume (m³)

  // Impeller
  impeller_type: string;  // Key matching IMPELLER_CORRELATION_PARAMS
  d_i: number;     // Impeller diameter (m)
  Np: number;      // Power number
  n_imp: number;   // Number of impellers

  // Operating conditions
  N_rps: number;   // Agitation speed (rps = rpm / 60)
  Q_gas: number;   // Volumetric gas flow (m³/s)
  v_s: number;     // Superficial gas velocity (m/s)

  // Fluid properties
  rho_L: number;   // Liquid density (kg/m³)
  mu_L: number;    // Dynamic viscosity (Pa·s)

}

export interface CorrelationResult {
  kLa_per_s:   number;  // [s⁻¹]
  kLa_per_h:   number;  // [h⁻¹]
  Pg:          number;  // Gassed power [W]
  PgV:         number;  // Specific power [W/m³]
  correlation: string;  // Name of correlation used
}

export type KlaCorrelationFn = (op: ReactorOperatingPoint, Pg: number) => number;
