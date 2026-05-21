'use client';

import posthog from 'posthog-js';
import type { PartialAssessmentResult, ProcessInputs, RiskScore } from '@torch/core-shared';
import type { SessionUser } from './schemas';
import { worstScore } from './format';

const ENTERED_SESSION_KEY = 'torch_posthog_app_entered';
const ATTRIBUTION_SESSION_KEY = 'torch_posthog_attribution';

type AnalyticsProps = Record<string, string | number | boolean | null | undefined>;

type AttributionProps = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  cta_location?: string;
};

export function hasPostHogConfig() {
  return Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY);
}

export function registerTorchProductContext() {
  if (!hasPostHogConfig()) return;
  try {
    posthog.register({
      product: 'torch',
      surface: 'product',
      app: 'torch_app',
    });
  } catch {
    // Analytics must never block product UI.
  }
}

export function captureEvent(event: string, props: AnalyticsProps = {}) {
  if (!hasPostHogConfig()) return;
  try {
    posthog.capture(event, props);
  } catch {
    // Analytics must never block product UI.
  }
}

export function identifyUser(user: SessionUser) {
  if (!hasPostHogConfig()) return;
  try {
    posthog.identify(user.id, {
      email: user.email,
      company_domain: user.company_domain,
    });
    posthog.group('company', user.company_domain, {
      domain: user.company_domain,
    });
  } catch {
    // Analytics must never block auth UI.
  }
}

export function resetAnalytics() {
  if (!hasPostHogConfig()) return;
  try {
    posthog.reset();
  } catch {
    // Analytics must never block auth UI.
  }
  registerTorchProductContext();
}

export function captureAppEnteredOnce() {
  if (!hasPostHogConfig() || typeof window === 'undefined') return;
  const attribution = readOrStoreAttribution();
  if (window.sessionStorage.getItem(ENTERED_SESSION_KEY)) return;
  window.sessionStorage.setItem(ENTERED_SESSION_KEY, '1');
  captureEvent('torch_app_entered', attribution);
}

export function readOrStoreAttribution(): AttributionProps {
  if (typeof window === 'undefined') return {};

  const url = new URL(window.location.href);
  const fromUrl = attributionFromSearch(url.searchParams);
  if (Object.keys(fromUrl).length > 0) {
    window.sessionStorage.setItem(ATTRIBUTION_SESSION_KEY, JSON.stringify(fromUrl));
    try {
      posthog.register(fromUrl);
    } catch {
      // Analytics must never block product UI.
    }
    return fromUrl;
  }

  try {
    const raw = window.sessionStorage.getItem(ATTRIBUTION_SESSION_KEY);
    return raw ? (JSON.parse(raw) as AttributionProps) : {};
  } catch {
    return {};
  }
}

export function assessmentProps(
  inputs: ProcessInputs,
  results?: PartialAssessmentResult,
): AnalyticsProps {
  const ratio = inputs.v_target / inputs.v_lab;
  const props: AnalyticsProps = {
    organism_class: inputs.organism_class,
    process_type: inputs.process_type,
    scale_ratio_bucket: scaleRatioBucket(ratio),
  };

  if (results) {
    props.highest_risk = worstScore(results);
    props.primary_bottleneck = results.primary_bottleneck.domain ?? 'none';
  }

  return props;
}

export function resultRiskProps(results: PartialAssessmentResult): AnalyticsProps {
  return {
    highest_risk: worstScore(results),
    primary_bottleneck: results.primary_bottleneck.domain ?? 'none',
  };
}

export function scaleRatioBucket(ratio: number): string {
  if (!Number.isFinite(ratio) || ratio <= 0) return 'unknown';
  if (ratio < 10) return '<10x';
  if (ratio < 100) return '10x-100x';
  if (ratio < 1000) return '100x-1000x';
  if (ratio < 10000) return '1000x-10000x';
  return '10000x+';
}

export function riskProp(score: RiskScore): AnalyticsProps {
  return { highest_risk: score };
}

function attributionFromSearch(search: URLSearchParams): AttributionProps {
  const props: AttributionProps = {};
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'cta_location'] as const) {
    const value = search.get(key);
    if (value) props[key] = value;
  }
  return props;
}
