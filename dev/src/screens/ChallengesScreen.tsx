import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { createClient } from '@/lib/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { ChallengeCard, type Challenge } from '@/components/ChallengeCard';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily } from '@/theme/tokens';

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'real_world', label: 'Real-World' },
  { key: 'model_selection', label: 'Model Selection' },
  { key: 'prompt_efficiency', label: 'Prompt Efficiency' },
  { key: 'iterative_debugging', label: 'Debugging' },
  { key: 'multi_model_strategy', label: 'Multi-Model' },
] as const;

const TIER_ORDER = ['onboarding', 'core', 'headline'] as const;
const TIER_META: Record<string, { label: string; description: string }> = {
  onboarding: { label: 'Getting Started', description: 'Beginner-friendly challenges to learn the platform.' },
  core: { label: 'Core Challenges', description: 'Standard challenges across all skill categories.' },
  headline: { label: 'Headline Challenges', description: 'Advanced challenges for experienced AI practitioners.' },
};

export function ChallengesScreen() {
  const navigation = useNavigation();
  const [user, setUser] = useState<any>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const supabase = createClient();
  const c = useColors();

  useEffect(() => {
    const init = async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) {
        navigation.reset({ index: 0, routes: [{ name: 'Login' as never }] });
        return;
      }
      setUser(u);
      try {
        const res = await fetch('/api/challenges');
        if (res.ok) {
          const data = await res.json();
          setChallenges((data as Challenge[]) ?? []);
        }
      } catch (_) {
        setChallenges([]);
      }
      setLoading(false);
    };
    init();
  }, [navigation, supabase.auth]);

  if (loading && !user) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  if (!user) return null;

  const filtered = activeCategory === 'all'
    ? challenges
    : challenges.filter((ch) => ch.category === activeCategory);

  // Group by tier
  const grouped = TIER_ORDER.map((tier) => ({
    tier,
    meta: TIER_META[tier],
    items: filtered
      .filter((ch) => (ch.tier || 'core') === tier)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
  })).filter((g) => g.items.length > 0);

  return (
    <DashboardLayout user={user}>
      <View style={[styles.section, { borderBottomColor: c.border }]}>
        <Text style={[styles.title, { color: c.text }]}>Engineering Challenges</Text>
        <Text style={[styles.subtitle, { color: c.textMuted }]}>
          Real engineering problems. Real AI models. Ranked by efficiency.
        </Text>
      </View>

      <View style={styles.tabs}>
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.key;
          return (
            <Pressable
              key={cat.key}
              onPress={() => setActiveCategory(cat.key)}
              style={[
                styles.tab,
                {
                  borderBottomColor: isActive ? c.accent : 'transparent',
                  borderBottomWidth: 2,
                },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: isActive ? c.text : c.textMuted },
                ]}
              >
                {cat.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {filtered.length === 0 ? (
        <Card style={[styles.empty, { borderStyle: 'dashed', backgroundColor: c.muted + '20' }]}>
          <CardContent style={styles.emptyContent}>
            <Text style={[styles.emptyTitle, { color: c.text }]}>No Challenges Available</Text>
            <Text style={[styles.emptySub, { color: c.textMuted }]}>Check back later for new challenges.</Text>
          </CardContent>
        </Card>
      ) : (
        grouped.map((group) => (
          <View key={group.tier} style={styles.tierSection}>
            <Text style={[styles.tierTitle, { color: c.text }]}>{group.meta.label}</Text>
            <Text style={[styles.tierDesc, { color: c.textMuted }]}>{group.meta.description}</Text>
            <View style={styles.grid}>
              {group.items.map((ch) => (
                <ChallengeCard key={ch.id} challenge={ch} />
              ))}
            </View>
          </View>
        ))
      )}
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  section: { marginBottom: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: 'transparent' },
  title: { fontSize: fontSizes['3xl'], fontWeight: '700', fontFamily: fontFamily.body },
  subtitle: { fontSize: fontSizes.sm, marginTop: spacing.xs },
  tabs: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  tab: { paddingBottom: spacing.sm },
  tabText: { fontSize: fontSizes.sm, fontWeight: '600' },
  empty: { borderWidth: 2 },
  emptyContent: { alignItems: 'center', paddingVertical: spacing['2xl'] },
  emptyTitle: { fontSize: fontSizes.lg, fontWeight: '600' },
  emptySub: { fontSize: fontSizes.sm, marginTop: spacing.xs },
  tierSection: { marginBottom: spacing.xl },
  tierTitle: { fontSize: fontSizes.lg, fontWeight: '700', fontFamily: fontFamily.body, marginBottom: spacing.xs },
  tierDesc: { fontSize: fontSizes.sm, marginBottom: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
});
