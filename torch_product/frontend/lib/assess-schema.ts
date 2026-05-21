// Zod schema mirroring ProcessInputs from @torch/core. Single source of
// truth for what the assess wizard collects + how each field is validated.
//
// Sliced into per-step "shape" objects so each step component validates its
// own slice independently. The full schema is composed from those shapes
// plus the cross-field refinements.
//
// Numeric bounds copied from @torch/core/constants/input_bounds. Source of
// truth lives there; if those change, fix here too (and add a snapshot test).

import { z } from 'zod';
import {
  PROCESS_INPUT_BOUNDS,
  inferHdFromVolume,
  getScaleupOperatingRange,
  maxImpellersForGeometry,
} from '@torch/core-shared';

export { inferHdFromVolume };

// ── Plain shapes (no cross-field refinements) ───────────────────────────────
// Step schemas below layer refinements on top of these. Composing them back
// into the full schema then preserves a clean shape we can read with .shape.

const organismShape = {
  organism_class: z.enum(['bacteria', 'yeast'], {
    errorMap: () => ({ message: 'Select an organism class.' }),
  }),
  organism_species: z.enum([
    'e_coli',
    'b_subtilis',
    's_cerevisiae',
    'p_pastoris',
    'other_bacteria',
    'other_yeast',
  ]),
  process_type: z.enum(['batch', 'fed_batch']),
  feeding_frequency: z
    .enum(['continuous', '1_10min', '10_30min', '30plus_min'])
    .optional(),
};

const scaleShape = {
  v_lab: z
    .number({ invalid_type_error: 'Enter a number.' })
    .positive('Must be greater than 0.')
    .max(PROCESS_INPUT_BOUNDS.v_lab.max, `Lab volume must be ≤ ${PROCESS_INPUT_BOUNDS.v_lab.max} L.`),
  v_target: z
    .number({ invalid_type_error: 'Enter a number.' })
    .positive('Must be greater than 0.'),
  scaleup_criterion: z.enum(['power_per_volume', 'kla', 'shear']),
};

const hdBound = (v: number) =>
  v >= PROCESS_INPUT_BOUNDS.h_d.min && v <= PROCESS_INPUT_BOUNDS.h_d.max;
const dtBound = (v: number) =>
  v >= PROCESS_INPUT_BOUNDS.dt_ratio.min && v <= PROCESS_INPUT_BOUNDS.dt_ratio.max;

const vesselShape = {
  h_d_lab: z
    .number({ invalid_type_error: 'Enter a number.' })
    .refine(hdBound, `H/D must be between ${PROCESS_INPUT_BOUNDS.h_d.min} and ${PROCESS_INPUT_BOUNDS.h_d.max}.`),
  h_d_target: z
    .number({ invalid_type_error: 'Enter a number.' })
    .refine(hdBound, `H/D must be between ${PROCESS_INPUT_BOUNDS.h_d.min} and ${PROCESS_INPUT_BOUNDS.h_d.max}.`),
  h_d_target_same_as_lab: z.boolean().default(true),
  impeller_type: z.enum(['rushton', 'pitched_blade', 'marine', 'unknown']),
  n_impellers: z.coerce
    .number({ invalid_type_error: 'Enter a number.' })
    .int('Whole number.')
    .min(1, 'At least 1.')
    .max(4, 'At most 4.'),
  n_impellers_target: z.coerce
    .number()
    .int()
    .min(1)
    .max(4)
    .optional(),
  n_impellers_target_same_as_lab: z.boolean().default(true),
  dt_ratio_lab: z
    .number()
    .optional()
    .refine((v) => v === undefined || dtBound(v), {
      message: `D/T must be between ${PROCESS_INPUT_BOUNDS.dt_ratio.min} and ${PROCESS_INPUT_BOUNDS.dt_ratio.max}.`,
    }),
  dt_ratio_target: z
    .number()
    .optional()
    .refine((v) => v === undefined || dtBound(v), {
      message: `D/T must be between ${PROCESS_INPUT_BOUNDS.dt_ratio.min} and ${PROCESS_INPUT_BOUNDS.dt_ratio.max}.`,
    }),
  dt_ratio_target_same_as_lab: z.boolean().default(true),
  rpm: z
    .number({ invalid_type_error: 'Enter a number.' })
    .positive('Must be greater than 0.')
    .max(3000, 'Above 3000 RPM is outside supported range.'),
  vvm: z
    .number({ invalid_type_error: 'Enter a number.' })
    .min(0.1, 'At least 0.1 VVM.')
    .max(5, 'At most 5 VVM.'),
};

// Single "process characterisation" shape — old/ groups biomass, oxygen,
// and thermal into one step. Replaces the previous oxygenShape +
// processShape split.
const processShape = {
  // Biomass
  biomass_input_mode: z.enum(['cdw', 'od']).default('cdw'),
  biomass_cdw_g_l: z
    .number({ invalid_type_error: 'Enter a number.' })
    .positive('Must be greater than 0.'),

  // Oxygen
  our_mode: z.enum(['measured', 'estimate', 'estimate_mu']),
  our_measured: z
    .number()
    .positive('Must be greater than 0.')
    .max(PROCESS_INPUT_BOUNDS.our_measured.max, `OUR cannot exceed ${PROCESS_INPUT_BOUNDS.our_measured.max} mmol/L/h.`)
    .optional(),
  specific_growth_rate: z
    .number()
    .positive('Must be greater than 0.')
    .max(3, 'µ above 3 h⁻¹ is outside supported range.')
    .optional(),
  o2_inlet: z
    .number()
    .min(20.9, 'Inlet O₂ must be ≥ 20.9% (air).')
    .max(100, 'At most 100%.')
    .optional(),
  do_setpoint: z
    .number({ invalid_type_error: 'Enter a number.' })
    .min(0, 'At least 0%.')
    .max(100, 'At most 100%.'),

  // Thermal
  temperature: z
    .number({ invalid_type_error: 'Enter a number.' })
    .min(PROCESS_INPUT_BOUNDS.temperature.min, `At least ${PROCESS_INPUT_BOUNDS.temperature.min} °C.`)
    .max(PROCESS_INPUT_BOUNDS.temperature.max, `At most ${PROCESS_INPUT_BOUNDS.temperature.max} °C.`),
  t_cw_inlet: z
    .number({ invalid_type_error: 'Enter a number.' })
    .min(0, 'At least 0 °C.')
    .max(40, 'At most 40 °C.'),
};

// ── Per-step schemas with cross-field refinements ───────────────────────────
// Matches the old wizard exactly: 4 steps.
//   1. identity ("What are you scaling?")  — organism + process type
//   2. scale    ("How big are you going?") — volumes + criterion
//   3. vessel   ("Your lab-scale setup")   — geometry + impeller + agitation
//   4. process  ("Process characterisation") — biomass + oxygen + thermal

export const identityStepSchema = z.object(organismShape).refine(
  (d) => d.process_type !== 'fed_batch' || typeof d.feeding_frequency === 'string',
  { message: 'Pick a feeding frequency.', path: ['feeding_frequency'] },
);

export const scaleStepSchema = z.object(scaleShape).refine(
  (d) => d.v_target > d.v_lab,
  { message: 'Target volume must be greater than lab volume.', path: ['v_target'] },
);

export const vesselStepSchema = z.object({
  v_lab: scaleShape.v_lab,
  ...vesselShape,
}).superRefine(addVesselEnvelopeIssues);

const ESTIMATE_MU_SPECIES = new Set([
  'e_coli', 'b_subtilis', 's_cerevisiae', 'p_pastoris',
]);

export const processStepSchema = z.object(processShape).superRefine((d, ctx) => {
  if (d.our_mode === 'measured' && typeof d.our_measured !== 'number') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['our_measured'],
      message: 'Provide a measured OUR value.',
    });
  }
  if (d.our_mode === 'estimate_mu' && typeof d.specific_growth_rate !== 'number') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['specific_growth_rate'],
      message: 'Provide a specific growth rate (µ).',
    });
  }
});

// ── Full schema — for the final submit ────────────────────────────────────

export const fullAssessSchema = z
  .object({
    ...organismShape,
    ...scaleShape,
    ...vesselShape,
    ...processShape,
  })
  .superRefine((d, ctx) => {
    if (d.v_target <= d.v_lab) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['v_target'],
        message: 'Target volume must be greater than lab volume.',
      });
    }
    if (d.our_mode === 'measured' && typeof d.our_measured !== 'number') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['our_measured'],
        message: 'Provide a measured OUR value.',
      });
    }
    if (d.our_mode === 'estimate_mu') {
      if (typeof d.specific_growth_rate !== 'number') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['specific_growth_rate'],
          message: 'Provide a specific growth rate (µ).',
        });
      }
      if (!ESTIMATE_MU_SPECIES.has(d.organism_species)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['our_mode'],
          message: 'µ-based estimate is only available for E. coli, B. subtilis, S. cerevisiae, and P. pastoris.',
        });
      }
    }
    if (d.process_type === 'fed_batch' && typeof d.feeding_frequency !== 'string') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['feeding_frequency'],
        message: 'Pick a feeding frequency.',
      });
    }
    addVesselEnvelopeIssues(d, ctx);
  });

type VesselEnvelopeValues = {
  v_lab?: number;
  rpm?: number;
  vvm?: number;
  h_d_lab?: number;
  h_d_target?: number;
  h_d_target_same_as_lab?: boolean;
  n_impellers?: number;
  n_impellers_target?: number;
  n_impellers_target_same_as_lab?: boolean;
};

function addVesselEnvelopeIssues(d: VesselEnvelopeValues, ctx: z.RefinementCtx) {
  if (typeof d.v_lab === 'number' && d.v_lab > 0) {
    const range = getScaleupOperatingRange(d.v_lab);
    if (typeof d.rpm === 'number' && d.rpm > range.max_rpm.max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rpm'],
        message: `RPM exceeds the ${range.scale_label} envelope (max ${range.max_rpm.max}).`,
      });
    }
    if (typeof d.vvm === 'number' && d.vvm > range.max_aeration_vvm.max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['vvm'],
        message: `VVM exceeds the ${range.scale_label} envelope (max ${range.max_aeration_vvm.max}).`,
      });
    }
  }

  if (typeof d.h_d_lab === 'number' && typeof d.n_impellers === 'number') {
    const maxLab = maxImpellersForGeometry(d.h_d_lab);
    if (d.n_impellers > maxLab) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['n_impellers'],
        message: `Too many impellers for lab H/D ${d.h_d_lab.toFixed(1)} (max ${maxLab}).`,
      });
    }
  }

  const targetHd = d.h_d_target_same_as_lab ? d.h_d_lab : d.h_d_target;
  const targetImpellers = d.n_impellers_target_same_as_lab ? d.n_impellers : d.n_impellers_target;
  if (typeof targetHd === 'number' && typeof targetImpellers === 'number') {
    const maxTarget = maxImpellersForGeometry(targetHd);
    if (targetImpellers > maxTarget) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['n_impellers_target'],
        message: `Too many impellers for target H/D ${targetHd.toFixed(1)} (max ${maxTarget}).`,
      });
    }
  }
}

export type IdentityStep = z.infer<typeof identityStepSchema>;
export type ScaleStep    = z.infer<typeof scaleStepSchema>;
export type VesselStep   = z.infer<typeof vesselStepSchema>;
export type ProcessStep  = z.infer<typeof processStepSchema>;
export type AssessFormValues = z.infer<typeof fullAssessSchema>;

// ── Per-step schema map ─────────────────────────────────────────────────────

export const STEP_SCHEMAS = {
  identity: identityStepSchema,
  scale:    scaleStepSchema,
  vessel:   vesselStepSchema,
  process:  processStepSchema,
} as const;

// ── Step metadata for the wizard shell ──────────────────────────────────────

export const STEPS = [
  { slug: 'identity', label: 'Identity',  eyebrow: 'Step 1 of 4' },
  { slug: 'scale',    label: 'Scale',     eyebrow: 'Step 2 of 4' },
  { slug: 'vessel',   label: 'Lab setup', eyebrow: 'Step 3 of 4' },
  { slug: 'process',  label: 'Process',   eyebrow: 'Step 4 of 4' },
] as const;

export type StepSlug = (typeof STEPS)[number]['slug'];

export function stepIndex(slug: StepSlug): number {
  return STEPS.findIndex((s) => s.slug === slug);
}

// Fields each step "owns" — Next button validates only the relevant slice
// before advancing, so the user isn't blocked by errors on later steps.
export const STEP_FIELDS: Record<StepSlug, (keyof AssessFormValues)[]> = {
  identity: ['organism_class', 'organism_species', 'process_type', 'feeding_frequency'],
  scale:    ['v_lab', 'v_target', 'scaleup_criterion'],
  vessel:   [
    'h_d_lab', 'h_d_target', 'h_d_target_same_as_lab',
    'impeller_type', 'n_impellers', 'n_impellers_target', 'n_impellers_target_same_as_lab',
    'dt_ratio_lab', 'dt_ratio_target', 'dt_ratio_target_same_as_lab',
    'rpm', 'vvm',
  ],
  process: [
    'biomass_input_mode', 'biomass_cdw_g_l',
    'our_mode', 'our_measured', 'specific_growth_rate',
    'o2_inlet', 'do_setpoint',
    'temperature', 't_cw_inlet',
  ],
};

// Defaults used on first load. Mirrors @torch/core INPUT_DEFAULTS where
// applicable.
export const ASSESS_DEFAULTS: Partial<AssessFormValues> = {
  organism_class: 'bacteria',
  organism_species: 'e_coli',
  process_type: 'batch',
  scaleup_criterion: 'power_per_volume',
  h_d_lab: 1.2,
  h_d_target_same_as_lab: true,
  impeller_type: 'rushton',
  n_impellers: 2,
  n_impellers_target_same_as_lab: true,
  dt_ratio_target_same_as_lab: true,
  vvm: 1.0,
  biomass_input_mode: 'cdw',
  our_mode: 'estimate',
  o2_inlet: 20.9,
  do_setpoint: 30,
  temperature: 37,
  t_cw_inlet: 12,
};
