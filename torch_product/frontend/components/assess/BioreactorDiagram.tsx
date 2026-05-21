'use client';

// Pure SVG bioreactor — vessel walls, motor, shaft, impellers, sparger,
// liquid fill at 70%. Ported from old/frontend/src/components/BioreactorDiagram.tsx
// with the colour tokens swapped to torch_product's monochrome palette. The
// liquid tint stays monochrome so the diagram does not introduce a second
// product palette.
//
// In `animated` mode the impellers spin (CSS perspective + rotateY) and
// bubbles rise from sparger to liquid surface.

import type { ImpellerType } from '@torch/core-shared';

type Props = {
  hd?: number;          // H/D ratio (0.5 – 4.5), clamped
  dtRatio?: number;     // d/T ratio (0.1 – 0.8), clamped
  nImpellers?: number;  // 1 – 4, clamped
  impellerType?: ImpellerType;
  volume?: number;      // L, rendered as label below vessel
  width?: number;
  animated?: boolean;
};

const INK = 'var(--color-ink-900)';
const ACCENT = 'var(--color-accent)';
const TERTIARY = 'var(--color-ink-400)';

function renderImpeller(
  type: ImpellerType | string,
  cx: number,
  cy: number,
  half: number,
  animated: boolean,
  index: number,
) {
  const wrap = (children: React.ReactNode) => {
    if (!animated) return <g key={`imp-${index}`}>{children}</g>;
    return (
      <g
        key={`imp-${index}`}
        style={{
          transformBox: 'fill-box',
          transformOrigin: 'center',
          animation: 'bioreactor-spin 2s linear infinite',
        }}
      >
        {children}
      </g>
    );
  };

  switch (type) {
    case 'rushton': {
      const bladeH = Math.max(6, half * 0.28);
      const bladeW = Math.max(8, half * 0.38);
      const leftInner  = cx - half * 0.95 + bladeW;
      const rightInner = cx + half * 0.95 - bladeW;
      return wrap(
        <>
          <circle cx={cx} cy={cy} r={half * 0.18} fill="none" stroke={INK} strokeWidth="1.2" />
          <rect x={cx - half * 0.95}        y={cy - bladeH / 2} width={bladeW} height={bladeH} rx="1" fill="none" stroke={INK} strokeWidth="1.1" />
          <rect x={cx + half * 0.95 - bladeW} y={cy - bladeH / 2} width={bladeW} height={bladeH} rx="1" fill="none" stroke={INK} strokeWidth="1.1" />
          <line x1={leftInner} y1={cy} x2={rightInner} y2={cy} stroke={INK} strokeWidth="1.1" strokeLinecap="round" />
        </>,
      );
    }
    case 'pitched_blade': {
      const tilt = half * 0.35;
      return wrap(
        <>
          <line x1={cx - half * 0.9} y1={cy - tilt * 0.5} x2={cx - half * 0.15} y2={cy + tilt * 0.5} stroke={INK} strokeWidth="2" strokeLinecap="round" />
          <line x1={cx + half * 0.15} y1={cy + tilt * 0.5} x2={cx + half * 0.9}  y2={cy - tilt * 0.5} stroke={INK} strokeWidth="2" strokeLinecap="round" />
          <circle cx={cx} cy={cy} r={2.5} fill={INK} />
        </>,
      );
    }
    case 'marine': {
      return wrap(
        <>
          <ellipse cx={cx - half * 0.48} cy={cy} rx={half * 0.38} ry={half * 0.14}
            fill="none" stroke={INK} strokeWidth="1.2"
            transform={`rotate(-25 ${cx - half * 0.48} ${cy})`} />
          <ellipse cx={cx + half * 0.48} cy={cy} rx={half * 0.38} ry={half * 0.14}
            fill="none" stroke={INK} strokeWidth="1.2"
            transform={`rotate(25 ${cx + half * 0.48} ${cy})`} />
          <circle cx={cx} cy={cy} r={2.5} fill={INK} />
        </>,
      );
    }
    default: {
      return wrap(
        <>
          <line x1={cx - half * 0.9} y1={cy} x2={cx + half * 0.9} y2={cy} stroke={INK} strokeWidth="2" strokeLinecap="round" />
          <circle cx={cx} cy={cy} r={2.5} fill={INK} />
        </>,
      );
    }
  }
}

export function BioreactorDiagram({
  hd = 2.0,
  dtRatio = 0.33,
  nImpellers = 1,
  impellerType = 'rushton',
  volume,
  width = 180,
  animated = false,
}: Props) {
  const hdClamped = Math.max(0.5, Math.min(4.5, hd));
  const dtClamped = Math.max(0.1, Math.min(0.8, dtRatio));

  const tankD = 80;
  const tankH = tankD * hdClamped;
  const pad = 28;
  const svgW = tankD + pad * 2;
  const svgH = tankH + pad * 2 + 18;
  const scaleFactor = width / svgW;
  const renderedHeight = svgH * scaleFactor;

  const wallL = pad;
  const wallR = pad + tankD;
  const wallTop = pad + 14;
  const wallBottom = pad + 14 + tankH;
  const cx = svgW / 2;
  const cornerR = 8;

  const fillRatio = 0.70;
  const liquidTop = wallBottom - tankH * fillRatio;

  const impellerHalf = (tankD * dtClamped) / 2;
  const baseImpellerHalf = (tankD * 0.33) / 2;
  const impellerScale = impellerHalf / baseImpellerHalf;

  const nClamped = Math.max(1, Math.min(4, nImpellers));
  const impellerYs: number[] = [];
  if (nClamped === 1) {
    impellerYs.push(wallBottom - tankH * 0.30);
  } else {
    const liquidH = wallBottom - liquidTop;
    const spacing = liquidH / (nClamped + 1);
    for (let i = 1; i <= nClamped; i++) {
      impellerYs.push(liquidTop + spacing * i);
    }
  }
  const shaftBottom = impellerYs[impellerYs.length - 1];

  const bubbles = [
    { bx: cx - 18, r: 2.5, dur: '1.4s', delay: '0s' },
    { bx: cx + 12, r: 1.8, dur: '1.7s', delay: '0.3s' },
    { bx: cx - 8,  r: 2.0, dur: '2.0s', delay: '0.6s' },
    { bx: cx + 22, r: 1.5, dur: '1.5s', delay: '0.9s' },
    { bx: cx + 5,  r: 2.2, dur: '1.8s', delay: '0.2s' },
    { bx: cx - 25, r: 1.6, dur: '1.6s', delay: '0.5s' },
  ];

  // The clip path id needs to be unique per instance — otherwise two
  // diagrams on the same page (lab + target in LivePreview) share the
  // same clip and both shrink to the smaller liquid box.
  const clipId = `vessel-clip-${Math.round(tankH)}-${Math.round(impellerHalf)}-${nClamped}`;

  return (
    <div className="flex flex-col items-center">
      {animated ? (
        <style>{`
          @keyframes bioreactor-spin {
            from { transform: perspective(140px) rotateY(0deg); }
            to   { transform: perspective(140px) rotateY(360deg); }
          }
          @media (prefers-reduced-motion: reduce) {
            g[style*="bioreactor-spin"] { animation: none !important; }
          }
        `}</style>
      ) : null}

      <div style={{ height: renderedHeight, transition: 'height 500ms ease' }}>
        <svg
          width={width}
          height={renderedHeight}
          viewBox={`0 0 ${svgW} ${svgH}`}
          style={{ overflow: 'visible' }}
        >
          <defs>
            <clipPath id={clipId}>
              <path d={`
                M ${wallL + 1} ${wallTop}
                L ${wallL + 1} ${wallBottom}
                Q ${wallL + 1} ${wallBottom + cornerR + 2} ${wallL + cornerR + 2} ${wallBottom + cornerR + 2}
                L ${wallR - cornerR - 2} ${wallBottom + cornerR + 2}
                Q ${wallR - 1} ${wallBottom + cornerR + 2} ${wallR - 1} ${wallBottom}
                L ${wallR - 1} ${wallTop}
                Z
              `} />
            </clipPath>
          </defs>

          {/* Liquid fill */}
          <rect
            x={wallL + 1}
            y={liquidTop}
            width={tankD - 2}
            height={wallBottom - liquidTop}
            fill="var(--color-accent-muted)"
            clipPath={`url(#${clipId})`}
            className="transition-all duration-500"
          />

          {/* Liquid surface dashed line */}
          <line
            x1={wallL + 3} y1={liquidTop} x2={wallR - 3} y2={liquidTop}
            stroke={ACCENT} strokeWidth="0.8" strokeDasharray="4 3" opacity="0.55"
            className="transition-all duration-500"
          />

          {/* Vessel walls */}
          <path
            d={`
              M ${wallL} ${wallTop}
              L ${wallL} ${wallBottom}
              Q ${wallL} ${wallBottom + cornerR * 2} ${wallL + cornerR * 2} ${wallBottom + cornerR * 2}
              L ${wallR - cornerR * 2} ${wallBottom + cornerR * 2}
              Q ${wallR} ${wallBottom + cornerR * 2} ${wallR} ${wallBottom}
              L ${wallR} ${wallTop}
            `}
            fill="none" stroke={INK} strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round" opacity="0.55"
            className="transition-all duration-500"
          />

          {/* Top flanges */}
          <line x1={wallL - 4} y1={wallTop} x2={wallL + 10} y2={wallTop} stroke={INK} strokeWidth="1.5" strokeLinecap="round" opacity="0.55" />
          <line x1={wallR - 10} y1={wallTop} x2={wallR + 4} y2={wallTop} stroke={INK} strokeWidth="1.5" strokeLinecap="round" opacity="0.55" />

          {/* Motor */}
          <rect x={cx - 7} y={wallTop - 16} width={14} height={10} rx="2" fill="none" stroke={INK} strokeWidth="1.2" opacity="0.5" />

          {/* Shaft */}
          <line x1={cx} y1={wallTop - 6} x2={cx} y2={shaftBottom} stroke={INK} strokeWidth="1.4" opacity="0.6" />

          {/* Impellers */}
          {impellerYs.map((y, i) => (
            <g key={i} transform={`translate(0 ${y})`}>
              <g
                transform={`translate(${cx} 0) scale(${impellerScale}) translate(${-cx} 0)`}
                style={{ transition: 'transform 500ms ease' }}
              >
                {renderImpeller(impellerType, cx, 0, baseImpellerHalf, animated, i)}
              </g>
            </g>
          ))}

          {/* Bubbles (animated only) */}
          {animated
            ? bubbles.map((b, i) => (
                <circle key={`bubble-${i}`} cx={b.bx} r={b.r} fill={ACCENT} opacity="0">
                  <animate
                    attributeName="cy"
                    values={`${wallBottom - 10};${liquidTop + 5}`}
                    dur={b.dur}
                    repeatCount="indefinite"
                    begin={b.delay}
                  />
                  <animate
                    attributeName="opacity"
                    values="0.35;0.5;0"
                    dur={b.dur}
                    repeatCount="indefinite"
                    begin={b.delay}
                  />
                </circle>
              ))
            : null}

          {/* Sparger ring */}
          <ellipse
            cx={cx} cy={wallBottom - 6} rx={tankD * 0.22} ry={3}
            fill="none" stroke={INK} strokeWidth="0.9" strokeDasharray="2 2" opacity="0.3"
          />
          <line x1={cx} y1={wallBottom - 3} x2={cx} y2={wallBottom + cornerR * 2} stroke={INK} strokeWidth="0.9" opacity="0.25" />

          {/* H/D annotation */}
          <text
            x={wallR + 10} y={wallTop + tankH / 2}
            fill={TERTIARY} fontSize="7.5" fontFamily="ui-monospace, monospace"
            dominantBaseline="middle" opacity="0.7"
          >
            H/D {hdClamped.toFixed(1)}
          </text>

          {/* Volume */}
          {volume !== undefined ? (
            <text
              x={cx} y={wallBottom + cornerR * 2 + 12}
              fill={TERTIARY} fontSize="7.5" fontFamily="ui-monospace, monospace"
              textAnchor="middle" opacity="0.6"
            >
              {volume >= 1000 ? `${(volume / 1000).toFixed(0)} m³` : `${volume} L`}
            </text>
          ) : null}
        </svg>
      </div>
    </div>
  );
}
