/**
 * AuthContext: Centralized auth state.
 * Calls supabase.auth.getUser() once on mount, caches the result,
 * and subscribes to onAuthStateChange for live updates.
 * Screens use useAuth() instead of making redundant getUser() calls.
 */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as Sentry from '@sentry/react';
import { createClient } from '@/shared/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    // Initial check
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(prev => (prev?.id === u?.id ? prev : u));
      setLoading(false);
      /* istanbul ignore next -- @preserve */
      if (u) Sentry.setUser({ id: u.id, email: u.email ?? undefined });
    });

    // Live updates (sign-in, sign-out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      // Keep stable reference if same user (token refresh creates new objects)
      /* istanbul ignore next -- @preserve */
      setUser(prev => (prev?.id === u?.id ? prev : u));
      setLoading(false);
      if (u) {
        /* istanbul ignore next -- @preserve */
        Sentry.setUser({ id: u.id, email: u.email ?? undefined });
      } else {
        Sentry.setUser(null);
      }
    });

    return () => { subscription.unsubscribe(); };
  }, []);

  const value = useMemo(() => ({ user, loading }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  return useContext(AuthContext);
}
