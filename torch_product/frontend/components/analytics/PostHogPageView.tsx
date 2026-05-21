'use client';

import { Suspense, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { usePostHog } from 'posthog-js/react';
import { readOrStoreAttribution, registerTorchProductContext } from '@/lib/analytics';

function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const posthog = usePostHog();

  useEffect(() => {
    if (!pathname || !posthog) return;
    registerTorchProductContext();
    const attribution = readOrStoreAttribution();
    let url = window.origin + pathname;
    const query = searchParams.toString();
    if (query) url = `${url}?${query}`;
    posthog.capture('$pageview', {
      $current_url: url,
      ...attribution,
    });
  }, [pathname, posthog, searchParams]);

  return null;
}

export function PostHogPageView() {
  return (
    <Suspense fallback={null}>
      <PageViewTracker />
    </Suspense>
  );
}
