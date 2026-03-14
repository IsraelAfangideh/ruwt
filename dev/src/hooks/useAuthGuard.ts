import { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '@/lib/AuthContext';
import { resetNavigation } from '@/navigation/resetNavigation';
import type { User } from '@supabase/supabase-js';

/**
 * Auth guard hook: reads cached auth state from AuthContext.
 * Redirects to Login if not authenticated (after loading completes).
 * No API calls — the AuthProvider already checked auth on app mount.
 */
export function useAuthGuard(): { user: User | null; loading: boolean } {
  const navigation = useNavigation();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      resetNavigation(navigation, [{ name: 'Login' }]);
    }
  }, [loading, user, navigation]);

  return { user, loading };
}
