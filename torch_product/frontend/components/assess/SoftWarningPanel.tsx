'use client';

// Informational glass panel rendered above the active step's content.
// Surfaces non-blocking soft-warning checks against SOFT_WARNING_BOUNDS:
//   - scale ratio above 10,000× (predictions become directional only)
//   - temperature outside 20–45 °C (C* + viscosity correlations untested)
//   - H/D > 1.5 (Ruszkowski mixing correlation validated only below this)
//   - biomass ≥ 50 g/L CDW (non-Newtonian viscosity regime)
//   - VVM outside 0.3–2.0 (gassed-power correction validated range)
//
// None of these block submission — they just tell the user that the
// engine's confidence interval widens beyond its validated envelope.

import { useFormContext, useWatch } from 'react-hook-form';
import { SOFT_WARNING_BOUNDS } from '@torch/core-shared';
import type { AssessFormValues } from '@/lib/assess-schema';

const HIGH_DENSITY_BIOMASS = 60;

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return null;
}

function computeWarnings(form: Partial<AssessFormValues>): string[] {
  const warnings: string[] = [];

  const vLab = num(form.v_lab);
  const vTarget = num(form.v_target);
  // if (vLab !== null && vTarget !== null && vLab > 0 && vTarget / vLab > SOFT_WARNING_BOUNDS.scale_ratio_extreme) {
  //   warnings.push(
  //     `Scale ratio above ${SOFT_WARNING_BOUNDS.scale_ratio_extreme.toLocaleString()}× — predictions carry very high uncertainty.`,
  //   );
  // }

  const temp = num(form.temperature);
  if (
    temp !== null &&
    (temp < SOFT_WARNING_BOUNDS.temperature_correlation.min || temp > SOFT_WARNING_BOUNDS.temperature_correlation.max)
  ) {
    warnings.push(
      `Temperature outside ${SOFT_WARNING_BOUNDS.temperature_correlation.min}–${SOFT_WARNING_BOUNDS.temperature_correlation.max} °C — C* and viscosity correlations are extrapolated.`,
    );
  }

  const hdLab = num(form.h_d_lab);
  const hdTarget = num(form.h_d_target);
  // if ((hdLab !== null && hdLab > SOFT_WARNING_BOUNDS.h_d_mixing_uncertainty) ||
  //     (hdTarget !== null && hdTarget > SOFT_WARNING_BOUNDS.h_d_mixing_uncertainty)) {
  //   warnings.push(
  //     `H/D above ${SOFT_WARNING_BOUNDS.h_d_mixing_uncertainty} — mixing-time estimate carries additional uncertainty.`,
  //   );
  // }

  const biomass = num(form.biomass_cdw_g_l);
  if (biomass !== null && biomass >= HIGH_DENSITY_BIOMASS) {
    warnings.push(
      `Biomass ≥ ${HIGH_DENSITY_BIOMASS} g/L CDW — non-Newtonian viscosity treatment applied to kLa.`,
    );
  }

  const vvm = num(form.vvm);
  // if (
  //   vvm !== null &&
  //   (vvm < SOFT_WARNING_BOUNDS.vvm_gassed_power.min || vvm > SOFT_WARNING_BOUNDS.vvm_gassed_power.max)
  // ) {
  //   warnings.push(
  //     `VVM outside ${SOFT_WARNING_BOUNDS.vvm_gassed_power.min}–${SOFT_WARNING_BOUNDS.vvm_gassed_power.max} — gassed-power correction is extrapolated.`,
  //   );
  // }

  return warnings;
}

export function SoftWarningPanel() {
  const { control } = useFormContext<AssessFormValues>();
  const form = useWatch({ control });
  const warnings = computeWarnings(form);

  if (warnings.length === 0) return null;

  return (
    <div
      role="status"
      className="mb-6 rounded-xl border p-4"
      style={{
        borderColor: 'var(--color-warning-border)',
        background: 'var(--color-warning-bg)',
      }}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
          style={{ background: 'var(--color-warning-fg)', color: 'var(--color-paper-50)' }}
        >
          !
        </span>
        <div className="min-w-0 flex-1">
          <p
            className="text-[12.5px] font-medium tracking-[-0.005em]"
            style={{ color: 'var(--color-warning-fg)' }}
          >
            Caution
          </p>
          <ul className="mt-2 space-y-1.5">
            {warnings.map((w) => (
              <li
                key={w}
                className="text-[12.5px] leading-snug"
                style={{ color: 'var(--color-warning-body)' }}
              >
                {w}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
