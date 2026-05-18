'use client';

// Wizard layout. Two-column on xl+: wide main form and a live bioreactor
// preview. The step rail was removed so the form fits in the viewport.
// Below lg the preview is hidden because the diagrams aren't the primary
// way to consume the form on a tablet.

import type { ReactNode } from 'react';
import { STEPS, type StepSlug, stepIndex } from '@/lib/assess-schema';
import { LivePreview } from './LivePreview';
import { SoftWarningPanel } from './SoftWarningPanel';

export function WizardShell({
  current,
  title,
  description,
  children,
}: {
  current: StepSlug;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const meta = STEPS[stepIndex(current)];

  return (
    <div className="mx-auto max-w-[1440px] px-6 pt-8 pb-4">
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="min-w-0">
          <p className="text-label">{meta.eyebrow}</p>
          <h1 className="text-display mt-2">{title}</h1>
          {description ? (
            <p
              className="text-body mt-3 max-w-[60ch]"
              style={{ color: 'var(--color-ink-500)' }}
            >
              {description}
            </p>
          ) : null}

          <div className="mt-8">
            <SoftWarningPanel />
            {children}
          </div>
        </section>

        <aside className="hidden xl:block">
          <LivePreview />
        </aside>
      </div>
    </div>
  );
}
