'use client';

// Client-side fetch wrapper. Talks DIRECTLY to the Express backend at
// NEXT_PUBLIC_BACKEND_URL — no BFF, no Next.js API proxy. Just CORS.
//
// Auth: reads the JWT from localStorage (key: torch_token) and attaches it
// as Authorization: Bearer. On 401 we clear the token so the next render
// boots the user back to /login. Stays in this single chokepoint so the
// rest of the app never reaches for storage or builds Authorization headers.

export const TOKEN_STORAGE_KEY = 'torch_token';

const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000').replace(
  /\/$/,
  '',
);

export type ApiError = { error: string; status: number };

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setToken(token: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearToken() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
}

type RequestOptions = RequestInit & {
  authed?: boolean;
};

export async function api<T = unknown>(path: string, init: RequestOptions = {}): Promise<T> {
  const { authed = true, headers, ...rest } = init;
  const finalHeaders = new Headers(headers);

  if (init.body && !finalHeaders.has('Content-Type')) {
    finalHeaders.set('Content-Type', 'application/json');
  }

  if (authed) {
    const token = getToken();
    if (token) finalHeaders.set('Authorization', `Bearer ${token}`);
  }

  const url = path.startsWith('http') ? path : `${BACKEND_URL}${path}`;
  const res = await fetch(url, { ...rest, headers: finalHeaders });

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    // Treat 401 as session expiry. Subsequent navigations will route through
    // /login automatically once the AuthProvider re-reads storage.
    if (res.status === 401) clearToken();
    const message =
      body && typeof body === 'object' && body !== null && 'error' in body
        ? String((body as Record<string, unknown>).error)
        : `Request failed: ${res.status}`;
    const err: ApiError = { error: message, status: res.status };
    throw err;
  }

  return body as T;
}
