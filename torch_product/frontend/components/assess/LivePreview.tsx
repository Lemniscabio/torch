'use client';

// Sticky side panel rendered alongside the wizard on xl+ screens. Shows
// target and lab BioreactorDiagrams wired to live form values. Reads tolerant
// fallbacks for early-stage state — before the user has entered volumes,
// the diagrams render with reasonable defaults rather than disappearing.

import { useFormContext, useWatch } from 'react-hook-form';
import { INPUT_DEFAULTS, IMPELLER_CONSTANTS, type ImpellerType } from '@torch/core-shared';
import { BioreactorDiagram } from './BioreactorDiagram';
import type { AssessFormValues } from '@/lib/assess-schema';

function num(v: unknown, fallback: number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const parsed = Number(v);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function targetDiagramWidth(scaleRatio: number | null): number {
  if (!scaleRatio || !Number.isFinite(scaleRatio) || scaleRatio <= 1) return 150;

  const presetScale = Math.log10(scaleRatio);
  return Math.min(215, 150 + presetScale * 20);
}

export function LivePreview() {
  const { control } = useFormContext<AssessFormValues>();
  const form = useWatch({ control });

  const impellerType: ImpellerType =
    (form.impeller_type as ImpellerType | undefined) ?? INPUT_DEFAULTS.impeller_type;
  const impellerDefaults = IMPELLER_CONSTANTS[impellerType];

  const vLab     = num(form.v_lab, 0);
  const vTarget  = num(form.v_target, 0);
  const hdLab    = num(form.h_d_lab, INPUT_DEFAULTS.h_d_lab);
  const hdTarget = form.h_d_target_same_as_lab
    ? hdLab
    : num(form.h_d_target, hdLab);
  const dtLab    = num(form.dt_ratio_lab, impellerDefaults.d_t_ratio);
  const dtTarget = form.dt_ratio_target_same_as_lab
    ? dtLab
    : num(form.dt_ratio_target, dtLab);
  const nLab     = Math.trunc(num(form.n_impellers, 1));
  const nTarget  = form.n_impellers_target_same_as_lab
    ? nLab
    : Math.trunc(num(form.n_impellers_target, nLab));

  const ratio = vLab > 0 ? vTarget / vLab : null;
  const targetWidth = targetDiagramWidth(ratio);

  return (
    <div className="sticky top-6">
      <p className="text-label">Live preview</p>

      <div className="mt-4 grid gap-4">
        <div
          className="rounded-xl border p-4"
          style={{ borderColor: 'var(--color-rule)', background: 'var(--color-paper-100)' }}
        >
          <div className="flex min-h-4 items-center justify-between gap-2">
            <span className="text-label" style={{ letterSpacing: '0.06em' }}>
              Target
            </span>
            {ratio && Number.isFinite(ratio) ? (
              <span
                className="text-[10px] tabular-nums"
                style={{ color: 'var(--color-accent)' }}
              >
                {ratio < 1 ? '—' : `${ratio.toFixed(ratio >= 100 ? 0 : 1)}×`}
              </span>
            ) : null}
          </div>
          <div className="mt-3 flex justify-center">
            <BioreactorDiagram
              hd={hdTarget}
              dtRatio={dtTarget}
              nImpellers={nTarget}
              impellerType={impellerType}
              volume={vTarget > 0 ? vTarget : undefined}
              width={targetWidth}
            />
          </div>
        </div>

        <div className="flex justify-center">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full border text-[15px]"
            style={{
              borderColor: 'var(--color-rule)',
              background: 'var(--color-paper-100)',
              color: 'var(--color-accent)',
            }}
            aria-hidden
          >
            ↑
          </div>
        </div>

        <div
          className="rounded-xl border p-4"
          style={{ borderColor: 'var(--color-rule)', background: 'var(--color-paper-100)' }}
        >
          <div className="flex min-h-4 items-center justify-between gap-2">
            <span className="text-label" style={{ letterSpacing: '0.06em' }}>
              Lab
            </span>
          </div>
          <div className="mt-3 flex justify-center">
            <BioreactorDiagram
              hd={hdLab}
              dtRatio={dtLab}
              nImpellers={nLab}
              impellerType={impellerType}
              volume={vLab > 0 ? vLab : undefined}
              width={150}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
