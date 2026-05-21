// Public route. No auth needed — the example is the unauthed visitor's
// way to see what a finished report actually looks like before signing up.
// Pre-loaded EXAMPLE_INPUTS (E. coli, 10 L → 1000 L, P/V scale-up, rushton
// example report.

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { PartialAssessmentResult, ProcessInputs } from '@torch/core-shared';
import { api } from '@/lib/api';
import { useTheme } from '@/lib/theme-context';
import { ResultsDashboard } from '@/components/results/ResultsDashboard';

const EXAMPLE_INPUTS: ProcessInputs = {
  organism_class: 'bacteria',
  organism_species: 'e_coli',
  v_lab: 10,
  v_target: 1_000,
  scaleup_criterion: 'power_per_volume',
  impeller_type: 'rushton',
  rpm: 900,
  vvm: 1.0,
  biomass_cdw_g_l: 40,
  our_mode: 'estimate',
  o2_inlet: 20.9,
  do_setpoint: 25,
  temperature: 37,
  t_cw_inlet: 25,
  cooling_water_flowrate_lpm: 50,
  h_d_lab: 1.2,
  h_d_target: 2.0,
  dt_ratio_lab: 0.3,
  dt_ratio_target: 0.3,
  n_impellers: 2,
  n_impellers_target: 3,
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
      <ExampleHeader />
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

function ExampleHeader() {
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

  return (
    <header className="product-header sticky inset-x-0 top-0 z-40 overflow-visible border-b border-white/10 bg-black/55 backdrop-blur-[18px] shadow-[inset_0_-1px_0_rgba(255,255,255,0.06)]">
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
          <HeaderNavLink href="/dashboard" label="Dashboard" />
          <HeaderNavLink href="/assess" label="New assessment" />
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
            href="/login"
            className="inline-flex items-center rounded-full border border-white/15 px-4 py-2 text-[14px] font-medium text-white/85 transition-[background-color,color,transform] duration-150 ease-out hover:bg-white/10 hover:text-white active:scale-[0.97]"
          >
            Sign in
          </Link>
        </div>

        <div className="flex items-center gap-3 md:hidden">
          <Link
            href="/login"
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
              href="/assess"
              onClick={() => setMenuOpen(false)}
              className="flex items-center justify-between rounded-xl px-3 py-3 text-[16px] font-medium text-white/85 transition-colors duration-150 hover:bg-white/5"
            >
              <span>New assessment</span>
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}

function HeaderNavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="group relative text-[14px] text-white/70 transition-[color,transform] duration-150 ease-out hover:text-white active:scale-[0.985]"
    >
      <span>{label}</span>
      <span
        aria-hidden
        className="absolute -bottom-1 left-0 h-px w-0 bg-white transition-[width] duration-200 ease-out group-hover:w-full"
      />
    </Link>
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
        x1="3"
        y1={open ? '9' : '5.5'}
        x2="15"
        y2={open ? '9' : '5.5'}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        style={{
          transformOrigin: 'center',
          transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
          transition: 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1), y 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      />
      <line
        x1="3"
        y1={open ? '9' : '12.5'}
        x2="15"
        y2={open ? '9' : '12.5'}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        style={{
          transformOrigin: 'center',
          transform: open ? 'rotate(-45deg)' : 'rotate(0deg)',
          transition: 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1), y 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      />
    </svg>
  );
}
