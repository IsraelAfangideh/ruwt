import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView } from 'react-native';
import { CardGridSkeleton } from '@/shared/ui/ScreenSkeletons';
import { useNavigation } from '@react-navigation/native';
import { DashboardLayout } from '@/shared/layout/DashboardLayout';
import { Card, CardContent } from '@/shared/ui/Card';
import { ChallengeCard, type Challenge } from '@/features/challenges/ChallengeCard';
import { useColors, useTheme } from '@/shared/theme';
import { spacing, fontSizes, fontFamily, radii } from '@/shared/theme/tokens';
import { useIsMobile } from '@/shared/lib/useIsMobile';
import { DIFFICULTIES, getDifficultyStyle } from '@/shared/lib/difficulty';
import { useDocumentMeta } from '@/shared/hooks/useDocumentMeta';
import { useAuthGuard } from '@/shared/hooks/useAuthGuard';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { useDashboardData } from '@/shared/lib/DashboardDataContext';

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
  /* istanbul ignore next -- @preserve SSR guard; jsdom always provides window */
  if (typeof window === 'undefined') return 'all';
  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab');
  if (tab && CATEGORIES.some((c) => c.key === tab)) return tab;
  return 'all';
}

function getInitialLang(): string {
  /* istanbul ignore next -- @preserve SSR guard; jsdom always provides window */
  if (typeof window === 'undefined') return 'all';
  const params = new URLSearchParams(window.location.search);
  return params.get('lang') || 'all';
}

function getInitialDifficulty(): string {
  /* istanbul ignore next -- @preserve SSR guard; jsdom always provides window */
  if (typeof window === 'undefined') return 'all';
  const params = new URLSearchParams(window.location.search);
  return params.get('difficulty') || 'all';
}

export function ChallengesScreen() {
  useDocumentMeta({ title: 'AI Coding Challenges', description: 'Browse 60+ coding challenges across 11 categories. Test your AI efficiency in model selection, prompt engineering, debugging, and more.', canonicalPath: '/problems' });
  const { user, loading: authLoading } = useAuthGuard();
  const navigation = useNavigation();
  const { state: cachedData } = useDashboardData();
  const challenges = cachedData.challenges.data as Challenge[];
  const dailyChallenge = cachedData.dailyChallenge.data as { challengeId: string; title: string; difficulty: string; category: string | null; solvedToday: boolean } | null;
  const loading = cachedData.challenges.status === 'loading' || cachedData.challenges.status === 'idle';
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
  const [dailyCountdown, setDailyCountdown] = useState(0);
  const c = useColors();
  const { isDark } = useTheme();
  const activePillText = isDark ? '#0f0e0d' : '#ffffff';
  const isMobile = useIsMobile();
  const gridStyle = isMobile ? styles.gridMobile : styles.grid;

  // Initialize daily countdown when dailyChallenge data becomes available
  useEffect(() => {
    /* istanbul ignore next -- @preserve */
    if (!dailyChallenge?.challengeId) return;
    /* istanbul ignore next -- @preserve */
    const now = new Date();
    /* istanbul ignore next -- @preserve */
    const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    /* istanbul ignore next -- @preserve */
    setDailyCountdown(Math.floor((tomorrow.getTime() - now.getTime()) / 1000));
  }, [dailyChallenge]);

  // Daily challenge countdown
  useEffect(() => {
    /* istanbul ignore next -- @preserve */
    if (dailyCountdown <= 0) return;
    /* istanbul ignore next -- @preserve */
    const id = setInterval(() => {
      /* istanbul ignore next -- @preserve */
      setDailyCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    /* istanbul ignore next -- @preserve */
    return () => clearInterval(id);
  }, [dailyCountdown > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const syncUrlParams = useCallback((cat: string, lang: string, diff: string) => {
    /* istanbul ignore next -- @preserve SSR guard; jsdom always provides window */
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
      /* istanbul ignore next -- @preserve */
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
      result = [...result].sort((a, b) => {
        /* istanbul ignore next -- @preserve */
        const aVal = DIFFICULTY_ORDER[a.difficulty] ?? 2;
        /* istanbul ignore next -- @preserve */
        const bVal = DIFFICULTY_ORDER[b.difficulty] ?? 2;
        return dir * (aVal - bVal);
      });
    } else if (sortBy === 'popularity') {
      result = [...result].sort((a, b) => {
        /* istanbul ignore next -- @preserve */
        const aVal = b.stats?.solvers ?? 0;
        /* istanbul ignore next -- @preserve */
        const bVal = a.stats?.solvers ?? 0;
        return dir * (aVal - bVal);
      });
    } else if (sortBy === 'cost') {
      result = [...result].sort((a, b) => {
        /* istanbul ignore next -- @preserve */
        const aVal = a.maxCost ?? Infinity;
        /* istanbul ignore next -- @preserve */
        const bVal = b.maxCost ?? Infinity;
        return dir * (aVal - bVal);
      });
    }

    return result;
  }, [challenges, searchQuery, activeCategory, activeLang, activeDifficulty, statusFilter, sortBy, sortDirection]);

  // Stats that reflect current non-status filters (for the clickable stats panel)
  const filteredStats = useMemo(() => {
    let result = challenges;
    /* istanbul ignore next -- @preserve */
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((ch) =>
        ch.title.toLowerCase().includes(q) ||
        ch.description.toLowerCase().includes(q) ||
        (ch.skillTested && ch.skillTested.toLowerCase().includes(q))
      );
    }
    if (activeCategory !== 'all') result = result.filter((ch) => ch.category === activeCategory);
    /* istanbul ignore next -- @preserve */
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
        .filter((ch) => { /* istanbul ignore next -- @preserve */ return (ch.tier || 'core') === tier; })
        .sort((a, b) => {
          /* istanbul ignore next -- @preserve */
          const aOrder = a.sortOrder ?? 0;
          /* istanbul ignore next -- @preserve */
          const bOrder = b.sortOrder ?? 0;
          return aOrder - bOrder;
        }),
    })).filter((g) => g.items.length > 0);
  }, [filtered, sortBy]);

  // "Where LLMs Struggle" — hard/impossible unsolved challenges for returning users
  const llmStruggleChallenges = useMemo(() => {
    if (progressStats.solved === 0) return []; // Only for returning users
    return filtered
      .filter((ch) => (ch.difficulty === 'hard' || ch.difficulty === 'impossible') && ch.userStatus !== 'passed')
      .sort((a, b) => {
        /* istanbul ignore next -- @preserve */
        const aVal = a.stats?.solvers ?? 0;
        /* istanbul ignore next -- @preserve */
        const bVal = b.stats?.solvers ?? 0;
        return aVal - bVal;
      })
      .slice(0, 4);
  /* istanbul ignore next -- @preserve */
  }, [filtered, progressStats.solved]);

  /* istanbul ignore next -- @preserve */
  if (authLoading || !user) {
    /* istanbul ignore next -- @preserve */
    return <CardGridSkeleton />;
  }

  const hasActiveFilters = activeLang !== 'all' || activeCategory !== 'all' || activeDifficulty !== 'all' || searchQuery.trim() !== '' || statusFilter !== 'all';
  const hasNonStatusFilters = activeLang !== 'all' || activeCategory !== 'all' || activeDifficulty !== 'all' || searchQuery.trim() !== '';
  const displayStats = hasNonStatusFilters ? filteredStats : progressStats;
  /* istanbul ignore next -- @preserve */
  const progressPct = displayStats.total > 0 ? Math.round((displayStats.solved / displayStats.total) * 100) : 0;
  return (
    <DashboardLayout user={user}>
      {loading && <CardGridSkeleton />}
      {!loading && <>
      {/* Header with title + progress */}
      <View style={styles.headerSection}>
        <View style={styles.headerLeft}>
          <Text style={[styles.title, { color: c.text }]} accessibilityRole="header" aria-level={1}>Engineering Challenges</Text>
          <Text style={[styles.subtitle, { color: c.textMuted }]}>
            Real engineering problems. Real AI models. Ranked by efficiency.
          </Text>
        </View>
        {/* Progress summary — clickable stats filter */}
        <View style={[styles.progressCard, { backgroundColor: c.muted, borderColor: c.border }]} accessibilityRole="group" accessibilityLabel="Challenge progress">
          <View style={styles.progressStats}>
            <Pressable
              onPress={() => setStatusFilter(statusFilter === 'solved' ? 'all' : 'solved')}
              style={[styles.progressStat, { cursor: 'pointer' as any }]}
              accessibilityRole="button"
              accessibilityLabel={`${displayStats.solved} solved${hasNonStatusFilters ? ` of ${progressStats.solved}` : ''}`}
              accessibilityState={{ selected: statusFilter === 'solved' }}
            >
              <Text style={[styles.progressNum, { color: c.success }]}>{displayStats.solved}</Text>
              <Text style={[styles.progressLabel, { color: statusFilter === 'solved' ? c.success : c.textMuted, fontWeight: statusFilter === 'solved' ? '700' : '400' }]}>
                solved{hasNonStatusFilters ? ` of ${progressStats.solved}` : ''}
              </Text>
              {statusFilter === 'solved' && <View style={[styles.activeStatBar, { backgroundColor: c.success }]} />}
            </Pressable>
            <View style={[styles.progressDivider, { backgroundColor: c.border }]} />
            <Pressable
              /* istanbul ignore next -- @preserve */
              onPress={() => { /* istanbul ignore next -- @preserve */ setStatusFilter(statusFilter === 'in_progress' ? 'all' : 'in_progress'); }}
              style={[styles.progressStat, { cursor: 'pointer' as any }]}
              accessibilityRole="button"
              accessibilityLabel={`${displayStats.inProgress} in progress${hasNonStatusFilters ? ` of ${progressStats.inProgress}` : ''}`}
              accessibilityState={{ selected: statusFilter === 'in_progress' }}
            >
              <Text style={[styles.progressNum, { color: c.accent }]}>{displayStats.inProgress}</Text>
              <Text style={[styles.progressLabel, { color: statusFilter === 'in_progress' ? c.accent : c.textMuted, fontWeight: statusFilter === 'in_progress' ? '700' : '400' }]}>
                in progress{hasNonStatusFilters ? ` of ${progressStats.inProgress}` : ''}
              </Text>
              {statusFilter === 'in_progress' && <View style={[styles.activeStatBar, { backgroundColor: c.accent }]} />}
            </Pressable>
            <View style={[styles.progressDivider, { backgroundColor: c.border }]} />
            <Pressable
              /* istanbul ignore next -- @preserve */
              onPress={() => { /* istanbul ignore next -- @preserve */ setStatusFilter(statusFilter === 'not_started' ? 'all' : 'not_started'); }}
              style={[styles.progressStat, { cursor: 'pointer' as any }]}
              accessibilityRole="button"
              accessibilityLabel={`${displayStats.notStarted} not started`}
              accessibilityState={{ selected: statusFilter === 'not_started' }}
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
              accessibilityRole="button"
              accessibilityLabel={`${displayStats.total} total challenges`}
            >
              <Text style={[styles.progressNum, { color: c.text }]}>{displayStats.total}</Text>
              <Text style={[styles.progressLabel, { color: c.textMuted }]}>total</Text>
            </Pressable>
          </View>
          <View
            style={[styles.progressBarBg, { backgroundColor: c.border }]}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: progressPct }}
            accessibilityLabel={`${progressPct}% of challenges completed`}
          >
            <View style={[styles.progressBarFill, { width: `${progressPct}%` as any, backgroundColor: c.success }]} />
          </View>
        </View>
      </View>

      {/* Daily Challenge Featured Card */}
      {/* istanbul ignore next -- @preserve */ dailyChallenge && (
        <Card style={[styles.dailyCard, { borderColor: c.accent, borderWidth: 2 }]}>
          <CardContent style={styles.dailyContent}>
            <View style={styles.dailyLeft}>
              <View style={styles.dailyBadgeRow}>
                <Badge variant="default">Daily Challenge</Badge>
                <Badge
                  variant="outline"
                  style={{ borderColor: getDifficultyStyle(dailyChallenge.difficulty).color, backgroundColor: getDifficultyStyle(dailyChallenge.difficulty).bg }}
                  textStyle={{ color: getDifficultyStyle(dailyChallenge.difficulty).color }}
                >
                  {getDifficultyStyle(dailyChallenge.difficulty).label}
                </Badge>
              </View>
              <Text style={[styles.dailyTitle, { color: c.text }]}>{dailyChallenge.title}</Text>
              {/* istanbul ignore next -- @preserve */ dailyCountdown > 0 && (
                <Text style={[styles.dailyCountdown, { color: c.textSubtle }]}>
                  Next in {String(Math.floor(dailyCountdown / 3600)).padStart(2, '0')}:{String(Math.floor((dailyCountdown % 3600) / 60)).padStart(2, '0')}:{String(dailyCountdown % 60).padStart(2, '0')}
                </Text>
              )}
            </View>
            <View style={styles.dailyRight}>
              {/* istanbul ignore next -- @preserve */ dailyChallenge.solvedToday ? (
                <View style={[styles.dailySolved, { backgroundColor: c.successBg }]}>
                  <Text style={[styles.dailySolvedText, { color: c.success }]}>{'\u2705'} Completed!</Text>
                </View>
              ) : (
                <Button
                  size="lg"
                  /* istanbul ignore next -- @preserve */
                  onPress={() => (navigation.navigate as any)('Arena', { challengeId: dailyChallenge.challengeId })}
                  style={{ backgroundColor: c.accent }}
                  textStyle={{ color: c.primaryForeground, fontWeight: '700' }}
                >
                  Start
                </Button>
              )}
            </View>
          </CardContent>
        </Card>
      )}

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
              accessibilityLabel="Search challenges"
              testID="challenge-search"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')} style={styles.clearBtn} accessibilityRole="button" accessibilityLabel="Clear search">
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
                /* istanbul ignore next -- @preserve */
                if (node && node.getBoundingClientRect) {
                  const rect = node.getBoundingClientRect();
                  setSortMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                }
                setShowSortMenu(true);
              }}
              style={[styles.sortButton, { backgroundColor: c.muted, borderColor: c.border }]}
              accessibilityRole="button"
              accessibilityLabel={`Sort challenges by ${SORT_OPTIONS.find((s) => s.key === sortBy)?.label}${sortBy !== 'default' ? (sortDirection === 'asc' ? ', ascending' : ', descending') : ''}`}
              accessibilityState={{ expanded: showSortMenu }}
              testID="sort-button"
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterScrollContent} accessibilityRole="toolbar" accessibilityLabel="Filter challenges">
          {/* Language pills */}
          {LANGUAGES.map((lang) => {
            const isActive = activeLang === lang.key;
            return (
              <Pressable
                key={`lang-${lang.key}`}
                onPress={() => handleLangChange(lang.key)}
                accessibilityRole="button"
                accessibilityLabel={`Filter by ${lang.label}`}
                accessibilityState={{ selected: isActive }}
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

          <View style={[styles.filterDivider, { backgroundColor: c.border }]} accessibilityRole="none" />

          {/* Difficulty pills */}
          {DIFFICULTIES.map((diff) => {
            const isActive = activeDifficulty === diff.key;
            const diffStyle = diff.key === 'all' ? null : getDifficultyStyle(diff.key);
            return (
              <Pressable
                key={`diff-${diff.key}`}
                onPress={() => handleDifficultyChange(diff.key)}
                accessibilityRole="button"
                accessibilityLabel={`Filter by ${diff.label} difficulty`}
                accessibilityState={{ selected: isActive }}
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

          <View style={[styles.filterDivider, { backgroundColor: c.border }]} accessibilityRole="none" />

          {/* Category pills */}
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.key;
            return (
              <Pressable
                key={`cat-${cat.key}`}
                onPress={() => handleCategoryChange(cat.key)}
                accessibilityRole="button"
                accessibilityLabel={`Filter by ${cat.label} category`}
                accessibilityState={{ selected: isActive }}
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
          <Text style={[styles.resultCount, { color: c.textMuted }]} accessibilityRole="status" accessibilityLiveRegion="polite">
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
              accessibilityRole="button"
              accessibilityLabel="Clear all filters"
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
        // Default sort: grouped by tier with "Where LLMs Struggle" after onboarding
        <>
          {grouped.map((group) => (
            <View key={group.tier}>
              <View style={styles.tierSection}>
                <View style={styles.tierHeader}>
                  <Text style={[styles.tierTitle, { color: c.text }]} accessibilityRole="header" aria-level={2}>{group.meta.label}</Text>
                  <Text style={[styles.tierDesc, { color: c.textMuted }]}>{group.meta.description}</Text>
                </View>
                <View style={gridStyle} accessibilityRole="list" accessibilityLabel={`${group.meta.label} challenges`}>
                  {group.items.map((ch) => (
                    <ChallengeCard key={ch.id} challenge={ch} />
                  ))}
                </View>
              </View>
              {/* Insert "Where LLMs Struggle" after onboarding tier */}
              {group.tier === 'onboarding' && llmStruggleChallenges.length > 0 && (
                <View style={styles.tierSection}>
                  <View style={styles.tierHeader}>
                    <Text style={[styles.tierTitle, { color: c.text }]} accessibilityRole="header" aria-level={2}>Where LLMs Struggle</Text>
                    <Text style={[styles.tierDesc, { color: c.textMuted }]}>
                      These challenges push the limits of AI. Your prompting skills matter here.
                    </Text>
                  </View>
                  <View style={gridStyle}>
                    {llmStruggleChallenges.map((ch) => (
                      <ChallengeCard key={`struggle-${ch.id}`} challenge={ch} />
                    ))}
                  </View>
                </View>
              )}
            </View>
          ))}
        </>
      ) : (
        // Custom sort: flat list
        <View style={styles.tierSection}>
          <View style={gridStyle}>
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
          accessibilityRole="button"
          accessibilityLabel="Back to top"
        >
          <Text style={styles.backToTopText}>{'\u2191'} Back to top</Text>
        </Pressable>
      )}

      {/* Sort menu — rendered outside filter bar as fixed overlay to escape stacking context */}
      {showSortMenu && sortMenuPos && (
        <>
          <Pressable style={styles.sortBackdrop} onPress={() => setShowSortMenu(false)} accessibilityRole="button" accessibilityLabel="Close sort menu" />
          {/* @ts-ignore web-only fixed positioning */}
          <View style={[styles.sortMenu, { backgroundColor: c.card, borderColor: c.border, top: sortMenuPos.top, right: sortMenuPos.right }]} accessibilityRole="menu" accessibilityLabel="Sort options">
            {SORT_OPTIONS.map((opt) => (
              <Pressable
                key={opt.key}
                onPress={() => {
                  if (sortBy === opt.key && opt.key !== 'default') {
                    /* istanbul ignore next -- @preserve */
                    setSortDirection((prev) => prev === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortBy(opt.key);
                    setSortDirection('asc');
                  }
                  setShowSortMenu(false);
                }}
                accessibilityRole="menuitem"
                /* istanbul ignore next -- @preserve */
                accessibilityLabel={(() => { /* istanbul ignore next -- @preserve */ const suffix = sortBy === opt.key && opt.key !== 'default' ? (sortDirection === 'asc' ? ', ascending' : ', descending') : ''; return `Sort by ${opt.label}${suffix}`; })()}
                /* istanbul ignore next -- @preserve */
                accessibilityState={{ selected: sortBy === opt.key }}
                style={[
                  styles.sortMenuItem,
                  /* istanbul ignore next -- @preserve */
                  sortBy === opt.key && { backgroundColor: c.accentBg },
                ]}
              >
                <Text style={[styles.sortMenuText, { color: sortBy === opt.key ? c.accent : c.text }]}>
                  {opt.label}
                  {/* istanbul ignore next -- @preserve */ sortBy === opt.key && opt.key !== 'default' ? (sortDirection === 'asc' ? ' \u2191' : ' \u2193') : ''}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
      </>}
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Daily challenge card
  dailyCard: { marginBottom: spacing.lg },
  dailyContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, flexWrap: 'wrap' },
  dailyLeft: { flex: 1, minWidth: 200, gap: spacing.xs },
  dailyBadgeRow: { flexDirection: 'row', gap: spacing.sm },
  dailyTitle: { fontSize: fontSizes.xl, fontWeight: '700', fontFamily: fontFamily.display },
  dailyCountdown: { fontSize: fontSizes.xs, fontFamily: fontFamily.body, fontVariant: ['tabular-nums'] },
  dailyRight: { alignItems: 'center' },
  dailySolved: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.lg },
  dailySolvedText: { fontSize: fontSizes.sm, fontWeight: '700', fontFamily: fontFamily.body },

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
    paddingVertical: 12,
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
  backToTopText: { color: '#ffffff', fontSize: fontSizes.sm, fontWeight: '600', fontFamily: fontFamily.body },
});
