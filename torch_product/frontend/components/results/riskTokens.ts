// Risk-category visual tokens. Centralised so DomainCard, DomainDetail, Radar,
// and ProjectionsTable all map the same way. Distances are the standard
// 15/40/70/95 of-100 anchors the old dashboard used for the radar polygon
// (low = small/inner, critical = large/outer).

import type { RiskScore } from '@torch/core';

export const RISK_LABEL: Record<RiskScore, string> = {
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
  critical: 'Critical',
};

export const RISK_COLOR: Record<RiskScore, { fg: string; bg: string; ring: string }> = {
  low:      { fg: '#059669', bg: 'rgba(5,150,105,0.10)',   ring: 'rgba(5,150,105,0.35)' },
  moderate: { fg: '#b45309', bg: 'rgba(251,191,36,0.12)',  ring: 'rgba(180,83,9,0.32)' },
  high:     { fg: '#c2410c', bg: 'rgba(251,146,60,0.12)',  ring: 'rgba(194,65,12,0.32)' },
  critical: { fg: '#dc2626', bg: 'rgba(248,113,113,0.12)', ring: 'rgba(220,38,38,0.38)' },
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
