'use client';

import { useFormContext } from 'react-hook-form';
import { Field } from '@/components/ui/Field';
import { NumberInput } from '@/components/ui/NumberInput';
import { Select } from '@/components/ui/Select';
import { inferHdFromVolume, type AssessFormValues } from '@/lib/assess-schema';

const PRESETS = [10, 100, 1000] as const;

function formatVolume(v: number): string {
  if (v >= 1000) return `${(v / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} m³`;
  return `${v.toLocaleString(undefined, { maximumFractionDigits: 1 })} L`;
}

export function ScaleStep() {
  const {
    register,
    setValue,
    watch,
    formState: { errors },
  } = useFormContext<AssessFormValues>();

  const vLab = watch('v_lab');
  const vTarget = watch('v_target');
  const hdTarget = watch('h_d_target');

  const vLabValid = typeof vLab === 'number' && Number.isFinite(vLab) && vLab > 0;
  const vTargetValid = typeof vTarget === 'number' && Number.isFinite(vTarget) && vTarget > 0;
  const ratio = vLabValid && vTargetValid ? vTarget / vLab : null;
  const selectedPreset = vLabValid && vTargetValid
    ? PRESETS.find((mult) => Math.abs(vTarget - vLab * mult) <= Math.max(0.000001, vLab * mult * 0.000001))
    : undefined;

  // Suggest a target H/D based on target volume — only when the user has
  // not yet set h_d_target themselves. Helps the wizard feel informed.
  if (typeof vTarget === 'number' && vTarget > 0 && (hdTarget === undefined || Number.isNaN(hdTarget))) {
    const suggested = inferHdFromVolume(vTarget);
    queueMicrotask(() => setValue('h_d_target', suggested, { shouldValidate: false }));
  }

  function applyMultiplier(mult: number) {
    if (!vLabValid) return;
    setValue('v_target', vLab * mult, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  }

  return (
    <div className="grid max-w-[760px] gap-7">
      <Field
        label="Lab volume"
        htmlFor="v_lab"
        hint="Working volume at the bench."
        error={errors.v_lab?.message}
      >
        <NumberInput
          id="v_lab"
          unit="L"
          invalid={!!errors.v_lab}
          {...register('v_lab', { valueAsNumber: true, deps: ['v_target'] })}
        />
      </Field>

      {/* Target scale cards — disabled until lab volume is valid. */}
      <div>
        <p className="text-label">Target scale</p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {PRESETS.map((mult) => {
            const selected = selectedPreset === mult;
            return (
              <button
                key={mult}
                type="button"
                disabled={!vLabValid}
                onClick={() => applyMultiplier(mult)}
                className="min-h-24 rounded-xl border px-5 py-4 text-center tabular-nums transition-[border-color,background-color,box-shadow,color,opacity]"
                style={{
                  borderColor: selected ? 'var(--color-flame-500)' : 'var(--color-rule)',
                  background: selected ? 'rgba(255,90,31,0.08)' : 'var(--color-paper-100)',
                  boxShadow: selected ? '0 0 0 1px var(--color-flame-500)' : 'none',
                  color: vLabValid ? 'var(--color-ink-900)' : 'var(--color-ink-400)',
                  opacity: vLabValid ? 1 : 0.48,
                  cursor: vLabValid ? 'pointer' : 'not-allowed',
                }}
                aria-pressed={selected}
              >
                <span className="block text-[1.35rem] font-semibold leading-none">
                  {mult.toLocaleString()}×
                </span>
                <span className="mt-2 block text-[0.8rem]" style={{ color: 'var(--color-ink-500)' }}>
                  {vLabValid ? formatVolume(vLab * mult) : 'Set lab volume'}
                </span>
              </button>
            );
          })}
        </div>
        {errors.v_target?.message ? (
          <p className="mt-2 text-meta" style={{ color: 'var(--color-flame-500)' }}>
            {errors.v_target.message}
          </p>
        ) : null}
      </div>

      {/* Scale-ratio panel — orienting feedback once both volumes are set */}
      {ratio && Number.isFinite(ratio) && ratio > 0 ? (
        <div
          className="flex items-center justify-between rounded-lg border px-4 py-3"
          style={{
            borderColor: 'var(--color-rule)',
            background: 'var(--color-paper-100)',
          }}
        >
          <p className="text-meta">
            Scale ratio
          </p>
          <p className="text-mono" style={{ color: 'var(--color-ink-900)' }}>
            {ratio >= 1 ? `${ratio.toFixed(ratio >= 100 ? 0 : 1)}×` : '—'}{' '}
            <span style={{ color: 'var(--color-ink-500)' }}>
              ({formatVolume(vLab)} → {formatVolume(vTarget)})
            </span>
          </p>
        </div>
      ) : null}

      <Field
        label="Scale-up criterion"
        htmlFor="scaleup_criterion"
        hint="How agitation and aeration is preserved across scales."
        error={errors.scaleup_criterion?.message}
      >
        <Select id="scaleup_criterion" {...register('scaleup_criterion')}>
          <option value="power_per_volume">Constant P/V</option>
          <option value="kla">Constant kLa</option>
          <option value="shear">Constant tip speed</option>
        </Select>
      </Field>
    </div>
  );
}
