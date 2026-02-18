import { useState, useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

/**
 * Auth guard hook: checks supabase session on mount.
 * If no authenticated user, resets navigation to Login screen.
 * Returns { user, loading } so screens can show a spinner while checking.
 */
export function useAuthGuard(): { user: User | null; loading: boolean } {
  const navigation = useNavigation();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const supabase = createClient();
      const { data: { user: u } } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!u) {
        navigation.reset({ index: 0, routes: [{ name: 'Login' as never }] });
        return;
      }
      setUser(u);
      setLoading(false);
    };
    check();
    return () => { cancelled = true; };
  }, [navigation]);

  return { user, loading };
}
