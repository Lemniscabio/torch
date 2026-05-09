"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { ThemeToggle, useTheme } from "@/components/ThemeProvider";
import type {
  RiskScore,
  Confidence,
  RiskDomain,
  OtrRiskResult,
  MixingRiskResult,
  ShearRiskResult,
  Co2RiskResult,
  HeatRiskResult,
  ProcessInputs,
  DerivedParameters,
} from "@/lib/types";
import type { PartialAssessmentResult } from "@/lib/engine";
import {
  RISK_COLOURS,
  VANT_RIET_COALESCING_COEFFICIENT,
  VANT_RIET_COALESCING_PV_EXPONENT,
  VANT_RIET_COALESCING_VS_EXPONENT,
  RUSZKOWSKI_CONSTANT,
  RHO,
  KLA_CO2_O2_RATIO,
  H_CO2,
  G,
  ATMOSPHERIC_PRESSURE_PA,
  METABOLIC_HEAT_FACTOR,
  RQ_DEFAULTS,
  CO2_BIOMASS_THRESHOLD,
  CO2_OUR_THRESHOLD,
} from "@/lib/constants";
import {
  deriveVesselGeometry,
  deriveGasVelocity,
  buildReactorScaleConfigs,
} from "@/lib/engine";
import { deriveOxygenSolubility } from "@/lib/engine/derivations";
import type { ReactorScaleConfig } from "@/lib/engine/reactor_configs";
import { buildOperatingPoint, computeKlaEnsemble } from "@/lib/engine/oxygen/kla_achievable";
import { runHeatCapacityCheck } from "@/lib/engine/heat/heat_capacity";
import GeneratePdfButton from "@/components/GeneratePdfButton";
import type { StoredAssessment } from "@/lib/store";

// --- Props ---

export interface ResultsDashboardProps {
  data: StoredAssessment;
  isExample?: boolean;
  onBackClick?: () => void;
}

// --- Species display labels ---

const SPECIES_LABELS: Record<string, string> = {
  e_coli: "E. coli",
  b_subtilis: "B. subtilis",
  s_cerevisiae: "S. cerevisiae",
  p_pastoris: "P. pastoris",
  other_bacteria: "Other bacterium",
  other_yeast: "Other yeast",
};

// --- Dark theme risk colours ---

const DARK_RISK_COLOURS: Record<RiskScore, string> = {
  low: "#34d399",
  moderate: "#fbbf24",
  high: "#fb923c",
  critical: "#f87171",
};

const LIGHT_RISK_COLOURS: Record<RiskScore, string> = {
  low: "#059669",
  moderate: "#b45309",
  high: "#c2410c",
  critical: "#dc2626",
};

// --- Composite score mapping ---

const SCORE_NUMERIC: Record<RiskScore, number> = {
  low: 15,
  moderate: 40,
  high: 70,
  critical: 95,
};

// --- Helpers ---

function fmt(n: number, decimals = 1): string {
  if (Math.abs(n) >= 1000) return n.toLocaleString("en-GB", { maximumFractionDigits: decimals });
  return n.toFixed(decimals);
}

function fmtInt(n: number): string {
  return Math.round(n).toLocaleString("en-GB");
}

function klaVantRiet(pv: number, vs: number): number {
  const kla_s =
    VANT_RIET_COALESCING_COEFFICIENT *
    Math.pow(pv, VANT_RIET_COALESCING_PV_EXPONENT) *
    Math.pow(vs, VANT_RIET_COALESCING_VS_EXPONENT);
  return kla_s * 3600;
}

function riskColour(score: RiskScore, theme: "light" | "dark" = "dark"): string {
  return theme === "light" ? LIGHT_RISK_COLOURS[score] : DARK_RISK_COLOURS[score];
}

function riskLabel(score: RiskScore): string {
  return score.charAt(0).toUpperCase() + score.slice(1);
}

function confidenceLabel(c: Confidence): string {
  switch (c) {
    case "high_confidence": return "High-confidence";
    case "reliable": return "Reliable";
    case "directional": return "Directional";
  }
}

function riskBadgeClass(score: RiskScore): string {
  return `risk-badge risk-badge-${score}`;
}

function riskGlowClass(score: RiskScore): string {
  return `risk-glow-${score}`;
}

function compositeScore(scores: RiskScore[]): number {
  const sum = scores.reduce((acc, s) => acc + SCORE_NUMERIC[s], 0);
  return Math.round(sum / scores.length);
}

function compositeLabel(score: number, theme: "light" | "dark" = "dark"): { label: string; colour: string } {
  const colours = theme === "light" ? LIGHT_RISK_COLOURS : DARK_RISK_COLOURS;
  if (score <= 20) return { label: "Low Risk", colour: colours.low };
  if (score <= 45) return { label: "Moderate Risk", colour: colours.moderate };
  if (score <= 70) return { label: "High Risk", colour: colours.high };
  return { label: "Critical Risk", colour: colours.critical };
}

// --- Radar chart summary ---

const RADAR_DOMAIN_ORDER: RiskDomain[] = ["otr", "mixing", "shear", "co2", "heat"];

function radarRadius(score: RiskScore): number {
  switch (score) {
    case "low": return 1.0;
    case "moderate": return 0.75;
    case "high": return 0.5;
    case "critical": return 0.25;
  }
}

function RadarChart({
  title,
  scores,
  theme,
}: {
  title: string;
  scores: Record<RiskDomain, RiskScore>;
  theme: "light" | "dark";
}) {
  const chartSize = 280;
  const cx = chartSize / 2;
  const cy = chartSize / 2;
  const maxR = 88;
  const axisLabelOffset = 24;
  const axisLabels: Record<RiskDomain, string> = {
    otr: "OTR",
    mixing: "Mixing",
    shear: "Shear",
    co2: "CO2",
    heat: "Heat",
  };
  const gridStroke = theme === "light" ? "rgba(0,0,0,0.16)" : "rgba(255,255,255,0.16)";
  const axisStroke = theme === "light" ? "rgba(0,0,0,0.22)" : "rgba(255,255,255,0.22)";
  const rings: { level: RiskScore; radius: number }[] = [
    { level: "critical", radius: 0.25 },
    { level: "high", radius: 0.5 },
    { level: "moderate", radius: 0.75 },
    { level: "low", radius: 1.0 },
  ];

  const axisPoints = RADAR_DOMAIN_ORDER.map((domain, index) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / RADAR_DOMAIN_ORDER.length;
    const x = cx + maxR * Math.cos(angle);
    const y = cy + maxR * Math.sin(angle);
    const lx = cx + (maxR + axisLabelOffset) * Math.cos(angle);
    const ly = cy + (maxR + axisLabelOffset) * Math.sin(angle);
    return { domain, angle, x, y, lx, ly };
  });

  const ringPoints = (radiusScale: number): string =>
    axisPoints
      .map(({ angle }) => `${cx + maxR * radiusScale * Math.cos(angle)},${cy + maxR * radiusScale * Math.sin(angle)}`)
      .join(" ");

  const dataPoints = axisPoints.map(({ domain, angle }) => {
    const r = maxR * radarRadius(scores[domain]);
    return {
      domain,
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      score: scores[domain],
    };
  });
  const dataPolygon = dataPoints.map((p) => `${p.x},${p.y}`).join(" ");
  const worstScore = RADAR_DOMAIN_ORDER.reduce<RiskScore>((worst, domain) => {
    const severity: Record<RiskScore, number> = { low: 0, moderate: 1, high: 2, critical: 3 };
    return severity[scores[domain]] > severity[worst] ? scores[domain] : worst;
  }, "low");
  const fillColour = riskColour(worstScore, theme);

  return (
    <div className="glass-panel-sm p-5 w-full max-w-[360px]">
      <p className="text-[11px] font-semibold text-silver-500 uppercase tracking-[0.1em] mb-3 text-center">{title}</p>
      <div className="flex justify-center">
        <svg width={chartSize} height={chartSize} viewBox={`0 0 ${chartSize} ${chartSize}`} role="img" aria-label={`${title} risk radar`}>
          {rings.map((ring) => (
            <polygon
              key={ring.level}
              points={ringPoints(ring.radius)}
              fill={riskColour(ring.level, theme)}
              fillOpacity={0.06}
              stroke={gridStroke}
              strokeWidth="1"
            />
          ))}
          {axisPoints.map((p) => (
            <line key={p.domain} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke={axisStroke} strokeWidth="1" />
          ))}
          <polygon
            points={dataPolygon}
            fill={fillColour}
            fillOpacity={0.24}
            stroke={fillColour}
            strokeWidth="2"
          />
          {dataPoints.map((p) => (
            <circle
              key={p.domain}
              cx={p.x}
              cy={p.y}
              r="4.5"
              fill={riskColour(p.score, theme)}
              stroke={theme === "light" ? "#ffffff" : "#0b1020"}
              strokeWidth="1.5"
            />
          ))}
          {axisPoints.map((p) => (
            <text
              key={`${p.domain}-label`}
              x={p.lx}
              y={p.ly}
              textAnchor={Math.abs(p.lx - cx) < 8 ? "middle" : p.lx > cx ? "start" : "end"}
              dominantBaseline="middle"
              style={{ fontSize: "11px", fill: "var(--text-tertiary)", fontWeight: 600 }}
            >
              {axisLabels[p.domain]}
            </text>
          ))}
        </svg>
      </div>
      <div className="text-[10px] text-silver-600 text-center mt-2">Outer ring: low risk. Inner ring: critical risk.</div>
    </div>
  );
}

// --- Pilot-scale helpers ---

function pilotVolume(vLab: number, vTarget: number): number {
  return Math.sqrt(vLab * vTarget);
}

function derivedAtScale(
  inputs: ProcessInputs,
  baseDerived: DerivedParameters,
  volume: number,
  hd: number,
): DerivedParameters {
  const geometry = deriveVesselGeometry(volume, hd, inputs.impeller_type, inputs.dt_ratio_target);
  const gas = deriveGasVelocity(inputs.vvm, volume, geometry.a_cross);
  return {
    ...baseDerived,
    target_geometry: geometry,
    q_gas_target: gas.q_gas,
    vs_target: gas.vs,
  };
}

// --- Mitigation recommendation ---

function MitigationBlock({
  domain,
  results,
  inputs,
}: {
  domain: RiskDomain;
  results: PartialAssessmentResult;
  inputs: ProcessInputs;
}) {
  const { otr, mixing, shear, co2, heat } = results;
  const score =
    domain === "otr" ? otr.score :
    domain === "mixing" ? mixing.score :
    domain === "shear" ? shear.score :
    domain === "co2" ? co2.score :
    heat.score;

  if (score !== "high" && score !== "critical") return null;

  let recommendation: string;
  switch (domain) {
    case "otr":
      recommendation = `Required kLa of ${fmt(otr.kla_required)} h\u207B\u00B9 exceeds standard P/V achievability at ${fmtInt(inputs.v_target)} L. Options: (1) Reduce target biomass ~20% to bring OUR within standard kLa range. (2) Dual Rushton or Rushton-to-PBT cascade configuration. (3) Pressure overlay (+0.5 bar increases C* by ~15%).`;
      break;
    case "mixing":
      recommendation = `Mixing time at ${fmtInt(inputs.v_target)} L is ~${fmt(mixing.theta_mix_target)} s. O2 mixing margin (t_o2/t_mix) = ${fmt(mixing.o2_mixing_ratio_target ?? 0, 3)} \u2014 oxygen gradients may persist. Options: (1) Increase agitation/mixing efficiency. (2) Reduce peak OUR demand. (3) Increase O2 availability at the same DO control strategy.`;
      break;
    case "shear":
      recommendation = `Tip speed of ${fmt(shear.tip_speed)} m/s at constant P/V exceeds ${SPECIES_LABELS[inputs.organism_species] ?? inputs.organism_species} threshold of ${fmt(shear.tip_speed_threshold)} m/s. Options: (1) Switch to pitched blade turbine. (2) Accept lower P/V with supplementary O\u2082 strategy. (3) Consider scale-up at constant tip speed instead of constant P/V.`;
      break;
    case "co2":
      recommendation = `Estimated pCO\u2082 at vessel bottom is ${fmt(co2.pco2_bottom ?? 0, 2)} bar \u2014 above 0.15 bar inhibitory threshold. Options: (1) Increase sparging rate to enhance CO\u2082 stripping. (2) Reduce biomass target. (3) Lower H/D vessel geometry.`;
      break;
    case "heat":
      recommendation = `Metabolic heat generation of ${fmt(heat.q_metabolic)} kW exceeds jacket cooling capacity of ${fmt(heat.q_cool_max)} kW. Options: (1) Add internal cooling coil. (2) Reduce target biomass or OUR. (3) Lower process temperature if organism permits.`;
      break;
  }

  return (
    <div className="mt-4 glass-panel-sm border-risk-high/20 bg-risk-high/[0.04] p-4">
      <h4 className="text-[11px] font-semibold text-silver-500 uppercase tracking-[0.08em] mb-2">
        Mitigation Recommendation
      </h4>
      <p className="text-sm text-silver-300 leading-relaxed">{recommendation}</p>
    </div>
  );
}

type Band = {
  score: RiskScore;
  label: string;
  min?: number;
  max?: number;
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function Fraction({
  mathNumerator,
  mathDenominator,
  textNumerator,
  textDenominator,
}: {
  mathNumerator: React.ReactNode;
  mathDenominator: React.ReactNode;
  textNumerator: React.ReactNode;
  textDenominator: React.ReactNode;
}) {
  const FractionView = ({ num, den }: { num: React.ReactNode; den: React.ReactNode }) => (
    <span className="inline-flex flex-col items-center w-auto max-w-full">
      <span className="text-base md:text-lg font-semibold text-silver-100 border-b border-silver-500/40 px-0.5 text-center whitespace-nowrap">{num}</span>
      <span className="text-base md:text-lg font-semibold text-silver-300 px-0.5 text-center whitespace-nowrap">{den}</span>
    </span>
  );

  return (
    <div className="glass-panel-sm p-3 border-black/[0.08] dark:border-white/[0.08]">
      <div className="flex flex-wrap items-center justify-center gap-0.5 md:gap-1 text-silver-200 text-center">
        <span className="text-xl font-semibold">Score</span>
        <span className="text-xl font-semibold">=</span>
        <FractionView num={mathNumerator} den={mathDenominator} />
        <span className="text-xl font-semibold">=</span>
        <FractionView num={textNumerator} den={textDenominator} />
      </div>
    </div>
  );
}

function formatBandRange(band: Band): string {
  if (band.min != null && band.max != null) return `${fmt(band.min, 2)}–${fmt(band.max, 2)}`;
  if (band.min != null) return `>${fmt(band.min, 2)}`;
  if (band.max != null) return `<=${fmt(band.max, 2)}`;
  return "—";
}

function inBand(value: number, band: Band): boolean {
  const minOk = band.min == null || value > band.min || Math.abs(value - band.min) < 1e-9;
  const maxOk = band.max == null || value <= band.max || Math.abs(value - band.max) < 1e-9;
  return minOk && maxOk;
}

function scoreFromBands(value: number, bands: Band[]): RiskScore {
  const match = bands.find((b) => inBand(value, b));
  return match?.score ?? "critical";
}

function bandLocalPosition(value: number, band: Band, higherIsSafer: boolean): number {
  const { min, max } = band;
  if (min != null && max != null && max > min) {
    const t = clamp01((value - min) / (max - min));
    return higherIsSafer ? t : 1 - t;
  }
  if (min != null && max == null) {
    const span = Math.max(min, 0.1);
    const t = clamp01((value - min) / span);
    return higherIsSafer ? t : 1 - t;
  }
  if (min == null && max != null && max > 0) {
    const t = clamp01(value / max);
    return higherIsSafer ? t : 1 - t;
  }
  return 0.5;
}

function RiskScale({
  value,
  score,
  bands,
  higherIsSafer,
  theme,
}: {
  value: number;
  score: RiskScore;
  bands: Band[];
  higherIsSafer: boolean;
  theme: "light" | "dark";
}) {
  const ordered: RiskScore[] = ["critical", "high", "moderate", "low"];
  const bandMap: Record<RiskScore, Band> = {
    critical: bands.find((b) => b.score === "critical")!,
    high: bands.find((b) => b.score === "high")!,
    moderate: bands.find((b) => b.score === "moderate")!,
    low: bands.find((b) => b.score === "low")!,
  };
  const activeIdx = ordered.indexOf(score);
  const activeBand = bandMap[score];
  const markerPct = ((activeIdx + bandLocalPosition(value, activeBand, higherIsSafer)) / 4) * 100;

  return (
    <div className="mt-3">
      <div className="relative">
        <div className="h-3 rounded-full overflow-hidden border border-black/[0.08] dark:border-white/[0.12] flex">
          {ordered.map((s) => {
            const active = s === score;
            return (
              <div
                key={s}
                className="flex-1 transition-all duration-300"
                style={{
                  background: riskColour(s, theme),
                  opacity: active ? 0.95 : 0.35,
                  boxShadow: active ? `inset 0 0 0 1px ${riskColour(s, theme)}` : "none",
                }}
              />
            );
          })}
        </div>
        <div
          className="absolute -top-2 transition-all duration-300"
          style={{ left: `calc(${markerPct}% - 5px)`, color: riskColour(score, theme) }}
          aria-label={`Score marker at ${value}`}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
            <path d="M5 10L0 0h10L5 10z" />
          </svg>
        </div>
      </div>
      <div className="mt-1.5 grid grid-cols-4 text-[10px] font-semibold uppercase tracking-[0.06em] text-silver-500">
        <span className="text-left">Critical</span>
        <span className="text-center">High</span>
        <span className="text-center">Moderate</span>
        <span className="text-right">Low</span>
      </div>
    </div>
  );
}

function ScoreColumn({
  title,
  score,
  value,
  bands,
  higherIsSafer,
  theme,
}: {
  title: string;
  score: RiskScore;
  value: number;
  bands: Band[];
  higherIsSafer: boolean;
  theme: "light" | "dark";
}) {
  return (
    <div className="px-1">
      <p className="text-[11px] uppercase tracking-[0.08em] text-silver-500 mb-2">{title}</p>
      <div className="glass-panel-sm p-3.5 border-black/[0.08] dark:border-white/[0.08]">
        <div className="flex items-center justify-between gap-3">
          <span className={riskBadgeClass(score)} style={{ borderColor: `${riskColour(score, theme)}66`, color: riskColour(score, theme) }}>
            {riskLabel(score)}
          </span>
          <span className="text-2xl font-semibold font-mono text-silver-100">{fmt(value, 2)}</span>
        </div>
        <RiskScale value={value} score={score} bands={bands} higherIsSafer={higherIsSafer} theme={theme} />
      </div>
    </div>
  );
}

function MetricLine({
  label,
  value,
  tail,
}: {
  label: string;
  value: React.ReactNode;
  tail?: React.ReactNode;
}) {
  return (
    <p className="text-[15px] md:text-[16px] leading-relaxed text-silver-300">
      <span className="text-silver-100 font-semibold">
        {label} ({value})
      </span>
      {tail ? <span className="text-silver-400"> {tail}</span> : null}
    </p>
  );
}

function Highlight({ children }: { children: React.ReactNode }) {
  return <strong className="text-silver-100 font-semibold">{children}</strong>;
}

function DetailScaffold({
  question,
  fraction,
  lab,
  target,
  bands,
  higherIsSafer,
  theme,
  narrative,
  mitigation,
}: {
  question: string;
  fraction: {
    mathNumerator: React.ReactNode;
    mathDenominator: React.ReactNode;
    textNumerator: React.ReactNode;
    textDenominator: React.ReactNode;
  };
  lab: { score: RiskScore; value: number };
  target: { score: RiskScore; value: number };
  bands: Band[];
  higherIsSafer: boolean;
  theme: "light" | "dark";
  narrative: React.ReactNode;
  mitigation: React.ReactNode;
}) {
  return (
    <div className="space-y-5 animate-fade-in">
      <p className="text-[22px] leading-tight font-semibold text-silver-100">{question}</p>
      <Fraction
        mathNumerator={fraction.mathNumerator}
        mathDenominator={fraction.mathDenominator}
        textNumerator={fraction.textNumerator}
        textDenominator={fraction.textDenominator}
      />
      <div className="glass-panel-sm p-4 border-black/[0.08] dark:border-white/[0.08]">
        <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-silver-400 mb-3 text-center">Thresholds</p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          {(["critical", "high", "moderate", "low"] as RiskScore[]).map((s) => {
            const band = bands.find((b) => b.score === s)!;
            return (
              <div
                key={s}
                className="rounded-lg px-3 py-2 border text-center"
                style={{
                  borderColor: `${riskColour(s, theme)}55`,
                  background: `${riskColour(s, theme)}15`,
                }}
              >
                <p className="text-[12px] md:text-[13px] font-semibold" style={{ color: riskColour(s, theme) }}>
                  {riskLabel(s)} risk
                </p>
                <p className="text-[12px] md:text-[13px] text-silver-200 font-semibold">
                  {formatBandRange(band)}
                </p>
              </div>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-0 md:divide-x md:divide-black/[0.08] md:dark:divide-white/[0.08]">
        <ScoreColumn title="Lab scale" score={lab.score} value={lab.value} bands={bands} higherIsSafer={higherIsSafer} theme={theme} />
        <ScoreColumn title="Target scale" score={target.score} value={target.value} bands={bands} higherIsSafer={higherIsSafer} theme={theme} />
      </div>
      <div className="glass-panel-sm p-4 border-black/[0.08] dark:border-white/[0.08] space-y-2">
        <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-silver-400">Target scale analysis and mitigation</p>
        {narrative}
      </div>
      {mitigation}
    </div>
  );
}

// --- Detail panels ---

function OtrDetail({ otr, derived, inputs, results, theme }: {
  otr: OtrRiskResult;
  derived: DerivedParameters;
  inputs: ProcessInputs;
  results: PartialAssessmentResult;
  theme: "light" | "dark";
}) {
  const our = otr.our_peak_selected ?? derived.our_peak;
  const otrLab = otr.otr_capacity_lab ?? 0;
  const otrTarget = otr.otr_capacity_target ?? 0;
  const scoreLabValue = our > 0 ? otrLab / our : 0;
  const scoreTargetValue = our > 0 ? otrTarget / our : 0;
  const oxygenBands: Band[] = [
    { score: "low", label: "Low", min: 1.5 },
    { score: "moderate", label: "Moderate", min: 1.0, max: 1.5 },
    { score: "high", label: "High", min: 0.7, max: 1.0 },
    { score: "critical", label: "Critical", max: 0.7 },
  ];
  const solubilityMgL = derived.c_star * 32;
  const klaMin = otr.kla_min ?? otr.kla_target_conservative;
  const klaMax = otr.kla_max ?? otr.kla_target_aggressive;

  return (
    <DetailScaffold
      question="Can the reactor deliver sufficient oxygen to the cells to sustain their growth and product formation?"
      fraction={{
        mathNumerator: <>OTR</>,
        mathDenominator: <>OUR</>,
        textNumerator: <>Oxygen Transfer Rate (mmol/L/h)</>,
        textDenominator: <>Oxygen Uptake Rate (mmol/L/h)</>,
      }}
      lab={{ score: scoreFromBands(scoreLabValue, oxygenBands), value: scoreLabValue }}
      target={{ score: scoreFromBands(scoreTargetValue, oxygenBands), value: scoreTargetValue }}
      bands={oxygenBands}
      higherIsSafer
      theme={theme}
      narrative={
        <>
          <MetricLine
            label="OTR"
            value={<>{fmt(otrTarget, 1)} mmol/L/h</>}
            tail={
              <>
                is controlled by <Highlight>k<sub>L</sub><span className="underline">a</span> ({fmt(klaMin, 1)}–{fmt(klaMax, 1)} h<sup>−1</sup>)</Highlight>, <Highlight>oxygen solubility ({fmt(solubilityMgL, 2)} mg/L)</Highlight>, and <Highlight>DO set point ({fmt(inputs.do_setpoint, 1)}%)</Highlight>.
              </>
            }
          />
          <MetricLine label="OUR" value={<>{fmt(our, 1)} mmol/L/h</>} tail="is microbe and biomass density dependent." />
        </>
      }
      mitigation={<MitigationBlock domain="otr" results={results} inputs={inputs} />}
    />
  );
}

function MixingDetail({ mixing, derived, inputs, results, theme }: {
  mixing: MixingRiskResult;
  derived: DerivedParameters;
  inputs: ProcessInputs;
  results: PartialAssessmentResult;
  theme: "light" | "dark";
}) {
  const mixingBands: Band[] = [
    { score: "low", label: "Low", min: 10 },
    { score: "moderate", label: "Moderate", min: 1, max: 10 },
    { score: "high", label: "High", min: 0.1, max: 1 },
    { score: "critical", label: "Critical", max: 0.1 },
  ];

  return (
    <DetailScaffold
      question="Is mixing fast enough to dissipate gradients in dissolved oxygen?"
      fraction={{
        mathNumerator: <>τ<sub>O</sub></>,
        mathDenominator: <>τ<sub>mix</sub></>,
        textNumerator: <>Oxygen uptake time (s)</>,
        textDenominator: <>Mixing time (s)</>,
      }}
      lab={{ score: scoreFromBands(mixing.o2_mixing_ratio_lab, mixingBands), value: mixing.o2_mixing_ratio_lab }}
      target={{ score: scoreFromBands(mixing.o2_mixing_ratio_target, mixingBands), value: mixing.o2_mixing_ratio_target }}
      bands={mixingBands}
      higherIsSafer
      theme={theme}
      narrative={
        <>
          <MetricLine label="Oxygen uptake time" value={<>{fmt(mixing.oxygen_depletion_time_target_s, 2)} s</>} tail={<>is dependent on <Highlight>OUR ({fmt(derived.our_peak, 1)} mmol/L/h)</Highlight> and <Highlight>DO setpoint ({fmt(inputs.do_setpoint, 1)}%)</Highlight>.</>} />
          <MetricLine label="Mixing time" value={<>{fmt(mixing.theta_mix_target, 2)} s</>} tail="is dependent on reactor geometry, operating conditions, and scale. It is calculated using the Ruszkowski correlation." />
        </>
      }
      mitigation={<MitigationBlock domain="mixing" results={results} inputs={inputs} />}
    />
  );
}

function ShearDetail({ shear, derived, results, inputs, theme }: {
  shear: ShearRiskResult;
  derived: DerivedParameters;
  results: PartialAssessmentResult;
  inputs: ProcessInputs;
  theme: "light" | "dark";
}) {
  const shearBands: Band[] = [
    { score: "low", label: "Low", min: 1 / 0.7 },
    { score: "moderate", label: "Moderate", min: 1.0, max: 1 / 0.7 },
    { score: "high", label: "High", min: 1 / 1.3, max: 1.0 },
    { score: "critical", label: "Critical", max: 1 / 1.3 },
  ];
  const labMargin = shear.tip_speed_margin_lab ?? (shear.tip_speed_threshold / Math.max(shear.tip_speed_lab ?? 1e-9, 1e-9));

  return (
    <DetailScaffold
      question="Is shear low enough to protect cells from damage?"
      fraction={{
        mathNumerator: <>v<sup>threshold</sup><sub>tip</sub></>,
        mathDenominator: <>v<sup>impeller</sup><sub>tip</sub></>,
        textNumerator: <>Tip speed threshold of microbe (m/s)</>,
        textDenominator: <>Tip speed of impeller (m/s)</>,
      }}
      lab={{ score: scoreFromBands(labMargin, shearBands), value: labMargin }}
      target={{ score: scoreFromBands(shear.tip_speed_margin, shearBands), value: shear.tip_speed_margin }}
      bands={shearBands}
      higherIsSafer
      theme={theme}
      narrative={
        <>
          <MetricLine label="Tip speed threshold" value={<>{fmt(shear.tip_speed_threshold, 2)} m/s</>} tail="is microbe dependent." />
          <MetricLine label="Tip speed of impeller" value={<>{fmt(shear.tip_speed, 2)} m/s</>} tail={<>is a function of <Highlight>impeller RPM ({fmt(shear.n_target * 60, 0)} rpm)</Highlight> and <Highlight>impeller diameter ({fmt(derived.target_geometry.d_imp, 3)} m)</Highlight>.</>} />
        </>
      }
      mitigation={<MitigationBlock domain="shear" results={results} inputs={inputs} />}
    />
  );
}

function Co2Detail({ co2, derived, results, inputs, theme }: {
  co2: Co2RiskResult;
  derived: DerivedParameters;
  results: PartialAssessmentResult;
  inputs: ProcessInputs;
  theme: "light" | "dark";
}) {
  const co2Bands: Band[] = [
    { score: "low", label: "Low", min: 1.5 },
    { score: "moderate", label: "Moderate", min: 1.0, max: 1.5 },
    { score: "high", label: "High", min: 0.75, max: 1.0 },
    { score: "critical", label: "Critical", max: 0.75 },
  ];
  const labMargin = co2.lab?.pco2_margin ?? Infinity;
  const targetMargin = co2.target?.pco2_margin ?? co2.pco2_margin ?? Infinity;
  const rq = inputs.organism_species === "p_pastoris" ? RQ_DEFAULTS.p_pastoris_methanol
    : inputs.organism_species === "s_cerevisiae" ? RQ_DEFAULTS.s_cerevisiae_aerobic
    : RQ_DEFAULTS.bacteria_aerobic;

  const narrative = !co2.activated ? (
    <p className="text-[15px] leading-relaxed text-silver-300">
      Detailed CO<sub>2</sub> accumulation check is currently not activated because biomass and OUR are below trigger thresholds, so this domain is currently low risk.
    </p>
  ) : (
    <>
      <MetricLine label="CO2 partial pressure threshold" value={<>{fmt(co2.pco2_critical ?? 0, 3)} bar</>} tail="is microbe dependent." />
      <MetricLine label="CO2 partial pressure at the bottom of reactor" value={<>{fmt(co2.target?.pco2_bottom ?? co2.pco2_bottom ?? 0, 3)} bar</>} tail={<>is a function of <Highlight>OUR ({fmt(derived.our_peak, 1)} mmol/L/h)</Highlight>, the microbe's <Highlight>respiratory quotient ({fmt(rq, 2)})</Highlight>, and the <Highlight>height of the reactor ({fmt(derived.target_geometry.h_liquid, 2)} m)</Highlight>.</>} />
    </>
  );

  return (
    <DetailScaffold
      question="Is carbon dioxide accumulation sufficiently low to prevent hampering cell growth?"
      fraction={{
        mathNumerator: <>P<sup>threshold</sup><sub>CO₂</sub></>,
        mathDenominator: <>P<sup>reactor</sup><sub>CO₂</sub></>,
        textNumerator: <>CO<sub>2</sub> partial pressure threshold (bar)</>,
        textDenominator: <>CO<sub>2</sub> partial pressure at the bottom of reactor (bar)</>,
      }}
      lab={{ score: scoreFromBands(labMargin, co2Bands), value: labMargin }}
      target={{ score: scoreFromBands(targetMargin, co2Bands), value: targetMargin }}
      bands={co2Bands}
      higherIsSafer
      theme={theme}
      narrative={narrative}
      mitigation={<MitigationBlock domain="co2" results={results} inputs={inputs} />}
    />
  );
}

function HeatDetail({ heat, derived, results, inputs, theme }: {
  heat: HeatRiskResult;
  derived: DerivedParameters;
  results: PartialAssessmentResult;
  inputs: ProcessInputs;
  theme: "light" | "dark";
}) {
  const heatBands: Band[] = [
    { score: "low", label: "Low", min: 1 / 0.6 },
    { score: "moderate", label: "Moderate", min: 1 / 0.85, max: 1 / 0.6 },
    { score: "high", label: "High", min: 1.0, max: 1 / 0.85 },
    { score: "critical", label: "Critical", max: 1.0 },
  ];
  const labMargin = heat.lab?.heat_transfer_margin ?? heat.heat_transfer_margin ?? 0;
  const targetMargin = heat.target?.heat_transfer_margin ?? heat.heat_transfer_margin ?? 0;

  return (
    <DetailScaffold
      question="Can the reactor effectively withdraw the metabolic heat generated during fermentation?"
      fraction={{
        mathNumerator: <>UAΔT<sub>LMTD</sub></>,
        mathDenominator: <>Q<sub>metabolic</sub></>,
        textNumerator: <>Reactor's capacity to withdraw heat (kW)</>,
        textDenominator: <>Heat generated during fermentation (kW)</>,
      }}
      lab={{ score: scoreFromBands(labMargin, heatBands), value: labMargin }}
      target={{ score: scoreFromBands(targetMargin, heatBands), value: targetMargin }}
      bands={heatBands}
      higherIsSafer
      theme={theme}
      narrative={
        <>
          <MetricLine label="Reactor's capacity to withdraw heat" value={<>{fmt(heat.q_cool_max, 2)} kW</>} tail={<>depends on the <Highlight>overall heat transfer coefficient ({fmt(heat.u_overall ?? 0, 1)} W/m<sup>2</sup>·K)</Highlight>, <Highlight>area available for heat transfer ({fmt(heat.a_jacket, 2)} m<sup>2</sup>)</Highlight>, and <Highlight>log-mean temperature difference ({fmt(heat.dt_lm, 1)} °C)</Highlight>.</>} />
          <MetricLine label="Heat generated during fermentation" value={<>{fmt(heat.q_metabolic, 2)} kW</>} tail={<>is a function of <Highlight>intrinsic heat generation of microbe ({METABOLIC_HEAT_FACTOR} kW per mmol/L/h per m<sup>3</sup>)</Highlight>, <Highlight>OUR ({fmt(derived.our_peak, 1)} mmol/L/h)</Highlight>, and <Highlight>volume of reactor ({fmt(derived.target_geometry.volume_m3, 3)} m<sup>3</sup>)</Highlight>.</>} />
        </>
      }
      mitigation={<MitigationBlock domain="heat" results={results} inputs={inputs} />}
    />
  );
}

// --- Pilot results ---

interface ProjectionScaleSummary {
  volumeL: number;
  rpm: number;
  aerationLpm: number;
  vvm: number;
  impellerDiameterM: number;
  reactorHeightM: number;
  klaMin: number;
  klaMax: number;
  mixingTimeS: number;
  tipSpeedMS: number;
  pco2Bar: number | null;
  metabolicHeatKW: number;
  reactorHeatCapacityKW: number;
}

interface ScaleProjectionSummary {
  lab: ProjectionScaleSummary;
  pilot: ProjectionScaleSummary;
  production: ProjectionScaleSummary;
  pilotVolumeL: number;
}

const Y_CO2_IN = 4e-4;
const MOLAR_VOL_STP_L_PER_MOL = 22.4;

function resolveRq(species: ProcessInputs["organism_species"]): number {
  if (species === "p_pastoris") return RQ_DEFAULTS.p_pastoris_methanol;
  if (species === "s_cerevisiae") return RQ_DEFAULTS.s_cerevisiae_aerobic;
  return RQ_DEFAULTS.bacteria_aerobic;
}

function calculateKlaRangeForScale(
  scale: ReactorScaleConfig,
  inputs: ProcessInputs,
  derived: DerivedParameters,
): { min: number; max: number } {
  const op = buildOperatingPoint({
    D_T: scale.geometry.t_diameter,
    H_L: scale.geometry.h_liquid,
    V_L: scale.geometry.volume_m3,
    d_i: scale.geometry.d_imp,
    impeller_type: inputs.impeller_type,
    n_imp: scale.n_impellers,
    N_rps: scale.rpm / 60,
    Q_gas: scale.gas.q_gas,
    v_s: scale.gas.vs,
    mu_L: derived.mu,
  });
  const ensemble = computeKlaEnsemble(op, scale.power_w, derived.biomass_cdw);
  return { min: ensemble.min, max: ensemble.max };
}

function calculateMixingTimeForScale(scale: ReactorScaleConfig): number {
  const epsilon = scale.pv_w_m3 / RHO;
  return RUSZKOWSKI_CONSTANT * Math.pow(scale.geometry.t_diameter, 2) /
    (Math.pow(epsilon, 1 / 3) * Math.pow(scale.geometry.d_imp, 4 / 3));
}

function calculatePco2ForScale(
  scale: ReactorScaleConfig,
  inputs: ProcessInputs,
  derived: DerivedParameters,
): number | null {
  const activated = derived.biomass_cdw > CO2_BIOMASS_THRESHOLD || derived.our_peak > CO2_OUR_THRESHOLD;
  if (!activated) return null;

  const rq = resolveRq(inputs.organism_species);
  const cer = rq * derived.our_peak;
  const klaCo2 = KLA_CO2_O2_RATIO * scale.kla_h;
  const vLiquidL = scale.geometry.volume_m3 * 1000;
  const qGasNlH = scale.gas.q_gas * 1e3 * 3600;
  const nDotGasMol = qGasNlH / MOLAR_VOL_STP_L_PER_MOL;
  const cerMolH = (cer / 1000) * vLiquidL;
  const yCo2Out = Math.min(Y_CO2_IN + cerMolH / Math.max(nDotGasMol, 1e-9), 0.20);
  const pTotalBar = (ATMOSPHERIC_PRESSURE_PA + (RHO * G * scale.geometry.h_liquid) / 2) / 1e5;
  const pco2GasIn = Y_CO2_IN * 1.01325;
  const pco2GasOut = yCo2Out * pTotalBar;
  const pco2GasAvg = Math.abs(pco2GasOut - pco2GasIn) < 1e-12
    ? pco2GasOut
    : (pco2GasOut - pco2GasIn) / Math.log(pco2GasOut / pco2GasIn);
  const pco2GasAvgAtm = pco2GasAvg / 1.01325;
  const pco2BulkAtm = pco2GasAvgAtm + (cer / 1000) / (Math.max(klaCo2, 1e-9) * H_CO2);
  const pco2Bulk = pco2BulkAtm * 1.01325;
  const dpHydro = RHO * G * scale.geometry.h_liquid;
  return pco2Bulk * (ATMOSPHERIC_PRESSURE_PA + dpHydro) / ATMOSPHERIC_PRESSURE_PA;
}

function summarizeScale(
  scale: ReactorScaleConfig,
  inputs: ProcessInputs,
  derived: DerivedParameters,
): ProjectionScaleSummary {
  const klaRange = calculateKlaRangeForScale(scale, inputs, derived);
  const heat = runHeatCapacityCheck({
    organism: inputs.organism_species,
    our_mmol_Lh: derived.our_peak,
    volume_litres: scale.volume_litres,
    t_process: inputs.temperature,
    t_cw_in: inputs.t_cw_inlet,
    flowrate_lpm: inputs.cooling_water_flowrate_lpm ?? 30,
    D_T: scale.geometry.t_diameter,
    H_L: scale.geometry.h_liquid,
    d_imp: scale.geometry.d_imp,
    N_rps: scale.rpm / 60,
    mu: derived.mu,
    impeller_type: inputs.impeller_type,
  });

  return {
    volumeL: scale.volume_litres,
    rpm: scale.rpm,
    aerationLpm: scale.gas.q_gas * 1000 * 60,
    vvm: scale.vvm,
    impellerDiameterM: scale.geometry.d_imp,
    reactorHeightM: scale.geometry.h_liquid,
    klaMin: klaRange.min,
    klaMax: klaRange.max,
    mixingTimeS: calculateMixingTimeForScale(scale),
    tipSpeedMS: scale.tip_speed_m_s,
    pco2Bar: calculatePco2ForScale(scale, inputs, derived),
    metabolicHeatKW: heat.Q_metabolic_kW,
    reactorHeatCapacityKW: heat.Q_available_kW,
  };
}

function computeScaleProjectionSummary(
  inputs: ProcessInputs,
  derived: DerivedParameters,
): ScaleProjectionSummary {
  const method = inputs.scaleup_criterion ?? "power_per_volume";
  const pilotVolumeL = pilotVolume(inputs.v_lab, inputs.v_target);
  const labAndProduction = buildReactorScaleConfigs(inputs, { method });
  const pilotInputs: ProcessInputs = { ...inputs, v_target: pilotVolumeL };
  const pilotConfigs = buildReactorScaleConfigs(pilotInputs, { method });

  return {
    lab: summarizeScale(labAndProduction.lab, inputs, derived),
    pilot: summarizeScale(pilotConfigs.target, inputs, derived),
    production: summarizeScale(labAndProduction.target, inputs, derived),
    pilotVolumeL,
  };
}

// --- Domain card icons ---

const DOMAIN_ICONS: Record<RiskDomain, React.ReactNode> = {
  otr: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v4m0 12v4M2 12h4m12 0h4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
    </svg>
  ),
  mixing: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 3v18M3 12h18M7.5 7.5l9 9M16.5 7.5l-9 9" strokeLinecap="round" />
    </svg>
  ),
  shear: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  co2: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 12a4 4 0 108 0 4 4 0 00-8 0z" />
      <path d="M3 12h2m14 0h2M5.636 5.636l1.414 1.414m9.9 9.9l1.414 1.414M12 3v2m0 14v2M5.636 18.364l1.414-1.414m9.9-9.9l1.414-1.414" />
    </svg>
  ),
  heat: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 2c0 4-4 6-4 10a4 4 0 008 0c0-4-4-6-4-10z" />
      <path d="M12 18v4" strokeLinecap="round" />
    </svg>
  ),
};

const DOMAIN_LABELS: Record<RiskDomain, string> = {
  otr: "Oxygen Transfer",
  mixing: "Mixing",
  shear: "Shear Stress",
  co2: "CO\u2082",
  heat: "Heat Removal",
};

// --- Compact domain card for horizontal row ---

function DomainCard({
  domain,
  score,
  scoreValue,
  thresholdText,
  expanded,
  onClick,
  theme,
}: {
  domain: RiskDomain;
  score: RiskScore;
  scoreValue: string;
  thresholdText: string;
  expanded: boolean;
  onClick: () => void;
  theme: "light" | "dark";
}) {
  const colour = riskColour(score, theme);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 min-w-0 rounded-2xl p-[1px] transition-all duration-300 text-left group relative overflow-hidden ${
        expanded ? "scale-[1.02]" : "hover:scale-[1.01]"
      }`}
      style={{
        background: expanded
          ? `linear-gradient(160deg, ${colour}40, ${colour}10 40%, rgba(255,255,255,0.06) 70%, ${colour}15)`
          : `linear-gradient(160deg, rgba(255,255,255,0.07), rgba(255,255,255,0.03) 50%, ${colour}12)`,
      }}
    >
      {/* Inner card */}
      <div
        className="rounded-[15px] p-4 h-full relative overflow-hidden"
        style={{
          background: expanded
            ? `linear-gradient(165deg, ${colour}08, var(--card-inner-light) 40%, var(--card-inner-dark))`
            : `linear-gradient(165deg, var(--card-inner-light), var(--card-inner-dark))`,
        }}
      >
        {/* Subtle top-left risk glow */}
        <div
          className="absolute -top-8 -left-8 w-24 h-24 rounded-full blur-2xl transition-opacity duration-300"
          style={{
            background: colour,
            opacity: expanded ? 0.1 : 0.04,
          }}
        />

        {/* Icon + label */}
        <div className="relative flex items-center gap-2 mb-3">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: `${colour}15` }}
          >
            <span style={{ color: colour }} className="opacity-80 [&>svg]:w-3.5 [&>svg]:h-3.5">
              {DOMAIN_ICONS[domain]}
            </span>
          </div>
          <span className="text-xs font-semibold text-silver-200 truncate">
            {DOMAIN_LABELS[domain]}
          </span>
        </div>

        {/* Badge */}
        <div className="relative mb-2.5">
          <span
            className={riskBadgeClass(score)}
            style={{
              background: `${colour}1f`,
              color: colour,
              border: `1px solid ${colour}66`,
            }}
          >
            {riskLabel(score)}
          </span>
        </div>

        <p className="relative text-[13px] font-mono text-silver-100 mb-1">
          Score = {scoreValue}
        </p>
        <p className="relative text-[9px] text-silver-500 leading-none mb-3 whitespace-nowrap tracking-normal">
          {thresholdText}
        </p>

        {/* Bottom row: expand */}
        <div className="relative flex items-center justify-end">
          <div
            className={`w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 ${
              expanded ? "bg-black/[0.05] dark:bg-white/[0.08]" : "bg-black/[0.03] dark:bg-white/[0.04] group-hover:bg-black/[0.04] dark:bg-white/[0.06]"
            }`}
          >
            <svg
              className={`w-3 h-3 text-silver-500 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M4 6l4 4 4-4" />
            </svg>
          </div>
        </div>
      </div>
    </button>
  );
}

// --- Main dashboard component ---

export default function ResultsDashboard({ data, isExample, onBackClick }: ResultsDashboardProps) {
  const { theme } = useTheme();
  const [selectedDomain, setSelectedDomain] = useState<RiskDomain | null>(null);
  const [showProjections, setShowProjections] = useState(true);

  const scaleProjection = useMemo(() => {
    return computeScaleProjectionSummary(data.inputs, data.derived);
  }, [data]);

  const { inputs, derived, results } = data;
  const { otr, mixing, shear, co2, heat } = results;
  const bottleneck = results.primary_bottleneck;
  const scaleRatio = inputs.v_target / inputs.v_lab;
  const vPilot = scaleProjection.pilotVolumeL;

  const PV_SLIDER_OPTIONS = [
    { label: "0.25\u00D7", value: 0.25 },
    { label: "0.5\u00D7", value: 0.5 },
    { label: "1.0\u00D7", value: 1.0 },
    { label: "2.0\u00D7", value: 2.0 },
  ];

  const toggleDomain = (d: RiskDomain) =>
    setSelectedDomain(selectedDomain === d ? null : d);

  const labDomainScores: Record<RiskDomain, RiskScore> = {
    otr: otr.score_lab ?? otr.score,
    mixing: mixing.score_lab ?? mixing.score,
    shear: shear.score_lab ?? shear.score,
    co2: co2.lab?.score ?? co2.score,
    heat: heat.lab?.score ?? heat.score,
  };

  const targetDomainScores: Record<RiskDomain, RiskScore> = {
    otr: otr.score_target ?? otr.score,
    mixing: mixing.score_target ?? mixing.score,
    shear: shear.score_target ?? shear.score,
    co2: co2.target?.score ?? co2.score,
    heat: heat.target?.score ?? heat.score,
  };

  // Composite score (target scale)
  const allScores: RiskScore[] = RADAR_DOMAIN_ORDER.map((d) => targetDomainScores[d]);
  const composite = compositeScore(allScores);
  const compositeInfo = compositeLabel(composite, theme);

  const domainThresholds: Record<RiskDomain, string> = {
    otr: "C<.7 | H .7-1 | M 1-1.5 | L>=1.5",
    mixing: "C<=.1 | H .1-1 | M 1-10 | L>10",
    shear: "C>=1.3 | H 1-1.3 | M .7-1 | L<.7",
    co2: "C<=.75 | H .75-1 | M 1-1.5 | L>1.5",
    heat: "C<=1 | H 1-1.18 | M 1.18-1.67 | L>1.67",
  };

  const domainScoreValues: Record<RiskDomain, string> = {
    otr: fmt(otr.otr_our_ratio_target ?? otr.kla_ratio, 2),
    mixing: fmt(mixing.o2_mixing_ratio_target ?? 0, 3),
    shear: fmt(shear.tip_speed_ratio, 2),
    co2: Number.isFinite(co2.target?.pco2_margin ?? co2.pco2_margin ?? Infinity)
      ? fmt(co2.target?.pco2_margin ?? co2.pco2_margin ?? 0, 2)
      : "\u221E",
    heat: fmt(heat.target?.heat_transfer_margin ?? heat.heat_transfer_margin ?? 0, 2),
  };

  const domainScores: Record<RiskDomain, RiskScore> = {
    otr: targetDomainScores.otr,
    mixing: targetDomainScores.mixing,
    shear: targetDomainScores.shear,
    co2: targetDomainScores.co2,
    heat: targetDomainScores.heat,
  };

  return (
    <main className="min-h-screen relative pb-20 transition-colors duration-300" style={{ background: "var(--bg-base)" }}>
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-[20%] w-[500px] h-[500px] blur-[120px] rounded-full" style={{ background: "var(--ambient-accent)" }} />
        <div className="absolute bottom-[20%] left-[10%] w-[400px] h-[400px] blur-[100px] rounded-full" style={{ background: "var(--ambient-warm)" }} />
      </div>

      {/* Top bar */}
      <div
        className="relative z-10 border-b px-8 py-4 flex items-center justify-between"
        style={{ background: "var(--bg-elevated)", borderColor: "var(--border-primary)" }}
      >
        {/* Left: Brand + page title */}
        <div className="flex items-center gap-4">
          <Link href="/" className="text-base font-bold tracking-tight hover:opacity-80 transition-opacity" style={{ color: "var(--text-heading)" }}>
            Lemnisca
          </Link>
          {isExample ? (
            <h1 className="text-sm" style={{ color: "var(--text-tertiary)" }}>
              Example &mdash; <em style={{ color: "var(--text-secondary)" }}>E.&nbsp;coli</em> fed-batch, 10&nbsp;L &rarr; 10,000&nbsp;L
            </h1>
          ) : (
            <h1 className="text-sm" style={{ color: "var(--text-tertiary)" }}>Results</h1>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {onBackClick && (
            <button
              type="button"
              onClick={onBackClick}
              className="text-sm px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all"
              style={{ color: "var(--text-primary)", border: "1px solid var(--border-primary)" }}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M10 4l-4 4 4 4" />
              </svg>
              Edit inputs
            </button>
          )}
          <ThemeToggle />
        </div>
      </div>

      {/* Example banner */}
      {isExample && (
        <div className="relative z-10 border-b border-accent/15 px-6 py-3 text-sm flex items-center gap-2" style={{ background: "var(--accent-glow)", color: "var(--text-secondary)" }}>
          <span className="inline-flex items-center gap-1.5 risk-badge !bg-accent/10 !text-accent !border-accent/20 !text-[10px] !py-0.5">Example</span>
          This is a pre-loaded example.{" "}
          <Link
            href="/"
            className="font-medium text-accent hover:text-accent-cool transition-colors"
          >
            Assess your own process &rarr;
          </Link>
        </div>
      )}

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* ===== SECTION 1: Radar Summary + Context ===== */}
        <div className="glass-panel p-8 flex flex-col items-center">
          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 place-items-center">
            <RadarChart title="Lab Scale Risk Profile" scores={labDomainScores} theme={theme} />
            <RadarChart title="Target Scale Risk Profile" scores={targetDomainScores} theme={theme} />
          </div>

          {/* Context bar */}
          <div className="mt-6 flex items-center gap-3 text-sm text-silver-400 flex-wrap justify-center">
            <span className="font-medium text-silver-200">
              {SPECIES_LABELS[inputs.organism_species] ?? inputs.organism_species}
            </span>
            <span className="w-px h-3.5 bg-black/[0.06] dark:bg-white/[0.1]" />
            <span>{fmtInt(inputs.v_lab)} L &rarr; {fmtInt(inputs.v_target)} L</span>
            <span className="w-px h-3.5 bg-black/[0.06] dark:bg-white/[0.1]" />
            <span>
              Scale ratio: <strong className="text-silver-100 font-mono">{fmt(scaleRatio, 0)}&times;</strong>
            </span>
          </div>

          {/* Bottleneck callout */}
          {bottleneck && (
            <div className="animate-fade-in mt-8 w-full flex items-start gap-4 py-4 pl-5 pr-2">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] mb-2" style={{ color: compositeInfo.colour }}>
                  Primary Bottleneck
                </p>
                <p className="text-base font-semibold text-silver-100 leading-snug mb-3">
                  {bottleneck.statement}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ===== SECTION 3: Domain Cards Row ===== */}
        <div>
          <h2 className="text-[11px] font-semibold text-silver-500 uppercase tracking-[0.12em] mb-3">
            Risk Domains
          </h2>
          <div className="grid grid-cols-5 gap-3">
            {(["otr", "mixing", "shear", "co2", "heat"] as RiskDomain[]).map((d) => (
              <DomainCard
                key={d}
                domain={d}
                score={domainScores[d]}
                scoreValue={domainScoreValues[d]}
                thresholdText={domainThresholds[d]}
                expanded={selectedDomain === d}
                onClick={() => toggleDomain(d)}
                theme={theme}
              />
            ))}
          </div>

          {/* Expanded detail panel (accordion) */}
          {selectedDomain && (
            <div className="mt-4 rounded-2xl p-[1px]" style={{
              background: `linear-gradient(160deg, ${riskColour(domainScores[selectedDomain], theme)}25, var(--border-primary) 40%, var(--border-secondary))`,
            }}>
            <div className="rounded-[15px] p-6" style={{
              background: `linear-gradient(165deg, var(--card-inner-light), var(--card-inner-dark))`,
            }}>
              {selectedDomain === "otr" && (
                <OtrDetail otr={otr} derived={derived} inputs={inputs} results={results} theme={theme} />
              )}
              {selectedDomain === "mixing" && (
                <MixingDetail mixing={mixing} derived={derived} inputs={inputs} results={results} theme={theme} />
              )}
              {selectedDomain === "shear" && (
                <ShearDetail shear={shear} derived={derived} results={results} inputs={inputs} theme={theme} />
              )}
              {selectedDomain === "co2" && (
                <Co2Detail co2={co2} derived={derived} inputs={inputs} results={results} theme={theme} />
              )}
              {selectedDomain === "heat" && (
                <HeatDetail heat={heat} derived={derived} inputs={inputs} results={results} theme={theme} />
              )}
            </div>
            </div>
          )}
        </div>

        {/* ===== SECTION 4: Warnings/Flags ===== */}
        {results.flags.length > 0 && (
          <div>
            <h3 className="text-[11px] font-semibold text-silver-500 uppercase tracking-[0.08em] mb-2">Warnings</h3>
            <div className="space-y-1.5">
              {results.flags.map((f, i) => (
                <p key={i} className="text-xs text-risk-moderate glass-panel-sm border-risk-moderate/15 bg-risk-moderate/[0.04] px-3 py-2.5 flex items-start gap-2.5">
                  {f.domain && (
                    <span className="flex-shrink-0 inline-flex items-center gap-1 risk-badge risk-badge-moderate !text-[9px] !py-0.5 !px-2 uppercase">
                      {f.domain}
                    </span>
                  )}
                  <span className="leading-relaxed">{f.message}</span>
                </p>
              ))}
            </div>
          </div>
        )}

        {/* ===== SECTION 5: Collapsible Projections ===== */}
        <div>
          <button
            type="button"
            onClick={() => setShowProjections(!showProjections)}
            className="w-full flex items-center justify-between glass-panel-sm px-5 py-3.5 text-left transition-all duration-200 hover:border-black/[0.1] dark:hover:border-white/[0.1]"
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-silver-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 10h18M3 14h18M3 6h18M3 18h18" strokeLinecap="round" />
              </svg>
              <span className="text-sm font-semibold text-silver-200">Scale-Up Projections</span>
              <span className="text-[11px] text-silver-600 ml-1">Lab &rarr; Pilot &rarr; Production</span>
            </div>
            <svg
              className={`w-4 h-4 text-silver-500 transition-transform duration-200 ${showProjections ? "rotate-180" : ""}`}
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M4 6l4 4 4-4" />
            </svg>
          </button>

          {showProjections && (
            <div className="mt-3 glass-panel p-6 animate-fade-in space-y-6">
              <div className="overflow-hidden rounded-lg">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="text-left">Parameter</th>
                      <th className="text-right">Lab ({fmtInt(inputs.v_lab)} L)</th>
                      <th className="text-right">Pilot ({fmtInt(vPilot)} L)</th>
                      <th className="text-right">Production ({fmtInt(inputs.v_target)} L)</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono text-silver-200">
                    <tr>
                      <td className="font-sans text-silver-400">Impeller RPM (rpm)</td>
                      <td className="text-right">{fmt(scaleProjection.lab.rpm, 0)}</td>
                      <td className="text-right">{fmt(scaleProjection.pilot.rpm, 0)}</td>
                      <td className="text-right">{fmt(scaleProjection.production.rpm, 0)}</td>
                    </tr>
                    <tr>
                      <td className="font-sans text-silver-400">Aeration rate (L/min, vvm)</td>
                      <td className="text-right">{fmt(scaleProjection.lab.aerationLpm, 2)} ({fmt(scaleProjection.lab.vvm, 2)})</td>
                      <td className="text-right">{fmt(scaleProjection.pilot.aerationLpm, 2)} ({fmt(scaleProjection.pilot.vvm, 2)})</td>
                      <td className="text-right">{fmt(scaleProjection.production.aerationLpm, 2)} ({fmt(scaleProjection.production.vvm, 2)})</td>
                    </tr>
                    <tr>
                      <td className="font-sans text-silver-400">Impeller diameter (m)</td>
                      <td className="text-right">{fmt(scaleProjection.lab.impellerDiameterM, 3)}</td>
                      <td className="text-right">{fmt(scaleProjection.pilot.impellerDiameterM, 3)}</td>
                      <td className="text-right">{fmt(scaleProjection.production.impellerDiameterM, 3)}</td>
                    </tr>
                    <tr>
                      <td className="font-sans text-silver-400">Reactor height (m)</td>
                      <td className="text-right">{fmt(scaleProjection.lab.reactorHeightM, 3)}</td>
                      <td className="text-right">{fmt(scaleProjection.pilot.reactorHeightM, 3)}</td>
                      <td className="text-right">{fmt(scaleProjection.production.reactorHeightM, 3)}</td>
                    </tr>
                    <tr>
                      <td className="font-sans text-silver-400">kLā range (h⁻¹)</td>
                      <td className="text-right">{fmt(scaleProjection.lab.klaMin, 1)}-{fmt(scaleProjection.lab.klaMax, 1)}</td>
                      <td className="text-right">{fmt(scaleProjection.pilot.klaMin, 1)}-{fmt(scaleProjection.pilot.klaMax, 1)}</td>
                      <td className="text-right">{fmt(scaleProjection.production.klaMin, 1)}-{fmt(scaleProjection.production.klaMax, 1)}</td>
                    </tr>
                    <tr>
                      <td className="font-sans text-silver-400">Mixing time (s)</td>
                      <td className="text-right">{fmt(scaleProjection.lab.mixingTimeS, 2)}</td>
                      <td className="text-right">{fmt(scaleProjection.pilot.mixingTimeS, 2)}</td>
                      <td className="text-right">{fmt(scaleProjection.production.mixingTimeS, 2)}</td>
                    </tr>
                    <tr>
                      <td className="font-sans text-silver-400">Tip speed (m/s)</td>
                      <td className="text-right">{fmt(scaleProjection.lab.tipSpeedMS, 2)}</td>
                      <td className="text-right">{fmt(scaleProjection.pilot.tipSpeedMS, 2)}</td>
                      <td className="text-right">{fmt(scaleProjection.production.tipSpeedMS, 2)}</td>
                    </tr>
                    <tr>
                      <td className="font-sans text-silver-400">P<sub>CO₂</sub> (bar)</td>
                      <td className="text-right">
                        {scaleProjection.lab.pco2Bar != null ? fmt(scaleProjection.lab.pco2Bar, 3) : <span className="text-silver-600">&mdash;</span>}
                      </td>
                      <td className="text-right">
                        {scaleProjection.pilot.pco2Bar != null ? fmt(scaleProjection.pilot.pco2Bar, 3) : <span className="text-silver-600">&mdash;</span>}
                      </td>
                      <td className="text-right">
                        {scaleProjection.production.pco2Bar != null ? fmt(scaleProjection.production.pco2Bar, 3) : <span className="text-silver-600">&mdash;</span>}
                      </td>
                    </tr>
                    <tr>
                      <td className="font-sans text-silver-400">Metabolic heat (kW)</td>
                      <td className="text-right">{fmt(scaleProjection.lab.metabolicHeatKW, 2)}</td>
                      <td className="text-right">{fmt(scaleProjection.pilot.metabolicHeatKW, 2)}</td>
                      <td className="text-right">{fmt(scaleProjection.production.metabolicHeatKW, 2)}</td>
                    </tr>
                    <tr>
                      <td className="font-sans text-silver-400">Reactor heat capacity (kW)</td>
                      <td className="text-right">{fmt(scaleProjection.lab.reactorHeatCapacityKW, 2)}</td>
                      <td className="text-right">{fmt(scaleProjection.pilot.reactorHeatCapacityKW, 2)}</td>
                      <td className="text-right">{fmt(scaleProjection.production.reactorHeatCapacityKW, 2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* P/V Scenario selector — commented out, redundant with OTR detail card
              <div className="glass-panel-sm p-5">
                <h4 className="text-[11px] font-semibold text-silver-500 uppercase tracking-[0.08em] mb-3">
                  Adjust target P/V ratio relative to lab scale
                </h4>
                <div className="flex items-center gap-2">
                  {PV_SLIDER_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPvMultiplier(opt.value)}
                      className={`btn-toggle px-5 py-2.5 text-sm font-mono ${
                        pvMultiplier === opt.value ? "active" : ""
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-silver-600 mt-3">
                  P/V at target: <span className="font-mono text-silver-400">{fmt(derived.pv_lab * pvMultiplier)} W/m³</span> &rarr; kLa achievable: <span className="font-mono text-silver-400">{fmt(adjustedKla ?? otr.kla_target_moderate)} h⁻¹</span>
                </p>
              </div>
              */}
            </div>
          )}
        </div>
      </div>

      {/* ===== STICKY FOOTER: PDF Download ===== */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t px-6 py-3" style={{ background: "var(--bar-bg)", backdropFilter: "blur(20px)", borderColor: "var(--bar-border)" }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="text-sm text-silver-500">
            <span className="font-medium text-silver-300">{SPECIES_LABELS[inputs.organism_species] ?? inputs.organism_species}</span>
            {" \u2014 "}
            {fmtInt(inputs.v_lab)} L &rarr; {fmtInt(inputs.v_target)} L
            {" \u2014 "}
            <span style={{ color: compositeInfo.colour }} className="font-medium">{compositeInfo.label}</span>
          </div>
          <div className="flex items-center gap-3">
            {isExample ? (
              <div className="text-right relative group/pdf">
                <button
                  type="button"
                  disabled
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-xl border border-black/[0.06] dark:border-white/[0.06] text-silver-600 opacity-50 cursor-not-allowed bg-black/[0.02] dark:bg-white/[0.02]"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Generate PDF Report
                </button>
                <span className="absolute bottom-full right-0 mb-2 px-3 py-1.5 rounded-lg text-[10px] bg-[var(--bg-elevated)] border border-[var(--border-primary)] shadow-lg text-silver-400 opacity-0 pointer-events-none group-hover/pdf:opacity-100 transition-opacity duration-200 whitespace-nowrap z-30">
                  Sign in and run your own assessment to generate PDFs
                </span>
              </div>
            ) : (
              <GeneratePdfButton inputs={inputs} derived={derived} results={results} />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
