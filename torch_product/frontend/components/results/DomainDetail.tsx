'use client';

// Expanded panel for the currently-selected domain card. Layout mirrors
// old's DetailScaffold (old:656-728): plain-language question + fraction
// notation + threshold band reference + lab/target score columns.

import type { PartialAssessmentResult, RiskScore } from '@torch/core';
import type { ReactNode } from 'react';
import { RISK_COLOR, RISK_LABEL, type DomainKey } from './riskTokens';

type Props = {
  domain: DomainKey;
  results: PartialAssessmentResult;
};

type DetailSpec = {
  question: string;
  fraction: {
    mathNumerator: ReactNode;
    mathDenominator: ReactNode;
    textNumerator: ReactNode;
    textDenominator: ReactNode;
  };
  thresholds: { label: RiskScore; range: string }[];
  lab: { value: string; score: RiskScore };
  target: { value: string; score: RiskScore };
};

function fmt(n: number | undefined, digits = 2, unit = '') {
  if (n === undefined || !Number.isFinite(n)) return '—';
  return `${n.toFixed(digits)}${unit ? ` ${unit}` : ''}`;
}

function fmtWithStd(n: number | undefined, std: number | undefined, digits = 2, unit = '') {
  if (n === undefined || !Number.isFinite(n)) return '—';
  const base = `${n.toFixed(digits)}${unit ? ` ${unit}` : ''}`;
  if (std === undefined || !Number.isFinite(std) || std <= 0) return base;
  return `${base} ± ${std.toFixed(digits)}`;
}

function specFor(d: DomainKey, r: PartialAssessmentResult): DetailSpec {
  switch (d) {
    case 'otr': {
      const ratioTarget = r.otr.otr_our_ratio_target ?? r.otr.kla_ratio;
      const ratioLab = r.otr.otr_our_ratio_lab ?? ratioTarget;
      return {
        question: 'Can the reactor deliver sufficient oxygen to the cells at scale?',
        fraction: {
          mathNumerator: 'OTR',
          mathDenominator: 'OUR',
          textNumerator: 'Oxygen Transfer Rate (mmol/L/h)',
          textDenominator: 'Oxygen Uptake Rate (mmol/L/h)',
        },
        thresholds: [
          { label: 'low',      range: '> 1.5' },
          { label: 'moderate', range: '1.0–1.5' },
          { label: 'high',     range: '0.7–1.0' },
          { label: 'critical', range: '< 0.7' },
        ],
        lab:    { value: fmtWithStd(ratioLab,    r.otr.otr_our_ratio_lab_std,    2), score: r.otr.score_lab },
        target: { value: fmtWithStd(ratioTarget, r.otr.otr_our_ratio_target_std, 2), score: r.otr.score_target },
      };
    }
    case 'mixing': {
      return {
        question: 'Is mixing fast enough to dissipate gradients?',
        fraction: {
          mathNumerator: <FormulaTerm symbol="τ" subscript="req" />,
          mathDenominator: <FormulaTerm symbol="τ" subscript="mix" />,
          textNumerator: 'Required mixing timescale (s)',
          textDenominator: 'Mixing time (s)',
        },
        thresholds: [
          { label: 'low',      range: '> 10' },
          { label: 'moderate', range: '1–10' },
          { label: 'high',     range: '0.1–1' },
          { label: 'critical', range: '< 0.1' },
        ],
        lab:    {
          value: fmtWithStd(r.mixing.process_mixing_ratio_lab,    r.mixing.process_mixing_ratio_lab_std,    2),
          score: r.mixing.score_lab ?? r.mixing.score,
        },
        target: {
          value: fmtWithStd(r.mixing.process_mixing_ratio_target, r.mixing.process_mixing_ratio_target_std, 2),
          score: r.mixing.score_target ?? r.mixing.score,
        },
      };
    }
    case 'shear': {
      return {
        question: 'Is impeller tip speed low enough to protect cells from damage?',
        fraction: {
          mathNumerator: <span>v<sup>threshold</sup><sub>tip</sub></span>,
          mathDenominator: <span>v<sup>impeller</sup><sub>tip</sub></span>,
          textNumerator: 'Tip speed threshold of microbe (m/s)',
          textDenominator: 'Impeller tip speed (m/s)',
        },
        thresholds: [
          { label: 'low',      range: '> 1.43' },
          { label: 'moderate', range: '1.0–1.43' },
          { label: 'high',     range: '0.77–1.0' },
          { label: 'critical', range: '< 0.77' },
        ],
        lab:    {
          value: fmtWithStd(r.shear.tip_speed_margin_lab, r.shear.tip_speed_margin_lab_std, 2),
          score: r.shear.score_lab,
        },
        target: {
          value: fmtWithStd(r.shear.tip_speed_margin,     r.shear.tip_speed_margin_std,     2),
          score: r.shear.score_target,
        },
      };
    }
    case 'co2': {
      const labMargin = r.co2.lab?.pco2_margin;
      const targetMargin = r.co2.target?.pco2_margin ?? r.co2.pco2_margin;
      return {
        question: 'Is dissolved CO₂ in the reactor low enough to avoid toxicity?',
        fraction: {
          mathNumerator: <span>P<sup>threshold</sup><sub>CO₂</sub></span>,
          mathDenominator: <span>P<sup>reactor</sup><sub>CO₂</sub></span>,
          textNumerator: <span>CO<sub>2</sub> toxicity threshold (bar)</span>,
          textDenominator: <span>CO<sub>2</sub> in the reactor (bar)</span>,
        },
        thresholds: [
          { label: 'low',      range: '> 1.5' },
          { label: 'moderate', range: '1.0–1.5' },
          { label: 'high',     range: '0.75–1.0' },
          { label: 'critical', range: '< 0.75' },
        ],
        lab:    {
          value: r.co2.activated ? fmt(labMargin, 2) : '—',
          score: r.co2.lab?.score ?? r.co2.score,
        },
        target: {
          value: r.co2.activated ? fmtWithStd(targetMargin, r.co2.pco2_margin_std, 2) : '—',
          score: r.co2.target?.score ?? r.co2.score,
        },
      };
    }
    case 'heat': {
      return {
        question: 'Can the reactor withdraw all the metabolic heat at scale?',
        fraction: {
          mathNumerator: <FormulaTerm symbol="Q" subscript="cooling" />,
          mathDenominator: <FormulaTerm symbol="Q" subscript="metabolic" />,
          textNumerator: 'Available heat removal capacity (kW)',
          textDenominator: 'Metabolic heat generation (kW)',
        },
        thresholds: [
          { label: 'low',      range: '> 1.67' },
          { label: 'moderate', range: '1.18–1.67' },
          { label: 'high',     range: '1.0–1.18' },
          { label: 'critical', range: '< 1.0' },
        ],
        lab:    {
          value: fmt(r.heat.lab?.heat_transfer_margin, 2),
          score: r.heat.lab?.score ?? r.heat.score,
        },
        target: {
          value: fmtWithStd(r.heat.target?.heat_transfer_margin ?? r.heat.heat_transfer_margin, r.heat.heat_transfer_margin_std, 2),
          score: r.heat.target?.score ?? r.heat.score,
        },
      };
    }
  }
}

export function DomainDetail({ domain, results }: Props) {
  const spec = specFor(domain, results);
  return (
    <section
      className="mt-4 rounded-lg border p-6 shadow-[0_12px_30px_-26px_rgba(0,0,0,0.35)]"
      style={{ borderColor: 'var(--color-rule)', background: 'var(--color-paper-100)' }}
    >
      <p className="text-[20px] font-semibold tracking-[-0.01em]" style={{ color: 'var(--color-ink-900)' }}>
        {spec.question}
      </p>

      <div
        className="mt-5 flex items-center justify-center rounded-lg border px-4 py-3"
        style={{ borderColor: 'var(--color-rule)', background: 'var(--color-paper-50)' }}
      >
        <FormulaEquation fraction={spec.fraction} />
      </div>

      <div
        className="mt-5 rounded-lg border p-4"
        style={{ borderColor: 'var(--color-rule)', background: 'var(--color-paper-50)' }}
      >
        <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--color-ink-400)' }}>
          Thresholds
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {spec.thresholds.map((t) => {
          const c = RISK_COLOR[t.label];
          return (
            <div
              key={t.label}
              className="rounded-md border px-3 py-2.5 text-center"
              style={{ borderColor: c.ring, background: c.bg }}
            >
              <p className="text-[11px] font-semibold" style={{ color: c.fg }}>
                {RISK_LABEL[t.label]}
              </p>
              <p className="mt-1 text-[11px] font-medium tabular-nums" style={{ color: 'var(--color-ink-800)' }}>
                {t.range}
              </p>
            </div>
          );
        })}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ScoreColumn title="Lab scale"    value={spec.lab.value}    score={spec.lab.score} />
        <ScoreColumn title="Target scale" value={spec.target.value} score={spec.target.score} />
      </div>

      <div
        className="mt-5 rounded-lg border p-4"
        style={{ borderColor: 'var(--color-rule)', background: 'var(--color-paper-50)' }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--color-ink-400)' }}>
          Target Scale What-If Analysis
        </p>
        <p className="mt-1 text-[12px]" style={{ color: 'var(--color-ink-500)' }}>
          Make modifications to your target scale reactor and see live changes in risk
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <WhatIfButton label="Increase impeller RPM" />
          <WhatIfButton label="Increase aeration rate" muted />
          <WhatIfButton label="Increase oxygen saturation" />
          <WhatIfButton label="Switch to Rushton impeller" />
        </div>
      </div>
    </section>
  );
}

function ScoreColumn({ title, value, score }: { title: string; value: string; score: RiskScore }) {
  const c = RISK_COLOR[score];
  return (
    <div
      className="rounded-lg border p-4"
      style={{ borderColor: 'var(--color-rule)', background: 'var(--color-paper-50)' }}
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--color-ink-400)' }}>
          {title}
        </p>
        <span
          className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium"
          style={{ background: c.bg, color: c.fg }}
        >
          {RISK_LABEL[score]}
        </span>
      </div>
      <p
        className="mt-3 text-[28px] font-semibold tabular-nums tracking-[-0.02em]"
        style={{ color: 'var(--color-ink-900)' }}
      >
        {value}
      </p>
    </div>
  );
}

function WhatIfButton({ label, muted = false }: { label: string; muted?: boolean }) {
  return (
    <button
      type="button"
      disabled={muted}
      className="rounded-lg border px-4 py-3 text-left text-[12px] font-medium transition-colors"
      style={{
        borderColor: 'var(--color-rule)',
        background: muted ? 'var(--color-paper-100)' : 'var(--color-paper-50)',
        color: muted ? 'var(--color-ink-400)' : 'var(--color-ink-700)',
      }}
    >
      {label}
    </button>
  );
}

function FormulaEquation({ fraction }: { fraction: DetailSpec['fraction'] }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-1 text-center">
      <span className="text-[22px] font-semibold" style={{ color: 'var(--color-ink-800)' }}>Score</span>
      <span className="text-[22px] font-semibold" style={{ color: 'var(--color-ink-800)' }}>=</span>
      <FormulaFraction num={fraction.mathNumerator} den={fraction.mathDenominator} />
      <span className="text-[22px] font-semibold" style={{ color: 'var(--color-ink-800)' }}>=</span>
      <FormulaFraction num={fraction.textNumerator} den={fraction.textDenominator} wide />
    </div>
  );
}

function FormulaFraction({ num, den, wide = false }: { num: ReactNode; den: ReactNode; wide?: boolean }) {
  return (
    <span
      className="inline-flex max-w-full flex-col items-center font-mono font-semibold"
      style={{ minWidth: wide ? 280 : 86 }}
    >
      <span
        className="border-b px-1 text-center text-[18px] leading-tight"
        style={{ borderColor: 'var(--color-ink-500)', color: 'var(--color-ink-900)' }}
      >
        {num}
      </span>
      <span className="px-1 text-center text-[18px] leading-tight" style={{ color: 'var(--color-ink-800)' }}>
        {den}
      </span>
    </span>
  );
}

function FormulaTerm({ symbol, subscript }: { symbol: string; subscript: string }) {
  return (
    <span>
      {symbol}
      <sub className="text-[0.62em] leading-none">{subscript}</sub>
    </span>
  );
}
