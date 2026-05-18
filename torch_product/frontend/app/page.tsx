'use client';

// Root / — authenticated users land on the dashboard; new visitors go
// straight into the assessment and only see auth after the run completes.

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function Home() {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (auth.status === 'loading') return;
    router.replace(auth.status === 'authed' ? '/dashboard' : '/assess');
  }, [auth.status, router]);

  return null;
}
