'use client';

// Composes the full results page: MOSCH header + bottleneck statement,
// radar pair (lab + target), interactive 5-domain card grid, expanded
// detail panel for the selected card, projections table, and a sticky
// bottom bar (PDF placeholder for v1 — wired up in P2).

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type {
  FeedingFrequency,
  PartialAssessmentResult,
  ProcessInputs,
  RiskScore,
} from '@torch/core-shared';
import { MODIFICATION_CONFLICTS } from '@torch/core-shared';
import { api } from '@/lib/api';
import type { ModificationId, WhatIfResult } from '@/lib/whatif-types';
import { Radar } from './Radar';
import { DomainCard } from './DomainCard';
import { DomainDetail } from './DomainDetail';
import { ProjectionsTable } from './ProjectionsTable';
import { DownloadPdfButton } from './DownloadPdfButton';
import { DOMAIN_ORDER, RISK_COLOR, RISK_LABEL, type DomainKey } from './riskTokens';
import { speciesLabel } from '@/lib/format';

type Props = {
  inputs: ProcessInputs;
  results: PartialAssessmentResult;
  assessmentId?: string;
  isExample?: boolean;
};

function scoresAt(scale: 'lab' | 'target', r: PartialAssessmentResult): Record<DomainKey, RiskScore> {
  const fallback = (s: RiskScore | undefined, base: RiskScore) => s ?? base;
  return {
    mixing: fallback(scale === 'lab' ? r.mixing.score_lab : r.mixing.score_target, r.mixing.score),
    otr:    scale === 'lab' ? r.otr.score_lab : r.otr.score_target,
    shear:  scale === 'lab' ? r.shear.score_lab : r.shear.score_target,
    co2:    fallback(scale === 'lab' ? r.co2.lab?.score : r.co2.target?.score, r.co2.score),
    heat:   fallback(scale === 'lab' ? r.heat.lab?.score : r.heat.target?.score, r.heat.score),
  };
}

function metricFor(key: DomainKey, r: PartialAssessmentResult): string {
  switch (key) {
    case 'otr': {
      const v = r.otr.otr_our_ratio_target ?? r.otr.kla_ratio;
      return `Score = ${v.toFixed(2)}`;
    }
    case 'mixing':
      return `Score = ${r.mixing.process_mixing_ratio_target.toFixed(1)}`;
    case 'shear':
      return `Score = ${r.shear.tip_speed_margin.toFixed(1)}`;
    case 'co2': {
      if (!r.co2.activated) return 'Not activated';
      const v = r.co2.target?.pco2_margin ?? r.co2.pco2_margin;
      return v !== undefined && Number.isFinite(v) ? `Score = ${v.toFixed(1)}` : 'Score = ∞';
    }
    case 'heat':
      return `Score = ${(r.heat.target?.heat_transfer_margin ?? r.heat.heat_transfer_margin ?? 0).toFixed(1)}`;
  }
}

function scoreFor(key: DomainKey, r: PartialAssessmentResult): RiskScore {
  return r[key].score;
}

function fmt(n: number | undefined, digits = 1) {
  if (n === undefined || !Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: digits });
  return n.toFixed(digits);
}

function scaleCriterionLabel(value: ProcessInputs['scaleup_criterion']) {
  switch (value ?? 'power_per_volume') {
    case 'kla':
      return 'kLa';
    case 'shear':
      return 'tip speed';
    case 'power_per_volume':
      return 'P/V';
  }
}

export function ResultsDashboard({ inputs, results, assessmentId, isExample = false }: Props) {
  const [selected, setSelected] = useState<DomainKey>(() => results.primary_bottleneck.domain ?? 'otr');

  // Shared what-if state across all five panels.
  //   • activeModifications: discrete on/off toggles from the catalog
  //   • oxygenLevel: continuous stepper for o2_inlet (% O₂)
  //   • feedFrequency: continuous stepper for feed pulse interval
  // Any one change to a physical input affects every domain's risk score, so
  // state lives here (not per-panel).
  const [activeModifications, setActiveModifications] = useState<Set<ModificationId>>(
    () => new Set(),
  );
  const [oxygenLevel, setOxygenLevel] = useState<number | undefined>(undefined);
  const [feedFrequency, setFeedFrequency] = useState<FeedingFrequency | undefined>(undefined);

  const [whatIfResult, setWhatIfResult] = useState<WhatIfResult | null>(null);
  const [whatIfLoading, setWhatIfLoading] = useState(false);
  const fetchSeqRef = useRef(0);

  const hasAnyMod = activeModifications.size > 0 || oxygenLevel !== undefined || feedFrequency !== undefined;

  const toggleModification = (id: ModificationId) => {
    setActiveModifications((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        // Drop any conflicting modifications before adding this one.
        for (const conflict of MODIFICATION_CONFLICTS[id] ?? []) {
          next.delete(conflict);
        }
        next.add(id);
      }
      return next;
    });
  };

  const clearAllModifications = () => {
    setActiveModifications(new Set());
    setOxygenLevel(undefined);
    setFeedFrequency(undefined);
  };

  useEffect(() => {
    if (!hasAnyMod) {
      setWhatIfResult(null);
      setWhatIfLoading(false);
      return;
    }
    const seq = ++fetchSeqRef.current;
    setWhatIfLoading(true);
    api<{ result: WhatIfResult }>('/api/assessments/whatif', {
      method: 'POST',
      authed: false,
      body: JSON.stringify({
        inputs,
        params: {
          active: [...activeModifications],
          oxygen_level: oxygenLevel,
          feed_frequency: feedFrequency,
        },
      }),
    })
      .then((data) => {
        if (seq === fetchSeqRef.current) {
          setWhatIfResult(data.result);
          setWhatIfLoading(false);
        }
      })
      .catch(() => {
        if (seq === fetchSeqRef.current) {
          setWhatIfResult(null);
          setWhatIfLoading(false);
        }
      });
  }, [activeModifications, oxygenLevel, feedFrequency, inputs, hasAnyMod]);

  const bottleneck = results.primary_bottleneck;
  const labScores = scoresAt('lab', results);
  const targetScores = scoresAt('target', results);
  const scaleRatio = inputs.v_target / inputs.v_lab;
  const reactorConfigs = results.reactor_configs;

  return (
    <main className="min-h-dvh px-6 py-8" style={{ background: 'var(--color-paper-50)' }}>
      <div className="mx-auto max-w-[1200px]">
      {isExample ? (
        <div
          className="mb-6 flex items-center justify-between rounded-lg border px-4 py-3 shadow-sm"
          style={{
            borderColor: 'var(--color-rule)',
            background: 'var(--color-paper-100)',
          }}
        >
          <p className="text-[13px]" style={{ color: 'var(--color-ink-500)' }}>
            This is a pre-loaded example assessment.
          </p>
          <Link href="/assess" className="text-[13px] font-medium" style={{ color: 'var(--color-flame-500)' }}>
            Assess your own process →
          </Link>
        </div>
      ) : null}

      <section
        className="rounded-lg border p-8 shadow-[0_18px_45px_-34px_rgba(0,0,0,0.35)]"
        style={{ borderColor: 'var(--color-rule)', background: 'var(--color-paper-100)' }}
      >
        <div className="grid grid-cols-1 place-items-center gap-8 md:grid-cols-2">
          <Radar title="Lab Scale Risk Profile" scores={labScores} />
          <Radar title="Target Scale Risk Profile" scores={targetScores} />
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-5">
          {(['low', 'moderate', 'high', 'critical'] as RiskScore[]).map((score) => (
            <div key={score} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: RISK_COLOR[score].fg }} />
              <span className="text-[10px]" style={{ color: 'var(--color-ink-500)' }}>
                {RISK_LABEL[score]}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-[13px]" style={{ color: 'var(--color-ink-500)' }}>
          <span className="font-medium" style={{ color: 'var(--color-ink-800)' }}>
            {speciesLabel(inputs.organism_species)}
          </span>
          <span className="h-3.5 w-px" style={{ background: 'var(--color-rule-strong)' }} />
          <span>{fmt(inputs.v_lab, 0)} L → {fmt(inputs.v_target, 0)} L</span>
          <span className="h-3.5 w-px" style={{ background: 'var(--color-rule-strong)' }} />
          <span>
            Scale ratio: <strong className="font-mono" style={{ color: 'var(--color-ink-900)' }}>{fmt(scaleRatio, 0)}×</strong>
          </span>
        </div>

        <div className="mt-8 divide-y" style={{ borderColor: 'var(--color-rule)' }}>
          <section className="pb-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--color-flame-500)' }}>
              Primary Bottleneck
            </p>
            <p className="mt-2 text-[15px] leading-relaxed" style={{ color: 'var(--color-ink-700)' }}>
              {bottleneck.domain ? bottleneck.statement : 'Low risk across all five domains.'}
            </p>
          </section>

          <section className="pt-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--color-flame-500)' }}>
              Scale-Up Constraints
            </p>
            <p className="mt-2 text-[15px] leading-relaxed" style={{ color: 'var(--color-ink-700)' }}>
              Scale-up performed according to {scaleCriterionLabel(inputs.scaleup_criterion)} criterion.
              Impeller at target scale set to run at{' '}
              <strong className="font-mono" style={{ color: 'var(--color-ink-900)' }}>{fmt(reactorConfigs?.target.rpm, 0)} RPM</strong>{' '}
              and aeration rate at target scale set to{' '}
              <strong className="font-mono" style={{ color: 'var(--color-ink-900)' }}>{fmt(reactorConfigs?.target.vvm, 2)} vvm</strong>.
            </p>
          </section>
        </div>
      </section>

      <section className="mt-8">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--color-ink-400)' }}>
          Risk Domains
        </p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {DOMAIN_ORDER.map((d) => (
            <DomainCard
              key={d.key}
              domainKey={d.key}
              letter={d.letter}
              label={d.label}
              score={scoreFor(d.key, results)}
              metric={metricFor(d.key, results)}
              selected={selected === d.key}
              onSelect={setSelected}
            />
          ))}
        </div>
      </section>

      <DomainDetail
        domain={selected}
        inputs={inputs}
        results={results}
        activeModifications={activeModifications}
        onToggleModification={toggleModification}
        oxygenLevel={oxygenLevel}
        onSetOxygenLevel={setOxygenLevel}
        feedFrequency={feedFrequency}
        onSetFeedFrequency={setFeedFrequency}
        onClearAll={clearAllModifications}
        whatIfResult={whatIfResult}
        whatIfLoading={whatIfLoading}
      />
      <ProjectionsTable inputs={inputs} results={results} />

      </div>

      {assessmentId ? (
        <div
          className="fixed bottom-6 right-6 z-40"
          style={{
            filter: 'drop-shadow(0 10px 24px rgba(0,0,0,0.18)) drop-shadow(0 4px 8px rgba(0,0,0,0.08))',
          }}
        >
          <DownloadPdfButton
            assessmentId={assessmentId}
            filename={`lemnisca-torch-${(inputs.organism_species ?? 'report').replace(/_/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`}
          />
        </div>
      ) : null}
    </main>
  );
}
