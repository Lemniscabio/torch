// Public route. No auth needed — the example is the unauthed visitor's
// way to see what a finished report actually looks like before signing up.
// Pre-loaded EXAMPLE_INPUTS (E. coli, 10 L → 1000 L, P/V scale-up, rushton
// at 1200 rpm with 2 impellers) match old/frontend's example (old:10-33).

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { PartialAssessmentResult, ProcessInputs } from '@torch/core-shared';
import { api } from '@/lib/api';
import { ResultsDashboard } from '@/components/results/ResultsDashboard';
import { Wordmark } from '@/components/ui/Wordmark';

const EXAMPLE_INPUTS: ProcessInputs = {
  organism_class: 'bacteria',
  organism_species: 'e_coli',
  v_lab: 10,
  v_target: 1_000,
  scaleup_criterion: 'power_per_volume',
  impeller_type: 'rushton',
  rpm: 1200,
  vvm: 0.8,
  biomass_cdw_g_l: 20,
  our_mode: 'estimate',
  o2_inlet: 40,
  do_setpoint: 30,
  temperature: 37,
  t_cw_inlet: 25,
  cooling_water_flowrate_lpm: 50,
  h_d_lab: 1.2,
  h_d_target: 1.2,
  dt_ratio_lab: 0.3,
  dt_ratio_target: 0.3,
  n_impellers: 2,
  n_impellers_target: 2,
  process_type: 'batch',
};

export default function ExamplePage() {
  const [results, setResults] = useState<PartialAssessmentResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<{ results: PartialAssessmentResult }>(
      '/api/assessments/preview',
      { method: 'POST', body: JSON.stringify({ inputs: EXAMPLE_INPUTS }), authed: false },
    )
      .then((data) => {
        if (!cancelled) setResults(data.results);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.error || 'Could not load example.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-dvh flex-col">
      <header
        className="glass-surface sticky top-0 z-30 h-14"
        style={{ borderBottom: '1px solid var(--color-rule)' }}
      >
        <div className="mx-auto flex h-full max-w-[1200px] items-center justify-between gap-6 px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="hover:opacity-80">
              <Wordmark />
            </Link>
            <span className="text-meta">Example</span>
          </div>
          <Link
            href="/login"
            className="text-[13px] font-medium transition-colors"
            style={{ color: 'var(--color-ink-700)' }}
          >
            Sign in
          </Link>
        </div>
      </header>
      <div className="flex-1">
        {results ? (
          <ResultsDashboard inputs={EXAMPLE_INPUTS} results={results} isExample />
        ) : error ? (
          <div className="mx-auto max-w-[600px] p-8 text-center text-[14px]" style={{ color: 'var(--color-ink-500)' }}>
            {error}
          </div>
        ) : (
          <div className="mx-auto max-w-[600px] p-8 text-center text-[14px]" style={{ color: 'var(--color-ink-500)' }}>
            Loading example…
          </div>
        )}
      </div>
    </div>
  );
}
