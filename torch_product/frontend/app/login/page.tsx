'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { LoginForm } from '@/components/auth/LoginForm';
import { Wordmark } from '@/components/ui/Wordmark';

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
  const initialMode = search?.get('mode') === 'signup' ? 'signup' : 'login';

  useEffect(() => {
    if (auth.status === 'authed') router.replace(next);
  }, [auth.status, next, router]);

  if (auth.status === 'authed') return null;

  return (
    <main
      className="relative flex min-h-dvh flex-col items-center justify-center px-6 py-12"
      style={{ background: 'var(--color-paper-50)' }}
    >
      {/* ambient glow behind the card */}
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
            background: 'radial-gradient(ellipse at center, rgba(255,90,31,0.07) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-[420px]">
        <div className="mb-8 flex items-center gap-3">
          <Wordmark href="/" />
        </div>

        <div className="glass-card px-8 py-10">
          <LoginForm mode={initialMode} next={next} />
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
          <Wordmark href="/" />
        </div>
        <div className="glass-card h-80 px-8 py-10" />
      </div>
    </main>
  );
}
