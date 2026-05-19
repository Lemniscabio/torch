'use client';

// Full-screen "Analysing scale-up" overlay shown after the user clicks
// "Run assessment" and validation passes. Cycles through 5 stage labels
// while a progress bar fills 0 → 100% over `duration` ms, then fires
// onComplete() so the caller can navigate to /results.
//
// Stages cycle once. Total wall time = duration; each stage is shown for
// duration / STAGES.length. We start the CSS width transition on the next
// animation frame so the browser commits the 0% width before transitioning.

import { useEffect, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { INPUT_DEFAULTS, IMPELLER_CONSTANTS, type ImpellerType } from '@torch/core-shared';
import type { AssessFormValues } from '@/lib/assess-schema';
import { BioreactorDiagram } from './BioreactorDiagram';

const STAGES = [
  'Calculating power input…',
  'Estimating kLa via van’t Riet…',
  'Computing mixing times…',
  'Evaluating heat removal…',
  'Assessing scale-up risks…',
] as const;

type Props = {
  onComplete: () => void;
  duration?: number;
};

function num(v: unknown, fallback: number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const parsed = Number(v);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function AnalyzingAnimation({ onComplete, duration = 5000 }: Props) {
  const { control } = useFormContext<AssessFormValues>();
  const form = useWatch({ control });
  const [stage, setStage] = useState(0);
  const [started, setStarted] = useState(false);

  const impellerType: ImpellerType =
    (form.impeller_type as ImpellerType | undefined) ?? INPUT_DEFAULTS.impeller_type;
  const impellerDefaults = IMPELLER_CONSTANTS[impellerType];
  const hdLab = num(form.h_d_lab, INPUT_DEFAULTS.h_d_lab);
  const hdTarget = form.h_d_target_same_as_lab ? hdLab : num(form.h_d_target, hdLab);
  const dtLab = num(form.dt_ratio_lab, impellerDefaults.d_t_ratio);
  const dtTarget = form.dt_ratio_target_same_as_lab ? dtLab : num(form.dt_ratio_target, dtLab);
  const nLab = Math.trunc(num(form.n_impellers, 1));
  const nTarget = form.n_impellers_target_same_as_lab
    ? nLab
    : Math.trunc(num(form.n_impellers_target, nLab));
  const vTarget = num(form.v_target, 0);
  const vLab = num(form.v_lab, 0);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setStarted(true));
    const perStage = duration / STAGES.length;
    const interval = setInterval(() => {
      setStage((s) => (s < STAGES.length - 1 ? s + 1 : s));
    }, perStage);
    const finish = setTimeout(onComplete, duration);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(interval);
      clearTimeout(finish);
    };
  }, [duration, onComplete]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ background: 'var(--color-paper-50)' }}
    >
      <div className="mb-8">
        <BioreactorDiagram
          hd={hdTarget}
          dtRatio={dtTarget}
          nImpellers={nTarget}
          impellerType={impellerType}
          volume={vTarget > 0 ? vTarget : vLab > 0 ? vLab : undefined}
          width={160}
          animated
        />
      </div>

      <h2 className="text-section" style={{ color: 'var(--color-ink-900)' }}>
        Analysing Scale-Up
      </h2>

      <p
        key={stage}
        className="mt-4 font-[var(--font-mono)] text-[1.05rem] motion-fade-stage"
        style={{ color: 'var(--color-flame-500)', letterSpacing: '0.04em' }}
      >
        {STAGES[stage]}
      </p>

      <div
        className="mt-8 h-1 w-[min(260px,62vw)] overflow-hidden rounded-full"
        style={{ background: 'var(--color-paper-200)' }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: started ? '100%' : '0%',
            background: 'var(--color-flame-500)',
            transition: `width ${duration}ms linear`,
          }}
        />
      </div>

      <style jsx>{`
        @keyframes fadeStage {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        :global(.motion-fade-stage) {
          animation: fadeStage 220ms cubic-bezier(0.16, 1, 0.3, 1) backwards;
        }
        @media (prefers-reduced-motion: reduce) {
          :global(.motion-fade-stage) { animation: none; }
        }
      `}</style>
    </div>
  );
}
