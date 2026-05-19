'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { LoginForm } from '@/components/auth/LoginForm';
import { ResultsDashboard } from '@/components/results/ResultsDashboard';
import { Wordmark } from '@/components/ui/Wordmark';
import { useAuth } from '@/lib/auth-context';
import type { PartialAssessmentResult, ProcessInputs } from '@torch/core-shared';

type Snapshot = {
  inputs: ProcessInputs;
  results: PartialAssessmentResult;
};

export default function ResultsPreviewPage() {
  return (
    <Suspense fallback={<PreviewSkeleton />}>
      <ResultsPreview />
    </Suspense>
  );
}

function ResultsPreview() {
  const auth = useAuth();
  const router = useRouter();
  const search = useSearchParams();
  const mode = search?.get('mode') === 'login' ? 'login' : 'signup';
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (auth.status === 'authed') {
      router.replace('/results');
    }
  }, [auth.status, router]);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem('torch_last_result');
      setSnap(raw ? (JSON.parse(raw) as Snapshot) : null);
    } catch {
      setSnap(null);
    } finally {
      setLoaded(true);
    }
  }, []);

  if (auth.status === 'authed') return null;

  if (loaded && !snap) {
    return (
      <main
        className="flex min-h-dvh items-center justify-center px-6 py-12"
        style={{ background: 'var(--color-paper-50)' }}
      >
        <div className="max-w-[460px] text-center">
          <Wordmark href="/assess" />
          <h1 className="text-display mt-8">No assessment result found.</h1>
          <p className="text-body mt-3" style={{ color: 'var(--color-ink-500)' }}>
            Run a new assessment to generate a gated report preview.
          </p>
          <Link href="/assess" className="btn btn-primary mt-8">
            Start assessment
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-dvh overflow-hidden" style={{ background: 'var(--color-paper-50)' }}>
      {snap ? (
        <div className="pointer-events-none select-none blur-[10px]">
          <ResultsDashboard inputs={snap.inputs} results={snap.results} />
        </div>
      ) : (
        <PreviewSkeleton />
      )}

      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.18)' }}
      />

      <section className="fixed inset-0 z-10 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[420px]">
          <div className="mb-6 flex justify-center">
            <Wordmark href="/assess" />
          </div>
          <div
            className="rounded-2xl border px-8 py-9 shadow-[0_24px_80px_-42px_rgba(0,0,0,0.75)]"
            style={{
              borderColor: 'var(--color-rule-strong)',
              background: 'var(--color-paper-50)',
            }}
          >
            <LoginForm mode={mode} next="/results" />
          </div>
        </div>
      </section>
    </main>
  );
}

function PreviewSkeleton() {
  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8 blur-[10px]">
      <div className="h-[320px] rounded-xl" style={{ background: 'var(--color-paper-100)' }} />
      <div className="mt-8 grid grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="h-36 rounded-xl"
            style={{ background: 'var(--color-paper-100)' }}
          />
        ))}
      </div>
      <div className="mt-8 h-[420px] rounded-xl" style={{ background: 'var(--color-paper-100)' }} />
    </div>
  );
}
