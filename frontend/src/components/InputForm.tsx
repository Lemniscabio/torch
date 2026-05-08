"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type {
  OrganismClass,
  OrganismSpecies,
  ProcessType,
  ProcessInputs,
  ImpellerType,
  BiomassUnit,
  BiomassDensityCategory,
  ScaleupCriterion,
  OurMode,
  Confidence,
} from "@/lib/types";
import {
  INPUT_DEFAULTS,
  IMPELLER_CONSTANTS,
  BATCH_DEFAULTS,
  FED_BATCH_DEFAULTS,
  BIOMASS_DENSITY_REPRESENTATIVE_CDW,
  getOurPeakBounds,
  getOurPeakByCategory,
  getRepresentativeBiomassCdw,
  NON_NEWTONIAN_BIOMASS_THRESHOLD,
} from "@/lib/constants";
import { runAssessment } from "@/lib/engine";
import { setAssessment, setFormDraft } from "@/lib/store";
import AnalyzingAnimation, { ANALYZING_DURATION_MS } from "@/components/AnalyzingAnimation";

// --- Static option arrays ---

const BACTERIA_SPECIES: { value: OrganismSpecies; label: string }[] = [
  { value: "e_coli", label: "Escherichia coli" },
  { value: "b_subtilis", label: "Bacillus subtilis" },
  { value: "other_bacteria", label: "Other bacterium" },
];

const YEAST_SPECIES: { value: OrganismSpecies; label: string }[] = [
  { value: "s_cerevisiae", label: "Saccharomyces cerevisiae" },
  { value: "p_pastoris", label: "Pichia pastoris" },
  { value: "other_yeast", label: "Other yeast" },
];

const IMPELLER_OPTIONS: { value: ImpellerType; label: string; icon: string; desc: string }[] = [
  { value: "rushton",       label: "Rushton",       icon: "⊞", desc: "High shear, high kLa" },
  { value: "pitched_blade", label: "Pitched blade", icon: "⊿", desc: "Axial flow, moderate shear" },
  { value: "marine",        label: "Marine",        icon: "⌁", desc: "Low shear, gentle mixing" },
  { value: "unknown",       label: "Unknown",       icon: "?",      desc: "Conservative estimates" },
];

const HD_PRESETS = [1.0, 1.2, 1.5, 2.0, 2.5, 3.0];
const DT_PRESETS = [0.2, 0.4, 0.6];
const SCALE_MULTIPLIERS = [10, 100, 1000] as const;
const SCALEUP_CRITERION_OPTIONS: {
  value: ScaleupCriterion;
  label: "P/V" | "kLa" | "Tip speed";
  description: "Power per volume" | "mass transfer coefficient" | "shear";
}[] = [
  { value: "power_per_volume", label: "P/V", description: "Power per volume" },
  { value: "kla", label: "kLa", description: "mass transfer coefficient" },
  { value: "shear", label: "Tip speed", description: "shear" },
];

const OXYGEN_INLET_OPTIONS = [
  { value: 20.9, key: "air", label: "Air", percentage: "21%" },
  { value: 40, key: "mild_enriched", label: "Mildly enriched air", percentage: "40%" },
  { value: 60, key: "high_enriched", label: "Highly enriched air", percentage: "60%" },
  { value: 100, key: "pure_oxygen", label: "Pure oxygen", percentage: "100%" },
] as const;

const BIOMASS_DENSITY_OPTIONS: {
  value: BiomassDensityCategory;
  label: string;
  range: string;
  assumption: string;
  description: string;
}[] = [
  {
    value: "low_density",
    label: "Low density",
    range: "<60 g/L CDW",
    assumption: "Newtonian",
    description: "Uses 20 g/L CDW as the representative peak biomass.",
  },
  {
    value: "high_density",
    label: "High density",
    range: "\u226560 g/L CDW",
    assumption: "Non-Newtonian",
    description: "Uses 100 g/L CDW as the representative peak biomass.",
  },
];

// --- Form state ---

export interface FormState {
  // Step A
  organism_class: OrganismClass | "";
  organism_species: OrganismSpecies | "";
  process_type: ProcessType | "";
  // Batch sub-config
  batch_x0: string;
  batch_s0: string;
  // Fed-batch sub-config
  fed_batch_fill_pct: string;
  fed_batch_time_h: string;

  // Step B
  v_lab: string;
  v_target: string;
  scaleup_criterion: ScaleupCriterion;

  // Step C (lab-scale)
  vessel_model: string;
  h_d_lab: string;
  h_d_target: string;
  h_d_target_same_as_lab: boolean;
  dt_ratio_lab: string;
  dt_ratio_target: string;
  dt_ratio_target_same_as_lab: boolean;
  n_impellers: string;
  n_impellers_target: string;
  n_impellers_target_same_as_lab: boolean;
  n_impellers_overridden: boolean;
  impeller_type: ImpellerType;
  rpm: string;
  vvm: string;

  // Step D — Oxygen
  biomass: string;
  biomass_unit: BiomassUnit;
  biomass_density_category: BiomassDensityCategory | "";
  our_mode: OurMode;
  our_measured: string;
  our_estimate_override: string;
  do_setpoint: string;
  o2_inlet: string;
  // Step D — Thermal
  temperature: string;
  t_cw_inlet: string;
  cooling_water_flowrate: string;
}

const INITIAL_STATE: FormState = {
  organism_class: "",
  organism_species: "",
  process_type: "",
  batch_x0: String(BATCH_DEFAULTS.x0_g_L),
  batch_s0: String(BATCH_DEFAULTS.s0_g_L),
  fed_batch_fill_pct: String(FED_BATCH_DEFAULTS.initial_fill_pct),
  fed_batch_time_h: String(FED_BATCH_DEFAULTS.batch_time_h),
  v_lab: "",
  v_target: "",
  scaleup_criterion: "power_per_volume",
  vessel_model: "",
  h_d_lab: String(INPUT_DEFAULTS.h_d_lab),
  h_d_target: "",
  h_d_target_same_as_lab: false,
  dt_ratio_lab: IMPELLER_CONSTANTS[INPUT_DEFAULTS.impeller_type].d_t_ratio.toFixed(1),
  dt_ratio_target: IMPELLER_CONSTANTS[INPUT_DEFAULTS.impeller_type].d_t_ratio.toFixed(1),
  dt_ratio_target_same_as_lab: true,
  n_impellers: String(inferImpellers(INPUT_DEFAULTS.h_d_lab)),
  n_impellers_target: String(inferImpellers(INPUT_DEFAULTS.h_d_lab)),
  n_impellers_target_same_as_lab: true,
  n_impellers_overridden: false,
  impeller_type: INPUT_DEFAULTS.impeller_type,
  rpm: "",
  vvm: String(INPUT_DEFAULTS.vvm),
  biomass: "",
  biomass_unit: INPUT_DEFAULTS.biomass_unit,
  biomass_density_category: "",
  our_mode: INPUT_DEFAULTS.our_mode,
  our_measured: "",
  our_estimate_override: "",
  do_setpoint: String(INPUT_DEFAULTS.do_setpoint),
  o2_inlet: String(INPUT_DEFAULTS.o2_inlet),
  temperature: "",
  t_cw_inlet: String(INPUT_DEFAULTS.t_cw_inlet),
  cooling_water_flowrate: String(INPUT_DEFAULTS.cooling_water_flowrate_lpm),
};

// --- Validation types ---

interface ValidationErrors {
  [key: string]: string | undefined;
}

interface SoftWarning {
  message: string;
}

// --- Step definitions ---

interface StepDef {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
}

const ALL_STEPS: StepDef[] = [
  { id: "a", title: "What are you scaling?",         subtitle: "Organism & process type",       icon: "01" },
  { id: "b", title: "How big are you going?",        subtitle: "Lab & target volumes",           icon: "02" },
  { id: "c", title: "Your lab-scale setup",          subtitle: "Lab vessel, impeller & agitation", icon: "03" },
  { id: "d", title: "Process characterisation",      subtitle: "Biomass, oxygen & thermal",     icon: "04" },
];

// --- Helpers ---

function inferImpellers(hd: number): number {
  if (hd > 2.5) return 3;
  if (hd > 1.5) return 2;
  return 1;
}

function inferHdFromVolume(volumeL: number): number {
  if (volumeL > 10000) return 2.8;
  if (volumeL > 5000)  return 2.5;
  if (volumeL > 1000)  return 2.2;
  if (volumeL > 100)   return 1.8;
  return 1.2;
}

function speciesDisplayName(species: OrganismSpecies | ""): string {
  const all = [...BACTERIA_SPECIES, ...YEAST_SPECIES];
  return all.find((s) => s.value === species)?.label ?? "organism";
}

function densityCategoryLabel(category: BiomassDensityCategory): string {
  return BIOMASS_DENSITY_OPTIONS.find((option) => option.value === category)?.label ?? category;
}

function canEstimateOur(species: OrganismSpecies | ""): boolean {
  return species ? getOurPeakBounds(species as OrganismSpecies) !== undefined : true;
}

const ORGANISM_INFO: Record<string, { traits: string }> = {
  e_coli:         { traits: "High OUR, shear tolerant" },
  b_subtilis:     { traits: "Moderate OUR, sporulation" },
  s_cerevisiae:   { traits: "Lower OUR, shear sensitive" },
  p_pastoris:     { traits: "Dual metabolism, shear sensitive" },
  other_bacteria: { traits: "Conservative estimates" },
  other_yeast:    { traits: "Conservative estimates" },
};

function RequiredMark() {
  return (
    <span className="text-risk-high ml-1 text-base font-semibold leading-none align-top" aria-hidden="true">*</span>
  );
}

/** Range / cross-field checks — omit empty required fields (those are checked on Continue). */
function getInlineRangeError(key: keyof FormState, f: FormState): string | undefined {
  switch (key) {
    case "v_lab": {
      if (!f.v_lab.trim()) return undefined;
      const v = parseFloat(f.v_lab);
      if (isNaN(v) || v <= 0) return "Volume must be greater than zero.";
      if (v > 1000) return "Lab volume must not exceed 1 000 L.";
      return undefined;
    }
    case "v_target": {
      if (!f.v_target.trim()) return undefined;
      const vt = parseFloat(f.v_target);
      const vl = parseFloat(f.v_lab);
      if (vt <= 0) return "Volume must be greater than zero.";
      if (!isNaN(vl) && vl > 0 && vt <= vl) return "Target scale must be larger than lab scale.";
      return undefined;
    }
    case "rpm": {
      if (!f.rpm.trim()) return undefined;
      const r = parseFloat(f.rpm);
      if (r <= 0) return "RPM must be greater than zero.";
      if (r > 3000) return "RPM must not exceed 3 000.";
      return undefined;
    }
    case "vvm": {
      if (!f.vvm.trim()) return undefined;
      const v = parseFloat(f.vvm);
      if (v < 0.1 || v > 5.0) return "VVM must be between 0.1 and 5.0.";
      return undefined;
    }
    case "h_d_lab":
    case "h_d_target": {
      const raw = f[key];
      if (!raw.trim()) return undefined;
      const h = parseFloat(raw);
      if (h < 0.5 || h > 4.0) return "H/D ratio must be between 0.5 and 4.0.";
      return undefined;
    }
    case "dt_ratio_lab":
    case "dt_ratio_target": {
      const raw = f[key];
      if (!raw.trim()) return undefined;
      const ratio = parseFloat(raw);
      if (isNaN(ratio) || ratio < 0.1 || ratio > 0.8) return "D/T ratio must be between 0.1 and 0.8.";
      return undefined;
    }
    case "biomass": {
      if (!f.biomass.trim()) return undefined;
      const b = parseFloat(f.biomass);
      if (b <= 0) return "Biomass must be greater than zero.";
      if (f.biomass_unit === "g_L_CDW" && b > 200)
        return `Biomass of ${b} g/L exceeds the maximum supported value (200 g/L).`;
      return undefined;
    }
    case "temperature": {
      if (!f.temperature.trim()) return undefined;
      const t = parseFloat(f.temperature);
      if (t < 15 || t > 55) return "Temperature must be between 15°C and 55°C.";
      return undefined;
    }
    case "do_setpoint": {
      if (f.do_setpoint === "") return undefined;
      const d = parseFloat(f.do_setpoint);
      if (isNaN(d) || d < 0 || d > 100) return "DO setpoint must be between 0% and 100%.";
      return undefined;
    }
    case "our_measured": {
      if (f.our_mode !== "measured") return undefined;
      if (!f.our_measured.trim()) return undefined;
      const o = parseFloat(f.our_measured);
      if (o <= 0 || o > 500) return "OUR must be between 0 and 500 mmol/L/h.";
      return undefined;
    }
    default:
      return undefined;
  }
}

// --- Component ---

interface InputFormProps {
  onStateChange?: (state: FormState) => void;
  initialValues?: FormState;
}

export default function InputForm({ onStateChange, initialValues }: InputFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({ ...INITIAL_STATE, ...initialValues });
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [showAnalyzing, setShowAnalyzing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const stepContentRef = useRef<HTMLDivElement>(null);

  const steps = ALL_STEPS;
  const totalSteps = steps.length;
  const isLastStep = currentStep >= totalSteps - 1;

  useEffect(() => {
    onStateChange?.(form);
  }, [form, onStateChange]);

  const set = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => {
        const next = { ...prev, [key]: value };

        if (key === "organism_class") {
          if (value === "bacteria" && !prev.temperature)
            next.temperature = String(INPUT_DEFAULTS.temperature_bacteria);
          else if (value === "yeast" && !prev.temperature)
            next.temperature = String(INPUT_DEFAULTS.temperature_yeast);
          next.organism_species = "";
        }

        if (key === "organism_species" && !canEstimateOur(value as OrganismSpecies | "")) {
          next.our_mode = "measured";
        }

        if (key === "v_target") {
          const vol = parseFloat(value as string);
          if (!isNaN(vol) && vol > 0 && !prev.h_d_target_same_as_lab) {
            const inferredHd = inferHdFromVolume(vol);
            next.h_d_target = String(inferredHd);
          }
        }

        if (key === "h_d_lab" && !prev.n_impellers_overridden) {
          const hd = parseFloat(value as string);
          if (!isNaN(hd) && hd > 0)
            next.n_impellers = String(inferImpellers(hd));
        }

        if (key === "impeller_type") {
          const ratio = IMPELLER_CONSTANTS[value as ImpellerType].d_t_ratio.toFixed(1);
          next.dt_ratio_lab = ratio;
          if (prev.dt_ratio_target_same_as_lab)
            next.dt_ratio_target = ratio;
        }

        if (key === "h_d_target_same_as_lab" && value === true) {
          next.h_d_target = next.h_d_lab;
        }
        if (key === "dt_ratio_target_same_as_lab" && value === true) {
          next.dt_ratio_target = next.dt_ratio_lab;
        }
        if (key === "n_impellers_target_same_as_lab" && value === true) {
          next.n_impellers_target = next.n_impellers;
        }

        if (key === "h_d_lab" && prev.h_d_target_same_as_lab) {
          next.h_d_target = String(value);
        }
        if (key === "dt_ratio_lab" && prev.dt_ratio_target_same_as_lab) {
          next.dt_ratio_target = String(value);
        }
        if (key === "n_impellers" && prev.n_impellers_target_same_as_lab) {
          next.n_impellers_target = String(value);
        }

        return next;
      });

      if (submitted) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }
    },
    [submitted]
  );

  const handleBoundedChange = useCallback(
    (key: keyof FormState, value: string) => {
      set(key, value as never);
      setErrors((prev) => {
        const nextForm = { ...form, [key]: value } as FormState;
        const n: ValidationErrors = { ...prev };
        const err = getInlineRangeError(key, nextForm);
        if (err) n[key] = err; else delete n[key];
        if (key === "v_lab") {
          const vte = getInlineRangeError("v_target", nextForm);
          if (vte) n.v_target = vte; else delete n.v_target;
        }
        return n;
      });
    },
    [form, set]
  );

  // --- Derived display values ---

  const scaleRatio = useMemo(() => {
    const lab = parseFloat(form.v_lab);
    const target = parseFloat(form.v_target);
    if (lab > 0 && target > 0) return target / lab;
    return null;
  }, [form.v_lab, form.v_target]);

  const ourEstimation = useMemo(() => {
    if (form.our_mode !== "estimate") return null;
    if (!form.biomass_density_category || !form.organism_species) return null;
    const species = form.organism_species as OrganismSpecies;
    const category = form.biomass_density_category as BiomassDensityCategory;
    const bounds = getOurPeakBounds(species);
    if (!bounds) return { unsupported: true as const, species_name: speciesDisplayName(form.organism_species) };
    const biomassCdw = getRepresentativeBiomassCdw(category);
    const ourPeak = getOurPeakByCategory(species, category);
    return {
      unsupported: false as const,
      our_peak: ourPeak ?? bounds.lower,
      our_min: bounds.lower,
      our_max: bounds.upper,
      biomass_cdw: biomassCdw,
      category_label: densityCategoryLabel(category),
      rheology: category === "high_density" ? "non-Newtonian" : "Newtonian",
      species_name: speciesDisplayName(form.organism_species),
    };
  }, [form.our_mode, form.biomass_density_category, form.organism_species]);

  const transparency = useMemo(() => {
    const totalParams = 12;
    let entered = 0;
    let estimated = 0;

    if (form.organism_class) entered++;
    if (form.organism_species) entered++;
    if (form.process_type) entered++;
    if (form.v_lab) entered++;
    if (form.v_target) entered++;
    if (form.rpm) entered++;
    if (form.biomass_density_category) entered++;
    if (form.impeller_type) entered++;

    const vvmVal = parseFloat(form.vvm);
    if (!isNaN(vvmVal)) {
      if (vvmVal !== INPUT_DEFAULTS.vvm) entered++; else estimated++;
    }
    const doVal = parseFloat(form.do_setpoint);
    if (!isNaN(doVal)) {
      if (doVal !== INPUT_DEFAULTS.do_setpoint) entered++; else estimated++;
    }
    if (parseFloat(form.temperature)) entered++;
    const tcwVal = parseFloat(form.t_cw_inlet);
    if (!isNaN(tcwVal)) {
      if (tcwVal !== INPUT_DEFAULTS.t_cw_inlet) entered++; else estimated++;
    }

    const ourProvided = form.our_mode === "measured";
    if (ourProvided) entered++; else estimated++;

    let confidence: Confidence;
    if (estimated === 0 && ourProvided) confidence = "high_confidence";
    else if (ourProvided) confidence = "reliable";
    else confidence = "directional";

    const confidenceLabels: Record<Confidence, string> = {
      high_confidence: "High-confidence",
      reliable: "Reliable",
      directional: "Directional",
    };

    return { entered, total: totalParams, estimated, confidence, label: confidenceLabels[confidence] };
  }, [form]);

  // --- Per-step validation ---

  const validateStep = useCallback(
    (stepId: string): ValidationErrors => {
      const errs: ValidationErrors = {};

      if (stepId === "a") {
        if (!form.organism_class) errs.organism_class = "Organism class is required.";
        if (!form.organism_species) errs.organism_species = "Organism species is required.";
        if (!form.process_type) errs.process_type = "Process type is required.";
        if (form.process_type === "batch") {
          const x0 = parseFloat(form.batch_x0);
          const s0 = parseFloat(form.batch_s0);
          if (isNaN(x0) || x0 <= 0) errs.batch_x0 = "Initial biomass must be greater than zero.";
          if (isNaN(s0) || s0 <= 0) errs.batch_s0 = "Initial substrate must be greater than zero.";
        }
        if (form.process_type === "fed_batch") {
          const fill = parseFloat(form.fed_batch_fill_pct);
          const time = parseFloat(form.fed_batch_time_h);
          if (isNaN(fill) || fill <= 0 || fill > 100) errs.fed_batch_fill_pct = "Fill must be between 1% and 100%.";
          if (isNaN(time) || time <= 0) errs.fed_batch_time_h = "Batch phase duration must be greater than zero.";
        }
      }

      if (stepId === "b") {
        if (!form.v_lab) errs.v_lab = "Lab working volume is required.";
        else { const r = getInlineRangeError("v_lab", form); if (r) errs.v_lab = r; }
        if (!form.v_target) errs.v_target = "Target working volume is required.";
        else { const r = getInlineRangeError("v_target", form); if (r) errs.v_target = r; }
      }

      if (stepId === "c") {
        if (!form.rpm) errs.rpm = "RPM is required.";
        else { const r = getInlineRangeError("rpm", form); if (r) errs.rpm = r; }
        if (form.vvm) { const r = getInlineRangeError("vvm", form); if (r) errs.vvm = r; }
        if (form.h_d_target) { const r = getInlineRangeError("h_d_target", form); if (r) errs.h_d_target = r; }
        if (form.h_d_lab) { const r = getInlineRangeError("h_d_lab", form); if (r) errs.h_d_lab = r; }
        if (form.dt_ratio_lab) { const r = getInlineRangeError("dt_ratio_lab", form); if (r) errs.dt_ratio_lab = r; }
        if (form.dt_ratio_target) { const r = getInlineRangeError("dt_ratio_target", form); if (r) errs.dt_ratio_target = r; }
      }

      if (stepId === "d") {
        if (!form.biomass_density_category) errs.biomass_density_category = "Peak biomass category is required.";
        if (!form.temperature) errs.temperature = "Process temperature is required.";
        else { const r = getInlineRangeError("temperature", form); if (r) errs.temperature = r; }
        if (form.do_setpoint !== "") { const r = getInlineRangeError("do_setpoint", form); if (r) errs.do_setpoint = r; }
        if (form.our_mode === "estimate" && !canEstimateOur(form.organism_species))
          errs.our_mode = "OUR estimate is unavailable for this organism. Please enter a measured OUR value.";
        if (form.our_mode === "measured") {
          if (!form.our_measured) errs.our_measured = "Measured OUR value is required.";
          else { const r = getInlineRangeError("our_measured", form); if (r) errs.our_measured = r; }
        }
      }

      return errs;
    },
    [form]
  );

  const validate = useCallback((): ValidationErrors => {
    let allErrs: ValidationErrors = {};
    for (const step of steps) allErrs = { ...allErrs, ...validateStep(step.id) };
    return allErrs;
  }, [steps, validateStep]);

  // --- Soft warnings ---

  const softWarnings = useMemo((): SoftWarning[] => {
    const warnings: SoftWarning[] = [];
    const vLab = parseFloat(form.v_lab);
    const vTarget = parseFloat(form.v_target);
    const temp = parseFloat(form.temperature);
    const hdTarget = parseFloat(form.h_d_target);
    const vvm = parseFloat(form.vvm);
    const biomassCdw = form.biomass_density_category
      ? BIOMASS_DENSITY_REPRESENTATIVE_CDW[form.biomass_density_category]
      : 0;

    if (!isNaN(vTarget) && !isNaN(vLab) && vLab > 0 && vTarget / vLab > 10000)
      warnings.push({ message: "Extreme scale ratio — predictions carry very high uncertainty. Intermediate scale assessment strongly recommended." });
    if (!isNaN(temp) && (temp < 20 || temp > 45))
      warnings.push({ message: "Outside validated range for C* and viscosity correlations." });
    if (!isNaN(hdTarget) && hdTarget > 1.5)
      warnings.push({ message: "Mixing time estimate carries additional uncertainty for H/D > 1.5. Multi-impeller configurations are standard at this scale." });
    if (biomassCdw >= NON_NEWTONIAN_BIOMASS_THRESHOLD)
      warnings.push({ message: "High-density biomass selected — non-Newtonian viscosity treatment will be used for kLa estimates." });
    if (!isNaN(vvm) && (vvm > 2.0 || vvm < 0.3))
      warnings.push({ message: "Gassed power correction carries additional uncertainty outside VVM 0.5–2.0." });

    return warnings;
  }, [form.v_lab, form.v_target, form.temperature, form.h_d_target, form.vvm, form.biomass_density_category]);

  // --- Navigation ---

  const goNext = useCallback(() => {
    const stepId = steps[currentStep].id;
    const errs = validateStep(stepId);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      const firstKey = Object.keys(errs)[0];
      document.getElementById(firstKey)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setDirection("forward");
    setCurrentStep((s) => Math.min(s + 1, totalSteps - 1));
  }, [currentStep, steps, totalSteps, validateStep]);

  const goBack = useCallback(() => {
    setDirection("back");
    setCurrentStep((s) => Math.max(s - 1, 0));
  }, []);

  const goToStep = useCallback(
    (index: number) => {
      if (index > currentStep + 1) return;
      if (index < currentStep) {
        setDirection("back");
      } else {
        const stepId = steps[currentStep].id;
        const errs = validateStep(stepId);
        setErrors(errs);
        if (Object.keys(errs).length > 0) return;
        setDirection("forward");
      }
      setCurrentStep(index);
    },
    [currentStep, steps, validateStep]
  );

  // --- Submit ---

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitted(true);
      const errs = validate();
      setErrors(errs);
      if (Object.keys(errs).length > 0) {
        for (let i = 0; i < steps.length; i++) {
          const stepErrs = validateStep(steps[i].id);
          if (Object.keys(stepErrs).length > 0) {
            setCurrentStep(i);
            setTimeout(() => {
              const firstKey = Object.keys(stepErrs)[0];
              document.getElementById(firstKey)?.scrollIntoView({ behavior: "smooth", block: "center" });
            }, 100);
            return;
          }
        }
        return;
      }

      const biomassDensityCategory = form.biomass_density_category as BiomassDensityCategory;
      const representativeBiomass = getRepresentativeBiomassCdw(biomassDensityCategory);

      const processInputs: ProcessInputs = {
        organism_class:  form.organism_class as ProcessInputs["organism_class"],
        organism_species: form.organism_species as ProcessInputs["organism_species"],
        process_type:    form.process_type as ProcessInputs["process_type"],

        batch_config: form.process_type === "batch" ? {
          x0_g_L: parseFloat(form.batch_x0) || BATCH_DEFAULTS.x0_g_L,
          s0_g_L: parseFloat(form.batch_s0) || BATCH_DEFAULTS.s0_g_L,
        } : undefined,

        fed_batch_config: form.process_type === "fed_batch" ? {
          initial_fill_pct: parseFloat(form.fed_batch_fill_pct) || FED_BATCH_DEFAULTS.initial_fill_pct,
          batch_time_h:     parseFloat(form.fed_batch_time_h)   || FED_BATCH_DEFAULTS.batch_time_h,
        } : undefined,

        v_lab:    parseFloat(form.v_lab),
        v_target: parseFloat(form.v_target),
        scaleup_criterion: form.scaleup_criterion,

        vessel_model:   form.vessel_model || undefined,
        h_d_lab:        parseFloat(form.h_d_lab)    || INPUT_DEFAULTS.h_d_lab,
        h_d_target:     parseFloat(form.h_d_target) || 1.0,
        dt_ratio_lab:   parseFloat(form.dt_ratio_lab) || IMPELLER_CONSTANTS[form.impeller_type].d_t_ratio,
        dt_ratio_target: parseFloat(form.dt_ratio_target) || IMPELLER_CONSTANTS[form.impeller_type].d_t_ratio,
        n_impellers:    parseInt(form.n_impellers)   || 1,
        n_impellers_target: parseInt(form.n_impellers_target) || parseInt(form.n_impellers) || 1,
        impeller_type:  form.impeller_type,
        rpm:            parseFloat(form.rpm),
        vvm:            parseFloat(form.vvm) || INPUT_DEFAULTS.vvm,

        biomass:      representativeBiomass,
        biomass_unit: "g_L_CDW",
        biomass_density_category: biomassDensityCategory,
        our_mode:     form.our_mode,
        our_measured: form.our_mode === "measured" ? parseFloat(form.our_measured) : undefined,

        do_setpoint: parseFloat(form.do_setpoint) ?? INPUT_DEFAULTS.do_setpoint,
        o2_inlet: parseFloat(form.o2_inlet) || INPUT_DEFAULTS.o2_inlet,

        temperature: parseFloat(form.temperature),
        t_cw_inlet:  parseFloat(form.t_cw_inlet) || INPUT_DEFAULTS.t_cw_inlet,
        cooling_water_flowrate_lpm: parseFloat(form.cooling_water_flowrate) || INPUT_DEFAULTS.cooling_water_flowrate_lpm,
      };

      const results = runAssessment(processInputs);
      setAssessment({ inputs: processInputs, derived: results.derived, results });
      localStorage.removeItem("lemnisca_last_assessment_id");
      setFormDraft(form);
      setShowAnalyzing(true);
    },
    [form, validate, steps, validateStep]
  );

  const handleAnalyzingComplete = useCallback(() => {
    router.push("/results");
  }, [router]);

  // --- Render helpers ---

  const speciesOptions = form.organism_class === "bacteria" ? BACTERIA_SPECIES
    : form.organism_class === "yeast" ? YEAST_SPECIES : [];

  const fieldError = (key: string) =>
    errors[key] ? <p className="text-risk-critical text-xs mt-1.5">{errors[key]}</p> : null;

  const inputCls = (key: string, extra = "") =>
    `glass-input block w-full px-3.5 py-2.5 text-sm ${
      errors[key] ? "border-risk-critical/40 bg-risk-critical/[0.03]" : ""
    } ${extra}`;

  const organismAccent = form.organism_class === "yeast" ? "organism-yeast"
    : form.organism_class === "bacteria" ? "organism-bacteria" : "";

  const activeStepDef = steps[currentStep];
  const hdTargetOptions = useMemo(() => {
    const labHd = parseFloat(form.h_d_lab);
    if (isNaN(labHd)) return HD_PRESETS;
    const rounded = Number(labHd.toFixed(1));
    return HD_PRESETS.includes(rounded) ? HD_PRESETS : [...HD_PRESETS, rounded].sort((a, b) => a - b);
  }, [form.h_d_lab]);
  const dtTargetOptions = useMemo(() => {
    const labDt = parseFloat(form.dt_ratio_lab);
    if (isNaN(labDt)) return DT_PRESETS;
    const rounded = Number(labDt.toFixed(1));
    return DT_PRESETS.includes(rounded) ? DT_PRESETS : [...DT_PRESETS, rounded].sort((a, b) => a - b);
  }, [form.dt_ratio_lab]);

  if (showAnalyzing) {
    return (
      <AnalyzingAnimation
        onComplete={handleAnalyzingComplete}
        hd={parseFloat(form.h_d_target) || 2.0}
        nImpellers={parseInt(form.n_impellers_target) || parseInt(form.n_impellers) || 1}
        impellerType={form.impeller_type}
        volume={parseFloat(form.v_target) || undefined}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className={`max-w-3xl mx-auto ${organismAccent}`}>
      {/* Step progress indicator */}
      <div className="mb-6">
        <div className="flex items-center gap-1">
          {steps.map((step, i) => {
            const isActive = i === currentStep;
            const isCompleted = i < currentStep;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => goToStep(i)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all duration-200 ${
                  isActive
                    ? "option-surface-sm option-surface--selected text-accent"
                    : isCompleted
                      ? "option-surface-sm text-silver-300 cursor-pointer"
                      : i > currentStep + 1
                        ? "bg-transparent text-silver-600 opacity-50 cursor-not-allowed"
                        : "bg-transparent text-silver-500 hover:text-silver-400 cursor-pointer"
                }`}
                disabled={i > currentStep + 1}
              >
                {isCompleted ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0">
                    <circle cx="7" cy="7" r="6" stroke="rgba(52,211,153,0.5)" strokeWidth="1.5" />
                    <path d="M4.5 7l1.5 1.5 3.5-3.5" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold border ${
                    isActive
                      ? "border-[color:var(--option-selected-border)] bg-[var(--bg-elevated)] text-accent shadow-sm"
                      : "border-[var(--border-secondary)] bg-[var(--bg-elevated)] text-silver-600"
                  }`}>
                    {step.icon}
                  </span>
                )}
                <span className="hidden sm:inline">{step.subtitle}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 h-0.5 rounded-full overflow-hidden" style={{ background: "var(--range-track)" }}>
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${((currentStep + 1) / totalSteps) * 100}%`,
              background: "linear-gradient(90deg, var(--text-grad-accent-start), var(--text-grad-accent-end))",
            }}
          />
        </div>
      </div>

      {/* Soft warnings */}
      {softWarnings.length > 0 && (
        <div className="mb-4 space-y-2">
          {softWarnings.map((w, i) => (
            <div key={i} className="glass-panel-sm border-risk-moderate/20 bg-risk-moderate/[0.04] text-risk-moderate text-sm px-4 py-2.5 flex items-start gap-2">
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 11a1 1 0 110-2 1 1 0 010 2zm.75-3.5a.75.75 0 01-1.5 0V5a.75.75 0 011.5 0v3.5z" />
              </svg>
              <span>{w.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Step content */}
      <div ref={stepContentRef}>
        <div className="glass-panel overflow-hidden">
          {/* Step header */}
          <div className="px-6 py-5 border-b border-black/[0.04] dark:border-white/[0.04]">
            <h2 className="text-lg font-semibold text-silver-100">{activeStepDef.title}</h2>
            <p className="text-xs text-silver-500 mt-0.5">{activeStepDef.subtitle}</p>
          </div>

          {/* Step body */}
          <div
            key={activeStepDef.id}
            className={`px-6 py-6 ${direction === "forward" ? "animate-step-forward" : "animate-step-back"}`}
          >

            {/* ==================== STEP A ==================== */}
            {activeStepDef.id === "a" && (
              <div className="space-y-5">
                {/* Organism class */}
                <div id="organism_class">
                  <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-silver-500 mb-2">
                    Organism class<RequiredMark />
                  </label>
                  <div className="flex gap-2">
                    {(["bacteria", "yeast"] as OrganismClass[]).map((cls) => (
                      <button key={cls} type="button" onClick={() => set("organism_class", cls)}
                        className={`btn-toggle px-5 py-2.5 text-sm flex items-center gap-2 ${form.organism_class === cls ? "active" : ""}`}>
                        <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold border border-[var(--border-secondary)] bg-[var(--bg-elevated)]">
                          {cls === "bacteria" ? "B" : "Y"}
                        </span>
                        {cls === "bacteria" ? "Bacteria" : "Yeast"}
                      </button>
                    ))}
                  </div>
                  {fieldError("organism_class")}
                </div>

                {/* Organism species */}
                {form.organism_class && (
                  <div id="organism_species" className="animate-fade-in">
                    <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-silver-500 mb-2">
                      Select your organism<RequiredMark />
                    </label>
                    <div className="grid grid-cols-1 gap-2">
                      {speciesOptions.map((s) => {
                        const info = ORGANISM_INFO[s.value];
                        return (
                          <button key={s.value} type="button" onClick={() => set("organism_species", s.value)}
                            className={`flex items-center gap-3 p-3.5 rounded-xl text-left transition-all duration-200 option-surface ${form.organism_species === s.value ? "option-surface--selected" : ""}`}>
                            <span className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold border ${
                              form.organism_species === s.value
                                ? "border-[color:var(--option-selected-border)] bg-[var(--bg-elevated)] text-accent"
                                : "border-[var(--border-primary)] bg-[var(--bg-elevated)] text-silver-400"
                            }`}>
                              {s.value.split("_").map(w => w[0].toUpperCase()).slice(0, 2).join("")}
                            </span>
                            <div className="flex-1 min-w-0">
                              <span className={`text-sm font-medium block ${form.organism_species === s.value ? "text-silver-100" : "text-silver-300"}`}>
                                <em>{s.label}</em>
                              </span>
                              {info && <span className="text-[11px] text-silver-600">{info.traits}</span>}
                            </div>
                            {form.organism_species === s.value && (
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
                                <circle cx="8" cy="8" r="7" stroke="var(--accent-focus)" strokeWidth="1.5" />
                                <path d="M5 8l2 2 4-4" stroke="var(--text-grad-accent-start)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {fieldError("organism_species")}
                  </div>
                )}

                {/* Process type */}
                <div id="process_type">
                  <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-silver-500 mb-2">
                    Process type<RequiredMark />
                  </label>
                  <div className="flex gap-2">
                    {(["batch", "fed_batch"] as ProcessType[]).map((pt) => (
                      <button key={pt} type="button" onClick={() => set("process_type", pt)}
                        className={`btn-toggle px-5 py-2.5 text-sm ${form.process_type === pt ? "active" : ""}`}>
                        {pt === "batch" ? "Batch" : "Fed-batch"}
                      </button>
                    ))}
                  </div>
                  {fieldError("process_type")}
                </div>

                {/* Batch sub-config */}
                {form.process_type === "batch" && (
                  <div className="glass-panel-sm px-4 py-4 space-y-4 animate-fade-in">
                    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-silver-500">
                      Batch initial conditions
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div id="batch_x0">
                        <label className="block text-[11px] text-silver-500 mb-1.5">
                          Initial biomass, X&#x2080; (g/L CDW)
                        </label>
                        <input type="number" value={form.batch_x0}
                          onChange={(e) => set("batch_x0", e.target.value)}
                          className={inputCls("batch_x0")} min={0} step="any" />
                        {fieldError("batch_x0")}
                      </div>
                      <div id="batch_s0">
                        <label className="block text-[11px] text-silver-500 mb-1.5">
                          Initial substrate, S&#x2080; (g/L)
                        </label>
                        <input type="number" value={form.batch_s0}
                          onChange={(e) => set("batch_s0", e.target.value)}
                          className={inputCls("batch_s0")} min={0} step="any" />
                        {fieldError("batch_s0")}
                      </div>
                    </div>
                  </div>
                )}

                {/* Fed-batch sub-config */}
                {form.process_type === "fed_batch" && (
                  <div className="glass-panel-sm px-4 py-4 space-y-4 animate-fade-in">
                    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-silver-500">
                      Fed-batch parameters
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div id="fed_batch_fill_pct">
                        <label className="block text-[11px] text-silver-500 mb-1.5">
                          Initial fill (% of working volume)
                        </label>
                        <input type="number" value={form.fed_batch_fill_pct}
                          onChange={(e) => set("fed_batch_fill_pct", e.target.value)}
                          className={inputCls("fed_batch_fill_pct")} min={1} max={100} step="1" />
                        {fieldError("fed_batch_fill_pct")}
                      </div>
                      <div id="fed_batch_time_h">
                        <label className="block text-[11px] text-silver-500 mb-1.5">
                          Batch phase duration (h)
                        </label>
                        <input type="number" value={form.fed_batch_time_h}
                          onChange={(e) => set("fed_batch_time_h", e.target.value)}
                          className={inputCls("fed_batch_time_h")} min={0} step="any" />
                        {fieldError("fed_batch_time_h")}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ==================== STEP B ==================== */}
            {activeStepDef.id === "b" && (
              <div>
                <div id="v_lab" className="mb-5">
                  <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-silver-500 mb-2">
                    Lab working volume (L)<RequiredMark />
                  </label>
                  <input type="number" value={form.v_lab}
                    onChange={(e) => handleBoundedChange("v_lab", e.target.value)}
                    className={inputCls("v_lab")} placeholder="e.g. 10" min={0} max={1000} step="any" />
                  {fieldError("v_lab")}
                </div>
                <div id="v_target">
                  <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-silver-500 mb-2">
                    Target scale<RequiredMark />
                  </label>
                  {(() => {
                    const labVal = parseFloat(form.v_lab);
                    const hasLab = !isNaN(labVal) && labVal > 0;
                    const currentTarget = parseFloat(form.v_target);
                    const activeMultiplier = hasLab && !isNaN(currentTarget) && currentTarget > 0
                      ? SCALE_MULTIPLIERS.find((m) => {
                          const expected = labVal * m;
                          return Math.abs(expected - currentTarget) <= Math.max(0.02, Math.abs(expected) * 1e-6);
                        })
                      : undefined;
                    return (
                      <div className="flex gap-3">
                        {SCALE_MULTIPLIERS.map((m) => {
                          const targetVol = hasLab ? labVal * m : 0;
                          const isActive = activeMultiplier === m;
                          return (
                            <button key={m} type="button" disabled={!hasLab}
                              onClick={() => handleBoundedChange("v_target", String(targetVol))}
                              className={`flex-1 rounded-xl px-4 py-3.5 text-center transition-all duration-200 option-surface ${isActive ? "option-surface--selected" : ""} ${!hasLab ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}`}>
                              <span className={`text-lg font-semibold font-mono ${isActive ? "text-accent" : "text-silver-300"}`}>
                                {m.toLocaleString()}&times;
                              </span>
                              {hasLab && (
                                <span className="block text-[10px] text-silver-500 mt-1 font-mono">
                                  {targetVol >= 1000
                                    ? `${(targetVol / 1000).toLocaleString("en-GB", { maximumFractionDigits: 1 })} m³`
                                    : `${targetVol.toLocaleString("en-GB")} L`}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}
                  {!form.v_lab && <p className="text-[10px] text-silver-600 mt-2">Enter lab volume first</p>}
                  {fieldError("v_target")}
                </div>
                <div id="scaleup_criterion" className="mt-4">
                  <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-silver-500 mb-2">
                    Scale-up criterion
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {SCALEUP_CRITERION_OPTIONS.map((opt) => {
                      const selected = form.scaleup_criterion === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => set("scaleup_criterion", opt.value)}
                          className={`rounded-xl px-4 py-3.5 text-center transition-all duration-200 option-surface ${selected ? "option-surface--selected" : ""}`}
                        >
                          <span className={`text-sm font-semibold ${selected ? "text-accent" : "text-silver-300"}`}>
                            {opt.value === "kla" ? (
                              <>
                                k<sub>L</sub><span className="underline">a</span>
                              </>
                            ) : (
                              opt.label
                            )}
                          </span>
                          <span className="block text-[10px] text-silver-500 mt-1">
                            {opt.description}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                {scaleRatio !== null && scaleRatio > 0 && (
                  <div className="mt-4 glass-panel-sm px-4 py-3 flex items-center gap-3">
                    <div className="flex items-end gap-1.5 flex-shrink-0">
                      <div className="w-3 h-5 rounded-sm border border-[color:var(--option-selected-border)] bg-[var(--bg-elevated)]" />
                      <svg width="16" height="8" viewBox="0 0 16 8" fill="none" className="mb-1">
                        <path d="M0 4h12m0 0l-3-3m3 3l-3 3" stroke="rgba(56,130,176,0.55)" strokeWidth="1" strokeLinecap="round" />
                      </svg>
                      <div className="w-5 h-8 rounded-sm border border-[color:var(--option-selected-border)] bg-[var(--bg-sunken)]" />
                    </div>
                    <div className="text-sm text-silver-400">
                      Scale ratio:{" "}
                      <span className="font-semibold text-silver-100 font-mono">
                        {scaleRatio.toLocaleString("en-GB", { maximumFractionDigits: 0 })}&times;
                      </span>
                      <span className="text-silver-600 ml-2 text-xs">
                        ({form.v_lab} L &rarr; {Number(form.v_target).toLocaleString("en-GB")} L)
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ==================== STEP C ==================== */}
            {activeStepDef.id === "c" && (
              <div className="space-y-5">
                <p className="text-[11px] text-silver-600 -mt-1">
                  Describe your <strong className="text-silver-400">lab vessel</strong>, then set target-scale geometry and impeller count directly.
                </p>

                {/* Vessel model */}
                <div>
                  <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-silver-500 mb-2">
                    Lab vessel brand/model (optional)
                  </label>
                  <select value={form.vessel_model} onChange={(e) => set("vessel_model", e.target.value)}
                    className="glass-select w-full px-3.5 py-2.5 text-sm">
                    <option value="">Generic STR</option>
                  </select>
                </div>

                {/* Impeller type */}
                <div>
                  <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-silver-500 mb-2">
                    Impeller type
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {IMPELLER_OPTIONS.map((imp) => (
                      <button key={imp.value} type="button" onClick={() => set("impeller_type", imp.value)}
                        className={`flex flex-col items-center py-3.5 px-2 rounded-xl text-sm transition-all duration-200 ${
                          form.impeller_type === imp.value
                            ? "option-surface option-surface--selected text-silver-100"
                            : "option-surface text-silver-500"
                        }`}>
                        <span className="text-2xl mb-1">{imp.icon}</span>
                        <span className="text-xs font-medium">{imp.label}</span>
                        <span className="text-[9px] text-silver-600 mt-0.5">{imp.desc}</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-silver-600 mt-1.5">
                    Default D/T: {IMPELLER_CONSTANTS[form.impeller_type].d_t_ratio.toFixed(1)} | Np: {IMPELLER_CONSTANTS[form.impeller_type].np}
                  </p>
                </div>

                {/* RPM + VVM */}
                <div className="grid grid-cols-2 gap-4">
                  <div id="rpm">
                    <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-silver-500 mb-2">
                      Agitation at peak demand (RPM)<RequiredMark />
                    </label>
                    <input type="number" value={form.rpm}
                      onChange={(e) => handleBoundedChange("rpm", e.target.value)}
                      className={inputCls("rpm")} placeholder="At highest-demand point" min={0} max={3000} />
                    {fieldError("rpm")}
                  </div>
                  <div id="vvm">
                    <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-silver-500 mb-2">
                      Airflow at peak demand (VVM)
                    </label>
                    <input type="number" value={form.vvm}
                      onChange={(e) => handleBoundedChange("vvm", e.target.value)}
                      className={inputCls("vvm")} min={0.1} max={5} step="0.1" />
                    {fieldError("vvm")}
                  </div>
                </div>

                {/* H/D ratios */}
                <div className="grid grid-cols-2 gap-4">
                  <div id="h_d_lab">
                    <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-silver-500 mb-2">
                      H/D ratio (lab vessel)
                    </label>
                    <input type="number" value={form.h_d_lab}
                      onChange={(e) => handleBoundedChange("h_d_lab", e.target.value)}
                      className={inputCls("h_d_lab")} min={0.5} max={4} step="0.1" />
                    {fieldError("h_d_lab")}
                  </div>
                  <div id="h_d_target" className="min-h-[112px]">
                    <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-silver-500 mb-2">
                      H/D ratio (target vessel)
                    </label>
                    <button
                      type="button"
                      onClick={() => set("h_d_target_same_as_lab", !form.h_d_target_same_as_lab)}
                      className={`btn-toggle w-full px-3 py-2.5 text-xs mb-2 ${form.h_d_target_same_as_lab ? "active" : ""}`}
                    >
                      Same as lab scale
                    </button>
                    <div className="flex gap-1.5 flex-wrap">
                      {hdTargetOptions.map((p) => (
                        <button key={p} type="button" onClick={() => { set("h_d_target_same_as_lab", false); set("h_d_target", String(p)); }}
                          className={`text-[11px] px-2.5 py-1.5 rounded-lg transition-all duration-200 ${
                            parseFloat(form.h_d_target) === p
                              ? "option-surface-sm option-surface--selected text-silver-100"
                              : "option-surface-sm text-silver-500"
                          }`}>
                          {p}
                        </button>
                      ))}
                    </div>
                    {fieldError("h_d_target")}
                  </div>
                </div>

                {/* D/T ratios */}
                <div className="grid grid-cols-2 gap-4">
                  <div id="dt_ratio_lab">
                    <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-silver-500 mb-2">
                      D/T ratio (lab vessel)
                    </label>
                    <input type="number" value={form.dt_ratio_lab}
                      onChange={(e) => handleBoundedChange("dt_ratio_lab", e.target.value)}
                      className={inputCls("dt_ratio_lab")} min={0.1} max={0.8} step="0.01" />
                    {fieldError("dt_ratio_lab")}
                  </div>
                  <div id="dt_ratio_target" className="min-h-[112px]">
                    <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-silver-500 mb-2">
                      D/T ratio (target vessel)
                    </label>
                    <button
                      type="button"
                      onClick={() => set("dt_ratio_target_same_as_lab", !form.dt_ratio_target_same_as_lab)}
                      className={`btn-toggle w-full px-3 py-2.5 text-xs mb-2 ${form.dt_ratio_target_same_as_lab ? "active" : ""}`}
                    >
                      Same as lab scale
                    </button>
                    <div className="flex gap-1.5 flex-wrap">
                      {dtTargetOptions.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => { set("dt_ratio_target_same_as_lab", false); set("dt_ratio_target", p.toFixed(1)); }}
                          className={`text-[11px] px-2.5 py-1.5 rounded-lg transition-all duration-200 ${
                            parseFloat(form.dt_ratio_target) === p
                              ? "option-surface-sm option-surface--selected text-silver-100"
                              : "option-surface-sm text-silver-500"
                          }`}
                        >
                          {p.toFixed(1)}
                        </button>
                      ))}
                    </div>
                    {fieldError("dt_ratio_target")}
                  </div>
                </div>

                {/* Number of impellers (lab + target) */}
                <div className="grid grid-cols-2 gap-4">
                  <div id="n_impellers">
                    <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-silver-500 mb-2">
                      Number of impellers (lab vessel)
                      {!form.n_impellers_overridden && form.n_impellers && (
                        <span className="text-silver-600 font-normal normal-case tracking-normal italic ml-2">
                          ~auto-inferred from H/D
                        </span>
                      )}
                    </label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4].map((n) => (
                        <button key={n} type="button"
                          onClick={() => { set("n_impellers", String(n)); set("n_impellers_overridden", true); }}
                          className={`w-11 h-11 rounded-xl text-sm font-mono transition-all duration-200 ${
                            form.n_impellers === String(n)
                              ? "option-surface option-surface--selected text-silver-100"
                              : "option-surface text-silver-500"
                          }`}>
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div id="n_impellers_target" className="min-h-[112px]">
                    <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-silver-500 mb-2">
                      Number of impellers (target vessel)
                    </label>
                    <button
                      type="button"
                      onClick={() => set("n_impellers_target_same_as_lab", !form.n_impellers_target_same_as_lab)}
                      className={`btn-toggle w-full px-3 py-2.5 text-xs mb-2 ${form.n_impellers_target_same_as_lab ? "active" : ""}`}
                    >
                      Same as lab scale
                    </button>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4].map((n) => (
                        <button
                          key={`target-${n}`}
                          type="button"
                          onClick={() => { set("n_impellers_target_same_as_lab", false); set("n_impellers_target", String(n)); }}
                          className={`text-[11px] px-2.5 py-1.5 rounded-lg font-mono transition-all duration-200 ${
                            form.n_impellers_target === String(n)
                              ? "option-surface-sm option-surface--selected text-silver-100"
                              : "option-surface-sm text-silver-500"
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ==================== STEP D ==================== */}
            {activeStepDef.id === "d" && (
              <div className="space-y-6">

                {/* ── Sub-section: Oxygen ── */}
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-silver-500 mb-4">
                    Oxygen at peak demand
                  </p>
                  <div className="space-y-5">

                    {/* Peak biomass category */}
                    <div id="biomass_density_category">
                      <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-silver-500 mb-2">
                        Peak biomass<RequiredMark />
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {BIOMASS_DENSITY_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => set("biomass_density_category", option.value)}
                            className={`text-left p-4 rounded-xl transition-all duration-200 option-surface ${
                              form.biomass_density_category === option.value ? "option-surface--selected" : ""
                            }`}
                          >
                            <span className="block text-sm font-medium text-silver-200">{option.label}</span>
                            <span className="block text-[11px] text-accent mt-1">
                              {option.range} · {option.assumption}
                            </span>
                            <span className="block text-[10px] text-silver-600 mt-1.5">{option.description}</span>
                          </button>
                        ))}
                      </div>
                      {fieldError("biomass_density_category")}
                    </div>

                    {/* OUR mode */}
                    <div id="our_mode">
                      <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-silver-500 mb-3">
                        Oxygen uptake rate (OUR) at peak demand
                      </label>
                      <p className="text-[11px] text-silver-600 mb-3 -mt-1">
                        {form.organism_species
                          ? "Estimate mode uses microbe physiology and the selected biomass density category."
                          : "Select your organism and biomass density to see the OUR estimate."}
                      </p>
                      <div className="space-y-2">
                        {/* Measured */}
                        <label className={`flex items-start gap-3 p-4 rounded-xl cursor-pointer transition-all duration-200 option-surface ${form.our_mode === "measured" ? "option-surface--selected" : ""}`}>
                          <input type="radio" name="our_mode" value="measured" checked={form.our_mode === "measured"} onChange={() => set("our_mode", "measured")} className="mt-0.5 accent-accent" />
                          <div className="flex-1">
                            <span className="text-sm font-medium text-silver-200">Yes, I have a measured value</span>
                            <p className="text-[10px] text-silver-600 mt-0.5">Highest confidence &mdash; upgrades all domains</p>
                            {form.our_mode === "measured" && (
                              <div className="mt-3" id="our_measured">
                                <label className="block text-[11px] text-silver-600 mb-1.5">
                                  OUR (mmol/L/h)<RequiredMark />
                                </label>
                                <input type="number" value={form.our_measured}
                                  onChange={(e) => handleBoundedChange("our_measured", e.target.value)}
                                  className={inputCls("our_measured")} placeholder="e.g. 45" min={0} max={500} step="any" />
                                {fieldError("our_measured")}
                              </div>
                            )}
                          </div>
                        </label>

                        {/* Estimate */}
                        <label className={`flex items-start gap-3 p-4 rounded-xl transition-all duration-200 option-surface ${
                          form.our_mode === "estimate" ? "option-surface--selected" : ""
                        } ${!canEstimateOur(form.organism_species) ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}>
                          <input
                            type="radio"
                            name="our_mode"
                            value="estimate"
                            checked={form.our_mode === "estimate"}
                            disabled={!canEstimateOur(form.organism_species)}
                            onChange={() => set("our_mode", "estimate")}
                            className="mt-0.5 accent-accent"
                          />
                          <div className="flex-1">
                            <span className="text-sm font-medium text-silver-200">Estimate from microbe physiology and cell density</span>
                            <p className="text-[10px] text-silver-600 mt-0.5">
                              {canEstimateOur(form.organism_species)
                                ? "Directional confidence for OTR domain"
                                : "Unavailable for other bacteria/yeast; enter measured OUR"}
                            </p>
                            {form.our_mode === "estimate" && (
                              <div className="mt-3">
                                {ourEstimation ? (
                                  ourEstimation.unsupported ? (
                                    <div className="glass-panel-sm border-[var(--border-primary)] bg-[var(--bg-sunken)] px-4 py-3 text-sm text-risk-moderate italic">
                                      OUR estimate is unavailable for {ourEstimation.species_name}. Please enter a measured OUR value.
                                    </div>
                                  ) : (
                                    <div className="glass-panel-sm border-[var(--border-primary)] bg-[var(--bg-sunken)] px-4 py-3 text-sm text-accent italic">
                                      OUR estimated: ~{ourEstimation.our_peak.toFixed(0)} mmol/L/h
                                      <span className="text-accent/70 block text-xs mt-1">
                                        {ourEstimation.species_name}, {ourEstimation.category_label.toLowerCase()} ({ourEstimation.biomass_cdw.toFixed(0)} g/L CDW, {ourEstimation.rheology})
                                      </span>
                                      <span className="text-accent/70 block text-xs">
                                        Bounds: {ourEstimation.our_min.toFixed(0)}&ndash;{ourEstimation.our_max.toFixed(0)} mmol/L/h
                                      </span>
                                    </div>
                                  )
                                ) : (
                                  <p className="text-xs text-silver-600 italic">Select organism and biomass density to see OUR estimate.</p>
                                )}
                                {fieldError("our_mode")}
                              </div>
                            )}
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* ── Sub-section: Oxygen ── */}
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-silver-500 mb-4">
                        Oxygen
                      </p>
                      <div className="space-y-4">
                        {/* DO setpoint (control point) */}
                        <div id="do_setpoint">
                          <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-silver-500 mb-2">
                            DO setpoint — control point (%)
                          </label>
                          <div className="flex items-center gap-3">
                            <div className="flex-[3] relative">
                              <input type="range" min={0} max={100} value={form.do_setpoint || 30}
                                onChange={(e) => handleBoundedChange("do_setpoint", e.target.value)}
                                className="w-full accent-accent h-1.5" />
                              <div className="flex justify-between text-[9px] text-silver-700 mt-1 px-0.5">
                                <span>0%</span>
                                <span className="text-risk-low/50">20&ndash;40% optimal</span>
                                <span>100%</span>
                              </div>
                            </div>
                            <input type="number" value={form.do_setpoint}
                              onChange={(e) => handleBoundedChange("do_setpoint", e.target.value)}
                              className={inputCls("do_setpoint", "!w-20 flex-shrink-0")} min={0} max={100} />
                          </div>
                          {fieldError("do_setpoint")}
                        </div>

                        {/* Inlet oxygen fraction */}
                        <div id="o2_inlet">
                          <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-silver-500 mb-2">
                            Inlet oxygen enrichment
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            {OXYGEN_INLET_OPTIONS.map((option) => {
                              const selected = parseFloat(form.o2_inlet) === option.value;
                              return (
                                <button
                                  key={option.key}
                                  type="button"
                                  onClick={() => set("o2_inlet", String(option.value))}
                                  className={`btn-toggle px-3 py-2.5 text-left ${selected ? "active" : ""}`}
                                >
                                  <span className="block text-sm">{option.label}</span>
                                  <span className="block text-[10px] text-silver-500 mt-0.5">{option.percentage}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-black/[0.04] dark:border-white/[0.04]" />

                {/* ── Sub-section: Thermal ── */}
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-silver-500 mb-4">
                    Thermal conditions
                  </p>
                  <div className="space-y-4">
                    <div id="temperature">
                      <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-silver-500 mb-2">
                        Process temperature (&deg;C)<RequiredMark />
                      </label>
                      <input type="number" value={form.temperature}
                        onChange={(e) => handleBoundedChange("temperature", e.target.value)}
                        className={inputCls("temperature")}
                        placeholder={form.organism_class === "yeast" ? "Default: 30" : "Default: 37"}
                        min={15} max={55} />
                      {fieldError("temperature")}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div id="t_cw_inlet">
                        <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-silver-500 mb-2">
                          Cooling water inlet (&deg;C)
                        </label>
                        <input type="number" value={form.t_cw_inlet}
                          onChange={(e) => set("t_cw_inlet", e.target.value)}
                          className={inputCls("t_cw_inlet")} min={0} max={40} />
                      </div>
                      <div id="cooling_water_flowrate">
                        <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-silver-500 mb-2">
                          Cooling water flowrate (L/min)
                        </label>
                        <input type="number" value={form.cooling_water_flowrate}
                          onChange={(e) => set("cooling_water_flowrate", e.target.value)}
                          className={inputCls("cooling_water_flowrate")} min={0} step="any" />
                        <p className="text-[10px] text-silver-600 mt-1">
                          Used to compute cooling capacity and outlet temperature.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* Navigation footer */}
          <div className="px-6 py-4 border-t border-black/[0.04] dark:border-white/[0.04] flex items-center justify-between">
            <div className="flex items-center gap-3">
              {currentStep > 0 && (
                <button type="button" onClick={goBack}
                  className="flex items-center gap-1.5 text-sm text-silver-400 hover:text-silver-200 transition-colors">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M8.5 3.5L5 7l3.5 3.5" />
                  </svg>
                  Back
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              {isLastStep ? (
                <button type="submit" className="btn-primary px-6 py-2.5 text-sm font-medium flex items-center gap-2">
                  <span className="relative z-10 flex items-center gap-2">
                    Run risk assessment
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M5.5 3.5L9 7l-3.5 3.5" />
                    </svg>
                  </span>
                </button>
              ) : (
                <button type="button" onClick={goNext} className="btn-primary px-6 py-2.5 text-sm font-medium flex items-center gap-2">
                  <span className="relative z-10 flex items-center gap-2">
                    Continue
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M5.5 3.5L9 7l-3.5 3.5" />
                    </svg>
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
