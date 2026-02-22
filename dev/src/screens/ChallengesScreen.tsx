import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Pressable, TextInput, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { createClient } from '@/lib/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { ChallengeCard, type Challenge } from '@/components/ChallengeCard';
import { useColors, useTheme } from '@/theme';
import { spacing, fontSizes, fontFamily, radii } from '@/theme/tokens';
import { useToast } from '@/components/ui/Toast';
import { useIsMobile } from '@/lib/useIsMobile';
import { DIFFICULTIES, getDifficultyStyle } from '@/lib/difficulty';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';

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

type SortOption = 'default' | 'difficulty' | 'popularity' | 'cost';
const SORT_OPTIONS: { key: SortOption; label: string }[] = [
  { key: 'default', label: 'Default' },
  { key: 'difficulty', label: 'Difficulty' },
  { key: 'popularity', label: 'Most Solved' },
  { key: 'cost', label: 'Lowest Cost' },
];

const DIFFICULTY_ORDER: Record<string, number> = {
  sprint: 0, easy: 1, medium: 2, hard: 3, impossible: 4,
};

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

function getInitialDifficulty(): string {
  if (typeof window === 'undefined') return 'all';
  const params = new URLSearchParams(window.location.search);
  return params.get('difficulty') || 'all';
}

export function ChallengesScreen() {
  useDocumentMeta({ title: 'AI Coding Challenges', description: 'Browse 60+ coding challenges across 11 categories. Test your AI efficiency in model selection, prompt engineering, debugging, and more.', canonicalPath: '/challenges' });
  const navigation = useNavigation();
  const [user, setUser] = useState<any>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState(getInitialTab);
  const [activeLang, setActiveLang] = useState(getInitialLang);
  const [activeDifficulty, setActiveDifficulty] = useState(getInitialDifficulty);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('default');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [sortMenuPos, setSortMenuPos] = useState<{ top: number; right: number } | null>(null);
  const sortBtnRef = useRef<any>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'solved' | 'in_progress' | 'not_started'>('all');
  const supabase = createClient();
  const c = useColors();
  const { isDark } = useTheme();
  const activePillText = isDark ? '#0f0e0d' : '#0d1117';
  const { showToast } = useToast();
  const isMobile = useIsMobile();

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
        showToast('Failed to load challenges. Check your connection.', 'error');
      }
      setLoading(false);
    };
    init();
  }, [navigation, supabase.auth]);

  const syncUrlParams = useCallback((cat: string, lang: string, diff: string) => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (cat === 'all') url.searchParams.delete('tab');
    else url.searchParams.set('tab', cat);
    if (lang === 'all') url.searchParams.delete('lang');
    else url.searchParams.set('lang', lang);
    if (diff === 'all') url.searchParams.delete('difficulty');
    else url.searchParams.set('difficulty', diff);
    window.history.replaceState({}, '', url.toString());
  }, []);

  const handleCategoryChange = (key: string) => {
    setActiveCategory(key);
    syncUrlParams(key, activeLang, activeDifficulty);
  };

  const handleLangChange = (key: string) => {
    setActiveLang(key);
    syncUrlParams(activeCategory, key, activeDifficulty);
  };

  const handleDifficultyChange = (key: string) => {
    setActiveDifficulty(key);
    syncUrlParams(activeCategory, activeLang, key);
  };

  // Progress stats (global)
  const progressStats = useMemo(() => {
    const total = challenges.length;
    const solved = challenges.filter((ch) => ch.userStatus === 'passed').length;
    const inProgress = challenges.filter((ch) => ch.userStatus === 'in_progress').length;
    const notStarted = total - solved - inProgress;
    return { total, solved, inProgress, notStarted };
  }, [challenges]);

  // Filtered + sorted challenges
  const filtered = useMemo(() => {
    let result = challenges;

    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((ch) =>
        ch.title.toLowerCase().includes(q) ||
        ch.description.toLowerCase().includes(q) ||
        (ch.skillTested && ch.skillTested.toLowerCase().includes(q))
      );
    }

    if (activeCategory !== 'all') {
      result = result.filter((ch) => ch.category === activeCategory);
    }
    if (activeLang !== 'all') {
      result = result.filter((ch) => (ch.language || 'javascript') === activeLang);
    }
    if (activeDifficulty !== 'all') {
      result = result.filter((ch) => ch.difficulty === activeDifficulty);
    }

    // Status filter (from clickable stats)
    if (statusFilter === 'solved') {
      result = result.filter((ch) => ch.userStatus === 'passed');
    } else if (statusFilter === 'in_progress') {
      result = result.filter((ch) => ch.userStatus === 'in_progress');
    } else if (statusFilter === 'not_started') {
      result = result.filter((ch) => ch.userStatus !== 'passed' && ch.userStatus !== 'in_progress');
    }

    // Sort
    const dir = sortDirection === 'asc' ? 1 : -1;
    if (sortBy === 'difficulty') {
      result = [...result].sort((a, b) =>
        dir * ((DIFFICULTY_ORDER[a.difficulty] ?? 2) - (DIFFICULTY_ORDER[b.difficulty] ?? 2))
      );
    } else if (sortBy === 'popularity') {
      result = [...result].sort((a, b) =>
        dir * ((b.stats?.solvers ?? 0) - (a.stats?.solvers ?? 0))
      );
    } else if (sortBy === 'cost') {
      result = [...result].sort((a, b) =>
        dir * ((a.maxCost ?? Infinity) - (b.maxCost ?? Infinity))
      );
    }

    return result;
  }, [challenges, searchQuery, activeCategory, activeLang, activeDifficulty, statusFilter, sortBy, sortDirection]);

  // Stats that reflect current non-status filters (for the clickable stats panel)
  const filteredStats = useMemo(() => {
    let result = challenges;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((ch) =>
        ch.title.toLowerCase().includes(q) ||
        ch.description.toLowerCase().includes(q) ||
        (ch.skillTested && ch.skillTested.toLowerCase().includes(q))
      );
    }
    if (activeCategory !== 'all') result = result.filter((ch) => ch.category === activeCategory);
    if (activeLang !== 'all') result = result.filter((ch) => (ch.language || 'javascript') === activeLang);
    if (activeDifficulty !== 'all') result = result.filter((ch) => ch.difficulty === activeDifficulty);

    const total = result.length;
    const solved = result.filter((ch) => ch.userStatus === 'passed').length;
    const inProgress = result.filter((ch) => ch.userStatus === 'in_progress').length;
    const notStarted = total - solved - inProgress;
    return { total, solved, inProgress, notStarted };
  }, [challenges, searchQuery, activeCategory, activeLang, activeDifficulty]);

  // Group by tier (only in default sort)
  const grouped = useMemo(() => {
    if (sortBy !== 'default') return null;
    return TIER_ORDER.map((tier) => ({
      tier,
      meta: TIER_META[tier],
      items: filtered
        .filter((ch) => (ch.tier || 'core') === tier)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    })).filter((g) => g.items.length > 0);
  }, [filtered, sortBy]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  if (!user) return null;

  const hasActiveFilters = activeLang !== 'all' || activeCategory !== 'all' || activeDifficulty !== 'all' || searchQuery.trim() !== '' || statusFilter !== 'all';
  const hasNonStatusFilters = activeLang !== 'all' || activeCategory !== 'all' || activeDifficulty !== 'all' || searchQuery.trim() !== '';
  const displayStats = hasNonStatusFilters ? filteredStats : progressStats;
  const progressPct = displayStats.total > 0 ? Math.round((displayStats.solved / displayStats.total) * 100) : 0;
  return (
    <DashboardLayout user={user}>
      {/* Header with title + progress */}
      <View style={styles.headerSection}>
        <View style={styles.headerLeft}>
          <Text style={[styles.title, { color: c.text }]}>Engineering Challenges</Text>
          <Text style={[styles.subtitle, { color: c.textMuted }]}>
            Real engineering problems. Real AI models. Ranked by efficiency.
          </Text>
        </View>
        {/* Progress summary — clickable stats filter */}
        <View style={[styles.progressCard, { backgroundColor: c.muted, borderColor: c.border }]}>
          <View style={styles.progressStats}>
            <Pressable
              onPress={() => setStatusFilter(statusFilter === 'solved' ? 'all' : 'solved')}
              style={[styles.progressStat, { cursor: 'pointer' as any }]}
            >
              <Text style={[styles.progressNum, { color: c.success }]}>{displayStats.solved}</Text>
              <Text style={[styles.progressLabel, { color: statusFilter === 'solved' ? c.success : c.textMuted, fontWeight: statusFilter === 'solved' ? '700' : '400' }]}>
                solved{hasNonStatusFilters ? ` of ${progressStats.solved}` : ''}
              </Text>
              {statusFilter === 'solved' && <View style={[styles.activeStatBar, { backgroundColor: c.success }]} />}
            </Pressable>
            <View style={[styles.progressDivider, { backgroundColor: c.border }]} />
            <Pressable
              onPress={() => setStatusFilter(statusFilter === 'in_progress' ? 'all' : 'in_progress')}
              style={[styles.progressStat, { cursor: 'pointer' as any }]}
            >
              <Text style={[styles.progressNum, { color: c.accent }]}>{displayStats.inProgress}</Text>
              <Text style={[styles.progressLabel, { color: statusFilter === 'in_progress' ? c.accent : c.textMuted, fontWeight: statusFilter === 'in_progress' ? '700' : '400' }]}>
                in progress{hasNonStatusFilters ? ` of ${progressStats.inProgress}` : ''}
              </Text>
              {statusFilter === 'in_progress' && <View style={[styles.activeStatBar, { backgroundColor: c.accent }]} />}
            </Pressable>
            <View style={[styles.progressDivider, { backgroundColor: c.border }]} />
            <Pressable
              onPress={() => setStatusFilter(statusFilter === 'not_started' ? 'all' : 'not_started')}
              style={[styles.progressStat, { cursor: 'pointer' as any }]}
            >
              <Text style={[styles.progressNum, { color: c.textMuted }]}>{displayStats.notStarted}</Text>
              <Text style={[styles.progressLabel, { color: statusFilter === 'not_started' ? c.text : c.textMuted, fontWeight: statusFilter === 'not_started' ? '700' : '400' }]}>
                not started
              </Text>
              {statusFilter === 'not_started' && <View style={[styles.activeStatBar, { backgroundColor: c.textMuted }]} />}
            </Pressable>
            <View style={[styles.progressDivider, { backgroundColor: c.border }]} />
            <Pressable
              onPress={() => setStatusFilter('all')}
              style={[styles.progressStat, { cursor: 'pointer' as any }]}
            >
              <Text style={[styles.progressNum, { color: c.text }]}>{displayStats.total}</Text>
              <Text style={[styles.progressLabel, { color: c.textMuted }]}>total</Text>
            </Pressable>
          </View>
          <View style={[styles.progressBarBg, { backgroundColor: c.border }]}>
            <View style={[styles.progressBarFill, { width: `${progressPct}%` as any, backgroundColor: c.success }]} />
          </View>
        </View>
      </View>

      {/* Sticky filter bar */}
      {/* @ts-ignore position: sticky is web-only */}
      <View style={[
        styles.filterBar,
        { backgroundColor: c.bg, borderBottomColor: c.border },
      ]}>
        {/* Search + sort row */}
        <View style={styles.searchRow}>
          <View style={[styles.searchBox, { backgroundColor: c.muted, borderColor: c.border }]}>
            <Text style={[styles.searchIcon, { color: c.textMuted }]}>{'\u2315'}</Text>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search challenges..."
              placeholderTextColor={c.textSubtle}
              style={[styles.searchInput, { color: c.text }]}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')} style={styles.clearBtn}>
                <Text style={{ color: c.textMuted, fontSize: 16 }}>{'\u2715'}</Text>
              </Pressable>
            )}
          </View>

          {/* Sort dropdown */}
          <View style={styles.sortWrapper} ref={sortBtnRef}>
            <Pressable
              onPress={() => {
                if (showSortMenu) {
                  setShowSortMenu(false);
                  return;
                }
                // Measure button position to place fixed menu
                const node = sortBtnRef.current as any;
                if (node && node.getBoundingClientRect) {
                  const rect = node.getBoundingClientRect();
                  setSortMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                }
                setShowSortMenu(true);
              }}
              style={[styles.sortButton, { backgroundColor: c.muted, borderColor: c.border }]}
            >
              <Text style={[styles.sortButtonText, { color: c.text }]}>
                Sort: {SORT_OPTIONS.find((s) => s.key === sortBy)?.label}
                {sortBy !== 'default' ? (sortDirection === 'asc' ? ' \u2191' : ' \u2193') : ''}
              </Text>
              <Text style={{ color: c.textMuted, fontSize: 10 }}>{'\u25BC'}</Text>
            </Pressable>
          </View>
        </View>

        {/* Filter pills - all in one compact row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterScrollContent}>
          {/* Language pills */}
          {LANGUAGES.map((lang) => {
            const isActive = activeLang === lang.key;
            return (
              <Pressable
                key={`lang-${lang.key}`}
                onPress={() => handleLangChange(lang.key)}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: isActive ? c.accent : 'transparent',
                    borderColor: isActive ? c.accent : c.border,
                  },
                ]}
              >
                <Text style={[styles.filterPillText, { color: isActive ? activePillText : c.textMuted }]}>
                  {lang.label}
                </Text>
              </Pressable>
            );
          })}

          <View style={[styles.filterDivider, { backgroundColor: c.border }]} />

          {/* Difficulty pills */}
          {DIFFICULTIES.map((diff) => {
            const isActive = activeDifficulty === diff.key;
            const diffStyle = diff.key === 'all' ? null : getDifficultyStyle(diff.key);
            return (
              <Pressable
                key={`diff-${diff.key}`}
                onPress={() => handleDifficultyChange(diff.key)}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: isActive ? (diffStyle?.color ?? c.accent) : 'transparent',
                    borderColor: isActive ? (diffStyle?.color ?? c.accent) : c.border,
                  },
                ]}
              >
                <Text style={[styles.filterPillText, { color: isActive ? activePillText : c.textMuted }]}>
                  {diff.label}
                </Text>
              </Pressable>
            );
          })}

          <View style={[styles.filterDivider, { backgroundColor: c.border }]} />

          {/* Category pills */}
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.key;
            return (
              <Pressable
                key={`cat-${cat.key}`}
                onPress={() => handleCategoryChange(cat.key)}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: isActive ? c.accent : 'transparent',
                    borderColor: isActive ? c.accent : c.border,
                  },
                ]}
              >
                <Text style={[styles.filterPillText, { color: isActive ? activePillText : c.textMuted }]}>
                  {cat.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Result count */}
        <View style={styles.resultRow}>
          <Text style={[styles.resultCount, { color: c.textMuted }]}>
            Showing {filtered.length} challenge{filtered.length !== 1 ? 's' : ''}
            {hasActiveFilters && (
              <Text> (filtered)</Text>
            )}
          </Text>
          {hasActiveFilters && (
            <Pressable
              onPress={() => {
                setActiveCategory('all');
                setActiveLang('all');
                setActiveDifficulty('all');
                setSearchQuery('');
                setStatusFilter('all');
                syncUrlParams('all', 'all', 'all');
              }}
              style={[styles.clearFilters, { borderColor: c.border }]}
            >
              <Text style={[styles.clearFiltersText, { color: c.accent }]}>Clear filters</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Challenge grid */}
      {filtered.length === 0 ? (
        <Card style={[styles.empty, { borderStyle: 'dashed', backgroundColor: c.muted + '20' }]}>
          <CardContent style={styles.emptyContent}>
            <Text style={[styles.emptyIcon, { color: c.textSubtle }]}>{'\uD83D\uDD0D'}</Text>
            <Text style={[styles.emptyTitle, { color: c.text }]}>No Challenges Found</Text>
            <Text style={[styles.emptySub, { color: c.textMuted }]}>
              {hasActiveFilters
                ? 'Try adjusting your filters or search query.'
                : 'Check back later for new challenges.'}
            </Text>
            {hasActiveFilters && (
              <Pressable
                onPress={() => {
                  setActiveCategory('all');
                  setActiveLang('all');
                  setActiveDifficulty('all');
                  setSearchQuery('');
                  setStatusFilter('all');
                  syncUrlParams('all', 'all', 'all');
                }}
                style={[styles.emptyBtn, { backgroundColor: c.accentBg }]}
              >
                <Text style={[styles.emptyBtnText, { color: c.accent }]}>Clear all filters</Text>
              </Pressable>
            )}
          </CardContent>
        </Card>
      ) : grouped ? (
        // Default sort: grouped by tier
        grouped.map((group) => (
          <View key={group.tier} style={styles.tierSection}>
            {/* @ts-ignore position: sticky is web-only */}
            <View style={[styles.tierHeader, { backgroundColor: c.bg }]}>
              <Text style={[styles.tierTitle, { color: c.text }]}>{group.meta.label}</Text>
              <Text style={[styles.tierDesc, { color: c.textMuted }]}>{group.meta.description}</Text>
            </View>
            <View style={isMobile ? styles.gridMobile : styles.grid}>
              {group.items.map((ch) => (
                <ChallengeCard key={ch.id} challenge={ch} />
              ))}
            </View>
          </View>
        ))
      ) : (
        // Custom sort: flat list
        <View style={styles.tierSection}>
          <View style={isMobile ? styles.gridMobile : styles.grid}>
            {filtered.map((ch) => (
              <ChallengeCard key={ch.id} challenge={ch} />
            ))}
          </View>
        </View>
      )}

      {/* Back to top button */}
      {filtered.length > 12 && (
        <Pressable
          onPress={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          style={[styles.backToTop, { backgroundColor: c.accent }]}
        >
          <Text style={styles.backToTopText}>{'\u2191'} Back to top</Text>
        </Pressable>
      )}

      {/* Sort menu — rendered outside filter bar as fixed overlay to escape stacking context */}
      {showSortMenu && sortMenuPos && (
        <>
          <Pressable style={styles.sortBackdrop} onPress={() => setShowSortMenu(false)} />
          {/* @ts-ignore web-only fixed positioning */}
          <View style={[styles.sortMenu, { backgroundColor: c.card, borderColor: c.border, top: sortMenuPos.top, right: sortMenuPos.right }]}>
            {SORT_OPTIONS.map((opt) => (
              <Pressable
                key={opt.key}
                onPress={() => {
                  if (sortBy === opt.key && opt.key !== 'default') {
                    setSortDirection((prev) => prev === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortBy(opt.key);
                    setSortDirection('asc');
                  }
                  setShowSortMenu(false);
                }}
                style={[
                  styles.sortMenuItem,
                  sortBy === opt.key && { backgroundColor: c.accentBg },
                ]}
              >
                <Text style={[styles.sortMenuText, { color: sortBy === opt.key ? c.accent : c.text }]}>
                  {opt.label}
                  {sortBy === opt.key && opt.key !== 'default' ? (sortDirection === 'asc' ? ' \u2191' : ' \u2193') : ''}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  headerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  headerLeft: { flex: 1, minWidth: 240 },
  title: { fontSize: fontSizes['3xl'], fontWeight: '700', fontFamily: fontFamily.body },
  subtitle: { fontSize: fontSizes.sm, marginTop: spacing.xs },

  // Progress card
  progressCard: {
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    minWidth: 220,
  },
  progressStats: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  progressStat: { alignItems: 'center' },
  progressNum: { fontSize: fontSizes.xl, fontWeight: '700', fontFamily: fontFamily.body },
  progressLabel: { fontSize: fontSizes.xs },
  activeStatBar: { height: 3, borderRadius: 2, width: '100%', marginTop: 4 },
  progressDivider: { width: 1, height: 28 },
  progressBarBg: { height: 4, borderRadius: 2, overflow: 'hidden' },
  progressBarFill: { height: 4, borderRadius: 2 },

  // Sticky filter bar
  filterBar: {
    paddingVertical: spacing.md,
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    marginBottom: spacing.lg,
    // @ts-ignore web-only sticky positioning
    position: 'sticky',
    top: 0,
    zIndex: 20,
  },

  // Search row
  searchRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    height: 38,
  },
  searchIcon: { fontSize: 16, marginRight: spacing.xs },
  searchInput: {
    flex: 1,
    fontSize: fontSizes.sm,
    fontFamily: fontFamily.body,
    // @ts-ignore web-only
    outlineStyle: 'none',
  },
  clearBtn: { padding: spacing.xs },

  // Sort
  sortWrapper: { position: 'relative' },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    height: 38,
  },
  sortButtonText: { fontSize: fontSizes.sm, fontWeight: '600', fontFamily: fontFamily.body },
  sortMenu: {
    // @ts-ignore web-only fixed positioning
    position: 'fixed' as any,
    borderWidth: 1,
    borderRadius: radii.md,
    minWidth: 160,
    zIndex: 9999,
    // @ts-ignore web-only shadow
    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
  },
  // @ts-ignore web-only fixed positioning
  sortBackdrop: { position: 'fixed' as any, top: 0, left: 0, right: 0, bottom: 0, zIndex: 49 },
  sortMenuItem: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  sortMenuText: { fontSize: fontSizes.sm, fontFamily: fontFamily.body },

  // Filter pills scroll
  filterScroll: { marginBottom: spacing.sm },
  filterScrollContent: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', paddingVertical: 2 },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 9999,
    borderWidth: 1,
  },
  filterPillText: { fontSize: fontSizes.xs, fontWeight: '600', fontFamily: fontFamily.body },
  filterDivider: { width: 1, height: 20, marginHorizontal: spacing.xs },

  // Result count
  resultRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resultCount: { fontSize: fontSizes.xs },
  clearFilters: { borderWidth: 1, borderRadius: radii.md, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  clearFiltersText: { fontSize: fontSizes.xs, fontWeight: '600' },

  // Empty state
  empty: { borderWidth: 2, marginTop: spacing.lg },
  emptyContent: { alignItems: 'center', paddingVertical: spacing['2xl'] },
  emptyIcon: { fontSize: 32, marginBottom: spacing.sm },
  emptyTitle: { fontSize: fontSizes.lg, fontWeight: '600' },
  emptySub: { fontSize: fontSizes.sm, marginTop: spacing.xs, textAlign: 'center' },
  emptyBtn: { marginTop: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.md },
  emptyBtnText: { fontSize: fontSizes.sm, fontWeight: '600' },

  // Tier sections
  tierSection: { marginBottom: spacing.xl },
  tierHeader: {
    // @ts-ignore web-only sticky
    position: 'sticky',
    top: 140,
    zIndex: 10,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  tierTitle: { fontSize: fontSizes.lg, fontWeight: '700', fontFamily: fontFamily.body, marginBottom: spacing.xs },
  tierDesc: { fontSize: fontSizes.sm, marginBottom: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  gridMobile: { flexDirection: 'column', gap: spacing.md },

  // Back to top
  backToTop: {
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  backToTopText: { color: '#0d1117', fontSize: fontSizes.sm, fontWeight: '600', fontFamily: fontFamily.body },
});
