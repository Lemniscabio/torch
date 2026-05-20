'use client';

// One of five cards on the results dashboard. Shows the domain letter +
// label + headline metric + risk badge. Clicking selects it; the parent
// renders DomainDetail for the selected card below the row.

import type { RiskScore } from '@torch/core-shared';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { RISK_COLOR, RISK_LABEL, type DomainKey } from './riskTokens';

type Props = {
  domainKey: DomainKey;
  letter: string;
  label: string;
  score: RiskScore;
  metric: string;
  selected: boolean;
  onSelect: (k: DomainKey) => void;
};

export function DomainCard({ domainKey, letter, label, score, metric, selected, onSelect }: Props) {
  const c = RISK_COLOR[score];
  return (
    <button
      type="button"
      onClick={() => onSelect(domainKey)}
      aria-pressed={selected}
      className="group relative min-h-[132px] rounded-lg border p-4 text-left transition-all"
      style={{
        background: selected ? c.bg : 'var(--color-paper-100)',
        borderColor: selected ? c.ring : 'var(--color-rule)',
        boxShadow: selected ? `0 14px 34px -28px ${c.fg}` : '0 10px 24px -24px rgba(0,0,0,0.35)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className="grid h-7 w-7 place-items-center rounded-md text-[13px] font-semibold"
          style={{ background: c.bg, color: c.fg }}
        >
          {letter}
        </span>
        <span
          className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium"
          style={{ background: c.bg, color: c.fg }}
        >
          {RISK_LABEL[score]}
        </span>
      </div>
      <p
        className="mt-3 text-[13px] font-semibold tracking-[-0.005em]"
        style={{ color: 'var(--color-ink-900)' }}
      >
        {label}
      </p>
      <p
        className="mt-3 text-[12px] tabular-nums leading-relaxed"
        style={{ color: 'var(--color-ink-500)' }}
      >
        {metric}
      </p>
      <span
        aria-hidden
        className="absolute bottom-3 right-3 grid h-5 w-5 place-items-center rounded-full text-[11px]"
        style={{ background: 'var(--color-paper-200)', color: 'var(--color-ink-500)' }}
      >
        {selected ? <ChevronUp size={12} strokeWidth={2} /> : <ChevronDown size={12} strokeWidth={2} />}
      </span>
    </button>
  );
}
