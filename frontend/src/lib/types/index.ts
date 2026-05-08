// TypeScript interfaces for Lemnisca Fermentation Scale-Up Risk Predictor
// All field IDs and structures per /docs/lemnisca_scaleup_app_dev_spec.md

// --- Enums and Literal Types ---

export type OrganismClass = "bacteria" | "yeast";

export type OrganismSpecies =
  | "e_coli"
  | "b_subtilis"
  | "s_cerevisiae"
  | "p_pastoris"
  | "other_bacteria"
  | "other_yeast";

export type ProcessType = "batch" | "fed_batch";

export type ImpellerType = "rushton" | "pitched_blade" | "marine" | "unknown";

export type BiomassUnit = "g_L_CDW" | "OD600";

// "exhaust_gas" retained for type-safety during transition; engine support
// will be dropped in Stage 3. New UI only exposes "measured" | "estimate".
export type OurMode = "measured" | "estimate" | "exhaust_gas";

/** @deprecated — will be removed in Stage 3. τ_feed now derived from fed_batch_config.batch_time_h. */
export type FeedFrequency = "continuous" | "1_10min" | "10_30min" | "30plus_min";

export type RiskScore = "low" | "moderate" | "high" | "critical";

export type Confidence = "high_confidence" | "reliable" | "directional";

// --- Batch / Fed-batch sub-configs (new in Stage 1) ---

export interface BatchConfig {
  x0_g_L: number;   // Initial biomass concentration (g/L CDW), default 0.5
  s0_g_L: number;   // Initial substrate concentration (g/L), default 20.0
}

export interface FedBatchConfig {
  initial_fill_pct: number;  // Initial fill as % of working volume, default 60
  batch_time_h: number;      // Duration of batch phase (h), default 24
}

// --- Input Parameters (Section 1.1) ---

export interface ProcessInputs {
  // Section A: Process Identity
  organism_class: OrganismClass;
  organism_species: OrganismSpecies;
  process_type: ProcessType;

  // Batch / fed-batch sub-configs (populated based on process_type)
  batch_config?: BatchConfig;
  fed_batch_config?: FedBatchConfig;

  // Section B: Scale Definition
  v_lab: number;        // Lab working volume (L), > 0, <= 1000
  v_target: number;     // Target working volume (L), > v_lab

  // Section C: Lab-scale Vessel & Agitation
  // Note: these describe the lab vessel; target geometry is derived from v_target + h_d_target.
  vessel_model?: string;            // Lab vessel brand/model (optional)
  h_d_lab: number;                  // H/D ratio (lab), default 1.2, range 0.5–4.0
  h_d_target: number;               // H/D ratio (target), range 0.5–4.0
  n_impellers: number;              // Number of impellers (lab vessel), 1–4
  impeller_type: ImpellerType;      // Default: rushton
  dt_ratio_lab?: number;             // d/T ratio override for lab vessel (default: from impeller type)
  dt_ratio_target?: number;          // d/T ratio override for target vessel (default: from impeller type)
  rpm: number;                      // Agitation at peak demand (RPM), > 0, <= 3000
  vvm: number;                      // Airflow at peak demand (VVM), default 1.0, 0.1–5.0

  // Section D: Oxygen & Biomass
  biomass: number;                  // Peak biomass, > 0, <= 200
  biomass_unit: BiomassUnit;        // Default: g_L_CDW
  our_mode: OurMode;                // OUR input mode, default: estimate
  our_measured?: number;            // OUR measured value (mmol/L/h), required if our_mode == measured
  /** @deprecated — exhaust_gas mode removed from UI in Stage 2 */
  o2_inlet?: number;                // Exhaust gas inlet O2 (%), default 20.9
  /** @deprecated */
  o2_outlet?: number;               // Exhaust gas outlet O2 (%)
  /** @deprecated */
  gas_flow?: number;                // Exhaust gas flow rate (L/min)
  do_setpoint: number;              // DO setpoint at control point (%), default 30, 0–100
  do_at_bottom_pct?: number;        // DO at vessel bottom (%), default 20; used for driving force in R1

  // Section D: Thermal
  temperature: number;              // Process temperature (°C), 15–55
  t_cw_inlet: number;               // Cooling water inlet temp (°C), default 12, 0–40
  cooling_water_flowrate_lpm?: number; // Cooling water flowrate (L/min), default 30

  // Section E: Fed-batch Parameters
  // feed_frequency and feed_interval_seconds are deprecated; τ_feed is now
  // derived from fed_batch_config.batch_time_h in Stage 3.
  /** @deprecated */
  feed_frequency?: FeedFrequency;
  /** @deprecated */
  feed_interval_seconds?: number;
}

// --- Derived Parameters (Section 2.1, D1–D7) ---

export interface VesselGeometry {
  t_diameter: number;    // Tank diameter (m)
  h_liquid: number;      // Liquid height (m)
  d_imp: number;         // Impeller diameter (m)
  a_cross: number;       // Cross-sectional area (m²)
  volume_m3: number;     // Working volume (m³)
}

export interface DerivedParameters {
  // D1 — OUR derivation
  our_peak: number;               // mmol/L/h
  our_min?: number;               // mmol/L/h (only when our_mode == estimate)
  our_max?: number;               // mmol/L/h (only when our_mode == estimate)

  // D2 — Vessel geometry
  lab_geometry: VesselGeometry;
  target_geometry: VesselGeometry;

  // D3 — Power input
  n_rps: number;                  // Revolutions per second
  p_ungassed: number;             // Ungassed power (W)
  p_gassed: number;               // Gassed power per impeller (W)
  p_total: number;                // Total gassed power (W)
  pv_lab: number;                 // P/V at lab scale (W/m³)

  // D4 — Reynolds number
  re: number;                     // Reynolds number (dimensionless)

  // D5 — Superficial gas velocity
  q_gas_lab: number;              // Gas flow rate at lab (m³/s)
  vs_lab: number;                 // Superficial gas velocity at lab (m/s)
  q_gas_target: number;           // Gas flow rate at target (m³/s)
  vs_target: number;              // Superficial gas velocity at target (m/s)

  // D6 — O₂ solubility (Tier 2: hydrostatic + inlet O₂ fraction)
  // Lab-scale
  c_star_lab:           number; // mmol/L — average C* at lab scale
  df_lm_lab:            number; // mmol/L — log-mean driving force at lab scale
  // Target-scale (primary for OTR risk)
  c_star:               number; // mmol/L — average C* at target scale
  c_star_bot:           number; // mmol/L — C* at sparger (target)
  c_star_top:           number; // mmol/L — C* at headspace (target)
  c_l:                  number; // mmol/L — dissolved O₂ at DO setpoint (target avg C*)
  driving_force:        number; // mmol/L — log-mean (C*−C_L) at target scale
  p_bot_pa:             number; // Pa — absolute pressure at target sparger
  p_top_pa:             number; // Pa — absolute pressure at target headspace

  // D7 — Biomass conversion
  biomass_cdw: number;            // Biomass in g/L CDW (converted if OD600)

  // Viscosity at process temperature
  mu: number;                     // Dynamic viscosity (Pa·s)
}

// --- Risk Domain Results (Section 2.2) ---

export interface OtrRiskResult {
  score: RiskScore;
  kla_required: number;                     // h⁻¹
  kla_lab: number;                          // h⁻¹ (achievable at lab)
  kla_target_conservative: number;          // h⁻¹ (0.5× P/V)
  kla_target_moderate: number;              // h⁻¹ (1.0× P/V)
  kla_target_aggressive: number;            // h⁻¹ (2.0× P/V)
  kla_ratio: number;                        // achievable / required (moderate scenario)
  pv_conservative: number;                  // W/m³
  pv_moderate: number;                      // W/m³
  pv_aggressive: number;                    // W/m³
  correlations_used?: string[];
  kla_std?: number;
  kla_components?: Record<string, number>;
  confidence: Confidence;
  driver: string;
}

export interface MixingRiskResult {
  score: RiskScore;
  theta_mix_lab: number;                    // Lab mixing time (s)
  theta_mix_target: number;                 // Target mixing time (s)
  // Kinetic Damköhler numbers (populated when biomass > 0)
  da_max?: number;                          // Conservative Da (μ_max-based) — primary risk indicator
  da_eff?: number;                          // Informational Da (μ_eff from OUR)
  da_score?: RiskScore;                     // Score based on da_max
  mu_eff?: number;                          // h⁻¹ — bulk-average μ inferred from OUR
  ph_score: RiskScore;                      // pH control score (θ_mix threshold)
  confidence: Confidence;
  driver: string;
}

export interface ShearRiskResult {
  score: RiskScore;
  n_target: number;                         // Target impeller speed (rev/s)
  tip_speed: number;                        // Tip speed at target (m/s)
  tip_speed_threshold: number;              // Organism threshold (m/s)
  tip_speed_ratio: number;                  // tip_speed / threshold (actual / critical)
  tip_speed_margin: number;                 // threshold / tip_speed (critical / actual); <1 = risk
  margin_score: RiskScore;                  // risk score derived from tip_speed_margin
  confidence: Confidence;
  driver: string;
}

export interface Co2RiskResult {
  score: RiskScore;
  activated: boolean;                       // Whether detailed calc was triggered
  cer?: number;                             // CO₂ evolution rate (mmol/L/h)
  kla_co2?: number;                         // kLa for CO₂ (h⁻¹)
  y_co2_out?: number;                       // Exhaust gas CO₂ mole fraction (−)
  pco2_gas_avg?: number;                    // Log-mean gas-phase pCO₂ (bar)
  pco2_bulk?: number;                       // Dissolved CO₂ driving force contribution (bar)
  pco2_bottom?: number;                     // Total pCO₂ at vessel bottom (bar)
  dp_hydro?: number;                        // Hydrostatic pressure (Pa)
  pco2_critical?: number;                   // Organism inhibition threshold (bar)
  pco2_margin?: number;                     // pco2_critical / pco2_bottom; <1 = risk
  confidence: Confidence;
  driver: string;
}

export interface HeatRiskResult {
  score: RiskScore;
  q_metabolic: number;                      // Metabolic heat generation (kW)
  a_jacket: number;                         // Jacket surface area (m²)
  dt_lm: number;                            // Log-mean temperature difference (K)
  q_cool_max: number;                       // Maximum cooling capacity (kW)
  heat_ratio: number;                       // Q_metabolic / Q_cool_max
  t_cw_outlet?: number;                     // Computed cooling water outlet temp (°C) — Stage 5
  confidence: Confidence;
  driver: string;
}

// --- Primary Bottleneck (Section 2.3) ---

export type RiskDomain = "otr" | "mixing" | "shear" | "co2" | "heat";

export interface PrimaryBottleneck {
  domain: RiskDomain;
  statement: string;                        // Plain-language bottleneck sentence
  what_would_change: string;                // Actionable input change suggestion
}

// --- Overall Assessment Result (Section 6) ---

export interface AssessmentResults {
  otr: OtrRiskResult;
  mixing: MixingRiskResult;
  shear: ShearRiskResult;
  co2: Co2RiskResult;
  heat: HeatRiskResult;
  primary_bottleneck: PrimaryBottleneck;
  overall_confidence: Confidence;
}

// --- Flag (soft warnings, Section 3.2) ---

export interface AssessmentFlag {
  domain?: RiskDomain;                      // Which domain the flag relates to (optional)
  message: string;                          // Warning message text
}

// --- Full Assessment (Section 6 Data Model) ---

export interface Assessment {
  id: string;                               // UUID
  user_id: string;                          // UUID
  created_at: string;                       // ISO timestamp
  inputs: ProcessInputs;
  derived: DerivedParameters;
  results: AssessmentResults;
  report_id: string | null;
  flags: AssessmentFlag[];
}

// --- Estimation Transparency (Section 1.4) ---

export interface EstimationTransparency {
  parameters_entered: number;
  parameters_total: number;
  estimated_count: number;
  confidence_label: Confidence;
}
