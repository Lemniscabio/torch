// Risk-category visual tokens. Centralised so DomainCard, DomainDetail, Radar,
// and ProjectionsTable all map the same way. Distances are the standard
// 15/40/70/95 of-100 anchors the old dashboard used for the radar polygon
// (low = small/inner, critical = large/outer).

import type { RiskScore } from '@torch/core-shared';

export const RISK_LABEL: Record<RiskScore, string> = {
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
  critical: 'Critical',
};

export const RISK_COLOR: Record<RiskScore, { fg: string; bg: string; ring: string }> = {
  low:      { fg: 'var(--color-ink-400)', bg: 'var(--color-paper-100)', ring: 'var(--color-rule)' },
  moderate: { fg: 'var(--color-ink-500)', bg: 'var(--color-paper-200)', ring: 'var(--color-rule-strong)' },
  high:     { fg: 'var(--color-ink-700)', bg: 'var(--color-paper-200)', ring: 'var(--color-ink-300)' },
  critical: { fg: 'var(--color-ink-900)', bg: 'var(--color-accent-muted)', ring: 'var(--color-accent-ring)' },
};

export const RISK_DISTANCE: Record<RiskScore, number> = {
  low: 0.15,
  moderate: 0.40,
  high: 0.70,
  critical: 0.95,
};

export const DOMAIN_ORDER = [
  { key: 'mixing' as const, label: 'Mixing',          letter: 'M' },
  { key: 'otr'    as const, label: 'Oxygen Transfer', letter: 'O' },
  { key: 'shear'  as const, label: 'Shear Stress',    letter: 'S' },
  { key: 'co2'    as const, label: 'CO₂',             letter: 'C' },
  { key: 'heat'   as const, label: 'Heat Removal',    letter: 'H' },
];

export type DomainKey = (typeof DOMAIN_ORDER)[number]['key'];
