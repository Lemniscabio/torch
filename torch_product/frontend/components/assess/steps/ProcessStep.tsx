'use client';

// Step 4 — "Process characterisation" — biomass + oxygen + thermal.
// Mirrors old/InputForm.tsx Step D: biomass mode toggle (CDW / OD) with
// species-specific conversion display, OUR mode as two cards, O₂ inlet
// as a 4-button toggle group, DO setpoint as a range slider, plus
// temperature and cooling-water inlet.

import { useEffect } from 'react';
import { useFormContext } from 'react-hook-form';
import { getOdToCdwFactor } from '@torch/core-shared';
import { Field } from '@/components/ui/Field';
import { NumberInput } from '@/components/ui/NumberInput';
import type { AssessFormValues } from '@/lib/assess-schema';

const O2_OPTIONS: { value: number; label: string; pct: string }[] = [
  { value: 20.9, label: 'Air',                       pct: '21%' },
  { value: 40,   label: 'Mildly enriched',           pct: '40%' },
  { value: 60,   label: 'Moderately enriched',       pct: '60%' },
  { value: 80,   label: 'Highly enriched',           pct: '80%' },
];

export function ProcessStep() {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<AssessFormValues>();

  const biomassMode = watch('biomass_input_mode') ?? 'cdw';
  const biomassValue = watch('biomass_cdw_g_l');
  const ourMode = watch('our_mode');
  const species = watch('organism_species');
  const o2Inlet = watch('o2_inlet');
  const doSetpoint = watch('do_setpoint');

  const isOtherOrganism = species === 'other_bacteria' || species === 'other_yeast';

  useEffect(() => {
    if (isOtherOrganism && ourMode !== 'measured') {
      setValue('our_mode', 'measured', { shouldDirty: true, shouldTouch: true, shouldValidate: true });
    }
  }, [isOtherOrganism, ourMode, setValue]);

  const odFactor = species ? getOdToCdwFactor(species) : 0.22;
  const cdwEquivalent =
    biomassMode === 'od' && typeof biomassValue === 'number' && Number.isFinite(biomassValue)
      ? biomassValue * odFactor
      : null;

  return (
    <div className="grid max-w-[760px] gap-8">
      {/* ── Biomass ──────────────────────────────────────────────────── */}
      <Field
        label="Peak biomass"
        htmlFor="biomass_cdw_g_l"
        hint={
          biomassMode === 'od' && cdwEquivalent !== null
            ? `≈ ${cdwEquivalent.toFixed(2)} g/L CDW — using ${odFactor.toFixed(2)} g/L·OD⁻¹ for ${species}`
            : 'Cell dry weight at the highest oxygen demand.'
        }
        error={errors.biomass_cdw_g_l?.message}
      >
        <div className="flex flex-col gap-2">
          <div className="flex justify-end gap-1">
            <ModeChip
              label="g/L CDW"
              selected={biomassMode === 'cdw'}
              onClick={() => setValue('biomass_input_mode', 'cdw', { shouldValidate: false })}
            />
            <ModeChip
              label="g/L WCW"
              selected={biomassMode === 'od'}
              onClick={() => setValue('biomass_input_mode', 'od', { shouldValidate: false })}
            />
          </div>
          <NumberInput
            id="biomass_cdw_g_l"
            unit={biomassMode === 'od' ? 'OD' : 'g/L'}
            invalid={!!errors.biomass_cdw_g_l}
            {...register('biomass_cdw_g_l', { valueAsNumber: true })}
          />
        </div>
      </Field>

      {/* ── OUR cards ────────────────────────────────────────────────── */}
      <Field
        label="Oxygen uptake rate"
        htmlFor="our_mode"
        hint="A measured OUR upgrades confidence across every domain."
        error={errors.our_mode?.message}
      >
        <div className="grid gap-2 sm:grid-cols-3">
          <OurCard
            title="I have measured OUR"
            description="Highest confidence — upgrades all domains."
            selected={ourMode === 'measured'}
            onSelect={() => setValue('our_mode', 'measured', {
              shouldDirty: true,
              shouldTouch: true,
              shouldValidate: true,
            })}
          />
          <OurCard
            title="Estimate from specific growth rate (µ)"
            description="Directional confidence for four domains."
            selected={ourMode === 'estimate_mu'}
            disabled={isOtherOrganism}
            onSelect={() => setValue('our_mode', 'estimate_mu', {
              shouldDirty: true,
              shouldTouch: true,
              shouldValidate: true,
            })}
          />
          <OurCard
            title="Estimate from physiology"
            description="Directional confidence for four domains."
            selected={ourMode === 'estimate'}
            disabled={isOtherOrganism}
            onSelect={() => setValue('our_mode', 'estimate', {
              shouldDirty: true,
              shouldTouch: true,
              shouldValidate: true,
            })}
          />
        </div>
      </Field>

      {ourMode === 'measured' ? (
        <Field
          label="Measured OUR (peak)"
          htmlFor="our_measured"
          error={errors.our_measured?.message}
        >
          <NumberInput
            id="our_measured"
            unit="mmol/L/h"
            invalid={!!errors.our_measured}
            {...register('our_measured', {
              setValueAs: (v) =>
                v === '' || Number.isNaN(Number(v)) ? undefined : Number(v),
            })}
          />
        </Field>
      ) : null}

      {ourMode === 'estimate_mu' ? (
        <Field
          label="Specific growth rate (µ)"
          htmlFor="specific_growth_rate"
          hint="Available for E. coli, B. subtilis, S. cerevisiae, P. pastoris."
          error={errors.specific_growth_rate?.message}
        >
          <NumberInput
            id="specific_growth_rate"
            unit="/h"
            invalid={!!errors.specific_growth_rate}
            {...register('specific_growth_rate', {
              setValueAs: (v) =>
                v === '' || Number.isNaN(Number(v)) ? undefined : Number(v),
            })}
          />
        </Field>
      ) : null}

      {/* ── DO setpoint slider ───────────────────────────────────────── */}
      <Field
        label="DO setpoint"
        htmlFor="do_setpoint"
        hint="20–40% is the typical operating window."
        error={errors.do_setpoint?.message}
      >
        <div className="flex items-center gap-4">
          <input
            id="do_setpoint"
            type="range"
            min={0}
            max={100}
            step={1}
            className="flex-1"
            style={{ accentColor: 'var(--color-flame-500)' }}
            {...register('do_setpoint', { valueAsNumber: true })}
          />
          <div
            className="grid h-9 w-16 place-items-center rounded-lg border text-[13px] tabular-nums"
            style={{
              borderColor: 'var(--color-ink-200)',
              background: 'var(--color-paper-200)',
              color: 'var(--color-ink-900)',
            }}
          >
            {typeof doSetpoint === 'number' ? `${Math.round(doSetpoint)}%` : '—'}
          </div>
        </div>
      </Field>

      {/* ── O₂ enrichment ────────────────────────────────────────────── */}
      <Field
        label="Inlet O₂ enrichment"
        htmlFor="o2_inlet"
        hint="Air = 20.9%. Raise for enriched sparging."
        error={errors.o2_inlet?.message}
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {O2_OPTIONS.map((o) => (
            <O2Chip
              key={o.value}
              label={o.label}
              pct={o.pct}
              selected={o2Inlet === o.value}
              onClick={() => setValue('o2_inlet', o.value, { shouldValidate: false })}
            />
          ))}
        </div>
      </Field>

      {/* ── Thermal ──────────────────────────────────────────────────── */}
      <div>
        <p className="text-meta mb-3" style={{ color: 'var(--color-ink-700)', fontWeight: 500 }}>
          Thermal
        </p>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field
            label="Process temperature"
            htmlFor="temperature"
            error={errors.temperature?.message}
          >
            <NumberInput
              id="temperature"
              unit="°C"
              invalid={!!errors.temperature}
              {...register('temperature', { valueAsNumber: true })}
            />
          </Field>
          <Field
            label="Cooling utility inlet"
            htmlFor="t_cw_inlet"
            error={errors.t_cw_inlet?.message}
          >
            <NumberInput
              id="t_cw_inlet"
              unit="°C"
              invalid={!!errors.t_cw_inlet}
              {...register('t_cw_inlet', { valueAsNumber: true })}
            />
          </Field>
        </div>
      </div>
    </div>
  );
}

function ModeChip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border px-2.5 py-1 text-[11.5px] font-medium tracking-[-0.005em] transition-[border-color,background-color,color]"
      style={{
        borderColor: selected ? 'var(--color-ink-500)' : 'var(--color-ink-200)',
        background:  selected ? 'var(--color-paper-300)' : 'var(--color-paper-200)',
        color:       selected ? 'var(--color-ink-900)'   : 'var(--color-ink-500)',
        boxShadow:   selected ? '0 0 0 1px var(--color-rule-strong) inset' : 'none',
      }}
    >
      {label}
    </button>
  );
}

function O2Chip({
  label, pct, selected, onClick,
}: { label: string; pct: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-start rounded-lg border px-3.5 py-2.5 text-left transition-[border-color,background-color]"
      style={{
        borderColor: selected ? 'var(--color-ink-500)' : 'var(--color-ink-200)',
        background:  selected ? 'var(--color-paper-300)' : 'var(--color-paper-200)',
        boxShadow:   selected ? '0 0 0 1px var(--color-rule-strong) inset' : 'none',
      }}
    >
      <span
        className="text-[14px] font-medium tracking-[-0.005em]"
        style={{ color: selected ? 'var(--color-ink-900)' : 'var(--color-ink-800)' }}
      >
        {label}
      </span>
      <span className="text-[12px] tabular-nums" style={{ color: 'var(--color-ink-500)' }}>
        {pct}
      </span>
    </button>
  );
}

function OurCard({
  title, description, selected, disabled, onSelect,
}: {
  title: string;
  description: string;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className="rounded-lg border p-4 text-left transition-[border-color,background-color]"
      style={{
        borderColor: selected ? 'var(--color-ink-500)' : 'var(--color-ink-200)',
        background:  selected ? 'var(--color-paper-300)' : 'var(--color-paper-200)',
        boxShadow:   selected ? '0 0 0 1px var(--color-rule-strong) inset' : 'none',
        cursor:  disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <p
        className="text-[14px] font-medium"
        style={{ color: selected ? 'var(--color-ink-900)' : 'var(--color-ink-800)' }}
      >
        {title}
      </p>
      <p
        className="mt-1 text-[12px] leading-snug"
        style={{ color: selected ? 'var(--color-ink-500)' : 'var(--color-ink-400)' }}
      >
        {description}
      </p>
    </button>
  );
}
