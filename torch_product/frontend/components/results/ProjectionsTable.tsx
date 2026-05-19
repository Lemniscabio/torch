'use client';

// Collapsible table showing every key derived quantity at lab vs target.
// Pilot interpolation is a follow-up — the v1 shape stays at two columns
// because the engine output gives us lab and target directly.

import { useState } from 'react';
import type {
  PartialAssessmentResult,
  ProcessInputs,
  ReactorScaleConfigs,
} from '@torch/core-shared';

type Props = {
  inputs: ProcessInputs;
  results: PartialAssessmentResult;
};

type Row = { label: string; lab: string; pilot: string; target: string };

function fmt(n: number | undefined, digits = 2) {
  if (n === undefined || !Number.isFinite(n)) return '—';
  return n.toFixed(digits);
}

// Adaptive precision: integers for big values, gradual decimals for small
// ones. Used across the Scale-Up Projections rows so we don't show
// "33.00 (1.00)" when "33 (1.0)" is more readable, and avoid losing
// precision on sub-unit values like impeller diameter 0.11 m.
function fmtAuto(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 100) return Math.round(n).toLocaleString('en-US');
  if (abs >= 10)  return Math.round(n).toString();
  if (abs >= 1)   return n.toFixed(1);
  return n.toFixed(2);
}

function rangeAuto(lo: number | undefined, hi: number | undefined): string {
  if (lo === undefined || hi === undefined) return '—';
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return '—';
  // Collapse if both end up rendering identically.
  const loStr = fmtAuto(lo);
  const hiStr = fmtAuto(hi);
  if (loStr === hiStr) return loStr;
  return `${loStr} – ${hiStr}`;
}

function midNumber(lab: number | undefined, target: number | undefined): number | undefined {
  if (lab === undefined || target === undefined) return undefined;
  if (!Number.isFinite(lab) || !Number.isFinite(target)) return undefined;
  if (lab > 0 && target > 0) return Math.sqrt(lab * target);
  return (lab + target) / 2;
}


function rows(inputs: ProcessInputs, r: PartialAssessmentResult): Row[] {
  const configs: ReactorScaleConfigs | undefined = r.reactor_configs;
  if (!configs) return [];
  const pilotVolume = Math.sqrt(inputs.v_lab * inputs.v_target);
  const labAeration = inputs.vvm * inputs.v_lab;
  const targetAeration = configs.target.vvm * inputs.v_target;
  const labPco2 = r.co2.activated ? r.co2.lab?.pco2_bottom : undefined;
  const targetPco2 = r.co2.activated ? r.co2.target?.pco2_bottom ?? r.co2.pco2_bottom : undefined;

  return [
    {
      label: 'Impeller RPM (rpm)',
      lab: fmtAuto(configs.lab.rpm),
      pilot: fmtAuto(midNumber(configs.lab.rpm, configs.target.rpm)),
      target: fmtAuto(configs.target.rpm),
    },
    {
      label: 'Aeration rate (L/min, vvm)',
      lab: `${fmtAuto(labAeration)} (${fmtAuto(inputs.vvm)})`,
      pilot: `${fmtAuto(midNumber(labAeration, targetAeration))} (${fmtAuto(midNumber(inputs.vvm, configs.target.vvm))})`,
      target: `${fmtAuto(targetAeration)} (${fmtAuto(configs.target.vvm)})`,
    },
    {
      label: 'Impeller diameter (m)',
      lab: fmtAuto(configs.lab.geometry.d_imp),
      pilot: fmtAuto(midNumber(configs.lab.geometry.d_imp, configs.target.geometry.d_imp)),
      target: fmtAuto(configs.target.geometry.d_imp),
    },
    {
      label: 'Reactor height (m)',
      lab: fmtAuto(configs.lab.geometry.h_liquid),
      pilot: fmtAuto(midNumber(configs.lab.geometry.h_liquid, configs.target.geometry.h_liquid)),
      target: fmtAuto(configs.target.geometry.h_liquid),
    },
    (() => {
      // kLa: use real ensemble min/max from reactor_configs (engine truth —
      // spans Van't Riet, Ruszkowski, etc.).
      const labLo = configs.lab.kla_ensemble.min;
      const labHi = configs.lab.kla_ensemble.max;
      const targetLo = configs.target.kla_ensemble.min;
      const targetHi = configs.target.kla_ensemble.max;
      return {
        label: 'kLa achievable (h⁻¹)',
        lab:    rangeAuto(labLo, labHi),
        pilot:  rangeAuto(midNumber(labLo, targetLo), midNumber(labHi, targetHi)),
        target: rangeAuto(targetLo, targetHi),
      };
    })(),
    (() => {
      // Mixing time: real ensemble min/max from the engine (Grenville-Nienow
      // + Ruszkowski correlations). Falls back to mean if min/max absent.
      const labLo    = r.mixing.theta_mix_lab_min    ?? r.mixing.theta_mix_lab;
      const labHi    = r.mixing.theta_mix_lab_max    ?? r.mixing.theta_mix_lab;
      const targetLo = r.mixing.theta_mix_target_min ?? r.mixing.theta_mix_target;
      const targetHi = r.mixing.theta_mix_target_max ?? r.mixing.theta_mix_target;
      return {
        label: 'Mixing time (s)',
        lab:    rangeAuto(labLo,    labHi),
        pilot:  rangeAuto(midNumber(labLo, targetLo), midNumber(labHi, targetHi)),
        target: rangeAuto(targetLo, targetHi),
      };
    })(),
    {
      label: 'Tip speed (m/s)',
      lab: fmtAuto(r.shear.tip_speed_lab),
      pilot: fmtAuto(midNumber(r.shear.tip_speed_lab, r.shear.tip_speed)),
      target: fmtAuto(r.shear.tip_speed),
    },
    {
      label: 'pCO₂ at bottom (bar)',
      lab: fmtAuto(labPco2),
      pilot: fmtAuto(midNumber(labPco2, targetPco2)),
      target: fmtAuto(targetPco2),
    },
    {
      label: 'Metabolic heat (kW)',
      lab: fmtAuto(r.heat.lab?.q_metabolic),
      pilot: fmtAuto(midNumber(r.heat.lab?.q_metabolic, r.heat.target?.q_metabolic ?? r.heat.q_metabolic)),
      target: fmtAuto(r.heat.target?.q_metabolic ?? r.heat.q_metabolic),
    },
    {
      label: 'Cooling capacity (kW)',
      lab: fmtAuto(r.heat.lab?.q_cool_max),
      pilot: fmtAuto(midNumber(r.heat.lab?.q_cool_max, r.heat.target?.q_cool_max ?? r.heat.q_cool_max)),
      target: fmtAuto(r.heat.target?.q_cool_max ?? r.heat.q_cool_max),
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
