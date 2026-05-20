'use client';

// Signed-in landing. Fetches GET /api/assessments and renders one row per
// saved run with the worst-risk dot, species, scale range, relative date,
// and the five domain dots. Click → /results?id=…, trash → DELETE then
// drop from local state.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, type ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { speciesLabel, worstScore, relativeTime } from '@/lib/format';
import { DOMAIN_ORDER, RISK_COLOR, type DomainKey } from '@/components/results/riskTokens';
import type { ProcessInputs, PartialAssessmentResult, RiskScore } from '@torch/core-shared';

type AssessmentRow = {
  id: string;
  inputs: ProcessInputs;
  results: PartialAssessmentResult;
  created_at: string;
};

export default function DashboardPage() {
  const auth = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<AssessmentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AssessmentRow | null>(null);

  useEffect(() => {
    if (auth.status !== 'authed') return;
    let cancelled = false;

    api<{ assessments: AssessmentRow[] }>('/api/assessments')
      .then((data) => {
        if (!cancelled) setRows(data.assessments);
      })
      .catch((err) => {
        if (!cancelled) setError((err as ApiError).error || 'Could not load assessments.');
      });

    return () => {
      cancelled = true;
    };
  }, [auth.status]);

  const handleDelete = useCallback(async (id: string) => {
    const previous = rows;
    setRows((current) => current?.filter((r) => r.id !== id) ?? null);
    setPendingDelete(null);
    try {
      await api(`/api/assessments/${id}`, { method: 'DELETE' });
    } catch {
      // Restore on failure so the user isn't left wondering.
      setRows(previous);
      setError('Could not delete that assessment.');
    }
  }, [rows]);

  if (auth.status !== 'authed') return null;
  const { user } = auth;

  return (
    <main className="mx-auto max-w-[1200px] px-6 py-12">
      <p className="text-label">Account</p>
      <h1 className="text-display mt-2">{user.email}</h1>
      <p className="text-meta mt-2">{user.company_domain}</p>

      <div className="mt-8">
        <Link href="/assess" className="btn btn-primary">
          Start an assessment
        </Link>
      </div>

      <hr className="mt-12" style={{ border: 0, borderTop: '1px solid var(--color-rule)' }} />

      <section className="mt-8">
        <h2 className="text-section">Past assessments</h2>

        {error ? (
          <p className="text-meta mt-3" style={{ color: 'var(--color-flame-700)' }}>
            {error}
          </p>
        ) : null}

        {rows === null ? (
          <ListSkeleton />
        ) : rows.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="mt-6 divide-y" style={{ borderColor: 'var(--color-rule)' }}>
            {rows.map((r) => (
              <Row
                key={r.id}
                row={r}
                onOpen={() => router.push(`/results?id=${r.id}`)}
                onDelete={() => setPendingDelete(r)}
              />
            ))}
          </ul>
        )}
      </section>

      {pendingDelete ? (
        <DeleteAssessmentModal
          row={pendingDelete}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => handleDelete(pendingDelete.id)}
        />
      ) : null}
    </main>
  );
}

function Row({
  row,
  onOpen,
  onDelete,
}: {
  row: AssessmentRow;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const worst = worstScore(row.results);
  const worstColor = RISK_COLOR[worst];

  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onOpen(); }}
        className="group flex cursor-pointer items-center gap-4 py-4"
        style={{ borderColor: 'var(--color-rule)' }}
      >
        <span
          aria-hidden
          className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
          style={{ background: worstColor.fg }}
        />
        <div className="min-w-0 flex-1">
          <p className="text-title truncate" style={{ color: 'var(--color-ink-900)' }}>
            {speciesLabel(row.inputs.organism_species)}
          </p>
          <p className="text-meta mt-1">
            {row.inputs.v_lab} L → {row.inputs.v_target} L · {relativeTime(row.created_at)}
          </p>
        </div>

        <div className="hidden items-center gap-1.5 sm:flex" aria-hidden>
          {DOMAIN_ORDER.map((d) => (
            <DomainDot key={d.key} domain={d.key} results={row.results} />
          ))}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          aria-label="Delete assessment"
          className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-md transition-colors hover:bg-[color:var(--color-paper-200)]"
          style={{ color: 'var(--color-ink-500)' }}
        >
          <TrashIcon />
        </button>
        <ChevronRightIcon aria-hidden className="flex-shrink-0" style={{ color: 'var(--color-ink-500)' }} />
      </div>
    </li>
  );
}

function DeleteAssessmentModal({
  row,
  onCancel,
  onConfirm,
}: {
  row: AssessmentRow;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-assessment-title"
      className="fixed inset-0 z-50 flex items-center justify-center px-6 py-8"
    >
      <button
        type="button"
        aria-label="Cancel delete"
        className="absolute inset-0 cursor-default"
        style={{ background: 'rgba(0,0,0,0.48)' }}
        onClick={onCancel}
      />
      <div
        className="relative w-full max-w-[420px] rounded-2xl border p-6 shadow-[0_28px_90px_-44px_rgba(0,0,0,0.85)]"
        style={{
          borderColor: 'var(--color-rule-strong)',
          background: 'var(--color-paper-100)',
        }}
      >
        <p className="text-label">Delete assessment</p>
        <h2 id="delete-assessment-title" className="text-section mt-3">
          Remove this saved run?
        </h2>
        <p className="text-body mt-3" style={{ color: 'var(--color-ink-500)' }}>
          {speciesLabel(row.inputs.organism_species)} · {row.inputs.v_lab} L → {row.inputs.v_target} L
        </p>
        <p className="text-meta mt-2">
          This will remove the assessment from your dashboard.
        </p>

        <div className="mt-7 flex justify-end gap-3">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn"
            onClick={onConfirm}
            style={{
              background: 'var(--color-flame-500)',
              borderColor: 'var(--color-flame-500)',
              color: '#fff',
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function DomainDot({ domain, results }: { domain: DomainKey; results: PartialAssessmentResult }) {
  const score: RiskScore = results[domain].score;
  const c = RISK_COLOR[score];
  return (
    <span
      title={`${domain}: ${score}`}
      className="inline-block h-2 w-2 rounded-full"
      style={{ background: c.fg }}
    />
  );
}

function ListSkeleton() {
  return (
    <ul className="mt-6 divide-y" style={{ borderColor: 'var(--color-rule)' }}>
      {Array.from({ length: 3 }).map((_, i) => (
        <li key={i} className="flex items-center gap-4 py-4">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ background: 'var(--color-paper-300)' }}
          />
          <div className="flex-1">
            <div
              className="h-4 w-40 rounded"
              style={{ background: 'var(--color-paper-200)' }}
            />
            <div
              className="mt-2 h-3 w-56 rounded"
              style={{ background: 'var(--color-paper-200)' }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function EmptyState() {
  return (
    <div
      className="mt-6 rounded-xl border p-8 text-center"
      style={{
        borderColor: 'var(--color-rule)',
        background: 'var(--color-paper-100)',
      }}
    >
      <p className="text-body" style={{ color: 'var(--color-ink-500)' }}>
        No assessments yet. Run your first one to see where your process breaks at scale.
      </p>
      <Link href="/assess" className="btn btn-primary mt-6">
        Run your first assessment
      </Link>
    </div>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M2.5 3.5h9M5.5 3.5V2.5h3v1M3.5 3.5l.6 8.4a1 1 0 001 .9h3.8a1 1 0 001-.9l.6-8.4M6 6v4M8 6v4"
        stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
