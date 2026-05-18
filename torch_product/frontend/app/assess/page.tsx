'use client';

// /assess — the 4-step wizard. URL-driven step (?step=identity|scale|vessel|process).
// One react-hook-form instance lives in AssessFormProvider and is shared by every
// step. "Run risk assessment" lives at the bottom of step 4 — no separate Review
// step, matching old/.

import { Suspense, useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFormContext } from 'react-hook-form';
import { runAssessment } from '@torch/core';
import { toProcessInputs } from '@/lib/assess-to-inputs';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { AssessFormProvider } from '@/components/assess/AssessFormProvider';
import { WizardShell } from '@/components/assess/WizardShell';
import { WizardBottomBar } from '@/components/assess/WizardBottomBar';
import { AnalyzingAnimation } from '@/components/assess/AnalyzingAnimation';
import { OrganismStep } from '@/components/assess/steps/OrganismStep';
import { ScaleStep } from '@/components/assess/steps/ScaleStep';
import { VesselStep } from '@/components/assess/steps/VesselStep';
import { ProcessStep } from '@/components/assess/steps/ProcessStep';
import { TopNav } from '@/components/shell/TopNav';
import { Wordmark } from '@/components/ui/Wordmark';
import {
  STEPS,
  STEP_FIELDS,
  STEP_SCHEMAS,
  stepIndex,
  type AssessFormValues,
  type StepSlug,
} from '@/lib/assess-schema';
import { clearDraft } from '@/lib/assess-storage';
import { api, type ApiError } from '@/lib/api';

const STEP_META: Record<StepSlug, { title: string; description?: string }> = {
  identity: {
    title: 'What are you scaling?',
    description: 'Organism identity and process type.',
  },
  scale: {
    title: 'How big are you going?',
    description: 'Lab and target working volumes.',
  },
  vessel: {
    title: 'Reactor design.',
    description: 'Vessel, impellers, agitation, and aeration.',
  },
  process: {
    title: 'Process characterisation.',
    description: 'Biomass, oxygen, and heat transfer.',
  },
};

export default function AssessPage() {
  return (
    <Suspense fallback={null}>
      <AssessHeader />
      <AssessFormProvider>
        <AssessRouter />
      </AssessFormProvider>
    </Suspense>
  );
}

function AssessHeader() {
  const auth = useAuth();
  const { theme, toggleTheme } = useTheme();

  if (auth.status === 'authed') {
    return <TopNav user={auth.user} />;
  }

  return (
    <header
      className="glass-surface sticky top-0 z-30 h-14"
      style={{ borderBottom: '1px solid var(--color-rule)' }}
    >
      <div className="mx-auto flex h-full max-w-[1200px] items-center justify-between gap-6 px-6">
        <div className="flex items-center gap-8">
          <Wordmark href="/assess" />
          <nav className="hidden gap-6 md:flex">
            <Link
              href="/assess"
              aria-current="page"
              className="relative py-1 text-[14px]"
              style={{ color: 'var(--color-ink-900)', fontWeight: 500 }}
            >
              New assessment
              <span
                aria-hidden
                className="absolute -bottom-[15px] left-0 right-0 h-px"
                style={{ background: 'var(--color-flame-500)' }}
              />
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              toggleTheme({
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2,
              });
            }}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="grid h-8 w-8 place-items-center rounded-lg transition-colors hover:bg-[color:var(--color-paper-200)]"
            style={{ color: 'var(--color-ink-500)' }}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
          <Link href="/login?next=/results" className="btn btn-ghost">
            Sign in
          </Link>
        </div>
      </div>
    </header>
  );
}

function AssessRouter() {
  const search = useSearchParams();
  const raw = search?.get('step') ?? 'identity';
  const current = (STEPS.find((s) => s.slug === raw)?.slug ?? 'identity') as StepSlug;
  const meta = STEP_META[current];

  return (
    <WizardShell current={current} title={meta.title} description={meta.description}>
      <StepBody slug={current} />
      <StepActions slug={current} />
    </WizardShell>
  );
}

function StepBody({ slug }: { slug: StepSlug }) {
  switch (slug) {
    case 'identity': return <OrganismStep />;
    case 'scale':    return <ScaleStep />;
    case 'vessel':   return <VesselStep />;
    case 'process':  return <ProcessStep />;
  }
}

function StepActions({ slug }: { slug: StepSlug }) {
  const auth = useAuth();
  const router = useRouter();
  const { trigger, getValues, setError, clearErrors } = useFormContext<AssessFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const savedIdRef = useRef<string | null>(null);

  const idx = stepIndex(slug);
  const prev = idx > 0 ? STEPS[idx - 1].slug : undefined;
  const next = idx < STEPS.length - 1 ? STEPS[idx + 1].slug : undefined;
  const isFinalStep = next === undefined;

  const goBack = useCallback(() => {
    if (prev) router.push(`/assess?step=${prev}`);
  }, [prev, router]);

  // Validate only the current step's slice against its dedicated schema.
  // Using the full-schema trigger() would fail on later-step blanks.
  const validateCurrentStep = useCallback((): boolean => {
    const fields = STEP_FIELDS[slug];
    const values = getValues();
    const schema = STEP_SCHEMAS[slug];
    const result = schema.safeParse(values);

    if (!result.success) {
      result.error.issues.forEach((issue) => {
        const path = issue.path[0] as keyof AssessFormValues | undefined;
        if (path) setError(path, { type: 'manual', message: issue.message });
      });
      return false;
    }
    clearErrors(fields as (keyof AssessFormValues)[]);
    return true;
  }, [slug, getValues, setError, clearErrors]);

  const goNext = useCallback(() => {
    if (!validateCurrentStep()) return;
    if (next) router.push(`/assess?step=${next}`);
  }, [next, router, validateCurrentStep]);

  const runAndSave = useCallback(async () => {
    setSubmitError(null);
    setSubmitting(true);
    try {
      // Validate the current step locally first (so per-field errors surface),
      // then run the full schema as the final guard before computing.
      if (!validateCurrentStep()) {
        setSubmitting(false);
        return;
      }
      const ok = await trigger();
      if (!ok) {
        setSubmitError('Some entries need attention. Use the rail to jump back.');
        setSubmitting(false);
        return;
      }
      const values = getValues();
      const inputs = toProcessInputs(values);
      const results = runAssessment(inputs);

      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(
          'torch_last_result',
          JSON.stringify({ inputs, results, savedAt: Date.now() }),
        );
      }
      clearDraft();

      setAnalyzing(true);
      savedIdRef.current = null;

      if (auth.status === 'authed') {
        api<{ id: string | null }>('/api/assessments/save', {
          method: 'POST',
          body: JSON.stringify({ inputs, results }),
        })
          .then((saved) => {
            savedIdRef.current = saved.id;
          })
          .catch(() => {
            // eslint-disable-next-line no-console
            console.warn('Assessment save failed; using local snapshot.');
          });
      }
    } catch (err) {
      const e = err as ApiError;
      setSubmitError(e.error || 'Could not run assessment.');
      setSubmitting(false);
    }
  }, [auth.status, trigger, getValues, validateCurrentStep]);

  const handleAnalyzeComplete = useCallback(() => {
    if (auth.status !== 'authed') {
      router.replace('/results-preview');
      return;
    }
    const id = savedIdRef.current;
    router.replace(id ? `/results?id=${id}` : '/results');
  }, [auth.status, router]);

  if (isFinalStep) {
    return (
      <>
        {analyzing ? (
          <AnalyzingAnimation onComplete={handleAnalyzeComplete} />
        ) : null}
        <WizardBottomBar
          onBack={prev ? goBack : undefined}
          onNext={runAndSave}
          nextLabel={submitting ? 'Running…' : 'Run risk assessment'}
          nextLoading={submitting}
          finalStep
          errorSummary={submitError}
        />
      </>
    );
  }

  return (
    <WizardBottomBar
      onBack={prev ? goBack : undefined}
      onNext={goNext}
      nextLabel="Next"
    />
  );
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.4" />
      <line x1="8" y1="1" x2="8" y2="3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="8" y1="13" x2="8" y2="15" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="1" y1="8" x2="3" y2="8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="13" y1="8" x2="15" y2="8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="2.93" y1="2.93" x2="4.34" y2="4.34" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="11.66" y1="11.66" x2="13.07" y2="13.07" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="11.66" y1="4.34" x2="13.07" y2="2.93" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="2.93" y1="13.07" x2="4.34" y2="11.66" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M13.5 9.5A6 6 0 0 1 6.5 2.5a6 6 0 1 0 7 7z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
