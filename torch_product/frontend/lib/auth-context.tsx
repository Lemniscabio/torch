'use client';

// AuthProvider — single client-side source of truth for the current user.
// Wraps the whole app in app/layout.tsx. Hydrates from localStorage on mount;
// pages that need the user pull from useAuth() rather than reaching for the
// API themselves. signIn / signUp / signOut are the only mutation points.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { api, clearToken, getToken, setToken, type ApiError } from './api';
import { captureEvent, identifyUser, resetAnalytics } from './analytics';
import type { SessionUser } from './schemas';

type AuthState =
  | { status: 'loading'; user: null }
  | { status: 'guest'; user: null }
  | { status: 'authed'; user: SessionUser };

type AuthContextValue = AuthState & {
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthResponse = {
  ok: boolean;
  user: { id: string; email: string; company_domain: string; token: string };
};

type MeResponse = {
  id: string;
  email: string;
  company_domain: string;
};

function toSessionUser(u: { id: string; email: string; company_domain: string }): SessionUser {
  return { id: u.id, email: u.email, company_domain: u.company_domain };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null });

  // Boot: if a token is in storage, verify it by calling /api/auth/me.
  // No token → land in guest. Bad token → cleared, also guest.
  useEffect(() => {
    let cancelled = false;
    async function boot() {
      const token = getToken();
      if (!token) {
        if (!cancelled) setState({ status: 'guest', user: null });
        return;
      }
      try {
        const me = await api<MeResponse>('/api/auth/me');
        if (!cancelled) {
          const user = toSessionUser(me);
          identifyUser(user);
          setState({ status: 'authed', user });
        }
      } catch {
        clearToken();
        if (!cancelled) setState({ status: 'guest', user: null });
      }
    }
    boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await api<AuthResponse>('/api/auth', {
      authed: false,
      method: 'POST',
      body: JSON.stringify({ email, password, action: 'login' }),
    });
    setToken(res.user.token);
    const user = toSessionUser(res.user);
    identifyUser(user);
    captureEvent('user_signed_in');
    setState({ status: 'authed', user });
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const res = await api<AuthResponse>('/api/auth', {
      authed: false,
      method: 'POST',
      body: JSON.stringify({ email, password, action: 'signup' }),
    });
    setToken(res.user.token);
    const user = toSessionUser(res.user);
    identifyUser(user);
    captureEvent('account_created');
    setState({ status: 'authed', user });
  }, []);

  const signOut = useCallback(() => {
    clearToken();
    resetAnalytics();
    setState({ status: 'guest', user: null });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, signIn, signUp, signOut }),
    [state, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>.');
  }
  return ctx;
}

export type { AuthContextValue };
export type { ApiError };
