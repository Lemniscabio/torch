'use client';

// Step 1 — "What are you scaling?" — organism class + species + process
// type (with feeding frequency for fed-batch). Matches old/InputForm.tsx
// Step A field set + conditional rendering.

import { useEffect } from 'react';
import { useFormContext } from 'react-hook-form';
import { INPUT_DEFAULTS } from '@torch/core';
import { Field } from '@/components/ui/Field';
import type { AssessFormValues } from '@/lib/assess-schema';

type OrganismClass = AssessFormValues['organism_class'];
type OrganismSpecies = AssessFormValues['organism_species'];
type ProcessType = AssessFormValues['process_type'];
type FeedingFrequency = AssessFormValues['feeding_frequency'];
type SelectionOption<T extends string> = {
  value: T;
  label: string;
  hint?: string;
  initials?: string;
};

const ORGANISM_CLASS_OPTIONS: ReadonlyArray<SelectionOption<OrganismClass>> = [
  { value: 'bacteria', label: 'Bacteria', initials: 'B' },
  { value: 'yeast', label: 'Yeast', initials: 'Y' },
];

// Species options grouped by class. Each carries the trait line old/
// shows beneath the species name.
const SPECIES_BY_CLASS = {
  bacteria: [
    { value: 'e_coli',         label: 'Escherichia coli',  hint: 'High OUR, shear tolerant' },
    { value: 'b_subtilis',     label: 'Bacillus subtilis', hint: 'Moderate OUR, sporulation' },
    { value: 'other_bacteria', label: 'Other bacterium',   hint: 'Conservative estimates' },
  ],
  yeast: [
    { value: 's_cerevisiae',   label: 'Saccharomyces cerevisiae',          hint: 'Lower OUR, shear sensitive' },
    { value: 'p_pastoris',     label: 'Pichia pastoris (K. phaffii)',      hint: 'Dual metabolism, shear sensitive' },
    { value: 'other_yeast',    label: 'Other yeast',                       hint: 'Conservative estimates' },
  ],
} as const;

const PROCESS_OPTIONS: ReadonlyArray<SelectionOption<ProcessType>> = [
  { value: 'batch', label: 'Batch' },
  { value: 'fed_batch', label: 'Fed-batch' },
];

const FEEDING_OPTIONS: ReadonlyArray<SelectionOption<NonNullable<FeedingFrequency>>> = [
  { value: 'continuous',  label: 'Continuous' },
  { value: '1_10min',     label: 'Every 1–10 min' },
  { value: '10_30min',    label: 'Every 10–30 min' },
  { value: '30plus_min',  label: 'Every 30 min+' },
] as const;

export function OrganismStep() {
  const {
    watch,
    setValue,
    clearErrors,
    formState: { errors },
  } = useFormContext<AssessFormValues>();

  const cls = watch('organism_class');
  const species = watch('organism_species');
  const processType = watch('process_type');
  const feedingFrequency = watch('feeding_frequency');
  const temperature = watch('temperature');

  // Clear the error as soon as a valid class is selected.
  useEffect(() => {
    if (cls === 'bacteria' || cls === 'yeast') {
      clearErrors('organism_class');
    }
  }, [cls, clearErrors]);

  // Auto-set temperature default when the user picks a class and the
  // temperature field is still empty. Matches old:344-349.
  useEffect(() => {
    if (cls !== 'bacteria' && cls !== 'yeast') return;
    if (typeof temperature === 'number' && Number.isFinite(temperature) && temperature > 0) return;
    setValue(
      'temperature',
      cls === 'yeast' ? INPUT_DEFAULTS.temperature_yeast : INPUT_DEFAULTS.temperature_bacteria,
      { shouldValidate: false },
    );
  }, [cls, temperature, setValue]);

  // Reset feeding_frequency when the user flips back to batch so a stale
  // value can't survive in the draft.
  useEffect(() => {
    if (processType === 'batch' && feedingFrequency !== undefined) {
      setValue('feeding_frequency', undefined, { shouldValidate: false });
    }
  }, [processType, feedingFrequency, setValue]);

  // Keep species in a valid set as class flips.
  const speciesOpts = SPECIES_BY_CLASS[cls] ?? SPECIES_BY_CLASS.bacteria;
  const validSpeciesValues = speciesOpts.map((o) => o.value as string);
  useEffect(() => {
    if (validSpeciesValues.includes(species as string)) return;
    setValue('organism_species', speciesOpts[0].value as OrganismSpecies, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  }, [species, speciesOpts, setValue, validSpeciesValues]);

  const selectOrganismClass = (nextClass: OrganismClass) => {
    setValue('organism_class', nextClass, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    setValue('organism_species', SPECIES_BY_CLASS[nextClass][0].value as OrganismSpecies, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    clearErrors(['organism_class', 'organism_species']);
  };

  const selectSpecies = (nextSpecies: OrganismSpecies) => {
    setValue('organism_species', nextSpecies, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    clearErrors('organism_species');
  };

  const selectProcessType = (nextProcessType: ProcessType) => {
    setValue('process_type', nextProcessType, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    clearErrors('process_type');
  };

  const selectFeedingFrequency = (nextFrequency: NonNullable<FeedingFrequency>) => {
    setValue('feeding_frequency', nextFrequency, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    clearErrors('feeding_frequency');
  };

  return (
    <div className="flex max-w-[860px] flex-col gap-6">
      <Field label="Organism class" htmlFor="organism_class" error={errors.organism_class?.message}>
        <SelectionGrid
          ariaLabel="Organism class"
          columns="compact"
          value={cls}
          options={ORGANISM_CLASS_OPTIONS}
          onSelect={selectOrganismClass}
        />
      </Field>

      <Field
        label={cls === 'yeast' ? 'Select yeast organism' : 'Select bacterial organism'}
        htmlFor="organism_species"
        error={errors.organism_species?.message}
      >
        <SelectionGrid
          ariaLabel="Organism species"
          columns="full"
          value={species}
          options={speciesOpts.map((o) => ({
            value: o.value as OrganismSpecies,
            label: o.label,
            hint: o.hint,
            initials: speciesInitials(o.value),
          }))}
          onSelect={selectSpecies}
        />
      </Field>

      <Field label="Process type" htmlFor="process_type" error={errors.process_type?.message}>
        <SelectionGrid
          ariaLabel="Process type"
          columns="compact"
          value={processType}
          options={PROCESS_OPTIONS}
          onSelect={selectProcessType}
        />
      </Field>

      {processType === 'fed_batch' ? (
        <Field
          label="Feeding frequency"
          htmlFor="feeding_frequency"
          hint="How often substrate is added during the fed phase."
          error={errors.feeding_frequency?.message}
        >
          <SelectionGrid
            ariaLabel="Feeding frequency"
            columns="responsive"
            value={feedingFrequency ?? ''}
            options={FEEDING_OPTIONS}
            onSelect={selectFeedingFrequency}
          />
        </Field>
      ) : null}
    </div>
  );
}

function SelectionGrid<T extends string>({
  ariaLabel,
  columns,
  value,
  options,
  onSelect,
}: {
  ariaLabel: string;
  columns: 'compact' | 'responsive' | 'full';
  value?: string;
  options: ReadonlyArray<SelectionOption<T>>;
  onSelect: (value: T) => void;
}) {
  const gridClass =
    columns === 'full'
      ? 'grid grid-cols-1 gap-2'
      : columns === 'compact'
        ? 'flex flex-wrap gap-2'
        : 'grid grid-cols-1 gap-2 sm:grid-cols-2';

  return (
    <div role="radiogroup" aria-label={ariaLabel} className={gridClass}>
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onSelect(option.value)}
            className={[
              'group flex min-h-12 items-center gap-3 rounded-lg border text-left transition-[border-color,background-color,box-shadow,color,transform]',
              columns === 'full' ? 'w-full px-3.5 py-3' : 'px-4 py-2.5',
              selected ? 'shadow-[0_0_0_1px_var(--color-rule-strong)_inset]' : 'hover:translate-y-[-1px]',
            ].join(' ')}
            style={{
              borderColor: selected ? 'var(--color-ink-500)' : 'var(--color-ink-200)',
              background: selected ? 'var(--color-paper-300)' : 'var(--color-paper-100)',
              color: selected ? 'var(--color-ink-900)' : 'var(--color-ink-700)',
            }}
          >
            {option.initials ? <OptionBadge selected={selected}>{option.initials}</OptionBadge> : null}
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-medium leading-snug">{option.label}</span>
              {option.hint ? (
                <span
                  className="mt-0.5 block text-[12px] leading-snug"
                  style={{ color: selected ? 'var(--color-ink-500)' : 'var(--color-ink-400)' }}
                >
                  {option.hint}
                </span>
              ) : null}
            </span>
            {columns === 'full' && selected ? (
              <span
                aria-hidden
                className="grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[11px] font-semibold"
                style={{ borderColor: 'var(--color-ink-500)', color: 'var(--color-ink-900)' }}
              >
                ✓
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function OptionBadge({ selected, children }: { selected: boolean; children: string }) {
  return (
    <span
      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border text-[12px] font-semibold"
      style={{
        borderColor: selected ? 'var(--color-ink-500)' : 'var(--color-ink-200)',
        background: selected ? 'var(--color-paper-100)' : 'var(--color-paper-200)',
        color: selected ? 'var(--color-ink-900)' : 'var(--color-ink-500)',
      }}
    >
      {children}
    </span>
  );
}

function speciesInitials(value: string): string {
  return value
    .split('_')
    .map((part) => part[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('');
}
