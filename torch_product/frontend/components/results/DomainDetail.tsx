'use client';

// Expanded panel for the currently-selected domain card. Layout mirrors
// old's DetailScaffold (old:656-728): plain-language question + fraction
// notation + threshold band reference + lab/target/with-mods score columns.
//
// Target-scale what-if controls are filtered by the engine's catalog so
// each panel only shows modifications that affect its domain. Two
// continuous knobs (oxygen-level stepper, feed-frequency stepper) appear
// only on the panels that read them.

import type {
  AssessmentFlag,
  FeedingFrequency,
  PartialAssessmentResult,
  ProcessInputs,
  RiskScore,
} from '@torch/core-shared';
import {
  MODIFICATION_CATALOG,
  FEEDING_FREQUENCY_LABELS,
  oxygenLevelsFromBaseline,
  stepOxygenLevel,
  stepFeedFrequency,
} from '@torch/core-shared';
import type { ReactNode } from 'react';
import { RISK_COLOR, RISK_LABEL, type DomainKey } from './riskTokens';
import type { ModificationId, WhatIfResult } from '@/lib/whatif-types';
import {
  canApplyModificationHeuristic,
  describeModificationDiff,
  modificationHint,
} from '@/lib/whatif-helpers';

type Props = {
  domain: DomainKey;
  inputs: ProcessInputs;
  results: PartialAssessmentResult;
  activeModifications: Set<ModificationId>;
  onToggleModification: (id: ModificationId) => void;
  oxygenLevel: number | undefined;
  onSetOxygenLevel: (v: number | undefined) => void;
  feedFrequency: FeedingFrequency | undefined;
  onSetFeedFrequency: (v: FeedingFrequency | undefined) => void;
  onClearAll: () => void;
  whatIfResult: WhatIfResult | null;
  whatIfLoading: boolean;
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

function fmt(n: number | undefined, digits = 1, unit = '') {
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
          { label: 'critical', range: '< 0.7' },
          { label: 'high',     range: '0.7–1.0' },
          { label: 'moderate', range: '1.0–1.5' },
          { label: 'low',      range: '> 1.5' },
        ],
        lab:    { value: fmtWithStd(ratioLab,    r.otr.otr_our_ratio_lab_std,    1), score: r.otr.score_lab },
        target: { value: fmtWithStd(ratioTarget, r.otr.otr_our_ratio_target_std, 1), score: r.otr.score_target },
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
          { label: 'critical', range: '< 0.1' },
          { label: 'high',     range: '0.1–1' },
          { label: 'moderate', range: '1–10' },
          { label: 'low',      range: '> 10' },
        ],
        lab:    {
          value: fmtWithStd(r.mixing.process_mixing_ratio_lab,    r.mixing.process_mixing_ratio_lab_std,    1),
          score: r.mixing.score_lab ?? r.mixing.score,
        },
        target: {
          value: fmtWithStd(r.mixing.process_mixing_ratio_target, r.mixing.process_mixing_ratio_target_std, 1),
          score: r.mixing.score_target ?? r.mixing.score,
        },
      };
    }
    case 'shear': {
      return {
        question: 'Is impeller tip speed low enough to protect cells from damage?',
        fraction: {
          mathNumerator: <FormulaTermStacked symbol="v" superscript="threshold" subscript="tip" />,
          mathDenominator: <FormulaTermStacked symbol="v" superscript="impeller" subscript="tip" />,
          textNumerator: 'Tip speed threshold of microbe (m/s)',
          textDenominator: 'Impeller tip speed (m/s)',
        },
        thresholds: [
          { label: 'critical', range: '< 0.77' },
          { label: 'high',     range: '0.77–1.0' },
          { label: 'moderate', range: '1.0–1.43' },
          { label: 'low',      range: '> 1.43' },
        ],
        lab:    {
          value: fmtWithStd(r.shear.tip_speed_margin_lab, r.shear.tip_speed_margin_lab_std, 1),
          score: r.shear.score_lab,
        },
        target: {
          value: fmtWithStd(r.shear.tip_speed_margin,     r.shear.tip_speed_margin_std,     1),
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
          mathNumerator: <FormulaTermStacked symbol="P" superscript="threshold" subscript={<>CO<sub>2</sub></>} />,
          mathDenominator: <FormulaTermStacked symbol="P" superscript="reactor" subscript={<>CO<sub>2</sub></>} />,
          textNumerator: <span>CO<sub>2</sub> toxicity threshold (bar)</span>,
          textDenominator: <span>CO<sub>2</sub> in the reactor (bar)</span>,
        },
        thresholds: [
          { label: 'critical', range: '< 0.75' },
          { label: 'high',     range: '0.75–1.0' },
          { label: 'moderate', range: '1.0–1.5' },
          { label: 'low',      range: '> 1.5' },
        ],
        lab:    {
          value: r.co2.activated ? fmt(labMargin, 1) : '—',
          score: r.co2.lab?.score ?? r.co2.score,
        },
        target: {
          value: r.co2.activated ? fmtWithStd(targetMargin, r.co2.pco2_margin_std, 1) : '—',
          score: r.co2.target?.score ?? r.co2.score,
        },
      };
    }
    case 'heat': {
      return {
        question: 'Can the reactor withdraw all the metabolic heat at scale?',
        fraction: {
          mathNumerator: <FormulaTerm symbol="Q" subscript="cooling" />,
          mathDenominator: <FormulaTerm symbol="Q" subscript="generated" />,
          textNumerator: 'Available heat removal capacity (kW)',
          textDenominator: 'Total heat generation — metabolic + impeller (kW)',
        },
        thresholds: [
          { label: 'critical', range: '< 1.0' },
          { label: 'high',     range: '1.0–1.18' },
          { label: 'moderate', range: '1.18–1.67' },
          { label: 'low',      range: '> 1.67' },
        ],
        lab:    {
          value: fmt(r.heat.lab?.heat_transfer_margin, 1),
          score: r.heat.lab?.score ?? r.heat.score,
        },
        target: {
          value: fmtWithStd(r.heat.target?.heat_transfer_margin ?? r.heat.heat_transfer_margin, r.heat.heat_transfer_margin_std, 1),
          score: r.heat.target?.score ?? r.heat.score,
        },
      };
    }
  }
}

// Domain → (margin value, score) extractor for the "With modifications"
// column. Mirrors the metric shown in the lab/target columns above.
function whatIfValueFor(d: DomainKey, w: WhatIfResult): { value: string; score: RiskScore; secondary?: string } {
  switch (d) {
    case 'otr':
      return {
        value: fmtWithStd(w.otr.otr_our_ratio, w.otr.otr_our_ratio_std, 1),
        score: w.otr.score,
        secondary: `kLa ≈ ${fmt(w.otr.kla_h, 0)} h⁻¹ · OTR ${fmt(w.otr.otr_capacity, 1)} mmol/L/h · P/V ${fmt(w.otr.pv_w_m3, 0)} W/m³`,
      };
    case 'mixing':
      return {
        value: fmtWithStd(w.mixing.process_mixing_ratio, w.mixing.process_mixing_ratio_std, 1),
        score: w.mixing.score,
        secondary: `Mixing time ${fmtWithStd(w.mixing.theta_mix, w.mixing.theta_mix_std, 1)} s`,
      };
    case 'shear':
      return {
        value: fmtWithStd(w.shear.tip_speed_margin, w.shear.tip_speed_margin_std, 1),
        score: w.shear.score,
        secondary: `Tip speed ${fmt(w.shear.tip_speed, 2)} m/s`,
      };
    case 'co2':
      return {
        value: fmtWithStd(w.co2.pco2_margin, w.co2.pco2_margin_std, 1),
        score: w.co2.score,
        secondary: `pCO₂ bottom ${fmt(w.co2.pco2_bottom, 3)} bar`,
      };
    case 'heat':
      return {
        value: fmtWithStd(w.heat.heat_transfer_margin, w.heat.heat_transfer_margin_std, 1),
        score: w.heat.score,
        secondary: `Cooling ${fmt(w.heat.q_cool_max, 2)} kW`,
      };
  }
}

const DOMAIN_LABEL_FULL: Record<DomainKey, string> = {
  otr:    'Oxygen transfer',
  mixing: 'Mixing',
  shear:  'Shear stress',
  co2:    'CO₂ accumulation',
  heat:   'Heat removal',
};

export function DomainDetail({
  domain,
  inputs,
  results,
  activeModifications,
  onToggleModification,
  oxygenLevel,
  onSetOxygenLevel,
  feedFrequency,
  onSetFeedFrequency,
  onClearAll,
  whatIfResult,
  whatIfLoading,
}: Props) {
  const spec = specFor(domain, results);
  const whatIf = whatIfResult ? whatIfValueFor(domain, whatIfResult) : null;
  const reactorConfigs = results.reactor_configs;

  // Filter the catalog to mods that affect THIS domain.
  // `increase_oxygen_saturation` is excluded — it's catalogued but the engine
  // doesn't have a branch for it in `applyModifications`. Oxygen saturation
  // is driven by the Inlet O₂ stepper (params.oxygen_level), so the button
  // would be a no-op duplicate.
  const buttons = MODIFICATION_CATALOG.filter(
    (m) => m.domains.includes(domain) && m.id !== 'increase_oxygen_saturation' && m.id !== 'reduce_feeding_frequency',
  );
  const operational = buttons.filter((m) => m.section === 'operational');
  // Design section temporarily hidden — per UX review. Re-enable by removing
  // the `false &&` filter when those buttons are ready.
  const design = false ? buttons.filter((m) => m.section === 'design') : [];

  // The oxygen and feed-frequency steppers are continuous knobs — show them
  // on the panels whose domains they affect (per the catalog).
  const showOxygenStepper =
    MODIFICATION_CATALOG.find((m) => m.id === 'increase_oxygen_saturation')?.domains.includes(domain) ?? false;
  const showFeedStepper =
    inputs.process_type === 'fed_batch' &&
    (MODIFICATION_CATALOG.find((m) => m.id === 'reduce_feeding_frequency')?.domains.includes(domain) ?? false);

  const anyModActive = activeModifications.size > 0 || oxygenLevel !== undefined || feedFrequency !== undefined;
  const diff = whatIfResult ? describeModificationDiff(inputs, whatIfResult.modified_inputs) : [];
  const whatIfOnlyFlags: AssessmentFlag[] = whatIfResult
    ? whatIfResult.flags.filter(
        (f) => !results.flags.some((rf) => rf.message === f.message),
      )
    : [];

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
        <ScoreColumn title="Lab scale" value={spec.lab.value} score={spec.lab.score} />
        <ScoreColumn
          title="Target scale"
          value={spec.target.value}
          score={spec.target.score}
          modifiedValue={anyModActive ? (whatIf?.value ?? (whatIfLoading ? '…' : '—')) : undefined}
          modifiedScore={whatIf?.score}
        />
      </div>

      {/* What-if controls */}
      <div
        className="mt-5 rounded-lg border p-4"
        style={{ borderColor: 'var(--color-rule)', background: 'var(--color-paper-50)' }}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--color-ink-400)' }}>
              Target Scale What-If Analysis
            </p>
            <p className="mt-1 text-[12px]" style={{ color: 'var(--color-ink-500)' }}>
              Apply modifications and see live changes to {DOMAIN_LABEL_FULL[domain]} (and every other domain).
            </p>
          </div>
          {anyModActive ? (
            <button
              type="button"
              onClick={onClearAll}
              className="rounded-md border px-2 py-1 text-[11px] font-medium transition-colors"
              style={{
                borderColor: 'var(--color-rule)',
                background: 'var(--color-paper-100)',
                color: 'var(--color-ink-700)',
              }}
            >
              Clear all
            </button>
          ) : null}
        </div>

        {operational.length > 0 ? (
          <SectionLabel>Operational</SectionLabel>
        ) : null}
        {operational.length > 0 ? (
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {operational.map((m) => (
              <WhatIfButton
                key={m.id}
                label={m.label}
                hint={modificationHint(m.id, inputs, reactorConfigs)}
                active={activeModifications.has(m.id)}
                disabled={!canApplyModificationHeuristic(m.id, inputs, reactorConfigs)}
                onClick={() => onToggleModification(m.id)}
              />
            ))}
          </div>
        ) : null}

        {showOxygenStepper ? (() => {
          const baseline = inputs.o2_inlet ?? 20.9;
          const current = oxygenLevel ?? baseline;
          const levels = oxygenLevelsFromBaseline(baseline);
          return (
            <Stepper
              label="Inlet O₂"
              baselineText={`Baseline ${baseline.toFixed(1)}%`}
              currentText={`${current.toFixed(1)}%`}
              modified={oxygenLevel !== undefined}
              disableLeft={current <= levels[0] + 1e-9}
              disableRight={current >= levels[levels.length - 1] - 1e-9}
              onLeft={() => {
                const next = stepOxygenLevel(current, baseline, 'left');
                onSetOxygenLevel(Math.abs(next - baseline) < 1e-9 ? undefined : next);
              }}
              onRight={() => {
                const next = stepOxygenLevel(current, baseline, 'right');
                onSetOxygenLevel(Math.abs(next - baseline) < 1e-9 ? undefined : next);
              }}
            />
          );
        })() : null}

        {showFeedStepper ? (() => {
          const baseline = inputs.feeding_frequency ?? 'continuous';
          const current = feedFrequency ?? baseline;
          return (
            <Stepper
              label="Feeding frequency"
              baselineText={`Baseline ${FEEDING_FREQUENCY_LABELS[baseline]}`}
              currentText={FEEDING_FREQUENCY_LABELS[current]}
              modified={feedFrequency !== undefined}
              disableLeft={current === '30plus_min'}
              disableRight={current === 'continuous'}
              hint="◀ less frequent · ▶ more frequent"
              onLeft={() => {
                const next = stepFeedFrequency(current, 'left');
                onSetFeedFrequency(next === baseline ? undefined : next);
              }}
              onRight={() => {
                const next = stepFeedFrequency(current, 'right');
                onSetFeedFrequency(next === baseline ? undefined : next);
              }}
            />
          );
        })() : null}

        {design.length > 0 ? (
          <SectionLabel className="mt-4">Design</SectionLabel>
        ) : null}
        {design.length > 0 ? (
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {design.map((m) => (
              <WhatIfButton
                key={m.id}
                label={m.label}
                hint={modificationHint(m.id, inputs, reactorConfigs)}
                active={activeModifications.has(m.id)}
                disabled={!canApplyModificationHeuristic(m.id, inputs, reactorConfigs)}
                onClick={() => onToggleModification(m.id)}
              />
            ))}
          </div>
        ) : null}

        {buttons.length === 0 && !showOxygenStepper && !showFeedStepper ? (
          <p className="text-[12px]" style={{ color: 'var(--color-ink-400)' }}>
            No modifications available for this domain.
          </p>
        ) : null}
      </div>

      {/* Modifications applied summary */}
      {anyModActive ? (
        <div
          className="mt-3 rounded-lg border p-4"
          style={{ borderColor: 'var(--color-rule)', background: 'var(--color-paper-50)' }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--color-ink-400)' }}>
            Changes Applied
          </p>
          {whatIfLoading && diff.length === 0 ? (
            <p className="mt-2 text-[12px]" style={{ color: 'var(--color-ink-400)' }}>Computing…</p>
          ) : diff.length === 0 ? (
            <p className="mt-2 text-[12px]" style={{ color: 'var(--color-ink-400)' }}>
              The selected modification didn't change any input field at this scale.
            </p>
          ) : (
            <ul className="mt-2 space-y-1 text-[12px]">
              {diff.map((d) => (
                <li key={d.label} style={{ color: 'var(--color-ink-700)' }}>
                  <span style={{ color: 'var(--color-ink-500)' }}>{d.label}:</span>{' '}
                  <span className="font-mono" style={{ color: 'var(--color-ink-500)' }}>{d.from}</span>
                  <span style={{ color: 'var(--color-ink-400)' }}> → </span>
                  <span className="font-mono" style={{ color: 'var(--color-ink-900)' }}>{d.to}</span>
                </li>
              ))}
            </ul>
          )}

          {whatIfResult?.primary_bottleneck && whatIfResult.primary_bottleneck.domain !== results.primary_bottleneck.domain ? (
            <p className="mt-3 text-[12px]" style={{ color: 'var(--color-ink-700)' }}>
              <span className="font-semibold">Primary bottleneck shifted:</span>{' '}
              <span style={{ color: 'var(--color-ink-500)' }}>
                {results.primary_bottleneck.domain ? DOMAIN_LABEL_FULL[results.primary_bottleneck.domain as DomainKey] : 'none'}
              </span>
              {' → '}
              <span className="font-semibold" style={{ color: 'var(--color-results-accent)' }}>
                {whatIfResult.primary_bottleneck.domain ? DOMAIN_LABEL_FULL[whatIfResult.primary_bottleneck.domain as DomainKey] : 'none'}
              </span>
            </p>
          ) : null}
        </div>
      ) : null}

      {/* New flags introduced by the modifications */}
      {whatIfOnlyFlags.length > 0 ? (
        <div
          className="mt-3 rounded-lg border p-4"
          style={{ borderColor: 'var(--color-warning-border)', background: 'var(--color-warning-bg)' }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--color-warning-fg)' }}>
            Warnings triggered by modifications
          </p>
          <ul className="mt-2 space-y-1 text-[12px]" style={{ color: 'var(--color-warning-body)' }}>
            {whatIfOnlyFlags.map((f, i) => (
              <li key={i}>{f.message}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function SectionLabel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${className}`}
      style={{ color: 'var(--color-ink-500)' }}
    >
      {children}
    </p>
  );
}

function ScoreColumn({
  title, value, score, modifiedValue, modifiedScore,
}: {
  title: string;
  value: string;
  score: RiskScore;
  modifiedValue?: string;       // when present, renders "value → modifiedValue"
  modifiedScore?: RiskScore;    // badge switches to this when modifiedValue is set
}) {
  const showModified = modifiedValue !== undefined;
  const badgeScore = showModified && modifiedScore ? modifiedScore : score;
  const c = RISK_COLOR[badgeScore];
  return (
    <div
      className="rounded-lg border p-4"
      style={{
        borderColor: 'var(--color-rule)',
        background: 'var(--color-paper-50)',
      }}
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--color-ink-400)' }}>
          {title}
        </p>
        <span
          className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium"
          style={{ background: c.bg, color: c.fg }}
        >
          {RISK_LABEL[badgeScore]}
        </span>
      </div>
      <p
        className="mt-3 flex items-center gap-x-3 text-[28px] font-semibold tabular-nums tracking-[-0.02em]"
        style={{ color: 'var(--color-ink-900)' }}
      >
        <span style={{ color: showModified ? 'var(--color-ink-400)' : 'var(--color-ink-900)' }}>
          {value}
        </span>
        {showModified ? (
          <>
            <span aria-hidden style={{ color: 'var(--color-ink-400)', fontSize: '22px' }}>→</span>
            <span style={{ color: 'var(--color-results-accent)' }}>{modifiedValue}</span>
          </>
        ) : null}
      </p>
    </div>
  );
}

function WhatIfButton({
  label,
  hint,
  active = false,
  disabled = false,
  onClick,
}: {
  label: string;
  hint?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      title={disabled ? 'Not applicable at the current operating point' : undefined}
      className="flex flex-col gap-0.5 rounded-lg border px-4 py-3 text-left transition-[border-color,background-color,color,box-shadow,opacity]"
      style={{
        borderColor: active ? 'var(--color-results-accent)' : 'var(--color-rule)',
        background: active ? 'var(--color-results-accent-muted)' : 'var(--color-paper-100)',
        boxShadow: active ? '0 0 0 1px var(--color-results-accent) inset' : 'none',
        opacity: disabled ? 0.55 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <span
        className="text-[12px] font-medium"
        style={{
          color: disabled
            ? 'var(--color-ink-400)'
            : active
              ? 'var(--color-ink-900)'
              : 'var(--color-ink-700)',
        }}
      >
        {label}
      </span>
      {hint && !disabled ? (
        <span
          className="text-[11px] font-mono tabular-nums"
          style={{
            color: active ? 'var(--color-results-accent)' : 'var(--color-ink-400)',
          }}
        >
          {hint}
        </span>
      ) : null}
    </button>
  );
}

function Stepper({
  label,
  baselineText,
  currentText,
  modified,
  onLeft,
  onRight,
  disableLeft = false,
  disableRight = false,
  hint,
}: {
  label: string;
  baselineText: string;   // "Baseline 20.9%"
  currentText: string;    // "80.0%"
  modified: boolean;
  onLeft: () => void;
  onRight: () => void;
  disableLeft?: boolean;
  disableRight?: boolean;
  hint?: string;
}) {
  return (
    <div
      className="mt-2 flex items-center justify-between gap-4 rounded-lg border px-4 py-3"
      style={{
        borderColor: modified ? 'var(--color-results-accent)' : 'var(--color-rule)',
        background: 'var(--color-paper-100)',
        boxShadow: modified ? '0 0 0 1px var(--color-results-accent) inset' : 'none',
      }}
    >
      <div className="flex min-w-0 flex-col">
        <span
          className="text-[11px] font-semibold uppercase tracking-[0.1em]"
          style={{ color: 'var(--color-ink-700)' }}
        >
          {label}
        </span>
        <span className="mt-0.5 truncate text-[11px]" style={{ color: 'var(--color-ink-400)' }}>
          {baselineText}
          {hint ? <> · {hint}</> : null}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <StepperButton onClick={onLeft} disabled={disableLeft} aria-label="Previous">◀</StepperButton>
        <span
          className="min-w-[9ch] text-center text-[15px] font-semibold tabular-nums"
          style={{
            color: modified ? 'var(--color-results-accent)' : 'var(--color-ink-900)',
          }}
        >
          {currentText}
        </span>
        <StepperButton onClick={onRight} disabled={disableRight} aria-label="Next">▶</StepperButton>
      </div>
    </div>
  );
}

function StepperButton({
  children, onClick, disabled, ...rest
}: { children: ReactNode; onClick: () => void; disabled: boolean } & Record<string, unknown>) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      {...rest}
      className="grid h-8 w-8 place-items-center rounded-md border text-[12px] font-semibold transition-[opacity,background-color,border-color,color]"
      style={{
        borderColor: 'var(--color-ink-300, var(--color-rule))',
        background: disabled ? 'var(--color-paper-100)' : 'var(--color-paper-50)',
        color: disabled ? 'var(--color-ink-300)' : 'var(--color-ink-800)',
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {children}
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

function FormulaTermStacked({ symbol, superscript, subscript }: { symbol: ReactNode; superscript: ReactNode; subscript: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-[1px]">
      <span>{symbol}</span>
      <span className="inline-flex flex-col items-start leading-[1.15]" style={{ fontSize: '0.6em' }}>
        <span>{superscript}</span>
        <span>{subscript}</span>
      </span>
    </span>
  );
}
