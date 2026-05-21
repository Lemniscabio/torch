'use client';

import { useEffect } from 'react';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { captureAppEnteredOnce, hasPostHogConfig, registerTorchProductContext } from '@/lib/analytics';

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;

    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
      capture_pageview: false,
      capture_pageleave: true,
      cross_subdomain_cookie: true,
      session_recording: {
        maskAllInputs: true,
      },
    });
    registerTorchProductContext();
    captureAppEnteredOnce();
  }, []);

  if (!hasPostHogConfig()) {
    return <>{children}</>;
  }

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
