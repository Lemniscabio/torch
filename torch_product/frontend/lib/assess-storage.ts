'use client';

// Persists the assess form draft to sessionStorage so the user doesn't lose
// progress on accidental reload. Per-tab (sessionStorage, not localStorage)
// so two open tabs don't fight each other.
//
// Storage key is versioned (`v1`) — if AssessFormValues shape changes
// incompatibly, bump the key so old drafts are quietly discarded rather
// than failing zod validation at form mount.

import type { AssessFormValues } from './assess-schema';

const STORAGE_KEY = 'torch_assess_draft_v1';

export function loadDraft(): Partial<AssessFormValues> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<AssessFormValues>;
  } catch {
    return null;
  }
}

export function saveDraft(values: Partial<AssessFormValues>) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(values));
  } catch {
    // Quota exceeded or storage disabled — silent failure is fine, this is
    // a convenience not a correctness boundary.
  }
}

export function clearDraft() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(STORAGE_KEY);
}
