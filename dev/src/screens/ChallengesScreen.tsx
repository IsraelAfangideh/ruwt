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
  { key: 'qa_testing', label: 'QA Testing' },
  { key: 'frontend', label: 'Frontend' },
  { key: 'backend_api', label: 'Backend API' },
  { key: 'data_engineering', label: 'Data' },
  { key: 'devops', label: 'DevOps' },
] as const;

const LANGUAGES = [
  { key: 'all', label: 'All Languages' },
  { key: 'javascript', label: 'JavaScript' },
  { key: 'python', label: 'Python' },
] as const;

const TIER_ORDER = ['onboarding', 'core', 'headline'] as const;
const TIER_META: Record<string, { label: string; description: string }> = {
  onboarding: { label: 'Getting Started', description: 'Beginner-friendly challenges to learn the platform.' },
  core: { label: 'Core Challenges', description: 'Standard challenges across all skill categories.' },
  headline: { label: 'Headline Challenges', description: 'Advanced challenges for experienced AI practitioners.' },
};

function getInitialTab(): string {
  if (typeof window === 'undefined') return 'all';
  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab');
  if (tab && CATEGORIES.some((c) => c.key === tab)) return tab;
  return 'all';
}

function getInitialLang(): string {
  if (typeof window === 'undefined') return 'all';
  const params = new URLSearchParams(window.location.search);
  return params.get('lang') || 'all';
}

export function ChallengesScreen() {
  const navigation = useNavigation();
  const [user, setUser] = useState<any>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState(getInitialTab);
  const [activeLang, setActiveLang] = useState(getInitialLang);
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

  const syncUrlParams = (cat: string, lang: string) => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (cat === 'all') url.searchParams.delete('tab');
    else url.searchParams.set('tab', cat);
    if (lang === 'all') url.searchParams.delete('lang');
    else url.searchParams.set('lang', lang);
    window.history.replaceState({}, '', url.toString());
  };

  const handleCategoryChange = (key: string) => {
    setActiveCategory(key);
    syncUrlParams(key, activeLang);
  };

  const handleLangChange = (key: string) => {
    setActiveLang(key);
    syncUrlParams(activeCategory, key);
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  if (!user) return null;

  let filtered = challenges;
  if (activeCategory !== 'all') {
    filtered = filtered.filter((ch) => ch.category === activeCategory);
  }
  if (activeLang !== 'all') {
    filtered = filtered.filter((ch) => (ch.language || 'javascript') === activeLang);
  }

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

      {/* Language filter pills */}
      <View style={styles.langRow}>
        {LANGUAGES.map((lang) => {
          const isActive = activeLang === lang.key;
          return (
            <Pressable
              key={lang.key}
              onPress={() => handleLangChange(lang.key)}
              style={[
                styles.langPill,
                {
                  backgroundColor: isActive ? c.accent : 'transparent',
                  borderColor: isActive ? c.accent : c.border,
                },
              ]}
            >
              <Text style={[styles.langPillText, { color: isActive ? '#0d1117' : c.textMuted }]}>
                {lang.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Category tabs */}
      <View style={styles.tabs}>
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.key;
          return (
            <Pressable
              key={cat.key}
              onPress={() => handleCategoryChange(cat.key)}
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
            <Text style={[styles.emptySub, { color: c.textMuted }]}>
              {activeLang !== 'all' || activeCategory !== 'all'
                ? 'Try adjusting your filters.'
                : 'Check back later for new challenges.'}
            </Text>
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
  langRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  langPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 9999,
    borderWidth: 1,
  },
  langPillText: { fontSize: fontSizes.xs, fontWeight: '600' },
  tabs: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg, flexWrap: 'wrap' },
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
