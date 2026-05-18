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
  FeedingFrequency,
} from "@/lib/types";
import {
  RISK_COLOURS,
  RUSZKOWSKI_CONSTANT,
  RHO,
  KLA_CO2_O2_RATIO,
  H_CO2,
  G,
  ATMOSPHERIC_PRESSURE_PA,
  ATMOSPHERIC_PRESSURE_BAR,
  Y_CO2_INLET,
  MAX_CO2_MOLE_FRACTION,
  molarVolumeIdealGas,
  METABOLIC_HEAT_COEFF_KJ_PER_MMOL,
  CO2_OUR_THRESHOLD,
  FEEDING_FREQUENCY_LABELS,
  FEEDING_FREQUENCY_ORDER,
} from "@/lib/constants";
import {
  deriveVesselGeometry,
  deriveGasVelocity,
  buildReactorScaleConfigs,
  runAssessment,
  resolveRq,
  ruszkowskiMixingTime,
} from "@/lib/engine";
import type { ReactorScaleConfig } from "@/lib/engine/reactor_configs";
import { runHeatCapacityCheck } from "@/lib/engine/heat/heat_capacity";
import { computeMixingTimeEnsemble } from "@/lib/engine/mixing/mixing_correlations";
import GeneratePdfButton from "@/components/GeneratePdfButton";
import type { StoredAssessment } from "@/lib/store";
import { getScaleupOperatingRange, IMPELLER_CONSTANTS } from "@/lib/constants";

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

const SCALEUP_CRITERION_LABELS: Record<NonNullable<ProcessInputs["scaleup_criterion"]>, string> = {
  power_per_volume: "P/V",
  kla: "kLa",
  shear: "tip speed",
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

function roundTo5(n: number): number {
  return Math.round(n / 5) * 5;
}

function fmtRange95(value: number, std: number): string {
  const lo = roundTo5(value - 1.96 * std);
  const hi = roundTo5(value + 1.96 * std);
  return `${lo}–${hi === lo ? lo + 5 : hi}`;
}


function riskColour(score: RiskScore, theme: "light" | "dark" = "dark"): string {
  return theme === "light" ? LIGHT_RISK_COLOURS[score] : DARK_RISK_COLOURS[score];
}

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function lerpRgb(a: [number, number, number], b: [number, number, number], t: number): string {
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

const RISK_NUMERIC: Record<RiskScore, number> = { low: 1, moderate: 2, high: 3, critical: 4 };

function compositeScoreColour(scores: Record<RiskDomain, RiskScore>, theme: "light" | "dark"): string {
  const total = RADAR_DOMAIN_ORDER.reduce((sum, d) => sum + RISK_NUMERIC[scores[d]], 0);
  const t = Math.max(0, Math.min(1, (total - 5) / 15));
  const palette = theme === "light" ? LIGHT_RISK_COLOURS : DARK_RISK_COLOURS;
  const stops: Array<[number, number, number]> = [
    hexToRgb(palette.low),
    hexToRgb(palette.moderate),
    hexToRgb(palette.high),
    hexToRgb(palette.critical),
  ];
  const segment = Math.min(2, Math.floor(t * 3));
  return lerpRgb(stops[segment], stops[segment + 1], t * 3 - segment);
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

const DISPLAY_DOMAIN_ORDER: RiskDomain[] = ["mixing", "otr", "shear", "co2", "heat"];
const RADAR_DOMAIN_ORDER: RiskDomain[] = DISPLAY_DOMAIN_ORDER;

function radarRadius(score: RiskScore): number {
  switch (score) {
    case "low":      return 0.25;
    case "moderate": return 0.5;
    case "high":     return 0.75;
    case "critical": return 1.0;
  }
}

const RISK_SCORE_LABELS: Record<RiskScore, string> = {
  low:      "Low",
  moderate: "Moderate",
  high:     "High",
  critical: "Critical",
};

function RadarChart({
  title,
  scores,
  theme,
}: {
  title: string;
  scores: Record<RiskDomain, RiskScore>;
  theme: "light" | "dark";
}) {
  const chartSize = 320;
  const cx = chartSize / 2;
  const cy = chartSize / 2;
  const maxR = 96;
  const axisLabelOffset = 28;
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
    { level: "low",      radius: 0.25 },
    { level: "moderate", radius: 0.5  },
    { level: "high",     radius: 0.75 },
    { level: "critical", radius: 1.0  },
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
  const fillColour = compositeScoreColour(scores, theme);

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
          {axisPoints.map((p) => {
            const anchor = Math.abs(p.lx - cx) < 8 ? "middle" : p.lx > cx ? "start" : "end";
            return (
              <g key={`${p.domain}-label-group`}>
                <text
                  x={p.lx}
                  y={p.ly - 8}
                  textAnchor={anchor}
                  dominantBaseline="middle"
                  style={{ fontSize: "11px", fill: "var(--text-tertiary)", fontWeight: 600 }}
                >
                  {axisLabels[p.domain]}
                </text>
                <text
                  x={p.lx}
                  y={p.ly + 8}
                  textAnchor={anchor}
                  dominantBaseline="middle"
                  style={{ fontSize: "9px", fill: riskColour(scores[p.domain], theme), fontWeight: 500 }}
                >
                  [{RISK_SCORE_LABELS[scores[p.domain]]}]
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="text-[10px] text-silver-600 text-center mt-2">Outer ring: critical risk. Inner ring: low risk.</div>
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
  std,
  bands,
  higherIsSafer,
  theme,
}: {
  title: string;
  score: RiskScore;
  value: number;
  std?: number;
  bands: Band[];
  higherIsSafer: boolean;
  theme: "light" | "dark";
}) {
  const showUncertainty = std != null && std > 0 && Number.isFinite(std) && Number.isFinite(value);
  return (
    <div className="px-1">
      <p className="text-[11px] uppercase tracking-[0.08em] text-silver-500 mb-2">{title}</p>
      <div className="glass-panel-sm p-3.5 border-black/[0.08] dark:border-white/[0.08]">
        <div className="flex items-center justify-between gap-3">
          <span className={riskBadgeClass(score)} style={{ borderColor: `${riskColour(score, theme)}66`, color: riskColour(score, theme) }}>
            {riskLabel(score)}
          </span>
          <span className="text-2xl font-semibold font-mono text-silver-100">
            {fmt(value, 2)}{showUncertainty && <span className="text-base font-normal text-silver-400"> ± {fmt(std!, 2)}</span>}
          </span>
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

interface CalculationLine {
  label: React.ReactNode;
  equation?: React.ReactNode;
  substitution?: React.ReactNode;
  finalValue: React.ReactNode;
  note?: React.ReactNode;
}

function EquationLine({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[13px] md:text-[14px] leading-relaxed">
      <span className="text-silver-500">Equation</span>
      <span className="mx-2 text-silver-600">:</span>
      <span className="font-mono text-silver-200">{children}</span>
    </div>
  );
}

function SubstitutionLine({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[13px] md:text-[14px] leading-relaxed">
      <span className="text-silver-500">Value</span>
      <span className="mx-2 text-silver-600">:</span>
      <span className="font-mono text-silver-300">{children}</span>
    </div>
  );
}

function FinalValueLine({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[14px] md:text-[15px] leading-relaxed">
      <span className="text-silver-500">Final</span>
      <span className="mx-2 text-silver-600">:</span>
      <span className="font-mono font-semibold text-silver-100">{children}</span>
    </div>
  );
}

function KlaSymbol() {
  return <>k<sub>L</sub><span className="underline">a</span></>;
}

function ScaleCalculationColumn({
  title,
  lines,
  theme,
  score,
}: {
  title: string;
  lines: CalculationLine[];
  theme: "light" | "dark";
  score: RiskScore;
}) {
  const colour = riskColour(score, theme);
  return (
    <div className="space-y-3 md:px-4 first:pl-0 last:pr-0">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-silver-500">{title}</p>
        <span className={riskBadgeClass(score)} style={{ borderColor: `${colour}66`, color: colour }}>
          {riskLabel(score)}
        </span>
      </div>
      <div className="space-y-2.5">
        {lines.map((line, index) => (
          <div key={index} className="rounded-lg border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.025] p-3">
            <p className="text-[13px] font-semibold text-silver-100 mb-1.5">{line.label}</p>
            {line.equation ? <EquationLine>{line.equation}</EquationLine> : null}
            {line.substitution ? <SubstitutionLine>{line.substitution}</SubstitutionLine> : null}
            <FinalValueLine>{line.finalValue}</FinalValueLine>
            {line.note ? <p className="mt-1.5 text-[12px] leading-relaxed text-silver-500">{line.note}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function ScaleAnalysisGrid({
  lab,
  target,
  labScore,
  targetScore,
  theme,
}: {
  lab: CalculationLine[];
  target: CalculationLine[];
  labScore: RiskScore;
  targetScore: RiskScore;
  theme: "light" | "dark";
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-0 md:divide-x md:divide-black/[0.08] md:dark:divide-white/[0.08]">
      <ScaleCalculationColumn title="Lab scale" lines={lab} score={labScore} theme={theme} />
      <ScaleCalculationColumn title="Target scale" lines={target} score={targetScore} theme={theme} />
    </div>
  );
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
}: {
  question: string;
  fraction: {
    mathNumerator: React.ReactNode;
    mathDenominator: React.ReactNode;
    textNumerator: React.ReactNode;
    textDenominator: React.ReactNode;
  };
  lab: { score: RiskScore; value: number; std?: number };
  target: { score: RiskScore; value: number; std?: number };
  bands: Band[];
  higherIsSafer: boolean;
  theme: "light" | "dark";
  narrative: React.ReactNode;
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
        <ScoreColumn title="Lab scale" score={lab.score} value={lab.value} std={lab.std} bands={bands} higherIsSafer={higherIsSafer} theme={theme} />
        <ScoreColumn title="Target scale" score={target.score} value={target.value} std={target.std} bands={bands} higherIsSafer={higherIsSafer} theme={theme} />
      </div>
      {/* ARCHIVED — Calculation Breakdown panel. To restore: remove the {false && ...} wrapper.
      {false && (
      <div className="glass-panel-sm p-4 border-black/[0.08] dark:border-white/[0.08] space-y-2">
        <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-silver-400">Calculation Breakdown</p>
        <p className="text-[12px] text-silver-500 -mt-1 mb-2">Work through the maths</p>
        {narrative}
      </div>
      )} */}
    </div>
  );
}

// --- Detail panels ---

function OtrDetail({ otr, derived, inputs, theme }: {
  otr: OtrRiskResult;
  derived: DerivedParameters;
  inputs: ProcessInputs;
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
  const labScore = scoreFromBands(scoreLabValue, oxygenBands);
  const targetScore = scoreFromBands(scoreTargetValue, oxygenBands);

  return (
    <DetailScaffold
      question="Can the reactor deliver sufficient oxygen to the cells to sustain their growth and product formation?"
      fraction={{
        mathNumerator: <>OTR</>,
        mathDenominator: <>OUR</>,
        textNumerator: <>Oxygen Transfer Rate (mmol/L/h)</>,
        textDenominator: <>Oxygen Uptake Rate (mmol/L/h)</>,
      }}
      lab={{ score: labScore, value: scoreLabValue, std: otr.otr_our_ratio_lab_std }}
      target={{ score: targetScore, value: scoreTargetValue, std: otr.otr_our_ratio_target_std }}
      bands={oxygenBands}
      higherIsSafer
      theme={theme}
      narrative={
        <ScaleAnalysisGrid
          labScore={labScore}
          targetScore={targetScore}
          theme={theme}
          lab={[
            {
              label: "Oxygen uptake rate",
              finalValue: <>{fmt(our, 1)} mmol/L/h</>,
              note: "Direct value from measured OUR or organism/density estimate.",
            },
            {
              label: <><KlaSymbol /></>,
              finalValue: <>{otr.kla_lab_std ? fmtRange95(otr.kla_lab, otr.kla_lab_std) : String(roundTo5(otr.kla_lab))} h<sup>-1</sup></>,
              note: <>Calculated as the mean of the active <KlaSymbol /> ensemble: Van't Riet (1979), Garcia-Ochoa and Gomez (2009), Linek et al. (2004), and impeller-specific correlations from the local correlation bank.</>,
            },
            {
              label: "Oxygen transfer rate",
              equation: <>OTR = <KlaSymbol /> × ΔC<sub>LM</sub></>,
              substitution: <>{fmt(otr.kla_lab, 1)} × {fmt(derived.df_lm_lab, 3)}</>,
              finalValue: <>{fmt(otrLab, 1)} mmol/L/h</>,
              note: <>ΔC<sub>LM</sub> is computed from oxygen solubility C* and the DO set point.</>,
            },
            {
              label: "Score",
              equation: <>Score = OTR / OUR</>,
              substitution: <>{fmt(otrLab, 1)} / {fmt(our, 1)}</>,
              finalValue: <>{fmt(scoreLabValue, 2)}{otr.otr_our_ratio_lab_std ? <span className="text-silver-400"> ± {fmt(otr.otr_our_ratio_lab_std, 2)}</span> : null}</>,
            },
          ]}
          target={[
            {
              label: "Oxygen uptake rate",
              finalValue: <>{fmt(our, 1)} mmol/L/h</>,
              note: "Same organism and biomass demand applied at target scale.",
            },
            {
              label: <><KlaSymbol /></>,
              finalValue: <>{otr.kla_target_std ? fmtRange95(otr.kla_target_moderate, otr.kla_target_std) : String(roundTo5(otr.kla_target_moderate))} h<sup>-1</sup></>,
              note: <>Calculated as the mean of the active <KlaSymbol /> ensemble: Van't Riet (1979), Garcia-Ochoa and Gomez (2009), Linek et al. (2004), and impeller-specific correlations from the local correlation bank.</>,
            },
            {
              label: "Oxygen transfer rate",
              equation: <>OTR = <KlaSymbol /> × ΔC<sub>LM</sub></>,
              substitution: <>{fmt(otr.kla_target_moderate, 1)} × {fmt(derived.driving_force, 3)}</>,
              finalValue: <>{fmt(otrTarget, 1)} mmol/L/h</>,
              note: <>ΔC<sub>LM</sub> is computed from oxygen solubility C* and the DO set point.</>,
            },
            {
              label: "Score",
              equation: <>Score = OTR / OUR</>,
              substitution: <>{fmt(otrTarget, 1)} / {fmt(our, 1)}</>,
              finalValue: <>{fmt(scoreTargetValue, 2)}{otr.otr_our_ratio_target_std ? <span className="text-silver-400"> ± {fmt(otr.otr_our_ratio_target_std, 2)}</span> : null}</>,
            },
          ]}
        />
      }
    />
  );
}

function MixingDetail({ mixing, derived, inputs, theme }: {
  mixing: MixingRiskResult;
  derived: DerivedParameters;
  inputs: ProcessInputs;
  theme: "light" | "dark";
}) {
  const mixingBands: Band[] = [
    { score: "low", label: "Low", min: 10 },
    { score: "moderate", label: "Moderate", min: 1, max: 10 },
    { score: "high", label: "High", min: 0.1, max: 1 },
    { score: "critical", label: "Critical", max: 0.1 },
  ];
  const targetConfig = buildReactorScaleConfigs(inputs, { method: inputs.scaleup_criterion ?? "power_per_volume" }).target;
  const epsilonLab = derived.pv_lab / RHO;
  const epsilonTarget = targetConfig.pv_w_m3 / RHO;
  const labScore = scoreFromBands(mixing.process_mixing_ratio_lab, mixingBands);
  const targetScore = scoreFromBands(mixing.process_mixing_ratio_target, mixingBands);

  return (
    <DetailScaffold
      question="Is mixing fast enough to dissipate gradients?"
      fraction={{
        mathNumerator: <>τ<sub>process</sub></>,
        mathDenominator: <>τ<sub>mix</sub></>,
        textNumerator: <>Shortest process timescale (s)</>,
        textDenominator: <>Mixing time (s)</>,
      }}
      lab={{ score: labScore, value: mixing.process_mixing_ratio_lab, std: mixing.process_mixing_ratio_lab_std }}
      target={{ score: targetScore, value: mixing.process_mixing_ratio_target, std: mixing.process_mixing_ratio_target_std }}
      bands={mixingBands}
      higherIsSafer
      theme={theme}
      narrative={
        <ScaleAnalysisGrid
          labScore={labScore}
          targetScore={targetScore}
          theme={theme}
          lab={[
            {
              label: <>Oxygen uptake time τ<sub>O₂</sub></>,
              equation: <>τ<sub>O₂</sub> = 3600 × C* / OUR</>,
              substitution: <>3600 × {fmt(derived.c_star_lab, 3)} / {fmt(derived.our_peak, 1)}</>,
              finalValue: <>{fmt(mixing.oxygen_depletion_time_lab_s, 2)} s</>,
              note: <>C* is oxygen solubility at saturation at this scale.</>,
            },
            ...(inputs.process_type === "fed_batch" && mixing.t_feed_s !== undefined ? [
              {
                label: <>Feed interval τ<sub>feed</sub></>,
                equation: <>τ<sub>feed</sub> = feed pulse interval</>,
                substitution: <>{FEEDING_FREQUENCY_LABELS[inputs.feeding_frequency ?? "10_30min"]} ({fmt(mixing.t_feed_s, 0)} s)</>,
                finalValue: <>{fmt(mixing.t_feed_s, 0)} s</>,
              },
              {
                label: <>Process timescale τ<sub>process</sub></>,
                equation: <>τ<sub>process</sub> = min(τ<sub>O₂</sub>, τ<sub>feed</sub>)</>,
                substitution: <>min({fmt(mixing.oxygen_depletion_time_lab_s, 1)}, {fmt(mixing.t_feed_s, 0)})</>,
                finalValue: <>{fmt(mixing.t_process_lab_s, 1)} s</>,
              },
            ] : []),
            {
              label: <>Mixing time τ<sub>mix</sub></>,
              equation: <>τ<sub>mix</sub> = C<sub>GN</sub> · T<sup>2/3</sup> · ε<sup>−1/3</sup> · (D/T)<sup>−1/3</sup> / N</>,
              substitution: <>{RUSZKOWSKI_CONSTANT} × {fmt(derived.lab_geometry.t_diameter, 3)}<sup>2/3</sup> × {fmt(epsilonLab, 3)}<sup>−1/3</sup> × ({fmt(derived.lab_geometry.d_imp, 3)}/{fmt(derived.lab_geometry.t_diameter, 3)})<sup>−1/3</sup> / {fmt(inputs.rpm / 60, 3)}</>,
              finalValue: <>{fmtRange95(mixing.theta_mix_lab, mixing.theta_mix_lab_std)} s</>,
              note: <>Ensemble mean of Grenville-Nienow (2002) and Ruszkowski (1994); ε = P/V / ρ.</>,
            },
            {
              label: "Score",
              equation: <>Score = τ<sub>process</sub> / τ<sub>mix</sub></>,
              substitution: <>{fmt(mixing.t_process_lab_s, 1)} / {fmt(mixing.theta_mix_lab, 2)}</>,
              finalValue: <>{fmt(mixing.process_mixing_ratio_lab, 3)}<span className="text-silver-400"> ± {fmt(mixing.process_mixing_ratio_lab_std, 3)}</span></>,
            },
          ]}
          target={[
            {
              label: <>Oxygen uptake time τ<sub>O₂</sub></>,
              equation: <>τ<sub>O₂</sub> = 3600 × C* / OUR</>,
              substitution: <>3600 × {fmt(derived.c_star, 3)} / {fmt(derived.our_peak, 1)}</>,
              finalValue: <>{fmt(mixing.oxygen_depletion_time_target_s, 2)} s</>,
              note: <>C* is oxygen solubility at saturation at this scale.</>,
            },
            ...(inputs.process_type === "fed_batch" && mixing.t_feed_s !== undefined ? [
              {
                label: <>Feed interval τ<sub>feed</sub></>,
                equation: <>τ<sub>feed</sub> = feed pulse interval</>,
                substitution: <>{FEEDING_FREQUENCY_LABELS[inputs.feeding_frequency ?? "10_30min"]} ({fmt(mixing.t_feed_s, 0)} s)</>,
                finalValue: <>{fmt(mixing.t_feed_s, 0)} s</>,
              },
              {
                label: <>Process timescale τ<sub>process</sub></>,
                equation: <>τ<sub>process</sub> = min(τ<sub>O₂</sub>, τ<sub>feed</sub>)</>,
                substitution: <>min({fmt(mixing.oxygen_depletion_time_target_s, 1)}, {fmt(mixing.t_feed_s, 0)})</>,
                finalValue: <>{fmt(mixing.t_process_target_s, 1)} s</>,
              },
            ] : []),
            {
              label: <>Mixing time τ<sub>mix</sub></>,
              equation: <>τ<sub>mix</sub> = C<sub>GN</sub> · T<sup>2/3</sup> · ε<sup>−1/3</sup> · (D/T)<sup>−1/3</sup> / N</>,
              substitution: <>{RUSZKOWSKI_CONSTANT} × {fmt(derived.target_geometry.t_diameter, 3)}<sup>2/3</sup> × {fmt(epsilonTarget, 3)}<sup>−1/3</sup> × ({fmt(derived.target_geometry.d_imp, 3)}/{fmt(derived.target_geometry.t_diameter, 3)})<sup>−1/3</sup> / {fmt(targetConfig.rpm / 60, 3)}</>,
              finalValue: <>{fmtRange95(mixing.theta_mix_target, mixing.theta_mix_target_std)} s</>,
              note: <>Ensemble mean of Grenville-Nienow (2002) and Ruszkowski (1994); ε = P/V / ρ.</>,
            },
            {
              label: "Score",
              equation: <>Score = τ<sub>process</sub> / τ<sub>mix</sub></>,
              substitution: <>{fmt(mixing.t_process_target_s, 1)} / {fmt(mixing.theta_mix_target, 2)}</>,
              finalValue: <>{fmt(mixing.process_mixing_ratio_target, 3)}<span className="text-silver-400"> ± {fmt(mixing.process_mixing_ratio_target_std, 3)}</span></>,
            },
          ]}
        />
      }
    />
  );
}

function ShearDetail({ shear, derived, inputs, theme }: {
  shear: ShearRiskResult;
  derived: DerivedParameters;
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
  const tipSpeedLab = shear.tip_speed_lab ?? 0;
  const labScore = scoreFromBands(labMargin, shearBands);
  const targetScore = scoreFromBands(shear.tip_speed_margin, shearBands);

  return (
    <DetailScaffold
      question="Is shear low enough to protect cells from damage?"
      fraction={{
        mathNumerator: <>v<sup>threshold</sup><sub>tip</sub></>,
        mathDenominator: <>v<sup>impeller</sup><sub>tip</sub></>,
        textNumerator: <>Tip speed threshold of microbe (m/s)</>,
        textDenominator: <>Tip speed of impeller (m/s)</>,
      }}
      lab={{ score: labScore, value: labMargin, std: shear.tip_speed_margin_lab_std }}
      target={{ score: targetScore, value: shear.tip_speed_margin, std: shear.tip_speed_margin_std }}
      bands={shearBands}
      higherIsSafer
      theme={theme}
      narrative={
        <ScaleAnalysisGrid
          labScore={labScore}
          targetScore={targetScore}
          theme={theme}
          lab={[
            {
              label: <>Tip speed v<sub>tip</sub></>,
              equation: <>v<sub>tip</sub> = πNd<sub>i</sub></>,
              substitution: <>π × {fmt(shear.n_lab ?? 0, 2)} × {fmt(derived.lab_geometry.d_imp, 3)}</>,
              finalValue: <>{fmt(tipSpeedLab, 2)} m/s</>,
            },
            {
              label: <>Tip speed threshold v<sub>tip</sub><sup>threshold</sup></>,
              finalValue: <>{fmt(shear.tip_speed_threshold, 2)} m/s</>,
              note: "Microbe-dependent threshold.",
            },
            {
              label: "Score",
              equation: <>Score = v<sub>tip</sub><sup>threshold</sup> / v<sub>tip</sub><sup>impeller</sup></>,
              substitution: <>{fmt(shear.tip_speed_threshold, 2)} / {fmt(tipSpeedLab, 2)}</>,
              finalValue: <>{fmt(labMargin, 2)}{shear.tip_speed_margin_lab_std ? <span className="text-silver-400"> ± {fmt(shear.tip_speed_margin_lab_std, 2)}</span> : null}</>,
            },
          ]}
          target={[
            {
              label: <>Tip speed v<sub>tip</sub></>,
              equation: <>v<sub>tip</sub> = πNd<sub>i</sub></>,
              substitution: <>π × {fmt(shear.n_target, 2)} × {fmt(derived.target_geometry.d_imp, 3)}</>,
              finalValue: <>{fmt(shear.tip_speed, 2)} m/s</>,
            },
            {
              label: <>Tip speed threshold v<sub>tip</sub><sup>threshold</sup></>,
              finalValue: <>{fmt(shear.tip_speed_threshold, 2)} m/s</>,
              note: "Microbe-dependent threshold.",
            },
            {
              label: "Score",
              equation: <>Score = v<sub>tip</sub><sup>threshold</sup> / v<sub>tip</sub><sup>impeller</sup></>,
              substitution: <>{fmt(shear.tip_speed_threshold, 2)} / {fmt(shear.tip_speed, 2)}</>,
              finalValue: <>{fmt(shear.tip_speed_margin, 2)}{shear.tip_speed_margin_std ? <span className="text-silver-400"> ± {fmt(shear.tip_speed_margin_std, 2)}</span> : null}</>,
            },
          ]}
        />
      }
    />
  );
}

function Co2Detail({ co2, derived, inputs, theme }: {
  co2: Co2RiskResult;
  derived: DerivedParameters;
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
  const rq = resolveRq(inputs.organism_species);
  const labScore = scoreFromBands(labMargin, co2Bands);
  const targetScore = scoreFromBands(targetMargin, co2Bands);

  const inactiveCo2Lines: CalculationLine[] = [
    {
      label: <>CO<sub>2</sub> partial pressure threshold</>,
      finalValue: <>{fmt(co2.pco2_critical ?? 0, 3)} bar</>,
      note: "Microbe-dependent threshold.",
    },
    {
      label: "Score",
      finalValue: <>∞</>,
      note: "Detailed CO2 accumulation calculation is inactive below biomass/OUR trigger thresholds.",
    },
  ];
  const labCo2 = co2.lab;
  const targetCo2 = co2.target;
  const co2Lines = (scale: NonNullable<typeof co2.lab> | undefined, margin: number): CalculationLine[] => {
    if (!co2.activated || !scale) return inactiveCo2Lines;
    return [
      {
        label: "Carbon dioxide evolution rate",
        equation: <>CER = RQ × OUR</>,
        substitution: <>{fmt(rq, 2)} × {fmt(derived.our_peak, 1)}</>,
        finalValue: <>{fmt(scale.cer, 1)} mmol/L/h</>,
      },
      {
        label: <>k<sub>L</sub>a<sub>CO₂</sub></>,
        equation: <>k<sub>L</sub>a<sub>CO₂</sub> = k<sub>L</sub>a<sub>O₂</sub> × √(D<sub>CO₂</sub> / D<sub>O₂</sub>)</>,
        substitution: <>{fmt(scale.kla_co2 / KLA_CO2_O2_RATIO, 1)} × √(D<sub>CO₂</sub> / D<sub>O₂</sub>) = {fmt(scale.kla_co2 / KLA_CO2_O2_RATIO, 1)} × {fmt(KLA_CO2_O2_RATIO, 2)}</>,
        finalValue: <>{fmt(scale.kla_co2, 1)} h<sup>-1</sup></>,
      },
      {
        label: <>P<sub>CO₂</sub> in bulk liquid</>,
        equation: <>P<sup>bulk</sup><sub>CO₂</sub> = P<sup>gas,avg</sup><sub>CO₂</sub> + CER / (k<sub>L</sub>a<sub>CO₂</sub> · H<sub>CO₂</sub>)</>,
        substitution: <>{fmt(scale.pco2_gas_avg, 4)} + {fmt(scale.cer, 1)} / ({fmt(scale.kla_co2, 1)} · H<sub>CO₂</sub>)</>,
        finalValue: <>{fmt(scale.pco2_bulk, 3)} bar</>,
        note: "Log-mean gas-phase pCO₂ plus the mass-transfer driving force needed to strip CER (Henry's law).",
      },
      {
        label: <>P<sub>CO₂</sub> at vessel bottom</>,
        equation: <>P<sup>bottom</sup><sub>CO₂</sub> = P<sup>bulk</sup><sub>CO₂</sub> × (P<sub>atm</sub> + ρ·g·h<sub>L</sub>) / P<sub>atm</sub></>,
        substitution: <>{fmt(scale.pco2_bulk, 3)} × (1 + {fmt(scale.dp_hydro / ATMOSPHERIC_PRESSURE_PA, 3)})</>,
        finalValue: <>{fmt(scale.pco2_bottom, 3)} bar</>,
        note: "Hydrostatic head raises pCO₂ at the bottom; this is the worst-case location for inhibition.",
      },
      {
        label: <>CO<sub>2</sub> partial pressure threshold</>,
        finalValue: <>{fmt(co2.pco2_critical ?? 0, 3)} bar</>,
        note: "Microbe-dependent threshold.",
      },
      {
        label: "Score",
        equation: <>Score = P<sub>CO₂</sub><sup>threshold</sup> / P<sub>CO₂</sub><sup>bottom</sup></>,
        substitution: <>{fmt(co2.pco2_critical ?? 0, 3)} / {fmt(scale.pco2_bottom, 3)}</>,
        finalValue: <>{Number.isFinite(margin) ? fmt(margin, 2) : "∞"}{Number.isFinite(margin) && scale.pco2_margin_std > 0 ? <span className="text-silver-400"> ± {fmt(scale.pco2_margin_std, 2)}</span> : null}</>,
      },
    ];
  };

  return (
    <DetailScaffold
      question="Is carbon dioxide accumulation sufficiently low to prevent hampering cell growth?"
      fraction={{
        mathNumerator: <>P<sup>threshold</sup><sub>CO₂</sub></>,
        mathDenominator: <>P<sup>reactor</sup><sub>CO₂</sub></>,
        textNumerator: <>CO<sub>2</sub> partial pressure threshold (bar)</>,
        textDenominator: <>CO<sub>2</sub> partial pressure at the bottom of reactor (bar)</>,
      }}
      lab={{ score: labScore, value: labMargin, std: co2.lab?.pco2_margin_std }}
      target={{ score: targetScore, value: targetMargin, std: co2.target?.pco2_margin_std }}
      bands={co2Bands}
      higherIsSafer
      theme={theme}
      narrative={
        <ScaleAnalysisGrid
          labScore={labScore}
          targetScore={targetScore}
          theme={theme}
          lab={co2Lines(labCo2, labMargin)}
          target={co2Lines(targetCo2, targetMargin)}
        />
      }
    />
  );
}

function HeatDetail({ heat, derived, inputs, theme }: {
  heat: HeatRiskResult;
  derived: DerivedParameters;
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
  const labScore = scoreFromBands(labMargin, heatBands);
  const targetScore = scoreFromBands(targetMargin, heatBands);
  const targetHeat = heat.target ?? {
    q_metabolic: heat.q_metabolic,
    q_cool_max: heat.q_cool_max,
    u_overall: heat.u_overall ?? 0,
    a_jacket: heat.a_jacket,
    dt_lm: heat.dt_lm,
    heat_transfer_margin: targetMargin,
    heat_ratio: heat.heat_ratio,
    margin_score: heat.margin_score ?? targetScore,
    score: targetScore,
    t_cw_outlet: heat.t_cw_outlet ?? 0,
    h_broth: heat.h_broth ?? 0,
    h_jacket: heat.h_jacket ?? 0,
    r_broth: heat.r_broth ?? 0,
    r_wall: heat.r_wall ?? 0,
    r_jacket: heat.r_jacket ?? 0,
    r_total: heat.r_total ?? 0,
    cooling_water_delta_t: heat.cooling_water_delta_t ?? 0,
    jacket_re: heat.jacket_re ?? 0,
    wall_material: heat.wall_material ?? "stainless_steel",
    heat_transfer_margin_std: heat.heat_transfer_margin_std ?? 0,
  };
  const heatLines = (scaleHeat: typeof targetHeat, margin: number): CalculationLine[] => [
    {
      label: <>Cooling capacity Q<sub>cooling</sub></>,
      equation: <>Q<sub>cooling</sub> = U A ΔT<sub>LM</sub></>,
      substitution: <>{fmt(scaleHeat.u_overall, 1)} × {fmt(scaleHeat.a_jacket, 2)} × {fmt(scaleHeat.dt_lm, 1)} / 1000</>,
      finalValue: <>{fmt(scaleHeat.q_cool_max, 2)} kW</>,
      note: <>U = 1 / (1/h<sub>i</sub> + R<sub>f,broth</sub> + δ<sub>wall</sub>/k<sub>wall</sub> + R<sub>f,jacket</sub> + 1/h<sub>o</sub>). h<sub>i</sub> uses Chilton-Drew (1944; Bondy and Lippa, 1983 constants by impeller). h<sub>o</sub> uses Dittus-Boelter (1930) with transitional/laminar fallbacks.</>,
    },
    {
      label: <>Heat generated during fermentation Q<sub>metabolic</sub></>,
      equation: <>Q<sub>metabolic</sub> = ΔH<sub>metabolic</sub> × OUR × V / 3600</>,
      substitution: <>{fmt(METABOLIC_HEAT_COEFF_KJ_PER_MMOL[inputs.organism_species], 2)} × {fmt(derived.our_peak, 1)} × {fmt((scaleHeat.q_metabolic * 3600) / Math.max(METABOLIC_HEAT_COEFF_KJ_PER_MMOL[inputs.organism_species] * derived.our_peak, 1e-9), 1)} / 3600</>,
      finalValue: <>{fmt(scaleHeat.q_metabolic, 2)} kW</>,
      note: <>ΔH<sub>metabolic</sub> = {fmt(METABOLIC_HEAT_COEFF_KJ_PER_MMOL[inputs.organism_species], 2)} kJ/mmol O<sub>2</sub>.</>,
    },
    {
      label: "Score",
      equation: <>Score = Q<sub>cooling</sub> / Q<sub>metabolic</sub></>,
      substitution: <>{fmt(scaleHeat.q_cool_max, 2)} / {fmt(scaleHeat.q_metabolic, 2)}</>,
      finalValue: <>{fmt(margin, 2)}{scaleHeat.heat_transfer_margin_std > 0 ? <span className="text-silver-400"> ± {fmt(scaleHeat.heat_transfer_margin_std, 2)}</span> : null}</>,
    },
  ];

  return (
    <DetailScaffold
      question="Can the reactor effectively withdraw the metabolic heat generated during fermentation?"
      fraction={{
        mathNumerator: <>Q<sub>cooling</sub></>,
        mathDenominator: <>Q<sub>metabolic</sub></>,
        textNumerator: <>Reactor's capacity to withdraw heat (kW)</>,
        textDenominator: <>Heat generated during fermentation (kW)</>,
      }}
      lab={{ score: labScore, value: labMargin, std: heat.lab?.heat_transfer_margin_std }}
      target={{ score: targetScore, value: targetMargin, std: heat.target?.heat_transfer_margin_std }}
      bands={heatBands}
      higherIsSafer
      theme={theme}
      narrative={
        <ScaleAnalysisGrid
          labScore={labScore}
          targetScore={targetScore}
          theme={theme}
          lab={heatLines(heat.lab ?? targetHeat, labMargin)}
          target={heatLines(targetHeat, targetMargin)}
        />
      }
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
  klaMean: number;
  klaStd: number;
  mixingTimeS: number;
  mixingTimeStd: number;
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

function calculatePco2ForScale(
  scale: ReactorScaleConfig,
  inputs: ProcessInputs,
  derived: DerivedParameters,
): number | null {
  if (derived.our_peak <= CO2_OUR_THRESHOLD) return null;

  const cer = resolveRq(inputs.organism_species) * derived.our_peak;
  const klaCo2 = KLA_CO2_O2_RATIO * scale.kla_h;
  const vLiquidL = scale.geometry.volume_m3 * 1000;
  const qGasNlH = scale.gas.q_gas * 1e3 * 3600;
  const nDotGasMol = qGasNlH / molarVolumeIdealGas(inputs.temperature);
  const cerMolH = (cer / 1000) * vLiquidL;
  const yCo2Out = Math.min(Y_CO2_INLET + cerMolH / Math.max(nDotGasMol, 1e-9), MAX_CO2_MOLE_FRACTION);
  const pco2GasIn  = Y_CO2_INLET * ATMOSPHERIC_PRESSURE_BAR;
  const pco2GasOut = yCo2Out     * ATMOSPHERIC_PRESSURE_BAR; // outlet at atmospheric — top of vessel
  const pco2GasAvg = Math.abs(pco2GasOut - pco2GasIn) < 1e-12
    ? pco2GasOut
    : (pco2GasOut - pco2GasIn) / Math.log(pco2GasOut / pco2GasIn);
  const pco2BulkAtm = (pco2GasAvg / ATMOSPHERIC_PRESSURE_BAR) + (cer / 1000) / (Math.max(klaCo2, 1e-9) * H_CO2);
  const pco2Bulk = pco2BulkAtm * ATMOSPHERIC_PRESSURE_BAR;
  const dpHydro = RHO * G * scale.geometry.h_liquid;
  return pco2Bulk * (ATMOSPHERIC_PRESSURE_PA + dpHydro) / ATMOSPHERIC_PRESSURE_PA;
}

function summarizeScale(
  scale: ReactorScaleConfig,
  inputs: ProcessInputs,
  derived: DerivedParameters,
): ProjectionScaleSummary {
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

  const mixingEns = computeMixingTimeEnsemble({
    T: scale.geometry.t_diameter,
    D: scale.geometry.d_imp,
    N_rps: scale.rpm / 60,
    pv_w_m3: scale.pv_w_m3,
    impeller_type: inputs.impeller_type,
  });

  return {
    volumeL: scale.volume_litres,
    rpm: scale.rpm,
    aerationLpm: scale.gas.q_gas * 1000 * 60,
    vvm: scale.vvm,
    impellerDiameterM: scale.geometry.d_imp,
    reactorHeightM: scale.geometry.h_liquid,
    klaMean: scale.kla_h,
    klaStd: scale.kla_ensemble.std,
    mixingTimeS: mixingEns.mean,
    mixingTimeStd: mixingEns.std,
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

type ModificationId =
  | "increase_impeller_rpm"
  | "decrease_impeller_rpm"
  | "increase_aeration_rate"
  | "increase_oxygen_saturation"
  | "increase_impeller_diameter"
  | "decrease_impeller_diameter"
  | "switch_to_rushton_impeller"
  | "switch_to_pitched_blade_impeller"
  | "add_internal_cooling_coils"
  | "reduce_feeding_frequency";

const OXYGEN_LEVELS_DEFAULT = [20.9, 40, 60, 80] as const;

function oxygenLevelsFromBaseline(baseline: number): number[] {
  const levels = new Set<number>(OXYGEN_LEVELS_DEFAULT);
  levels.add(Number(baseline.toFixed(1)));
  return Array.from(levels).sort((a, b) => a - b);
}

interface ModificationDefinition {
  id: ModificationId;
  label: string;
  domains: RiskDomain[];
  section: "operational" | "design";
}

const MODIFICATIONS: ModificationDefinition[] = [
  { id: "increase_impeller_rpm", label: "Increase impeller RPM", domains: ["otr", "mixing", "co2", "heat"], section: "operational" },
  { id: "decrease_impeller_rpm", label: "Decrease impeller RPM", domains: ["shear"], section: "operational" },
  { id: "increase_aeration_rate", label: "Increase aeration rate", domains: ["otr", "co2", "heat"], section: "operational" },
  { id: "increase_oxygen_saturation", label: "Increase oxygen saturation", domains: ["otr"], section: "operational" },
  { id: "increase_impeller_diameter", label: "Increase impeller diameter", domains: ["otr", "mixing", "co2"], section: "design" },
  { id: "decrease_impeller_diameter", label: "Decrease impeller diameter", domains: ["shear"], section: "design" },
  { id: "switch_to_rushton_impeller", label: "Switch to Rushton impeller", domains: ["otr", "mixing", "co2", "heat"], section: "design" },
  { id: "switch_to_pitched_blade_impeller", label: "Switch to Pitched blade impeller", domains: ["otr", "mixing", "co2", "heat"], section: "design" },
  { id: "add_internal_cooling_coils", label: "Add internal cooling coils", domains: ["heat"], section: "design" },
  { id: "reduce_feeding_frequency", label: "Reduce feeding frequency", domains: ["mixing"], section: "operational" },
];

const CONFLICTS: Record<ModificationId, ModificationId[]> = {
  increase_impeller_rpm: ["decrease_impeller_rpm"],
  decrease_impeller_rpm: ["increase_impeller_rpm"],
  increase_aeration_rate: [],
  increase_oxygen_saturation: [],
  increase_impeller_diameter: ["decrease_impeller_diameter"],
  decrease_impeller_diameter: ["increase_impeller_diameter"],
  switch_to_rushton_impeller: ["switch_to_pitched_blade_impeller"],
  switch_to_pitched_blade_impeller: ["switch_to_rushton_impeller"],
  add_internal_cooling_coils: [],
  reduce_feeding_frequency: [],
};

function applyModificationsWithOxygenLevel(
  inputs: ProcessInputs,
  active: Set<ModificationId>,
  oxygenLevel: number | null,
  feedFrequency: FeedingFrequency | null = null,
): ProcessInputs {
  const limits = getScaleupOperatingRange(inputs.v_target);
  const out: ProcessInputs = { ...inputs };

  let dtTarget = out.dt_ratio_target ?? IMPELLER_CONSTANTS[out.impeller_type].d_t_ratio;

  if (active.has("switch_to_rushton_impeller")) out.impeller_type = "rushton";
  if (active.has("switch_to_pitched_blade_impeller")) out.impeller_type = "pitched_blade";
  if (active.has("increase_impeller_rpm")) out.target_rpm_override = limits.max_rpm.max;
  if (active.has("increase_aeration_rate")) out.vvm = limits.max_aeration_vvm.max;
  if (oxygenLevel != null) out.o2_inlet = oxygenLevel;
  if (feedFrequency != null && inputs.process_type === "fed_batch") out.feeding_frequency = feedFrequency;
  if (active.has("increase_impeller_diameter")) {
    dtTarget = Math.min(dtTarget + 0.1, 0.8);
    // Keep target RPM fixed at the baseline value so that the larger impeller
    // at the same RPM produces higher P/V and higher kLa, rather than having
    // the criterion solver drop RPM to preserve the original P/V.
    const baselineTargetRpm = buildReactorScaleConfigs(inputs, {
      method: inputs.scaleup_criterion ?? "power_per_volume",
    }).target.rpm;
    out.target_rpm_override = baselineTargetRpm;
  }
  if (active.has("decrease_impeller_diameter")) dtTarget = Math.max(dtTarget - 0.1, 0.1);

  out.dt_ratio_target = dtTarget;

  // Decrease RPM should lower target tip speed, not just lab RPM.
  if (active.has("decrease_impeller_rpm")) {
    const method = out.scaleup_criterion ?? "power_per_volume";
    const currentTarget = buildReactorScaleConfigs(out, { method }).target.rpm;
    const desiredTarget = Math.max(currentTarget - 50, limits.max_rpm.min);
    if (desiredTarget < currentTarget - 1e-6) {
      let lo = limits.max_rpm.min;
      let hi = Math.max(out.rpm, lo);
      for (let i = 0; i < 28; i++) {
        const mid = (lo + hi) / 2;
        const trial = { ...out, rpm: mid };
        const targetMid = buildReactorScaleConfigs(trial, { method }).target.rpm;
        if (targetMid > desiredTarget) hi = mid;
        else lo = mid;
      }
      out.rpm = Math.max(lo, limits.max_rpm.min);
    }
  }
  return out;
}

function heatScoreFromMargin(margin: number): RiskScore {
  if (margin > 1 / 0.6) return "low";
  if (margin > 1 / 0.85) return "moderate";
  if (margin > 1.0) return "high";
  return "critical";
}

// --- Compact domain card for horizontal row ---

function DomainCard({
  domain,
  score,
  scoreValue,
  thresholdText,
  confidence,
  expanded,
  onClick,
  theme,
}: {
  domain: RiskDomain;
  score: RiskScore;
  scoreValue: string;
  thresholdText: string;
  confidence: Confidence;
  expanded: boolean;
  onClick: () => void;
  theme: "light" | "dark";
}) {
  const colour = riskColour(score, theme);
  const confidenceColour = confidence === "directional"
    ? riskColour("moderate", theme)
    : riskColour("low", theme);

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
        <p className="relative text-[9px] text-silver-500 leading-none mb-2 whitespace-nowrap tracking-normal">
          {thresholdText}
        </p>
        <p className="relative mb-3 flex items-center gap-1.5 text-[10px] font-medium text-silver-500">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: confidenceColour }}
            aria-hidden="true"
          />
          <span>{confidenceLabel(confidence)}</span>
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

function ReactorModificationsPanel({
  domain,
  selected,
  onToggle,
  canSelect,
  oxygenLevel,
  oxygenBaseline,
  onOxygenStep,
  feedFrequency,
  feedFrequencyBaseline,
  onFeedFrequencyStep,
  showFeedFrequencyControl,
  impellerType,
  theme,
}: {
  domain: RiskDomain;
  selected: Set<ModificationId>;
  onToggle: (id: ModificationId) => void;
  canSelect: (id: ModificationId) => boolean;
  oxygenLevel: number;
  oxygenBaseline: number;
  onOxygenStep: (dir: "left" | "right") => void;
  feedFrequency: FeedingFrequency;
  feedFrequencyBaseline: FeedingFrequency;
  onFeedFrequencyStep: (dir: "left" | "right") => void;
  showFeedFrequencyControl: boolean;
  impellerType: ProcessInputs["impeller_type"];
  theme: "light" | "dark";
}) {
  const oxygenLevels = oxygenLevelsFromBaseline(oxygenBaseline);
  const oxygenIdx = Math.max(0, oxygenLevels.findIndex((v) => Math.abs(v - oxygenLevel) < 1e-9));
  const canLeft = oxygenIdx > 0;
  const canRight = oxygenIdx < oxygenLevels.length - 1;
  const oxygenIsModified = Math.abs(oxygenLevel - oxygenBaseline) > 1e-9;
  const freqIdx = FEEDING_FREQUENCY_ORDER.indexOf(feedFrequency);
  const canFreqLeft  = freqIdx < FEEDING_FREQUENCY_ORDER.length - 1;  // ◀ = less frequent
  const canFreqRight = freqIdx > 0;                                    // ▶ = more frequent
  const feedFreqIsModified = feedFrequency !== feedFrequencyBaseline;

  const options = MODIFICATIONS.filter((m) => {
    if (!m.domains.includes(domain)) return false;
    if (m.id === "switch_to_rushton_impeller") {
      return impellerType === "pitched_blade" || impellerType === "marine" || impellerType === "unknown";
    }
    if (m.id === "switch_to_pitched_blade_impeller") {
      return impellerType === "marine" || impellerType === "unknown";
    }
    return true;
  });
  const operational = options.filter((m) => m.section === "operational");
  const design = options.filter((m) => m.section === "design");

  const section = (title: string, items: ModificationDefinition[]) => (
    <div className="space-y-2.5">
      <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-silver-500">{title}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {items.map((item) => {
          const active = item.id === "increase_oxygen_saturation" ? oxygenIsModified
            : item.id === "reduce_feeding_frequency" ? feedFreqIsModified
            : selected.has(item.id);
          const enabled = item.id === "increase_oxygen_saturation" ? true
            : item.id === "reduce_feeding_frequency" ? showFeedFrequencyControl
            : (active || canSelect(item.id));
          const tone = riskColour(active ? "moderate" : "low", theme);
          if (item.id === "reduce_feeding_frequency") {
            if (!showFeedFrequencyControl) return null;
            return (
              <div
                key={item.id}
                className="rounded-xl px-3.5 py-2.5 border transition-all duration-200"
                style={{
                  borderColor: active ? `${tone}99` : "var(--border-primary)",
                  background: active ? `${tone}22` : "var(--bg-elevated)",
                  color: active ? tone : "var(--text-secondary)",
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium">
                    {item.label} ({FEEDING_FREQUENCY_LABELS[feedFrequency]})
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onFeedFrequencyStep("left")}
                      disabled={!canFreqLeft}
                      className={`w-6 h-6 rounded-md border text-[12px] leading-none ${
                        canFreqLeft ? "hover:brightness-110" : "opacity-40 cursor-not-allowed"
                      }`}
                      style={{ borderColor: "var(--border-primary)", background: "var(--bg-sunken)" }}
                      aria-label="Reduce feeding frequency (longer interval)"
                    >
                      ◀
                    </button>
                    <button
                      type="button"
                      onClick={() => onFeedFrequencyStep("right")}
                      disabled={!canFreqRight}
                      className={`w-6 h-6 rounded-md border text-[12px] leading-none ${
                        canFreqRight ? "hover:brightness-110" : "opacity-40 cursor-not-allowed"
                      }`}
                      style={{ borderColor: "var(--border-primary)", background: "var(--bg-sunken)" }}
                      aria-label="Increase feeding frequency (shorter interval)"
                    >
                      ▶
                    </button>
                  </div>
                </div>
              </div>
            );
          }
          if (item.id === "increase_oxygen_saturation") {
            return (
              <div
                key={item.id}
                className="rounded-xl px-3.5 py-2.5 border transition-all duration-200"
                style={{
                  borderColor: active ? `${tone}99` : "var(--border-primary)",
                  background: active ? `${tone}22` : "var(--bg-elevated)",
                  color: active ? tone : "var(--text-secondary)",
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium">
                    {item.label} ({Math.round(oxygenLevel)}%)
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onOxygenStep("left")}
                      disabled={!canLeft}
                      className={`w-6 h-6 rounded-md border text-[12px] leading-none ${
                        canLeft ? "hover:brightness-110" : "opacity-40 cursor-not-allowed"
                      }`}
                      style={{ borderColor: "var(--border-primary)", background: "var(--bg-sunken)" }}
                      aria-label="Decrease oxygen enrichment level"
                    >
                      ◀
                    </button>
                    <button
                      type="button"
                      onClick={() => onOxygenStep("right")}
                      disabled={!canRight}
                      className={`w-6 h-6 rounded-md border text-[12px] leading-none ${
                        canRight ? "hover:brightness-110" : "opacity-40 cursor-not-allowed"
                      }`}
                      style={{ borderColor: "var(--border-primary)", background: "var(--bg-sunken)" }}
                      aria-label="Increase oxygen enrichment level"
                    >
                      ▶
                    </button>
                  </div>
                </div>
              </div>
            );
          }
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onToggle(item.id)}
              disabled={!enabled}
              className={`text-left rounded-xl px-3.5 py-2.5 border transition-all duration-200 ${
                enabled ? "hover:brightness-110" : "opacity-45 cursor-not-allowed"
              }`}
              style={{
                borderColor: active ? `${tone}99` : "var(--border-primary)",
                background: active ? `${tone}22` : "var(--bg-elevated)",
                color: active ? tone : "var(--text-secondary)",
              }}
            >
              <span className="text-[13px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {section("Operational Modifications", operational)}
      {section("Design Modifications", design)}
    </div>
  );
}

// --- Main dashboard component ---

export default function ResultsDashboard({ data, isExample, onBackClick }: ResultsDashboardProps) {
  const { theme } = useTheme();
  const [selectedDomain, setSelectedDomain] = useState<RiskDomain | null>("otr");
  const [showProjections, setShowProjections] = useState(true);
  const [selectedModifications, setSelectedModifications] = useState<Set<ModificationId>>(new Set());

  const { inputs } = data;
  const baselineOxygen = inputs.o2_inlet ?? 20.9;
  const [oxygenLevel, setOxygenLevel] = useState<number>(baselineOxygen);
  const baselineFrequency: FeedingFrequency = (inputs.feeding_frequency ?? "10_30min") as FeedingFrequency;
  const [feedFrequency, setFeedFrequency] = useState<FeedingFrequency>(baselineFrequency);
  const baselineResults = useMemo(
    () => runAssessment(inputs),
    [inputs],
  );
  const baselineDerived = baselineResults.derived;
  const feedFrequencyIsModified = inputs.process_type === "fed_batch" && feedFrequency !== baselineFrequency;
  const modifiedInputs = useMemo(
    () => applyModificationsWithOxygenLevel(
      inputs,
      selectedModifications,
      Math.abs(oxygenLevel - baselineOxygen) > 1e-9 ? oxygenLevel : null,
      feedFrequencyIsModified ? feedFrequency : null,
    ),
    [inputs, selectedModifications, oxygenLevel, baselineOxygen, feedFrequency, feedFrequencyIsModified],
  );
  const rawModifiedResults = useMemo(
    () => runAssessment(modifiedInputs),
    [modifiedInputs],
  );
  const modifiedResults = useMemo(() => {
    if (!selectedModifications.has("add_internal_cooling_coils")) return rawModifiedResults;
    const heat = rawModifiedResults.heat;
    const target = heat.target ? { ...heat.target } : undefined;
    const qCoolBase = target?.q_cool_max ?? heat.q_cool_max;
    const qCool = qCoolBase * 1.5;
    const qMet = heat.q_metabolic;
    const margin = qMet > 0 ? qCool / qMet : Infinity;
    const score = heatScoreFromMargin(margin);
    if (target) {
      target.q_cool_max = qCool;
      target.heat_transfer_margin = margin;
      target.heat_ratio = qCool > 0 ? qMet / qCool : Infinity;
      target.margin_score = score;
      target.score = score;
    }
    return {
      ...rawModifiedResults,
      heat: {
        ...heat,
        q_cool_max: qCool,
        heat_transfer_margin: margin,
        heat_ratio: qCool > 0 ? qMet / qCool : Infinity,
        margin_score: score,
        score,
        target,
      },
    };
  }, [rawModifiedResults, selectedModifications]);

  const oxygenIsModified = Math.abs(oxygenLevel - baselineOxygen) > 1e-9;
  const hasActiveModifications = selectedModifications.size > 0 || oxygenIsModified || feedFrequencyIsModified;

  const activeResults = hasActiveModifications ? modifiedResults : baselineResults;
  const otr = {
    ...activeResults.otr,
    score_lab: baselineResults.otr.score_lab ?? baselineResults.otr.score,
    otr_capacity_lab: baselineResults.otr.otr_capacity_lab,
    otr_our_ratio_lab: baselineResults.otr.otr_our_ratio_lab,
    otr_our_ratio_lab_std: baselineResults.otr.otr_our_ratio_lab_std,
    kla_lab: baselineResults.otr.kla_lab,
    kla_lab_std: baselineResults.otr.kla_lab_std,
  };
  const mixing = {
    ...activeResults.mixing,
    score_lab: baselineResults.mixing.score_lab ?? baselineResults.mixing.score,
    theta_mix_lab:     baselineResults.mixing.theta_mix_lab,
    theta_mix_lab_std: baselineResults.mixing.theta_mix_lab_std,
    process_mixing_ratio_lab:     baselineResults.mixing.process_mixing_ratio_lab,
    process_mixing_ratio_lab_std: baselineResults.mixing.process_mixing_ratio_lab_std,
    t_process_lab_s:              baselineResults.mixing.t_process_lab_s,
    oxygen_depletion_time_lab_s:  baselineResults.mixing.oxygen_depletion_time_lab_s,
  };
  const shear = {
    ...activeResults.shear,
    score_lab: baselineResults.shear.score_lab ?? baselineResults.shear.score,
    n_lab: baselineResults.shear.n_lab,
    tip_speed_lab: baselineResults.shear.tip_speed_lab,
    tip_speed_margin_lab: baselineResults.shear.tip_speed_margin_lab,
    tip_speed_ratio_lab: baselineResults.shear.tip_speed_ratio_lab,
    margin_score_lab: baselineResults.shear.margin_score_lab,
  };
  const co2 = {
    ...activeResults.co2,
    lab: baselineResults.co2.lab,
  };
  const heat = {
    ...activeResults.heat,
    lab: baselineResults.heat.lab,
  };
  const derived = hasActiveModifications ? activeResults.derived : baselineDerived;
  const detailDerived: DerivedParameters = hasActiveModifications ? {
    ...derived,
    lab_geometry: baselineDerived.lab_geometry,
    n_rps: baselineDerived.n_rps,
    p_ungassed: baselineDerived.p_ungassed,
    p_gassed: baselineDerived.p_gassed,
    p_total: baselineDerived.p_total,
    pv_lab: baselineDerived.pv_lab,
    q_gas_lab: baselineDerived.q_gas_lab,
    vs_lab: baselineDerived.vs_lab,
    c_star_lab: baselineDerived.c_star_lab,
    c_l_lab: baselineDerived.c_l_lab,
    df_lm_lab: baselineDerived.df_lm_lab,
  } : baselineDerived;
  const bottleneck = activeResults.primary_bottleneck;
  const scaleRatio = inputs.v_target / inputs.v_lab;
  const baselineScaleConfigs = useMemo(() => {
    return buildReactorScaleConfigs(inputs, {
      method: inputs.scaleup_criterion ?? "power_per_volume",
    });
  }, [inputs]);
  const baselineScaleProjection = useMemo(() => {
    return computeScaleProjectionSummary(inputs, baselineDerived);
  }, [inputs, baselineDerived]);
  const vPilot = baselineScaleProjection.pilotVolumeL;
  const scaleupCriterion = inputs.scaleup_criterion ?? "power_per_volume";
  const scaleupCriterionLabel = SCALEUP_CRITERION_LABELS[scaleupCriterion];
  const scaleupConstraintWarnings = [
    ...(baselineScaleConfigs.scaleup.clamped
      ? [`Target operating conditions were constrained, so the target scale does not fully match the selected ${scaleupCriterionLabel} criterion.`]
      : []),
    ...baselineScaleConfigs.scaleup.flags,
  ];

  const PV_SLIDER_OPTIONS = [
    { label: "0.25\u00D7", value: 0.25 },
    { label: "0.5\u00D7", value: 0.5 },
    { label: "1.0\u00D7", value: 1.0 },
    { label: "2.0\u00D7", value: 2.0 },
  ];

  const toggleDomain = (d: RiskDomain) =>
    setSelectedDomain(selectedDomain === d ? null : d);

  const canSelectModification = (id: ModificationId): boolean => {
    const current = applyModificationsWithOxygenLevel(
      inputs,
      selectedModifications,
      Math.abs(oxygenLevel - baselineOxygen) > 1e-9 ? oxygenLevel : null,
    );
    const limits = getScaleupOperatingRange(inputs.v_target);
    const dt = current.dt_ratio_target ?? IMPELLER_CONSTANTS[current.impeller_type].d_t_ratio;
    switch (id) {
      case "increase_impeller_rpm":
        return buildReactorScaleConfigs(current, { method: current.scaleup_criterion ?? "power_per_volume" }).target.rpm < limits.max_rpm.max;
      case "decrease_impeller_rpm":
        return buildReactorScaleConfigs(current, { method: current.scaleup_criterion ?? "power_per_volume" }).target.rpm > limits.max_rpm.min + 1e-6;
      case "increase_aeration_rate":
        return current.vvm < limits.max_aeration_vvm.max;
      case "increase_oxygen_saturation":
        return true;
      case "increase_impeller_diameter":
        return dt < 0.8;
      case "decrease_impeller_diameter":
        return dt > 0.1;
      case "switch_to_rushton_impeller":
        return current.impeller_type !== "rushton";
      case "switch_to_pitched_blade_impeller":
        return current.impeller_type === "marine" || current.impeller_type === "unknown";
      case "add_internal_cooling_coils":
        return true;
      default:
        return true;
    }
  };

  const toggleModification = (id: ModificationId) => {
    if (id === "increase_oxygen_saturation") return;
    setSelectedModifications((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        return next;
      }
      CONFLICTS[id].forEach((conflictId) => next.delete(conflictId));
      next.add(id);
      return next;
    });
  };

  const stepOxygenLevel = (dir: "left" | "right") => {
    const levels = oxygenLevelsFromBaseline(baselineOxygen);
    const idx = Math.max(0, levels.findIndex((v) => Math.abs(v - oxygenLevel) < 1e-9));
    const nextIdx = dir === "left"
      ? Math.max(0, idx - 1)
      : Math.min(levels.length - 1, idx + 1);
    setOxygenLevel(levels[nextIdx]);
  };

  const stepFeedFrequency = (dir: "left" | "right") => {
    const idx = FEEDING_FREQUENCY_ORDER.indexOf(feedFrequency);
    // ◀ = less frequent (longer interval, higher index), ▶ = more frequent (shorter interval)
    const nextIdx = dir === "left"
      ? Math.min(FEEDING_FREQUENCY_ORDER.length - 1, idx + 1)
      : Math.max(0, idx - 1);
    setFeedFrequency(FEEDING_FREQUENCY_ORDER[nextIdx]);
  };

  const labDomainScores: Record<RiskDomain, RiskScore> = {
    otr: baselineResults.otr.score_lab ?? baselineResults.otr.score,
    mixing: baselineResults.mixing.score_lab ?? baselineResults.mixing.score,
    shear: baselineResults.shear.score_lab ?? baselineResults.shear.score,
    co2: baselineResults.co2.lab?.score ?? baselineResults.co2.score,
    heat: baselineResults.heat.lab?.score ?? baselineResults.heat.score,
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

  const SEV: Record<RiskScore, number> = { low: 0, moderate: 1, high: 2, critical: 3 };
  const worstTargetScore: RiskScore = RADAR_DOMAIN_ORDER.reduce<RiskScore>(
    (worst, d) => SEV[targetDomainScores[d]] > SEV[worst] ? targetDomainScores[d] : worst,
    "low",
  );
  const worstTargetColour = riskColour(worstTargetScore, theme);

  const domainThresholds: Record<RiskDomain, string> = {
    otr: "C<.7 | H .7-1 | M 1-1.5 | L>=1.5",
    mixing: "C<=.1 | H .1-1 | M 1-10 | L>10",
    shear: "C<=.77 | H .77-1 | M 1-1.43 | L>1.43",
    co2: "C<=.75 | H .75-1 | M 1-1.5 | L>1.5",
    heat: "C<=1 | H 1-1.18 | M 1.18-1.67 | L>1.67",
  };

  const domainScoreValues: Record<RiskDomain, string> = {
    otr: otr.otr_our_ratio_target_std
      ? `${fmt(otr.otr_our_ratio_target ?? otr.kla_ratio, 2)} \u00B1 ${fmt(otr.otr_our_ratio_target_std, 2)}`
      : fmt(otr.otr_our_ratio_target ?? otr.kla_ratio, 2),
    mixing: `${fmt(mixing.process_mixing_ratio_target ?? 0, 3)} ± ${fmt(mixing.process_mixing_ratio_target_std, 3)}`,
    shear: shear.tip_speed_margin_std
      ? `${fmt(shear.tip_speed_margin, 2)} \u00B1 ${fmt(shear.tip_speed_margin_std, 2)}`
      : fmt(shear.tip_speed_margin, 2),
    co2: Number.isFinite(co2.target?.pco2_margin ?? co2.pco2_margin ?? Infinity)
      ? (co2.target?.pco2_margin_std
          ? `${fmt(co2.target?.pco2_margin ?? co2.pco2_margin ?? 0, 2)} \u00B1 ${fmt(co2.target.pco2_margin_std, 2)}`
          : fmt(co2.target?.pco2_margin ?? co2.pco2_margin ?? 0, 2))
      : "\u221E",
    heat: heat.target?.heat_transfer_margin_std
      ? `${fmt(heat.target?.heat_transfer_margin ?? heat.heat_transfer_margin ?? 0, 2)} \u00B1 ${fmt(heat.target.heat_transfer_margin_std, 2)}`
      : fmt(heat.target?.heat_transfer_margin ?? heat.heat_transfer_margin ?? 0, 2),
  };

  const domainScores: Record<RiskDomain, RiskScore> = {
    otr: targetDomainScores.otr,
    mixing: targetDomainScores.mixing,
    shear: targetDomainScores.shear,
    co2: targetDomainScores.co2,
    heat: targetDomainScores.heat,
  };
  const domainConfidences: Record<RiskDomain, Confidence> = {
    otr: otr.confidence,
    mixing: mixing.confidence,
    shear: shear.confidence,
    co2: co2.confidence,
    heat: heat.confidence,
  };
  // Use baseline (not modified) results so the control stays visible after the user cycles
  // to a longer interval — once t_feed was the bottleneck at baseline we keep it visible.
  const showFeedFrequencyControl =
    inputs.process_type === "fed_batch" &&
    baselineResults.mixing.t_feed_s !== undefined &&
    baselineResults.mixing.t_feed_s < baselineResults.mixing.oxygen_depletion_time_target_s;

  const modificationsContent = selectedDomain ? (
    <ReactorModificationsPanel
      domain={selectedDomain}
      selected={selectedModifications}
      onToggle={toggleModification}
      canSelect={canSelectModification}
      oxygenLevel={oxygenLevel}
      oxygenBaseline={baselineOxygen}
      onOxygenStep={stepOxygenLevel}
      feedFrequency={feedFrequency}
      feedFrequencyBaseline={baselineFrequency}
      onFeedFrequencyStep={stepFeedFrequency}
      showFeedFrequencyControl={showFeedFrequencyControl && selectedDomain === "mixing"}
      impellerType={modifiedInputs.impeller_type}
      theme={theme}
    />
  ) : null;

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
              Example &mdash; <em style={{ color: "var(--text-secondary)" }}>E.&nbsp;coli</em>, 10&nbsp;L &rarr; 10,000&nbsp;L
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

        <div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-silver-100">MOSCH Analysis</h1>
        </div>

        {/* ===== SECTION 1: Radar Summary + Context ===== */}
        <div className="glass-panel p-8 flex flex-col items-center">
          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 place-items-center">
            <RadarChart title="Lab Scale Risk Profile" scores={labDomainScores} theme={theme} />
            <RadarChart title="Target Scale Risk Profile" scores={targetDomainScores} theme={theme} />
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-5 mt-5">
            {(["low", "moderate", "high", "critical"] as RiskScore[]).map((level) => (
              <div key={level} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: riskColour(level, theme) }} />
                <span className="text-[10px] text-silver-500">{RISK_SCORE_LABELS[level]}</span>
              </div>
            ))}
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

          <div className="w-full mt-8 divide-y divide-black/[0.08] dark:divide-white/[0.08]">
            {/* Bottleneck callout */}
            {bottleneck && (
              <section className="animate-fade-in pb-5 pl-5 pr-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] mb-2" style={{ color: worstTargetColour }}>
                  Primary Bottleneck
                </p>
                <p className="text-base text-silver-200 leading-relaxed">
                  {bottleneck.statement}
                </p>
              </section>
            )}

            <section className={`${bottleneck ? "pt-5" : ""} pl-5 pr-2`}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] mb-2" style={{ color: worstTargetColour }}>
                Scale-Up Constraints
              </p>
              <p className="text-base text-silver-200 leading-relaxed">
                Scale-up performed according to {scaleupCriterionLabel} criterion. Impeller at target scale set to run at{" "}
                <span className="font-mono font-semibold text-silver-100">{fmt(baselineScaleConfigs.target.rpm, 0)} RPM</span>{" "}
                and aeration rate at target scale set to{" "}
                <span className="font-mono font-semibold text-silver-100">{fmt(baselineScaleConfigs.target.vvm, 2)} vvm</span>.
              </p>
              {scaleupConstraintWarnings.length > 0 && (
                <div className="mt-4 rounded-xl border px-4 py-3" style={{
                  borderColor: `${riskColour("moderate", theme)}55`,
                  background: `${riskColour("moderate", theme)}14`,
                }}>
                  <div className="flex items-start gap-3">
                    <div
                      className="mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-semibold flex-shrink-0"
                      style={{ color: riskColour("moderate", theme), background: `${riskColour("moderate", theme)}20` }}
                      aria-hidden="true"
                    >
                      !
                    </div>
                    <div className="min-w-0 space-y-1">
                      <p className="text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: riskColour("moderate", theme) }}>
                        Operational constraint warning
                      </p>
                      {scaleupConstraintWarnings.map((warning, index) => (
                        <p key={index} className="text-sm text-silver-300 leading-relaxed">
                          {warning}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>

        {/* ===== SECTION 3: Domain Cards Row ===== */}
        <div>
          <h2 className="text-[11px] font-semibold text-silver-500 uppercase tracking-[0.12em] mb-3">
            Risk Domains
          </h2>
          <div className="grid grid-cols-5 gap-3">
            {DISPLAY_DOMAIN_ORDER.map((d) => (
              <DomainCard
                key={d}
                domain={d}
                score={domainScores[d]}
                scoreValue={domainScoreValues[d]}
                thresholdText={domainThresholds[d]}
                confidence={domainConfidences[d]}
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
                <OtrDetail otr={otr} derived={detailDerived} inputs={modifiedInputs} theme={theme} />
              )}
              {selectedDomain === "mixing" && (
                <MixingDetail mixing={mixing} derived={detailDerived} inputs={modifiedInputs} theme={theme} />
              )}
              {selectedDomain === "shear" && (
                <ShearDetail shear={shear} derived={detailDerived} inputs={modifiedInputs} theme={theme} />
              )}
              {selectedDomain === "co2" && (
                <Co2Detail co2={co2} derived={detailDerived} inputs={modifiedInputs} theme={theme} />
              )}
              {selectedDomain === "heat" && (
                <HeatDetail heat={heat} derived={detailDerived} inputs={modifiedInputs} theme={theme} />
              )}
              <div className="mt-5 glass-panel-sm p-4 border-black/[0.08] dark:border-white/[0.08] space-y-4">
                <div>
                  <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-silver-400">Target Scale What-If Analysis</p>
                  <p className="text-[12px] text-silver-500 mt-1">
                    Make modifications to your target scale reactor and see live changes in risk
                  </p>
                </div>
                {modificationsContent}
              </div>
            </div>
            </div>
          )}
        </div>

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
                      <td className="text-right">{fmt(baselineScaleProjection.lab.rpm, 0)}</td>
                      <td className="text-right">{fmt(baselineScaleProjection.pilot.rpm, 0)}</td>
                      <td className="text-right">{fmt(baselineScaleProjection.production.rpm, 0)}</td>
                    </tr>
                    <tr>
                      <td className="font-sans text-silver-400">Aeration rate (L/min, vvm)</td>
                      <td className="text-right">{fmt(baselineScaleProjection.lab.aerationLpm, 2)} ({fmt(baselineScaleProjection.lab.vvm, 2)})</td>
                      <td className="text-right">{fmt(baselineScaleProjection.pilot.aerationLpm, 2)} ({fmt(baselineScaleProjection.pilot.vvm, 2)})</td>
                      <td className="text-right">{fmt(baselineScaleProjection.production.aerationLpm, 2)} ({fmt(baselineScaleProjection.production.vvm, 2)})</td>
                    </tr>
                    <tr>
                      <td className="font-sans text-silver-400">Impeller diameter (m)</td>
                      <td className="text-right">{fmt(baselineScaleProjection.lab.impellerDiameterM, 2)}</td>
                      <td className="text-right">{fmt(baselineScaleProjection.pilot.impellerDiameterM, 2)}</td>
                      <td className="text-right">{fmt(baselineScaleProjection.production.impellerDiameterM, 2)}</td>
                    </tr>
                    <tr>
                      <td className="font-sans text-silver-400">Reactor height (m)</td>
                      <td className="text-right">{fmt(baselineScaleProjection.lab.reactorHeightM, 2)}</td>
                      <td className="text-right">{fmt(baselineScaleProjection.pilot.reactorHeightM, 2)}</td>
                      <td className="text-right">{fmt(baselineScaleProjection.production.reactorHeightM, 2)}</td>
                    </tr>
                    <tr>
                      <td className="font-sans text-silver-400">k<sub>L</sub>a̱ (h⁻¹)</td>
                      <td className="text-right">{fmtRange95(baselineScaleProjection.lab.klaMean, baselineScaleProjection.lab.klaStd)}</td>
                      <td className="text-right">{fmtRange95(baselineScaleProjection.pilot.klaMean, baselineScaleProjection.pilot.klaStd)}</td>
                      <td className="text-right">{fmtRange95(baselineScaleProjection.production.klaMean, baselineScaleProjection.production.klaStd)}</td>
                    </tr>
                    <tr>
                      <td className="font-sans text-silver-400">Mixing time (s)</td>
                      <td className="text-right">{fmtRange95(baselineScaleProjection.lab.mixingTimeS, baselineScaleProjection.lab.mixingTimeStd)}</td>
                      <td className="text-right">{fmtRange95(baselineScaleProjection.pilot.mixingTimeS, baselineScaleProjection.pilot.mixingTimeStd)}</td>
                      <td className="text-right">{fmtRange95(baselineScaleProjection.production.mixingTimeS, baselineScaleProjection.production.mixingTimeStd)}</td>
                    </tr>
                    <tr>
                      <td className="font-sans text-silver-400">Tip speed (m/s)</td>
                      <td className="text-right">{fmt(baselineScaleProjection.lab.tipSpeedMS, 2)}</td>
                      <td className="text-right">{fmt(baselineScaleProjection.pilot.tipSpeedMS, 2)}</td>
                      <td className="text-right">{fmt(baselineScaleProjection.production.tipSpeedMS, 2)}</td>
                    </tr>
                    <tr>
                      <td className="font-sans text-silver-400">P<sub>CO₂</sub> (bar)</td>
                      <td className="text-right">
                        {baselineScaleProjection.lab.pco2Bar != null ? fmt(baselineScaleProjection.lab.pco2Bar, 2) : <span className="text-silver-600">&mdash;</span>}
                      </td>
                      <td className="text-right">
                        {baselineScaleProjection.pilot.pco2Bar != null ? fmt(baselineScaleProjection.pilot.pco2Bar, 2) : <span className="text-silver-600">&mdash;</span>}
                      </td>
                      <td className="text-right">
                        {baselineScaleProjection.production.pco2Bar != null ? fmt(baselineScaleProjection.production.pco2Bar, 2) : <span className="text-silver-600">&mdash;</span>}
                      </td>
                    </tr>
                    <tr>
                      <td className="font-sans text-silver-400">Metabolic heat (kW)</td>
                      <td className="text-right">{fmt(baselineScaleProjection.lab.metabolicHeatKW, 2)}</td>
                      <td className="text-right">{fmt(baselineScaleProjection.pilot.metabolicHeatKW, 2)}</td>
                      <td className="text-right">{fmt(baselineScaleProjection.production.metabolicHeatKW, 2)}</td>
                    </tr>
                    <tr>
                      <td className="font-sans text-silver-400">Cooling capacity (kW)</td>
                      <td className="text-right">{fmt(baselineScaleProjection.lab.reactorHeatCapacityKW, 2)}</td>
                      <td className="text-right">{fmt(baselineScaleProjection.pilot.reactorHeatCapacityKW, 2)}</td>
                      <td className="text-right">{fmt(baselineScaleProjection.production.reactorHeatCapacityKW, 2)}</td>
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
              <GeneratePdfButton inputs={inputs} derived={baselineDerived} results={baselineResults} />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
