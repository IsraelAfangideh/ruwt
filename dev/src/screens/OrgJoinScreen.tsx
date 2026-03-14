import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DetailCardSkeleton } from '@/components/ui/ScreenSkeletons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { createClient } from '@/lib/supabase/client';
import { resetNavigation } from '@/navigation/resetNavigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily } from '@/theme/tokens';

export function OrgJoinScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { token } = (route.params || {}) as { token?: string };
  const c = useColors();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) {
        // Store intent and redirect to login
        localStorage.setItem('ruwt_org_join_token', token || '');
        resetNavigation(navigation, [{ name: 'Login' }]);
        return;
      }
      setLoading(false);
    };
    init();
  }, [navigation, supabase.auth, token]);

  const handleJoin = useCallback(async () => {
    if (!token) return;
    setJoining(true);
    setError(null);
    try {
      const res = await fetch('/api/orgs/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          resetNavigation(navigation, [{ name: 'Assessments' }]);
        }, 2000);
      } else {
        setError(data.error || 'Failed to join organization');
      }
    } catch {
      setError('Network error');
    }
    setJoining(false);
  }, [token, navigation]);

  if (loading) {
    return <DetailCardSkeleton />;
  }

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <Card style={[styles.card, { borderColor: c.border }]}>
        <CardHeader>
          <CardTitle>Join Team</CardTitle>
          <CardDescription>
            You've been invited to join an organization on Ruwt.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {success ? (
            <View style={[styles.successBanner, { backgroundColor: c.success + '15' }]}>
              <Text style={{ color: c.success, fontSize: fontSizes.md, fontWeight: '600' }}>
                You've joined the team! Redirecting...
              </Text>
            </View>
          ) : (
            <>
              <Text style={[styles.info, { color: c.textMuted }]}>
                Clicking "Accept Invitation" will add you to the team. You'll be able to view
                shared assessments and candidate results.
              </Text>
              <Button onPress={handleJoin} disabled={joining}>
                {joining ? 'Joining...' : 'Accept Invitation'}
              </Button>
              {error && (
                <Text style={{ color: c.destructive, fontSize: fontSizes.sm, marginTop: spacing.sm }}>
                  {error}
                </Text>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  card: { maxWidth: 480, width: '100%' },
  info: { fontSize: fontSizes.sm, marginBottom: spacing.lg, fontFamily: fontFamily.body },
  successBanner: { padding: spacing.md, borderRadius: 8, alignItems: 'center' },
});
