'use client';

// Thin "X of Y inputs · Confidence: …" strip that lives below the wizard's
// step content. Driven by the same useWatch the LivePreview uses so it
// stays in sync without re-rendering the form on every keystroke.
//
// The confidence label is the same three-way split the engine emits per
// domain: high_confidence (OUR measured + all required entered),
// reliable (all required entered but OUR estimated), and directional
// (something is missing or species lacks an estimable curve).

import { useFormContext, useWatch } from 'react-hook-form';
import type { AssessFormValues } from '@/lib/assess-schema';

type Confidence = 'high_confidence' | 'reliable' | 'directional';

// Fields that drive the engine's structural fidelity. Everything else
// either has a sensible default or is optional. Order is irrelevant —
// we only count, not enumerate.
const TRACKED: (keyof AssessFormValues)[] = [
  'organism_class',
  'organism_species',
  'v_lab',
  'v_target',
  'rpm',
  'vvm',
  'biomass_cdw_g_l',
  'h_d_lab',
  'h_d_target',
  'temperature',
  't_cw_inlet',
  'do_setpoint',
  'impeller_type',
  'n_impellers',
  'process_type',
  'our_mode',
];

const OUR_ESTIMABLE = new Set<AssessFormValues['organism_species']>([
  'e_coli',
  'b_subtilis',
  's_cerevisiae',
  'p_pastoris',
]);

function isFilled(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'number') return Number.isFinite(value) && value !== 0;
  if (typeof value === 'string') return value.trim() !== '';
  return true;
}

function classify(form: Partial<AssessFormValues>): {
  entered: number;
  total: number;
  confidence: Confidence;
  label: string;
} {
  const total = TRACKED.length;
  let entered = TRACKED.reduce((acc, k) => acc + (isFilled(form[k]) ? 1 : 0), 0);

  // OUR measured is a separate axis — only counted as "entered" when the
  // user actually provided a value, not just picked the mode.
  const ourMeasuredFilled = form.our_mode === 'measured' && isFilled(form.our_measured);

  // Treat OUR measurement as the high-confidence anchor.
  const allRequiredEntered = entered >= TRACKED.length - 1; // tolerate one missing field

  const speciesEstimable =
    form.organism_species ? OUR_ESTIMABLE.has(form.organism_species) : false;

  let confidence: Confidence;
  let label: string;

  if (ourMeasuredFilled && allRequiredEntered) {
    confidence = 'high_confidence';
    label = 'High confidence';
  } else if (allRequiredEntered && (speciesEstimable || ourMeasuredFilled)) {
    confidence = 'reliable';
    label = 'Reliable';
  } else {
    confidence = 'directional';
    label = 'Directional';
  }

  return { entered, total, confidence, label };
}

const COLOR: Record<Confidence, string> = {
  high_confidence: 'var(--color-ink-900)',
  reliable: 'var(--color-ink-600, var(--color-ink-500))',
  directional: 'var(--color-ink-400)',
};

export function TransparencyIndicator() {
  const { control } = useFormContext<AssessFormValues>();
  const form = useWatch({ control });
  const { entered, total, confidence, label } = classify(form);
  const c = COLOR[confidence];
  const pct = Math.round((entered / total) * 100);

  return (
    <div
      className="mt-8 flex items-center justify-between rounded-lg border px-4 py-3"
      style={{
        borderColor: 'var(--color-rule)',
        background: 'var(--color-paper-100)',
      }}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: c }}
        />
        <p className="text-meta">
          <span style={{ color: 'var(--color-ink-700)' }}>{entered}</span>
          <span style={{ color: 'var(--color-ink-500)' }}> of {total} inputs entered</span>
        </p>
      </div>
      <p className="text-meta tabular-nums" style={{ color: c }}>
        {label} <span style={{ color: 'var(--color-ink-400)' }}>· {pct}%</span>
      </p>
    </div>
  );
}
