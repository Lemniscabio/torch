'use client';

// Collapsible table showing every key derived quantity at lab vs target.
// Pilot interpolation is a follow-up — the v1 shape stays at two columns
// because the engine output gives us lab and target directly.

import { useState } from 'react';
import {
  buildReactorScaleConfigs,
  type PartialAssessmentResult,
  type ProcessInputs,
} from '@torch/core';

type Props = {
  inputs: ProcessInputs;
  results: PartialAssessmentResult;
};

type Row = { label: string; lab: string; pilot: string; target: string };

function fmt(n: number | undefined, digits = 2) {
  if (n === undefined || !Number.isFinite(n)) return '—';
  return n.toFixed(digits);
}

function midNumber(lab: number | undefined, target: number | undefined): number | undefined {
  if (lab === undefined || target === undefined) return undefined;
  if (!Number.isFinite(lab) || !Number.isFinite(target)) return undefined;
  if (lab > 0 && target > 0) return Math.sqrt(lab * target);
  return (lab + target) / 2;
}

function rows(inputs: ProcessInputs, r: PartialAssessmentResult): Row[] {
  const configs = buildReactorScaleConfigs(inputs, {
    method: inputs.scaleup_criterion ?? 'power_per_volume',
  });
  const pilotVolume = Math.sqrt(inputs.v_lab * inputs.v_target);
  const labAeration = inputs.vvm * inputs.v_lab;
  const targetAeration = configs.target.vvm * inputs.v_target;
  const labPco2 = r.co2.activated ? r.co2.lab?.pco2_bottom : undefined;
  const targetPco2 = r.co2.activated ? r.co2.target?.pco2_bottom ?? r.co2.pco2_bottom : undefined;

  return [
    {
      label: 'Impeller RPM (rpm)',
      lab: fmt(configs.lab.rpm, 0),
      pilot: fmt(midNumber(configs.lab.rpm, configs.target.rpm), 0),
      target: fmt(configs.target.rpm, 0),
    },
    {
      label: 'Aeration rate (L/min, vvm)',
      lab: `${fmt(labAeration, 2)} (${fmt(inputs.vvm, 2)})`,
      pilot: `${fmt(midNumber(labAeration, targetAeration), 2)} (${fmt(midNumber(inputs.vvm, configs.target.vvm), 2)})`,
      target: `${fmt(targetAeration, 2)} (${fmt(configs.target.vvm, 2)})`,
    },
    {
      label: 'Impeller diameter (m)',
      lab: fmt(configs.lab.geometry.d_imp, 2),
      pilot: fmt(midNumber(configs.lab.geometry.d_imp, configs.target.geometry.d_imp), 2),
      target: fmt(configs.target.geometry.d_imp, 2),
    },
    {
      label: 'Reactor height (m)',
      lab: fmt(configs.lab.geometry.h_liquid, 2),
      pilot: fmt(midNumber(configs.lab.geometry.h_liquid, configs.target.geometry.h_liquid), 2),
      target: fmt(configs.target.geometry.h_liquid, 2),
    },
    {
      label: 'kLa achievable (h⁻¹)',
      lab: fmt(r.otr.kla_lab, 1),
      pilot: fmt(midNumber(r.otr.kla_lab, r.otr.kla_target_moderate), 1),
      target: fmt(r.otr.kla_target_moderate, 1),
    },
    {
      label: 'Mixing time (s)',
      lab: fmt(r.mixing.theta_mix_lab, 1),
      pilot: fmt(midNumber(r.mixing.theta_mix_lab, r.mixing.theta_mix_target), 1),
      target: fmt(r.mixing.theta_mix_target, 1),
    },
    {
      label: 'Tip speed (m/s)',
      lab: fmt(r.shear.tip_speed_lab, 2),
      pilot: fmt(midNumber(r.shear.tip_speed_lab, r.shear.tip_speed), 2),
      target: fmt(r.shear.tip_speed, 2),
    },
    {
      label: 'pCO₂ at bottom (bar)',
      lab: fmt(labPco2, 2),
      pilot: fmt(midNumber(labPco2, targetPco2), 2),
      target: fmt(targetPco2, 2),
    },
    {
      label: 'Metabolic heat (kW)',
      lab: fmt(r.heat.lab?.q_metabolic, 2),
      pilot: fmt(midNumber(r.heat.lab?.q_metabolic, r.heat.target?.q_metabolic ?? r.heat.q_metabolic), 2),
      target: fmt(r.heat.target?.q_metabolic ?? r.heat.q_metabolic, 2),
    },
    {
      label: 'Cooling capacity (kW)',
      lab: fmt(r.heat.lab?.q_cool_max, 2),
      pilot: fmt(midNumber(r.heat.lab?.q_cool_max, r.heat.target?.q_cool_max ?? r.heat.q_cool_max), 2),
      target: fmt(r.heat.target?.q_cool_max ?? r.heat.q_cool_max, 2),
    },
  ];
}

export function ProjectionsTable({ inputs, results }: Props) {
  const [open, setOpen] = useState(true);
  const data = rows(inputs, results);
  const pilotVolume = Math.sqrt(inputs.v_lab * inputs.v_target);

  return (
    <section
      className="mt-8 rounded-lg border shadow-[0_12px_30px_-26px_rgba(0,0,0,0.35)]"
      style={{ borderColor: 'var(--color-rule)', background: 'var(--color-paper-100)' }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-5 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-[15px]" style={{ color: 'var(--color-ink-500)' }}>≡</span>
          <p className="text-[13px] font-semibold" style={{ color: 'var(--color-ink-800)' }}>Scale-Up Projections</p>
          <span className="text-[11px]" style={{ color: 'var(--color-ink-400)' }}>Lab → Pilot → Production</span>
        </div>
        <span
          aria-hidden
          className="text-[20px] leading-none"
          style={{
            color: 'var(--color-ink-500)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 200ms ease',
          }}
        >
          ⌄
        </span>
      </button>

      {open ? (
        <div className="border-t px-6 py-6" style={{ borderColor: 'var(--color-rule)' }}>
          <table className="w-full text-[12px] tabular-nums">
            <thead>
              <tr
                className="text-[10px] font-semibold uppercase tracking-[0.14em]"
                style={{ borderBottom: '1px solid var(--color-rule)', color: 'var(--color-ink-400)' }}
              >
                <th className="py-2 text-left font-medium">Quantity</th>
                <th className="py-2 text-right font-medium">{`Lab (${fmt(inputs.v_lab, 0)} L)`}</th>
                <th className="py-2 text-right font-medium">{`Pilot (${fmt(pilotVolume, 0)} L)`}</th>
                <th className="py-2 text-right font-medium">{`Production (${fmt(inputs.v_target, 0)} L)`}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr
                  key={row.label}
                  style={{ borderBottom: '1px solid var(--color-rule)' }}
                >
                  <td className="py-3 pr-4" style={{ color: 'var(--color-ink-500)' }}>
                    {row.label}
                  </td>
                  <td className="py-3 text-right font-mono" style={{ color: 'var(--color-ink-900)' }}>
                    {row.lab}
                  </td>
                  <td className="py-3 text-right font-mono" style={{ color: 'var(--color-ink-900)' }}>
                    {row.pilot}
                  </td>
                  <td className="py-3 text-right font-mono" style={{ color: 'var(--color-ink-900)' }}>
                    {row.target}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
