'use client';

// Step 3 — "Your lab-scale setup" — impeller + agitation + lab/target
// geometry with "same as lab" toggles + preset chips. Mirrors old/
// InputForm.tsx Step C field set and conditional rendering.

import { useEffect } from 'react';
import { useFormContext } from 'react-hook-form';
import {
  IMPELLER_CONSTANTS,
  getScaleupOperatingRange,
  maxImpellersForGeometry,
  type ImpellerType,
} from '@torch/core-shared';
import { Field } from '@/components/ui/Field';
import { NumberInput } from '@/components/ui/NumberInput';
import type { AssessFormValues } from '@/lib/assess-schema';

const HD_PRESETS = [1.0, 1.2, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0] as const;
const DT_PRESETS = [0.2, 0.33, 0.4, 0.5] as const;
const IMPELLER_COUNTS = [1, 2, 3, 4] as const;

const IMPELLER_OPTIONS = [
  { value: 'rushton',       label: 'Rushton',        hint: 'High shear, high kLa' },
  { value: 'pitched_blade', label: 'Pitched blade',  hint: 'Axial flow, moderate shear' },
  { value: 'marine',        label: 'Marine',         hint: 'Low shear, gentle mixing' },
  { value: 'unknown',       label: 'Unknown',        hint: 'Conservative estimates' },
] as const;

export function VesselStep() {
  const {
    register,
    watch,
    setValue,
    clearErrors,
    formState: { errors },
  } = useFormContext<AssessFormValues>();

  const impellerType = (watch('impeller_type') ?? 'rushton') as ImpellerType;
  const impellerDefaults = IMPELLER_CONSTANTS[impellerType];

  const hdLab = watch('h_d_lab');
  const hdTarget = watch('h_d_target');
  const hdSame = watch('h_d_target_same_as_lab') ?? true;

  const dtLab = watch('dt_ratio_lab');
  const dtTarget = watch('dt_ratio_target');
  const dtSame = watch('dt_ratio_target_same_as_lab') ?? true;

  const nImpellers = watch('n_impellers');
  const nTarget = watch('n_impellers_target');
  const nSame = watch('n_impellers_target_same_as_lab') ?? true;

  // Scale-dependent operating envelopes — bound RPM / VVM against the
  // bin the user's lab volume falls into.
  const vLab = watch('v_lab');
  const labRange =
    typeof vLab === 'number' && vLab > 0 ? getScaleupOperatingRange(vLab) : null;

  // Impeller type change → sync lab D/T to that impeller's default, and
  // sync target D/T if "same as lab" is on.
  useEffect(() => {
    setValue('dt_ratio_lab', impellerDefaults.d_t_ratio, { shouldValidate: false });
    if (dtSame) {
      setValue('dt_ratio_target', impellerDefaults.d_t_ratio, { shouldValidate: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [impellerType]);

  // Mirror lab → target when their respective "same as lab" toggles are on.
  useEffect(() => {
    if (hdSame && typeof hdLab === 'number') {
      setValue('h_d_target', hdLab, { shouldValidate: false });
    }
  }, [hdSame, hdLab, setValue]);

  useEffect(() => {
    if (dtSame && typeof dtLab === 'number') {
      setValue('dt_ratio_target', dtLab, { shouldValidate: false });
    }
  }, [dtSame, dtLab, setValue]);

  useEffect(() => {
    if (nSame && typeof nImpellers === 'number') {
      setValue('n_impellers_target', nImpellers, { shouldValidate: false });
    }
  }, [nSame, nImpellers, setValue]);

  const maxLab    = maxImpellersForGeometry(typeof hdLab    === 'number' ? hdLab    : 1.2);
  const maxTarget = maxImpellersForGeometry(typeof hdTarget === 'number' ? hdTarget : 1.2);

  const selectImpellerType = (nextType: ImpellerType) => {
    const nextDefaults = IMPELLER_CONSTANTS[nextType];
    setValue('impeller_type', nextType, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    setValue('dt_ratio_lab', nextDefaults.d_t_ratio, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    if (dtSame) {
      setValue('dt_ratio_target', nextDefaults.d_t_ratio, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
    }
    clearErrors(['impeller_type', 'dt_ratio_lab', 'dt_ratio_target']);
  };

  return (
    <div className="grid max-w-[760px] gap-8">
      {/* ── Impeller type ────────────────────────────────────────────── */}
      <Field label="Impeller type" htmlFor="impeller_type" error={errors.impeller_type?.message}>
        <ImpellerTypeGroup
          value={impellerType}
          onSelect={selectImpellerType}
        />
      </Field>

      {/* ── Operating point ─────────────────────────────────────────── */}
      <div>
        <p className="text-meta mb-3" style={{ color: 'var(--color-ink-700)', fontWeight: 500 }}>
          Operating point at peak oxygen demand
        </p>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field
            label="Agitation (RPM)"
            htmlFor="rpm"
            hint={
              labRange
                ? `For ${labRange.scale_label} vessels: up to ${labRange.max_rpm.max} rpm.`
                : undefined
            }
            error={errors.rpm?.message}
          >
            <NumberInput
              id="rpm"
              unit="rpm"
              invalid={!!errors.rpm}
              {...register('rpm', { valueAsNumber: true })}
            />
          </Field>
          <Field
            label="Gassing (VVM)"
            htmlFor="vvm"
            hint={
              labRange
                ? `For ${labRange.scale_label} vessels: up to ${labRange.max_aeration_vvm.max} vvm.`
                : undefined
            }
            error={errors.vvm?.message}
          >
            <NumberInput
              id="vvm"
              unit="vvm"
              invalid={!!errors.vvm}
              {...register('vvm', { valueAsNumber: true })}
            />
          </Field>
        </div>
      </div>

      {/* ── H/D ratio ────────────────────────────────────────────────── */}
      <div>
        <p className="text-meta mb-3" style={{ color: 'var(--color-ink-700)', fontWeight: 500 }}>
          H/D (liquid height / tank diameter)
        </p>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="H/D — lab" htmlFor="h_d_lab" error={errors.h_d_lab?.message}>
            <NumberInput
              id="h_d_lab"
              invalid={!!errors.h_d_lab}
              {...register('h_d_lab', { valueAsNumber: true })}
            />
          </Field>
          <Field
            label="H/D — target"
            htmlFor="h_d_target"
            error={errors.h_d_target?.message}
            hint={
              <button
                type="button"
                onClick={() => setValue('h_d_target_same_as_lab', !hdSame, { shouldValidate: false })}
                className="underline decoration-[color:var(--color-ink-300)] underline-offset-[3px] hover:decoration-[color:var(--color-ink-900)]"
                style={{ color: 'var(--color-ink-700)' }}
              >
                {hdSame ? 'Same as lab scale (tap to override)' : 'Override target H/D'}
              </button>
            }
          >
            {hdSame ? (
              <div
                className="rounded-lg border px-3 py-2.5 text-[14px] tabular-nums"
                style={{
                  borderColor: 'var(--color-ink-200)',
                  background: 'var(--color-paper-200)',
                  color: 'var(--color-ink-500)',
                }}
              >
                {typeof hdLab === 'number' ? hdLab.toFixed(1) : '—'}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {HD_PRESETS.map((p) => (
                  <ChipButton
                    key={p}
                    label={p.toFixed(1)}
                    selected={typeof hdTarget === 'number' && Math.abs(hdTarget - p) < 0.01}
                    onClick={() => setValue('h_d_target', p, { shouldValidate: true })}
                  />
                ))}
              </div>
            )}
          </Field>
        </div>
      </div>

      {/* ── D/T ratio ────────────────────────────────────────────────── */}
      <div>
        <p className="text-meta mb-3" style={{ color: 'var(--color-ink-700)', fontWeight: 500 }}>
          D/T (impeller / tank diameter)
        </p>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="D/T — lab" htmlFor="dt_ratio_lab" error={errors.dt_ratio_lab?.message}>
            <NumberInput
              id="dt_ratio_lab"
              invalid={!!errors.dt_ratio_lab}
              {...register('dt_ratio_lab', {
                valueAsNumber: true,
                setValueAs: (v) =>
                  v === '' || Number.isNaN(Number(v)) ? undefined : Number(v),
              })}
            />
          </Field>
          <Field
            label="D/T — target"
            htmlFor="dt_ratio_target"
            error={errors.dt_ratio_target?.message}
            hint={
              <button
                type="button"
                onClick={() => setValue('dt_ratio_target_same_as_lab', !dtSame, { shouldValidate: false })}
                className="underline decoration-[color:var(--color-ink-300)] underline-offset-[3px] hover:decoration-[color:var(--color-ink-900)]"
                style={{ color: 'var(--color-ink-700)' }}
              >
                {dtSame ? 'Same as lab scale (tap to override)' : 'Override target D/T'}
              </button>
            }
          >
            {dtSame ? (
              <div
                className="rounded-lg border px-3 py-2.5 text-[14px] tabular-nums"
                style={{
                  borderColor: 'var(--color-ink-200)',
                  background: 'var(--color-paper-200)',
                  color: 'var(--color-ink-500)',
                }}
              >
                {typeof dtLab === 'number' ? dtLab.toFixed(2) : '—'}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {DT_PRESETS.map((p) => (
                  <ChipButton
                    key={p}
                    label={p.toFixed(2)}
                    selected={typeof dtTarget === 'number' && Math.abs(dtTarget - p) < 0.005}
                    onClick={() => setValue('dt_ratio_target', p, { shouldValidate: true })}
                  />
                ))}
              </div>
            )}
          </Field>
        </div>
      </div>

      {/* ── Impeller count ──────────────────────────────────────────── */}
      <div>
        <p className="text-meta mb-3" style={{ color: 'var(--color-ink-700)', fontWeight: 500 }}>
          Number of impellers
        </p>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field
            label="Impellers — lab"
            htmlFor="n_impellers"
            hint={`Geometry limit at H/D ${(typeof hdLab === 'number' ? hdLab : 1.2).toFixed(1)}: up to ${maxLab}.`}
            error={errors.n_impellers?.message}
          >
            <ImpellerCountGroup
              value={typeof nImpellers === 'number' ? nImpellers : 1}
              max={maxLab}
              onSelect={(v) => setValue('n_impellers', v, { shouldValidate: true })}
            />
          </Field>
          <Field
            label="Impellers — target"
            htmlFor="n_impellers_target"
            hint={
              <button
                type="button"
                onClick={() => setValue('n_impellers_target_same_as_lab', !nSame, { shouldValidate: false })}
                className="underline decoration-[color:var(--color-ink-300)] underline-offset-[3px] hover:decoration-[color:var(--color-ink-900)]"
                style={{ color: 'var(--color-ink-700)' }}
              >
                {nSame ? 'Same as lab scale (tap to override)' : `Override · max ${maxTarget} at target H/D`}
              </button>
            }
            error={errors.n_impellers_target?.message}
          >
            {nSame ? (
              <div
                className="rounded-lg border px-3 py-2.5 text-[14px] tabular-nums"
                style={{
                  borderColor: 'var(--color-ink-200)',
                  background: 'var(--color-paper-200)',
                  color: 'var(--color-ink-500)',
                }}
              >
                {typeof nImpellers === 'number' ? nImpellers : '—'}
              </div>
            ) : (
              <ImpellerCountGroup
                value={typeof nTarget === 'number' ? nTarget : (typeof nImpellers === 'number' ? nImpellers : 1)}
                max={maxTarget}
                onSelect={(v) => setValue('n_impellers_target', v, { shouldValidate: true })}
              />
            )}
          </Field>
        </div>
      </div>
    </div>
  );
}

function ImpellerTypeGroup({
  value,
  onSelect,
}: {
  value: ImpellerType;
  onSelect: (value: ImpellerType) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Impeller type" className="grid gap-2 sm:grid-cols-4">
      {IMPELLER_OPTIONS.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onSelect(option.value)}
            className="flex min-h-20 flex-col items-start justify-center rounded-lg border px-3.5 py-3 text-left transition-[border-color,background-color,box-shadow,transform]"
            style={{
              borderColor: selected ? 'var(--color-ink-500)' : 'var(--color-ink-200)',
              background: selected ? 'var(--color-paper-300)' : 'var(--color-paper-100)',
              boxShadow: selected ? '0 0 0 1px var(--color-rule-strong) inset' : 'none',
              color: selected ? 'var(--color-ink-900)' : 'var(--color-ink-700)',
            }}
          >
            <span className="text-[14px] font-medium leading-snug">{option.label}</span>
            <span
              className="mt-1 text-[12px] leading-snug"
              style={{ color: selected ? 'var(--color-ink-500)' : 'var(--color-ink-400)' }}
            >
              {option.hint}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ChipButton({
  label, selected, onClick,
}: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border px-3.5 py-2 text-[14px] tabular-nums transition-[border-color,background-color,color]"
      style={{
        borderColor: selected ? 'var(--color-ink-500)' : 'var(--color-ink-200)',
        background:  selected ? 'var(--color-paper-300)' : 'var(--color-paper-200)',
        color:       selected ? 'var(--color-ink-900)'   : 'var(--color-ink-700)',
        boxShadow:   selected ? '0 0 0 1px var(--color-rule-strong) inset' : 'none',
      }}
    >
      {label}
    </button>
  );
}

function ImpellerCountGroup({
  value, max, onSelect,
}: { value: number; max: number; onSelect: (v: number) => void }) {
  return (
    <div role="radiogroup" className="flex gap-2">
      {IMPELLER_COUNTS.map((n) => {
        const disabled = n > max;
        const selected = value === n;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onSelect(n)}
            title={disabled ? 'Insufficient H/T clearance for this many impellers.' : undefined}
            className="grid h-10 w-12 place-items-center rounded-lg border text-[14px] tabular-nums transition-[border-color,background-color,color]"
            style={{
              borderColor: selected ? 'var(--color-ink-500)' : 'var(--color-ink-200)',
              background:  selected ? 'var(--color-paper-300)' : 'var(--color-paper-200)',
              color:       selected ? 'var(--color-ink-900)'   : 'var(--color-ink-700)',
              boxShadow:   selected ? '0 0 0 1px var(--color-rule-strong) inset' : 'none',
              opacity:     disabled ? 0.35 : 1,
              cursor:      disabled ? 'not-allowed' : 'pointer',
            }}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}
