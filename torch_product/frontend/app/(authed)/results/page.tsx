'use client';

// /results?id=... — the bottleneck-led dashboard. Reads ?id from the URL
// and hydrates the snapshot from either the backend (preferred, persisted)
// or sessionStorage (fallback, set during /assess submit so the page works
// even if the backend save is slower than the analyzing animation).

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api, type ApiError } from '@/lib/api';
import { ResultsDashboard } from '@/components/results/ResultsDashboard';
import type { ProcessInputs, PartialAssessmentResult } from '@torch/core-shared';

type Snapshot = {
  inputs: ProcessInputs;
  results: PartialAssessmentResult;
};

export default function ResultsPage() {
  return (
    <Suspense fallback={<LoadingShell />}>
      <ResultsView />
    </Suspense>
  );
}

function ResultsView() {
  const search = useSearchParams();
  const id = search?.get('id') ?? null;
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (id) {
        try {
          const a = await api<Snapshot & { id: string }>(`/api/assessments/${id}`);
          if (!cancelled) setSnap({ inputs: a.inputs, results: a.results });
          return;
        } catch (err) {
          // Fall through to sessionStorage if the server can't find it
          // (e.g. anonymous local run, save failed, or stale link).
          // eslint-disable-next-line no-console
          console.warn('Server load failed; falling back to local snapshot.', (err as ApiError).error);
        }
      }
      try {
        const raw = window.sessionStorage.getItem('torch_last_result');
        if (!raw) {
          if (!cancelled) setError('No assessment to display.');
          return;
        }
        const parsed = JSON.parse(raw) as Snapshot;
        if (!cancelled) setSnap(parsed);
      } catch {
        if (!cancelled) setError('No assessment to display.');
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) {
    return (
      <main className="mx-auto max-w-[760px] px-6 py-12">
        <p className="text-label">Results</p>
        <h1 className="text-display mt-2">Nothing to show.</h1>
        <p className="text-body mt-3" style={{ color: 'var(--color-ink-500)' }}>
          {error}
        </p>
        <Link href="/assess" className="btn btn-primary mt-8">
          Start a new assessment
        </Link>
      </main>
    );
  }

  if (!snap) return <LoadingShell />;

  return <ResultsDashboard inputs={snap.inputs} results={snap.results} />;
}

function LoadingShell() {
  return (
    <main className="mx-auto max-w-[1200px] px-6 py-12">
      <p className="text-label">Assessment result</p>
      <div
        aria-hidden
        className="mt-3 h-9 w-3/4 rounded"
        style={{ background: 'var(--color-paper-200)' }}
      />
      <div
        aria-hidden
        className="mt-10 h-[280px] rounded-xl"
        style={{ background: 'var(--color-paper-100)' }}
      />
    </main>
  );
}
