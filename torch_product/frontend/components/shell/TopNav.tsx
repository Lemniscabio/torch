'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import type { SessionUser } from '@/lib/schemas';

type NavItem = { label: string; href: string; cta?: boolean };

const ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'New assessment', href: '/assess' },
];

function isActiveRoute(href: string, pathname: string | null) {
  if (!pathname || href.startsWith('http') || href.startsWith('#')) return false;
  const current = normalizeRoutePath(pathname);
  const target = normalizeRoutePath(href);
  if (target === '/') return current === '/';
  if (target === '/dashboard') return current === '/dashboard' || current === '/';
  return current === target || current.startsWith(`${target}/`);
}

function normalizeRoutePath(path: string) {
  if (path === '/') return path;
  return path.replace(/\/+$/, '');
}

function brandSuffixParts(suffix: string): { pre: string; rest: string } {
  const trimmed = suffix.trim();
  const firstSpace = trimmed.indexOf(' ');
  if (firstSpace === -1) return { pre: '', rest: trimmed };
  return {
    pre: trimmed.slice(0, firstSpace),
    rest: trimmed.slice(firstSpace + 1),
  };
}

export function TopNav({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

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

  useEffect(() => {
    if (!menuOpen && !accountOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        setAccountOpen(false);
      }
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
  }, [menuOpen, accountOpen]);

  function handleSignOut() {
    signOut();
    router.replace('/login');
  }

  return (
    <header
      className={`product-header sticky inset-x-0 top-0 z-40 overflow-visible transition-[background-color,backdrop-filter,box-shadow,border-color] duration-300 ${
        scrolled || menuOpen || accountOpen
          ? 'border-b border-white/10 bg-black/55 backdrop-blur-[18px] shadow-[inset_0_-1px_0_rgba(255,255,255,0.06),0_18px_54px_-38px_rgba(0,0,0,0.55)]'
          : 'border-b border-white/10 bg-black/55 backdrop-blur-[18px] shadow-[inset_0_-1px_0_rgba(255,255,255,0.06)]'
      }`}
    >
      <div className="relative z-10 flex items-center justify-between px-6 py-5 md:px-10 lg:px-14">
        <Link
          href="/dashboard"
          className="group inline-flex items-end gap-2.5 transition-opacity duration-200 hover:opacity-85"
          aria-label="Torch dashboard"
        >
          <span className="text-[30px] leading-none font-semibold tracking-[-0.02em] text-white transition-colors duration-300">
            Torch
          </span>
          <span className="flex flex-col items-start leading-none pb-[2px] text-white/70 transition-colors duration-300">
            <span className="text-[7px] font-medium tracking-[0.02em] md:text-[8px]">
              {brandSuffixParts('by Lemnisca').pre}
            </span>
            <span className="text-[9px] font-medium tracking-[-0.02em] md:text-[10px]">
              {brandSuffixParts('by Lemnisca').rest}
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {ITEMS.map((item) => (
            <NavLink
              key={item.label}
              item={item}
              active={isActiveRoute(item.href, pathname)}
            />
          ))}
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

          <div className="relative">
            <button
              type="button"
              onClick={() => setAccountOpen((v) => !v)}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3.5 py-2 text-[13px] font-medium text-white/85 transition-colors duration-200 hover:bg-white/10 hover:text-white"
              aria-haspopup="menu"
              aria-expanded={accountOpen}
            >
              <span
                aria-hidden
                className="grid h-5 w-5 place-items-center rounded-full bg-white text-[10px] font-semibold text-black"
              >
                {user.email.charAt(0).toUpperCase()}
              </span>
              <span className="max-w-[22ch] truncate">{user.email}</span>
            </button>

            {accountOpen && (
              <>
                <button
                  type="button"
                  aria-hidden
                  tabIndex={-1}
                  onClick={() => setAccountOpen(false)}
                  className="fixed inset-0 z-10 cursor-default"
                />
                <div
                  role="menu"
                  className="absolute right-0 top-[calc(100%+10px)] z-20 min-w-[240px] overflow-hidden rounded-xl border border-white/10 bg-black/80 py-1 text-white backdrop-blur-[18px] shadow-[0_18px_54px_-28px_rgba(0,0,0,0.75)]"
                >
                  <div className="px-3 py-2.5">
                    <p className="truncate text-[13px] font-medium text-white">
                      {user.email}
                    </p>
                    <p className="truncate text-[12px] text-white/50">{user.company_domain}</p>
                  </div>
                  <div className="h-px bg-white/10" />
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="block w-full px-3 py-2 text-left text-[13px] text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                    role="menuitem"
                  >
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 md:hidden">
          <Link
            href="/assess"
            className="inline-flex items-center rounded-full bg-white px-3.5 py-2 text-[13px] font-medium text-black transition-[background-color,transform] duration-150 ease-out active:scale-[0.97]"
          >
            New assessment
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
            {ITEMS.map((item) => {
              const active = isActiveRoute(item.href, pathname);
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center justify-between rounded-xl px-3 py-3 text-[16px] font-medium transition-colors duration-150 ${
                    active ? 'bg-white/10 text-white' : 'text-white/85 hover:bg-white/5'
                  }`}
                >
                  <span>{item.label}</span>
                  {active && (
                    <span
                      aria-hidden
                      className="text-[12px] font-medium tracking-[0.06em] uppercase text-white/55"
                    >
                      Current
                    </span>
                  )}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={handleSignOut}
              className="mt-2 rounded-xl px-3 py-3 text-left text-[16px] font-medium text-white/65 transition-colors hover:bg-white/5 hover:text-white"
            >
              Sign out
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}

function NavLink({
  item,
  active,
}: {
  item: NavItem;
  active: boolean;
}) {
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={`group relative text-[14px] transition-[color,transform] duration-150 ease-out active:scale-[0.985] ${
        active ? 'text-white font-medium' : 'text-white/70 hover:text-white'
      }`}
    >
      <span>{item.label}</span>
      <span
        aria-hidden
        className={`absolute -bottom-1 left-0 h-px transition-[width] duration-200 ease-out group-hover:w-full ${
          active ? 'w-full' : 'w-0'
        }`}
        style={{ background: 'currentColor' }}
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
