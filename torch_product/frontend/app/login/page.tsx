'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { LoginForm } from '@/components/auth/LoginForm';
import Link from 'next/link';

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginShell />}>
      <LoginScreen />
    </Suspense>
  );
}

function LoginScreen() {
  const auth = useAuth();
  const router = useRouter();
  const search = useSearchParams();
  const next = search?.get('next') ?? '/dashboard';
  const rawMode = search?.get('mode');
  const initialMode = rawMode === 'signup' || rawMode === 'forgot' || rawMode === 'reset'
    ? rawMode
    : 'login';
  const resetToken = search?.get('token') ?? '';

  useEffect(() => {
    if (auth.status === 'authed') router.replace(next);
  }, [auth.status, next, router]);

  if (auth.status === 'authed') return null;

  return (
    <main
      className="relative flex min-h-dvh flex-col items-center justify-center px-6 py-12"
      style={{ background: 'var(--color-paper-50)' }}
    >
      {/* subtle neutral depth behind the card */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div
          style={{
            position: 'absolute',
            top: '20%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '600px',
            height: '400px',
            background: 'radial-gradient(ellipse at center, var(--color-accent-muted) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-[420px]">
        <div className="mb-8 flex items-center gap-3">
          <ProductBrand />
        </div>

        <div className="glass-card px-8 py-10">
          <LoginForm mode={initialMode} next={next} resetToken={resetToken} />
        </div>
      </div>
    </main>
  );
}

function LoginShell() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-[420px]">
        <div className="mb-8">
          <ProductBrand />
        </div>
        <div className="glass-card h-80 px-8 py-10" />
      </div>
    </main>
  );
}

function ProductBrand() {
  return (
    <Link
      href="/assess"
      className="group inline-flex items-end gap-2.5 transition-opacity duration-200 hover:opacity-85"
      aria-label="Torch assessment"
    >
      <span
        className="text-[30px] leading-none font-semibold tracking-[-0.02em] transition-colors duration-300"
        style={{ color: 'var(--color-ink-900)' }}
      >
        Torch
      </span>
      <span
        className="flex flex-col items-start leading-none pb-[2px] transition-colors duration-300"
        style={{ color: 'var(--color-ink-500)' }}
      >
        <span className="text-[7px] font-medium tracking-[0.02em] md:text-[8px]">by</span>
        <span className="text-[9px] font-medium tracking-[-0.02em] md:text-[10px]">Lemnisca</span>
      </span>
    </Link>
  );
}
