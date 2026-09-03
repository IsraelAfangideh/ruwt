/**
 * AuthContext: Centralized auth state.
 * Calls supabase.auth.getUser() once on mount, caches the result,
 * and subscribes to onAuthStateChange for live updates.
 * Screens use useAuth() instead of making redundant getUser() calls.
 */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as Sentry from '@sentry/react';
import { createClient } from '@/shared/lib/supabase/client';
import { reportAttribution } from '@/shared/lib/attribution';
import type { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

/** Cap getUser so a hung Supabase call cannot pin the app on a skeleton. */
export const AUTH_LOAD_TIMEOUT_MS = 4000;

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    // Once per mount, so a token refresh does not re-post. The record clears
    // itself on success, so later page loads send nothing at all.
    let reported = false;

    /** Attaches the stored first-touch record to the account, once. */
    const report = (u: User | null) => {
      if (!u || reported) return;
      reported = true;
      void reportAttribution();
    };

    let resolved = false;
    const applyUser = (u: User | null, fromTimeout = false) => {
      if (resolved && fromTimeout) return;
      resolved = true;
      setUser(prev => (prev?.id === u?.id ? prev : u));
      setLoading(false);
      report(u);
      /* istanbul ignore next -- @preserve */
      if (u) Sentry.setUser({ id: u.id, email: u.email ?? undefined });
      else Sentry.setUser(null);
    };

    const timeout = setTimeout(() => applyUser(null, true), AUTH_LOAD_TIMEOUT_MS);

    // Initial check — always settle loading, even if getUser rejects or hangs.
    supabase.auth.getUser()
      .then(({ data: { user: u } }) => applyUser(u))
      .catch(() => applyUser(null));

    // Live updates (sign-in, sign-out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      applyUser(session?.user ?? null);
    });

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(() => ({ user, loading }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  return useContext(AuthContext);
}
