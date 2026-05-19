// Tiny display helpers shared across results + dashboard.

import type { OrganismSpecies, PartialAssessmentResult, RiskScore } from '@torch/core-shared';

const SPECIES_LABELS: Record<OrganismSpecies, string> = {
  e_coli:           'E. coli',
  b_subtilis:       'B. subtilis',
  s_cerevisiae:     'S. cerevisiae',
  p_pastoris:       'P. pastoris',
  other_bacteria:   'Other bacterium',
  other_yeast:      'Other yeast',
};

export function speciesLabel(species: OrganismSpecies): string {
  return SPECIES_LABELS[species] ?? species;
}

const RISK_RANK: Record<RiskScore, number> = { low: 0, moderate: 1, high: 2, critical: 3 };

export function worstScore(r: PartialAssessmentResult): RiskScore {
  const scores: RiskScore[] = [
    r.otr.score,
    r.mixing.score,
    r.shear.score,
    r.co2.score,
    r.heat.score,
  ];
  return scores.reduce<RiskScore>((acc, s) => (RISK_RANK[s] > RISK_RANK[acc] ? s : acc), 'low');
}

const RELATIVE = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const diffSec = Math.round((then - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 60)              return RELATIVE.format(Math.round(diffSec), 'second');
  if (abs < 3600)            return RELATIVE.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86_400)          return RELATIVE.format(Math.round(diffSec / 3600), 'hour');
  if (abs < 604_800)         return RELATIVE.format(Math.round(diffSec / 86_400), 'day');
  if (abs < 2_592_000)       return RELATIVE.format(Math.round(diffSec / 604_800), 'week');
  if (abs < 31_536_000)      return RELATIVE.format(Math.round(diffSec / 2_592_000), 'month');
  return RELATIVE.format(Math.round(diffSec / 31_536_000), 'year');
}
