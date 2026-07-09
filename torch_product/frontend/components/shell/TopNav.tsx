'use client';

// DEMO (email-only gate): stripped-down top bar for the demo flow.
// Only the Torch logo, a "New assessment" button, and the theme toggle —
// no Dashboard link, no account menu / Sign out. Revert with `git revert`.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTheme } from '@/lib/theme-context';

export function TopNav() {
  const { theme, toggleTheme } = useTheme();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 80);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <header
      className={`product-header sticky inset-x-0 top-0 z-40 overflow-visible border-b border-white/10 bg-black/55 backdrop-blur-[18px] transition-[background-color,backdrop-filter,box-shadow,border-color] duration-300 ${
        scrolled
          ? 'shadow-[inset_0_-1px_0_rgba(255,255,255,0.06),0_18px_54px_-38px_rgba(0,0,0,0.55)]'
          : 'shadow-[inset_0_-1px_0_rgba(255,255,255,0.06)]'
      }`}
    >
      <div className="relative z-10 flex items-center justify-between px-6 py-5 md:px-10 lg:px-14">
        <Link
          href="/assess"
          className="group inline-flex items-end gap-2.5 transition-opacity duration-200 hover:opacity-85"
          aria-label="Torch"
        >
          <span className="text-[30px] leading-none font-semibold tracking-[-0.02em] text-white">
            Torch
          </span>
          <span className="flex flex-col items-start leading-none pb-[2px] text-white/70">
            <span className="text-[7px] font-medium tracking-[0.02em] md:text-[8px]">by</span>
            <span className="text-[9px] font-medium tracking-[-0.02em] md:text-[10px]">Lemnisca</span>
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href="/assess"
            className="inline-flex items-center rounded-full bg-white px-4 py-2 text-[13px] font-medium text-black transition-[background-color,transform] duration-150 ease-out active:scale-[0.97]"
          >
            New assessment
          </Link>
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
        </div>
      </div>
    </header>
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
