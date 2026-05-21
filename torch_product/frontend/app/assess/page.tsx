'use client';

// /assess — the 4-step wizard. URL-driven step (?step=identity|scale|vessel|process).
// One react-hook-form instance lives in AssessFormProvider and is shared by every
// step. "Run risk assessment" lives at the bottom of step 4 — no separate Review
// step, matching old/.

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFormContext } from 'react-hook-form';
import type { PartialAssessmentResult } from '@torch/core-shared';
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
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    function onResize() {
      if (window.innerWidth >= 768) setMenuOpen(false);
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [menuOpen]);

  if (auth.status === 'authed') {
    return <TopNav user={auth.user} />;
  }

  return (
    <header
      className="product-header sticky inset-x-0 top-0 z-40 overflow-visible border-b border-white/10 bg-black/55 backdrop-blur-[18px] shadow-[inset_0_-1px_0_rgba(255,255,255,0.06)]"
    >
      <div className="relative z-10 flex items-center justify-between px-6 py-5 md:px-10 lg:px-14">
        <Link
          href="/assess"
          className="group inline-flex items-end gap-2.5 transition-opacity duration-200 hover:opacity-85"
          aria-label="Torch assessment"
        >
          <span className="text-[30px] leading-none font-semibold tracking-[-0.02em] text-white transition-colors duration-300">
            Torch
          </span>
          <span className="flex flex-col items-start leading-none pb-[2px] text-white/70 transition-colors duration-300">
            <span className="text-[7px] font-medium tracking-[0.02em] md:text-[8px]">by</span>
            <span className="text-[9px] font-medium tracking-[-0.02em] md:text-[10px]">Lemnisca</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          <Link
            href="/dashboard"
            className="group relative text-[14px] text-white/70 transition-[color,transform] duration-150 ease-out hover:text-white active:scale-[0.985]"
          >
            <span>Dashboard</span>
            <span
              aria-hidden
              className="absolute -bottom-1 left-0 h-px w-0 bg-white transition-[width] duration-200 ease-out group-hover:w-full"
            />
          </Link>
          <Link
            href="/assess"
            aria-current="page"
            className="group relative text-[14px] font-medium text-white transition-[color,transform] duration-150 ease-out active:scale-[0.985]"
          >
            <span>New assessment</span>
            <span aria-hidden className="absolute -bottom-1 left-0 h-px w-full bg-white" />
          </Link>
        </nav>

        <div className="hidden items-center gap-3 md:flex">
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
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-white transition-colors duration-200 hover:bg-white/10"
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
          <Link
            href="/login?next=/results"
            className="inline-flex items-center rounded-full border border-white/15 px-4 py-2 text-[14px] font-medium text-white/85 transition-[background-color,color,transform] duration-150 ease-out hover:bg-white/10 hover:text-white active:scale-[0.97]"
          >
            Sign in
          </Link>
        </div>

        <div className="flex items-center gap-3 md:hidden">
          <Link
            href="/login?next=/results"
            className="inline-flex items-center rounded-full bg-white px-3.5 py-2 text-[13px] font-medium text-black transition-[background-color,transform] duration-150 ease-out active:scale-[0.97]"
          >
            Sign in
          </Link>
          <button
            type="button"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-white transition-colors duration-200 hover:bg-white/10"
          >
            <HamburgerIcon open={menuOpen} />
          </button>
        </div>
      </div>

      <div
        id="torch-nav-mobile"
        role="menu"
        className="md:hidden"
        style={{
          display: 'grid',
          gridTemplateRows: menuOpen ? '1fr' : '0fr',
          transition: 'grid-template-rows 260ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div style={{ overflow: 'hidden', minHeight: 0 }}>
          <nav
            className="relative z-10 flex flex-col gap-1 px-6 pb-6"
            aria-label="Mobile primary"
          >
            <Link
              href="/dashboard"
              onClick={() => setMenuOpen(false)}
              className="flex items-center justify-between rounded-xl px-3 py-3 text-[16px] font-medium text-white/85 transition-colors duration-150 hover:bg-white/5"
            >
              <span>Dashboard</span>
            </Link>
            <Link
              onClick={() => setMenuOpen(false)}
              href="/assess"
              aria-current="page"
              className="flex items-center justify-between rounded-xl bg-white/10 px-3 py-3 text-[16px] font-medium text-white transition-colors duration-150"
            >
              <span>New assessment</span>
              <span
                aria-hidden
                className="text-[12px] font-medium tracking-[0.06em] uppercase text-white/55"
              >
                Current
              </span>
            </Link>
          </nav>
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

      // Engine runs server-side. Auth users hit /save (computes + persists +
      // returns results); unauth users hit /preview (computes only).
      let results: PartialAssessmentResult;
      let savedId: string | null = null;

      if (auth.status === 'authed') {
        const saved = await api<{ id: string | null; results: PartialAssessmentResult }>(
          '/api/assessments/save',
          { method: 'POST', body: JSON.stringify({ inputs }) },
        );
        results = saved.results;
        savedId = saved.id;
      } else {
        const preview = await api<{ results: PartialAssessmentResult }>(
          '/api/assessments/preview',
          { method: 'POST', body: JSON.stringify({ inputs }), authed: false },
        );
        results = preview.results;
      }

      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(
          'torch_last_result',
          JSON.stringify({ inputs, results, savedAt: Date.now() }),
        );
      }
      clearDraft();

      setAnalyzing(true);
      savedIdRef.current = savedId;
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

function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden
      style={{ transition: 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1)' }}
    >
      <line
        x1="2"
        y1="5"
        x2="16"
        y2="5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        style={{
          transformOrigin: '9px 5px',
          transition: 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1)',
          transform: open ? 'translateY(4px) rotate(45deg)' : 'none',
        }}
      />
      <line
        x1="2"
        y1="13"
        x2="16"
        y2="13"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        style={{
          transformOrigin: '9px 13px',
          transition: 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1)',
          transform: open ? 'translateY(-4px) rotate(-45deg)' : 'none',
        }}
      />
    </svg>
  );
}
