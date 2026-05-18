"use client";

import { useMemo } from "react";
import BioreactorDiagram from "@/components/BioreactorDiagram";
import type {
  OrganismClass,
  OrganismSpecies,
  ProcessType,
  BiomassDensityCategory,
  ScaleupCriterion,
} from "@/lib/types";

// Mirrors FormState from InputForm — kept in sync manually
export interface PreviewFormState {
  organism_class: OrganismClass | "";
  organism_species: OrganismSpecies | "";
  process_type: ProcessType | "";
  batch_x0?: string;
  batch_s0?: string;
  fed_batch_fill_pct?: string;
  fed_batch_time_h?: string;
  v_lab: string;
  v_target: string;
  scaleup_criterion?: ScaleupCriterion;
  h_d_lab: string;
  h_d_target: string;
  h_d_target_same_as_lab?: boolean;
  dt_ratio_lab?: string;
  dt_ratio_target?: string;
  dt_ratio_target_same_as_lab?: boolean;
  n_impellers: string;
  n_impellers_target?: string;
  n_impellers_target_same_as_lab?: boolean;
  impeller_type: string;
  rpm: string;
  vvm: string;
  biomass: string;
  biomass_unit: string;
  biomass_density_category?: BiomassDensityCategory | "";
  our_mode: string;
  our_measured: string;
  do_setpoint: string;
  o2_inlet?: string;
  temperature: string;
  t_cw_inlet: string;
  cooling_water_flowrate?: string;
  // optional / legacy
  vessel_model?: string;
  our_estimate_override?: string;
  n_impellers_overridden?: boolean;
}

interface LivePreviewProps {
  formState: PreviewFormState | null;
}

export default function LivePreview({ formState }: LivePreviewProps) {
  const PREVIEW_WIDTH = 200;
  const labVolume = useMemo(() => {
    const value = parseFloat(formState?.v_lab ?? "");
    return Number.isFinite(value) && value > 0 ? value : null;
  }, [formState?.v_lab]);

  const targetVolume = useMemo(() => {
    const value = parseFloat(formState?.v_target ?? "");
    return Number.isFinite(value) && value > 0 ? value : null;
  }, [formState?.v_target]);

  const scaleRatio = useMemo(() => {
    if (labVolume == null || targetVolume == null || labVolume <= 0 || targetVolume <= labVolume) return null;
    return targetVolume / labVolume;
  }, [labVolume, targetVolume]);

  const labHd = parseFloat(formState?.h_d_lab ?? "");
  const targetHd = parseFloat(formState?.h_d_target ?? "");
  const labDt = parseFloat(formState?.dt_ratio_lab ?? "");
  const targetDt = parseFloat(formState?.dt_ratio_target ?? "");
  const labImpellers = parseInt(formState?.n_impellers ?? "", 10);
  const targetImpellers = parseInt(formState?.n_impellers_target ?? formState?.n_impellers ?? "", 10);

  return (
    <div className="sticky top-8 space-y-4">
      <div className="mb-1">
        <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-silver-500">
          Live reactor preview
        </h3>
      </div>

      <div className="glass-panel-sm p-4 min-h-[290px]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] text-silver-500 uppercase tracking-[0.08em]">Target Vessel</span>
          {scaleRatio && (
            <span className="text-[10px] font-mono text-accent-warm font-medium">
              {scaleRatio.toLocaleString("en-GB", { maximumFractionDigits: 0 })}&times; scale-up
            </span>
          )}
        </div>
        <BioreactorDiagram
          hd={Number.isFinite(targetHd) ? targetHd : 2.0}
          dtRatio={Number.isFinite(targetDt) ? targetDt : 0.33}
          nImpellers={Number.isFinite(targetImpellers) && targetImpellers > 0 ? targetImpellers : 1}
          impellerType={formState?.impeller_type || "rushton"}
          volume={targetVolume ?? undefined}
          width={PREVIEW_WIDTH}
        />
      </div>

      <div className="flex items-center justify-center py-0.5">
        <svg width="44" height="44" viewBox="0 0 44 44" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="scale-arrow-grad" x1="22" y1="42" x2="22" y2="2">
              <stop offset="0%" stopColor="rgba(120,136,168,0.3)" />
              <stop offset="100%" stopColor="rgba(88,182,197,0.7)" />
            </linearGradient>
          </defs>
          <circle cx="22" cy="22" r="18" stroke="rgba(255,255,255,0.08)" fill="rgba(255,255,255,0.02)" />
          <path d="M22 29V17" stroke="url(#scale-arrow-grad)" strokeWidth="2" strokeLinecap="round" />
          <path d="M17 21L22 16L27 21" stroke="url(#scale-arrow-grad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <div className="glass-panel-sm p-4 min-h-[290px]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] text-silver-500 uppercase tracking-[0.08em]">Lab Vessel</span>
        </div>
        <BioreactorDiagram
          hd={Number.isFinite(labHd) ? labHd : 1.2}
          dtRatio={Number.isFinite(labDt) ? labDt : 0.33}
          nImpellers={Number.isFinite(labImpellers) && labImpellers > 0 ? labImpellers : 1}
          impellerType={formState?.impeller_type || "rushton"}
          volume={labVolume ?? undefined}
          width={PREVIEW_WIDTH}
        />
      </div>
    </div>
  );
}
