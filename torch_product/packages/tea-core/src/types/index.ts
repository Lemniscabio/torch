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

export type ImpellerType = "rushton" | "pitched_blade" | "marine" | "unknown";

export type ScaleupCriterion = "power_per_volume" | "kla" | "shear";

// "exhaust_gas" retained for type-safety during transition; engine support
// will be dropped in Stage 3. New UI only exposes "measured" | "estimate".
export type OurMode = "measured" | "estimate" | "exhaust_gas";

export type RiskScore = "low" | "moderate" | "high" | "critical";

export type Confidence = "high_confidence" | "reliable" | "directional";

export type ProcessType      = "batch" | "fed_batch";
export type FeedingFrequency = "continuous" | "1_10min" | "10_30min" | "30plus_min";

// --- Input Parameters (Section 1.1) ---

export interface ProcessInputs {
  // Section A: Process Identity
  organism_class: OrganismClass;
  organism_species: OrganismSpecies;

  // Section B: Scale Definition
  v_lab: number;        // Lab working volume (L), > 0, <= 1000
  v_target: number;     // Target working volume (L), > v_lab
  scaleup_criterion?: ScaleupCriterion; // Scale-up criterion selector, default power_per_volume

  // Section C: Lab-scale Vessel & Agitation
  // Note: these describe the lab vessel; target geometry is derived from v_target + h_d_target.
  vessel_model?: string;            // Lab vessel brand/model (optional)
  h_d_lab: number;                  // H/D ratio (lab), default 1.2, range 0.5–4.0
  h_d_target: number;               // H/D ratio (target), range 0.5–4.0
  n_impellers: number;              // Number of impellers (lab vessel), 1–4
  n_impellers_target?: number;      // Number of impellers (target vessel), defaults to n_impellers
  impeller_type: ImpellerType;      // Default: rushton
  dt_ratio_lab?: number;             // d/T ratio override for lab vessel (default: from impeller type)
  dt_ratio_target?: number;          // d/T ratio override for target vessel (default: from impeller type)
  target_rpm_override?: number;      // What-if only: fix target RPM and compute P/V from geometry
  rpm: number;                      // Agitation at peak demand (RPM), > 0, <= 3000
  vvm: number;                      // Airflow at peak demand (VVM), default 1.0, 0.1–5.0

  // Section D: Oxygen & Biomass
  biomass_cdw_g_l: number;              // Peak biomass (g/L CDW), > 0
  our_mode: OurMode;                // OUR input mode, default: estimate
  our_measured?: number;            // OUR measured value (mmol/L/h), required if our_mode == measured
  o2_inlet?: number;                // Sparger inlet O2 mole fraction (%), default 20.9
  /** @deprecated */
  o2_outlet?: number;               // Exhaust gas outlet O2 (%)
  /** @deprecated */
  gas_flow?: number;                // Exhaust gas flow rate (L/min)
  do_setpoint: number;              // DO setpoint at control point (%), default 30, 0–100
  do_at_bottom_pct?: number;        // DO at vessel bottom (%), default 20; used for driving force in R1

  // Section E: Process type
  process_type:       ProcessType;       // "batch" or "fed_batch"
  feeding_frequency?: FeedingFrequency;  // only relevant for fed_batch

  // Section D: Thermal
  temperature: number;              // Process temperature (°C), 15–55
  t_cw_inlet: number;               // Cooling water inlet temp (°C), default 12, 0–40
  cooling_water_flowrate_lpm?: number; // Cooling water flowrate (L/min), default 30

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
  c_l_lab:              number; // mmol/L — dissolved O₂ at DO setpoint (lab avg C*)
  df_lm_lab:            number; // mmol/L — log-mean driving force at lab scale
  // Target-scale (primary for OTR risk)
  c_star:               number; // mmol/L — average C* at target scale
  c_star_bot:           number; // mmol/L — C* at sparger (target)
  c_star_top:           number; // mmol/L — C* at headspace (target)
  c_l:                  number; // mmol/L — dissolved O₂ at DO setpoint (target avg C*)
  driving_force:        number; // mmol/L — log-mean (C*−C_L) at target scale
  p_bot_pa:             number; // Pa — absolute pressure at target sparger
  p_top_pa:             number; // Pa — absolute pressure at target headspace

  // Viscosity at process temperature
  mu: number;                     // Dynamic viscosity (Pa·s)
}

// --- Risk Domain Results (Section 2.2) ---

export interface OtrRiskResult {
  score: RiskScore;
  score_lab: RiskScore;
  score_target: RiskScore;
  our_peak_selected?: number;               // mmol/L/h
  our_peak_lab?: number;                    // mmol/L/h
  kla_required: number;                     // h⁻¹
  kla_lab: number;                          // h⁻¹
  kla_lab_std?: number;                     // h⁻¹ — 1-σ from kLa ensemble
  kla_target_moderate: number;              // h⁻¹ — achievable kLa at target scale
  kla_target_std?: number;                  // h⁻¹ — 1-σ from kLa ensemble
  kla_ratio: number;                        // OTR/OUR at target scale
  otr_capacity_lab?: number;                // mmol/L/h
  otr_capacity_target?: number;             // mmol/L/h
  otr_our_ratio_lab?: number;
  otr_our_ratio_lab_std?: number;           // 1-σ uncertainty propagated from kLa ensemble
  otr_our_ratio_target?: number;
  otr_our_ratio_target_std?: number;        // 1-σ uncertainty propagated from kLa ensemble
  pv_target: number;                        // W/m³ — P/V at target scale
  confidence: Confidence;
  driver: string;
}

export interface GrowthOxygenScaleRiskResult {
  score: RiskScore;
  mu_o2: number;                         // h⁻¹ — oxygen-limited specific growth rate
  mu_substrate: number;                  // h⁻¹ — substrate-limited specific growth rate
  mu_ratio: number;                      // μ_O2 / μ_substrate
  limiting: "substrate" | "oxygen";
  confidence: Confidence;
  driver: string;
}

export interface GrowthOxygenRiskResult {
  score: RiskScore;                      // worst of lab and target
  lab: GrowthOxygenScaleRiskResult;
  target: GrowthOxygenScaleRiskResult;
  confidence: Confidence;
  driver: string;
}

export interface MixingRiskResult {
  score: RiskScore;
  score_lab?: RiskScore;                    // Lab-scale O2 mixing margin score
  score_target?: RiskScore;                 // Target-scale O2 mixing margin score
  theta_mix_lab: number;                    // Lab mixing time (s) — ensemble mean
  theta_mix_lab_std: number;                // 1-σ from mixing time ensemble
  theta_mix_target: number;                 // Target mixing time (s) — ensemble mean
  theta_mix_target_std: number;             // 1-σ from mixing time ensemble
  process_mixing_ratio_lab:       number;   // τ_process / τ_mix at lab scale
  process_mixing_ratio_lab_std:   number;   // 1-σ propagated from mixing time uncertainty
  process_mixing_ratio_target:    number;   // τ_process / τ_mix at target scale
  process_mixing_ratio_target_std: number;  // 1-σ propagated from mixing time uncertainty
  t_feed_s?:                      number;   // Feed pulse interval (s); undefined for batch
  t_process_lab_s:                number;   // min(τ_feed, τ_O₂) at lab, or τ_O₂ for batch
  t_process_target_s:             number;   // min(τ_feed, τ_O₂) at target, or τ_O₂ for batch
  oxygen_depletion_time_lab_s:    number;   // Raw τ_O₂ at lab scale (s)
  oxygen_depletion_time_target_s: number;   // Raw τ_O₂ at target scale (s)
  confidence: Confidence;
  driver: string;
}

export interface ShearRiskResult {
  score: RiskScore;
  score_lab: RiskScore;                     // Lab-scale tip-speed-margin score
  score_target: RiskScore;                  // Target-scale tip-speed-margin score
  n_lab?: number;                           // Lab impeller speed (rev/s)
  n_target: number;                         // Target impeller speed (rev/s)
  tip_speed_lab?: number;                   // Tip speed at lab (m/s)
  tip_speed: number;                        // Tip speed at target (m/s)
  tip_speed_threshold: number;              // Organism threshold (m/s)
  tip_speed_ratio_lab?: number;             // lab tip_speed / threshold
  tip_speed_margin_lab?: number;            // threshold / lab tip_speed
  tip_speed_margin_lab_std?: number;        // 1-σ from threshold uncertainty
  tip_speed_ratio: number;                  // tip_speed / threshold (actual / critical)
  tip_speed_margin: number;                 // threshold / tip_speed (critical / actual); <1 = risk
  tip_speed_margin_std?: number;            // 1-σ from threshold uncertainty
  margin_score: RiskScore;                  // risk score derived from tip_speed_margin
  margin_score_lab: RiskScore;              // lab-scale risk score derived from tip_speed_margin_lab
  margin_score_target: RiskScore;           // target-scale risk score derived from tip_speed_margin
  confidence: Confidence;
  driver: string;
}

export interface Co2ScaleRiskResult {
  cer: number;                              // CO2 evolution rate (mmol/L/h)
  kla_co2: number;                          // kLa for CO2 (h^-1)
  y_co2_out: number;                        // exhaust gas CO2 mole fraction (-)
  pco2_gas_avg: number;                     // log-mean gas-phase pCO2 (bar)
  pco2_bulk: number;                        // dissolved CO2 contribution (bar)
  pco2_bottom: number;                      // total pCO2 at vessel bottom (bar)
  dp_hydro: number;                         // hydrostatic pressure (Pa)
  pco2_bottom_std: number;                  // 1-σ propagated from kLa ensemble
  pco2_margin: number;                      // pco2_critical / pco2_bottom
  pco2_margin_std: number;                  // 1-σ propagated from kLa ensemble
  margin_score: RiskScore;                  // risk score derived from pco2_margin
  score: RiskScore;                         // scale score (same as margin_score)
}

export interface Co2RiskResult {
  score: RiskScore;
  margin_score?: RiskScore;                // risk score derived from pco2_margin
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
  pco2_margin_std?: number;                 // 1-σ propagated from kLa ensemble
  lab?: Co2ScaleRiskResult;
  target?: Co2ScaleRiskResult;
  confidence: Confidence;
  driver: string;
}

export interface HeatScaleRiskResult {
  q_metabolic: number;                      // Metabolic heat generation (kW)
  a_jacket: number;                         // Jacket area (m^2)
  dt_lm: number;                            // Log-mean temperature difference (K)
  q_cool_max: number;                       // Available cooling capacity (kW)
  heat_ratio: number;                       // Q_metabolic / Q_cool_max
  heat_transfer_margin: number;             // Q_cool_max / Q_metabolic
  heat_transfer_margin_std: number;         // 1-σ from U correlation uncertainty
  margin_score: RiskScore;                  // risk score derived from heat_transfer_margin
  score: RiskScore;                         // scale score (same as margin_score)
  t_cw_outlet: number;                      // Calculated cooling-water outlet temp (C)
  u_overall: number;                        // Overall U (W/m^2-K)
  h_broth: number;                          // Broth-side film coefficient (W/m^2-K)
  h_jacket: number;                         // Jacket-side film coefficient (W/m^2-K)
  r_broth: number;                          // Broth-side resistance (m^2-K/W)
  r_wall: number;                           // Wall resistance (m^2-K/W)
  r_jacket: number;                         // Jacket-side resistance (m^2-K/W)
  r_total: number;                          // Total resistance (m^2-K/W)
  cooling_water_delta_t: number;            // Cooling-water temperature rise (C)
  jacket_re: number;                        // Jacket Reynolds number (-)
  wall_material: "glass" | "stainless_steel";
}

export interface HeatRiskResult {
  score: RiskScore;
  margin_score?: RiskScore;                 // risk score derived from heat_transfer_margin
  q_metabolic: number;                      // Metabolic heat generation (kW)
  a_jacket: number;                         // Jacket surface area (m²)
  dt_lm: number;                            // Log-mean temperature difference (K)
  q_cool_max: number;                       // Maximum cooling capacity (kW)
  heat_ratio: number;                       // Q_metabolic / Q_cool_max
  heat_transfer_margin?: number;            // Q_cool_max / Q_metabolic; lower => higher risk
  heat_transfer_margin_std?: number;        // 1-σ from U correlation uncertainty
  t_cw_outlet?: number;                     // Computed cooling water outlet temp (°C) — Stage 5
  u_overall?: number;                       // Overall U from film/wall resistances (W/m²·K)
  h_broth?: number;                         // Broth-side film coefficient (W/m²·K)
  h_jacket?: number;                        // Jacket-side film coefficient (W/m²·K)
  r_broth?: number;                         // Broth-side thermal resistance (m²·K/W)
  r_wall?: number;                          // Wall thermal resistance (m²·K/W)
  r_jacket?: number;                        // Jacket-side thermal resistance (m²·K/W)
  r_total?: number;                         // Total thermal resistance (m²·K/W)
  cooling_water_delta_t?: number;           // Jacket cooling-water temperature rise (°C)
  jacket_re?: number;                       // Jacket-side Reynolds number (dimensionless)
  wall_material?: "glass" | "stainless_steel";
  lab?: HeatScaleRiskResult;
  target?: HeatScaleRiskResult;
  confidence: Confidence;
  driver: string;
}

// --- Primary Bottleneck (Section 2.3) ---

export type RiskDomain = "otr" | "mixing" | "shear" | "co2" | "heat";

export interface PrimaryBottleneck {
  domain: RiskDomain | null;
  statement: string;                        // Plain-language bottleneck sentence
  what_would_change?: string;               // Deprecated display field (kept for compatibility)
}

// --- Overall Assessment Result (Section 6) ---

export interface AssessmentResults {
  growth_oxygen: GrowthOxygenRiskResult;
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
