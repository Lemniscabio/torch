'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { TopNav } from './TopNav';

export function AppShell({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (auth.status === 'guest') {
      // DEMO (email-only gate): send guests to the assessment flow rather than
      // the password /login page, which is a dead-end without a password.
      router.replace('/assess');
    }
  }, [auth.status, pathname, router]);

  if (auth.status !== 'authed') {
    return <ShellSkeleton />;
  }

  return (
    <>
      <MobileGate />
      <div className="hidden min-h-dvh flex-col md:flex">
        <TopNav />
        <div className="flex-1">{children}</div>
      </div>
    </>
  );
}

// Phone-width gate. The wizard form and results dashboard are designed
// around three-column layouts and tabular density — both fail on a
// 375px viewport in ways the user can't recover from. Tell them to
// come back on a laptop rather than ship a degraded experience.
function MobileGate() {
  return (
    <div
      className="flex min-h-dvh items-center justify-center px-8 md:hidden"
      style={{ background: 'var(--color-paper-50)' }}
    >
      <div className="max-w-[28ch] text-center">
        <p
          className="text-[28px] font-[520] tracking-[-0.02em]"
          style={{ color: 'var(--color-ink-900)' }}
        >
          Designed for desktop.
        </p>
        <p
          className="mt-3 text-[14px] leading-relaxed"
          style={{ color: 'var(--color-ink-500)' }}
        >
          Torch needs the screen real estate of a laptop or desktop for the
          form + live preview + results dashboard. Visit on a larger screen
          to run an assessment.
        </p>
      </div>
    </div>
  );
}

function ShellSkeleton() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header
        className="glass-surface sticky top-0 z-30 h-14"
        style={{ borderBottom: '1px solid var(--color-rule)' }}
      />
      <div className="flex-1" />
    </div>
  );
}
