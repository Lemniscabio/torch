'use client';

// Pure SVG radar plot. Five axes (M / O / S / C / H), four rings (Low /
// Moderate / High / Critical from inner to outer). The polygon connects
// the per-domain RiskScore mapped through RISK_DISTANCE. Inner = good,
// outer = bad.
//
// Renders identically in lab and target views — caller passes the score
// quintuplet and the title.

import type { RiskScore } from '@torch/core-shared';
import { DOMAIN_ORDER, RISK_DISTANCE, RISK_COLOR, type DomainKey } from './riskTokens';

type Props = {
  title: string;
  scores: Record<DomainKey, RiskScore>;
};

const SIZE = 300;
const CENTER = SIZE / 2;
const RADIUS = 96;
const N = DOMAIN_ORDER.length;

// Start at top (-90°) and go clockwise so the layout reads M → O → S → C → H.
function pointAt(index: number, distance: number) {
  const angle = (-Math.PI / 2) + (2 * Math.PI * index) / N;
  return {
    x: CENTER + Math.cos(angle) * RADIUS * distance,
    y: CENTER + Math.sin(angle) * RADIUS * distance,
  };
}

function ringPoints(distance: number) {
  return Array.from({ length: N }, (_, i) => pointAt(i, distance))
    .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');
}

const RINGS: { dist: number; label: string }[] = [
  { dist: 0.15, label: 'Low' },
  { dist: 0.40, label: 'Moderate' },
  { dist: 0.70, label: 'High' },
  { dist: 0.95, label: 'Critical' },
];

export function Radar({ title, scores }: Props) {
  const polygonPoints = DOMAIN_ORDER.map((d, i) =>
    pointAt(i, RISK_DISTANCE[scores[d.key]]),
  )
    .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');

  // Worst score → use that ramp colour for the polygon fill, so the radar
  // immediately signals severity at a glance.
  const worst = DOMAIN_ORDER.reduce<RiskScore>((acc, d) => {
    const s = scores[d.key];
    const rank: Record<RiskScore, number> = { low: 0, moderate: 1, high: 2, critical: 3 };
    return rank[s] > rank[acc] ? s : acc;
  }, 'low');
  const polygonColor = RISK_COLOR[worst];

  return (
    <div
      className="flex w-full max-w-[390px] flex-col items-center rounded-lg border px-5 py-5 shadow-[0_18px_45px_-34px_rgba(0,0,0,0.35)]"
      style={{ borderColor: 'var(--color-rule)', background: 'var(--color-paper-50)' }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--color-ink-400)' }}>
        {title}
      </p>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="mt-2 h-[300px] w-[300px]"
        role="img"
        aria-label={`${title}: risk profile across five domains`}
      >
        {/* Rings */}
        {RINGS.map((r) => (
          <polygon
            key={r.dist}
            points={ringPoints(r.dist)}
            fill={RISK_COLOR[r.label.toLowerCase() as RiskScore].bg}
            stroke="var(--color-rule-strong)"
            strokeWidth="1"
          />
        ))}

        {/* Axes */}
        {DOMAIN_ORDER.map((_, i) => {
          const tip = pointAt(i, 0.98);
          return (
            <line
              key={i}
              x1={CENTER}
              y1={CENTER}
              x2={tip.x}
              y2={tip.y}
              stroke="var(--color-rule)"
              strokeWidth="1"
            />
          );
        })}

        {/* Risk polygon */}
        <polygon
          points={polygonPoints}
          fill={polygonColor.bg}
          stroke={polygonColor.fg}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        {/* Domain markers */}
        {DOMAIN_ORDER.map((d, i) => {
          const at = pointAt(i, RISK_DISTANCE[scores[d.key]]);
          const c = RISK_COLOR[scores[d.key]];
          return (
            <circle
              key={d.key}
              cx={at.x}
              cy={at.y}
              r="4"
              fill={c.fg}
              stroke="var(--color-paper-50)"
              strokeWidth="1"
            />
          );
        })}

        {/* Axis labels */}
        {DOMAIN_ORDER.map((d, i) => {
          const at = pointAt(i, 1.18);
          const score = scores[d.key];
          const c = RISK_COLOR[score];
          return (
            <g key={d.key}>
              <text
                x={at.x}
                y={at.y - 7}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="10"
                fontWeight={600}
                fill="var(--color-ink-500)"
              >
                {d.label === 'Oxygen Transfer' ? 'OTR' : d.label.replace(' Removal', '').replace(' Stress', '')}
              </text>
              <text
                x={at.x}
                y={at.y + 8}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="9"
                fontWeight={600}
                fill={c.fg}
              >
                [{score.charAt(0).toUpperCase() + score.slice(1)}]
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-[10px]" style={{ color: 'var(--color-ink-400)' }}>
        Outer ring: critical risk. Inner ring: low risk.
      </p>
    </div>
  );
}
