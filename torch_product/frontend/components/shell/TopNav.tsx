'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Wordmark } from '@/components/ui/Wordmark';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import type { SessionUser } from '@/lib/schemas';

type NavItem = { label: string; href: string };

const ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'New assessment', href: '/assess' },
];

function isActive(href: string, pathname: string | null) {
  if (!pathname) return false;
  if (href === '/dashboard') return pathname === '/dashboard' || pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function TopNav({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  function handleSignOut() {
    signOut();
    router.replace('/login');
  }

  return (
    <header
      className="glass-surface sticky top-0 z-30 h-14"
      style={{ borderBottom: '1px solid var(--color-rule)' }}
    >
      <div className="mx-auto flex h-full max-w-[1200px] items-center justify-between gap-6 px-6">
        <div className="flex items-center gap-8">
          <Wordmark />
          <nav className="hidden gap-6 md:flex">
            {ITEMS.map((item) => {
              const active = isActive(item.href, pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className="relative py-1 text-[14px] transition-colors"
                  style={{
                    color: active ? 'var(--color-ink-900)' : 'var(--color-ink-500)',
                    fontWeight: active ? 500 : 400,
                  }}
                >
                  {item.label}
                  {active && (
                    <span
                      aria-hidden
                      className="absolute -bottom-[15px] left-0 right-0 h-px"
                      style={{ background: 'var(--color-flame-500)' }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
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

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg px-2 py-1 text-[13px] transition-colors hover:bg-[color:var(--color-paper-200)]"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <span
              aria-hidden
              className="grid h-6 w-6 place-items-center rounded-full text-[11px] font-semibold"
              style={{
                background: 'var(--color-flame-500)',
                color: '#fff',
              }}
            >
              {user.email.charAt(0).toUpperCase()}
            </span>
            <span className="hidden md:inline" style={{ color: 'var(--color-ink-700)' }}>
              {user.email}
            </span>
          </button>

          {menuOpen && (
            <>
              <button
                type="button"
                aria-hidden
                tabIndex={-1}
                onClick={() => setMenuOpen(false)}
                className="fixed inset-0 z-10 cursor-default"
              />
              <div
                role="menu"
                className="absolute right-0 top-[calc(100%+6px)] z-20 min-w-[220px] overflow-hidden rounded-xl border py-1"
                style={{
                  background: 'var(--color-paper-100)',
                  borderColor: 'var(--color-rule-strong)',
                  backdropFilter: 'blur(24px)',
                  WebkitBackdropFilter: 'blur(24px)',
                  boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
                }}
              >
                <div className="px-3 py-2.5">
                  <p className="text-meta truncate font-medium" style={{ color: 'var(--color-ink-900)' }}>
                    {user.email}
                  </p>
                  <p className="text-meta truncate">{user.company_domain}</p>
                </div>
                <div className="rule" />
                <Link
                  href="/dashboard"
                  onClick={() => setMenuOpen(false)}
                  className="block px-3 py-2 text-[13px] transition-colors hover:bg-[color:var(--color-paper-200)] md:hidden"
                  style={{ color: 'var(--color-ink-900)' }}
                  role="menuitem"
                >
                  Dashboard
                </Link>
                <Link
                  href="/assess"
                  onClick={() => setMenuOpen(false)}
                  className="block px-3 py-2 text-[13px] transition-colors hover:bg-[color:var(--color-paper-200)] md:hidden"
                  style={{ color: 'var(--color-ink-900)' }}
                  role="menuitem"
                >
                  New assessment
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="block w-full px-3 py-2 text-left text-[13px] transition-colors hover:bg-[color:var(--color-paper-200)]"
                  style={{ color: 'var(--color-ink-500)' }}
                  role="menuitem"
                >
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
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
