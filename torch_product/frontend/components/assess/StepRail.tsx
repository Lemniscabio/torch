'use client';

import Link from 'next/link';
import { STEPS, type StepSlug, stepIndex } from '@/lib/assess-schema';

export function StepRail({ current }: { current: StepSlug }) {
  const currentIdx = stepIndex(current);

  return (
    <nav aria-label="Assessment steps" className="flex flex-col gap-0.5 text-[13px]">
      <p className="text-label mb-4">Steps</p>
      {STEPS.map((s, i) => {
        const active = i === currentIdx;
        const navigable = i < currentIdx;
        const muted = i > currentIdx;

        const content = (
          <span className="flex items-center gap-3">
            <span
              aria-hidden
              className="h-px transition-all"
              style={{
                width: active ? '16px' : '8px',
                background: active
                  ? 'var(--color-accent)'
                  : navigable
                  ? 'var(--color-ink-300)'
                  : 'var(--color-ink-200)',
              }}
            />
            <span style={{ fontWeight: active ? 500 : 400 }}>{s.label}</span>
          </span>
        );

        if (navigable) {
          return (
            <Link
              key={s.slug}
              href={`/assess?step=${s.slug}`}
              className="rounded-md py-1.5 transition-colors hover:text-[color:var(--color-ink-800)]"
              style={{ color: 'var(--color-ink-500)' }}
            >
              {content}
            </Link>
          );
        }
        return (
          <div
            key={s.slug}
            className="py-1.5"
            style={{
              color: active
                ? 'var(--color-ink-900)'
                : muted
                ? 'var(--color-ink-300)'
                : 'var(--color-ink-500)',
            }}
            aria-current={active ? 'step' : undefined}
          >
            {content}
          </div>
        );
      })}
    </nav>
  );
}
