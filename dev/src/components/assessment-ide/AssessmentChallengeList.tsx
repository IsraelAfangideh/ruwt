import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { useColors } from '@/theme';
import { spacing, fontSizes } from '@/theme/tokens';
import { DIFFICULTIES, getDifficultyStyle } from '@/lib/difficulty';
import type { Challenge, CustomChallenge } from '@/hooks/useAssessmentIDEState';

const PICKER_CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'real_world', label: 'Real-World' },
  { key: 'model_selection', label: 'Model Selection' },
  { key: 'prompt_efficiency', label: 'Prompt Efficiency' },
  { key: 'iterative_debugging', label: 'Iterative Debugging' },
  { key: 'multi_model_strategy', label: 'Multi-Model' },
  { key: 'qa_testing', label: 'QA Testing' },
  { key: 'frontend', label: 'Frontend' },
  { key: 'backend_api', label: 'Backend API' },
  { key: 'data_engineering', label: 'Data Engineering' },
  { key: 'devops', label: 'DevOps' },
];

function matchesFilters(ch: { title: string; difficulty: string; category: string | null; skillTested: string | null }, q: string, difficultyFilter: string, categoryFilter: string): boolean {
  if (q && !ch.title.toLowerCase().includes(q) && !(ch.skillTested ?? '').toLowerCase().includes(q)) return false;
  if (difficultyFilter !== 'all' && ch.difficulty !== difficultyFilter) return false;
  if (categoryFilter !== 'all' && ch.category !== categoryFilter) return false;
  return true;
}

function categoryLabel(cat: string | null): string {
  const found = PICKER_CATEGORIES.find((p) => p.key === cat);
  return found ? found.label : 'Practice';
}

interface Props {
  allChallenges: Challenge[];
  customChallenges: CustomChallenge[];
  selectedChallengeIds: string[];
  onToggle: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
  onClearAll: () => void;
  loadError: string | null;
}

interface ChallengeRowProps {
  id: string;
  title: string;
  difficulty: string;
  selected: boolean;
  onToggle: (id: string) => void;
  trailing: React.ReactNode;
}

function ChallengeRow({ id, title, difficulty, selected, onToggle, trailing }: ChallengeRowProps) {
  const c = useColors();
  const ds = getDifficultyStyle(difficulty);
  return (
    <Pressable
      onPress={() => onToggle(id)}
      accessibilityRole="button"
      style={[styles.row, { borderColor: selected ? c.accent : c.border }, selected && { backgroundColor: c.accent + '08' }]}
    >
      <Text style={{ fontSize: fontSizes.md, color: selected ? c.accent : c.textMuted, width: 20 }}>
        {selected ? '\u2713' : '\u25CB'}
      </Text>
      <Text style={[styles.rowTitle, { color: c.text }]} numberOfLines={1}>{title}</Text>
      <Badge variant="outline" style={{ borderColor: ds.color, backgroundColor: ds.bg }}>
        <Text style={{ fontSize: 10, color: ds.color }}>{ds.label}</Text>
      </Badge>
      {trailing}
    </Pressable>
  );
}

export function AssessmentChallengeList({
  allChallenges,
  customChallenges,
  selectedChallengeIds,
  onToggle,
  onSelectAll,
  onClearAll,
  loadError,
}: Props) {
  const c = useColors();
  const [search, setSearch] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const selectedSet = useMemo(() => new Set(selectedChallengeIds), [selectedChallengeIds]);

  const filteredChallenges = useMemo(() => {
    const q = search.toLowerCase();
    return allChallenges.filter((ch) => matchesFilters(ch, q, difficultyFilter, categoryFilter));
  }, [allChallenges, search, difficultyFilter, categoryFilter]);

  const filteredCustom = useMemo(() => {
    const q = search.toLowerCase();
    return customChallenges.filter((ch) =>
      ch.status === 'active' && matchesFilters(ch, q, difficultyFilter, categoryFilter)
    );
  }, [customChallenges, search, difficultyFilter, categoryFilter]);

  const allVisibleIds = useMemo(
    () => [...filteredChallenges, ...filteredCustom].map((ch) => ch.id),
    [filteredChallenges, filteredCustom]
  );
  const totalShown = filteredChallenges.length + filteredCustom.length;

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionLabel, { color: c.text }]}>
        Challenges ({selectedChallengeIds.length} selected)
      </Text>

      {/* Filters */}
      <View style={styles.filterBar}>
        <View style={{ maxWidth: 280 }}>
          <Input
            placeholder="Search challenges..."
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <View style={styles.filterPills}>
          {DIFFICULTIES.map((d) => (
            <Pressable
              key={d.key}
              onPress={() => setDifficultyFilter(d.key)}
              accessibilityRole="button"
              style={[styles.pill, {
                backgroundColor: difficultyFilter === d.key ? c.accent + '20' : 'transparent',
                borderColor: difficultyFilter === d.key ? c.accent : c.border,
              }]}
            >
              <Text style={{ fontSize: fontSizes.xs, color: difficultyFilter === d.key ? c.accent : c.textMuted }}>
                {d.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.filterPills}>
          {PICKER_CATEGORIES.map((cat) => (
            <Pressable
              key={cat.key}
              onPress={() => setCategoryFilter(cat.key)}
              accessibilityRole="button"
              style={[styles.pill, {
                backgroundColor: categoryFilter === cat.key ? c.accent + '20' : 'transparent',
                borderColor: categoryFilter === cat.key ? c.accent : c.border,
              }]}
            >
              <Text style={{ fontSize: fontSizes.xs, color: categoryFilter === cat.key ? c.accent : c.textMuted }}>
                {cat.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xs }}>
          <Text style={{ fontSize: fontSizes.xs, color: c.textMuted }}>
            {totalShown} challenges shown
          </Text>
          {totalShown > 0 && (
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Pressable
                accessibilityRole="button"
                onPress={() => onSelectAll(allVisibleIds)}
              >
                <Text style={{ fontSize: fontSizes.xs, color: c.accent, fontWeight: '600' }}>Select All Visible</Text>
              </Pressable>
              {selectedChallengeIds.length > 0 && (
                <Pressable accessibilityRole="button" onPress={onClearAll}>
                  <Text style={{ fontSize: fontSizes.xs, color: c.textMuted, fontWeight: '600' }}>Clear All</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      </View>

      {/* Error */}
      {loadError && (
        <View style={[styles.errorBanner, { backgroundColor: c.destructive + '15', borderColor: c.destructive + '30' }]}>
          <Text style={{ color: c.destructive, fontSize: fontSizes.sm }}>{loadError}</Text>
        </View>
      )}

      {/* Empty filter state */}
      {!loadError && totalShown === 0 && (
        <View style={{ paddingVertical: spacing.xl, alignItems: 'center' }}>
          <Text style={{ fontSize: fontSizes.md, color: c.textMuted, marginBottom: spacing.xs }}>
            No challenges match your filters
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => { setSearch(''); setDifficultyFilter('all'); setCategoryFilter('all'); }}
          >
            <Text style={{ fontSize: fontSizes.sm, color: c.accent, fontWeight: '600' }}>Clear filters</Text>
          </Pressable>
        </View>
      )}

      {/* Compact checkbox rows */}
      <View style={styles.list}>
        {filteredChallenges.map((ch) => (
          <ChallengeRow
            key={ch.id}
            id={ch.id}
            title={ch.title}
            difficulty={ch.difficulty}
            selected={selectedSet.has(ch.id)}
            onToggle={onToggle}
            trailing={<Text style={{ fontSize: fontSizes.xs, color: c.textMuted }}>{categoryLabel(ch.category)}</Text>}
          />
        ))}

        {/* Custom challenges divider */}
        {filteredCustom.length > 0 && filteredChallenges.length > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginVertical: spacing.sm }}>
            <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
            <Text style={{ fontSize: fontSizes.xs, color: c.textMuted, fontWeight: '600' }}>Custom Challenges</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
          </View>
        )}

        {filteredCustom.map((ch) => (
          <ChallengeRow
            key={ch.id}
            id={ch.id}
            title={ch.title}
            difficulty={ch.difficulty}
            selected={selectedSet.has(ch.id)}
            onToggle={onToggle}
            trailing={
              <Badge variant="outline" style={{ borderColor: c.accent + '60', backgroundColor: c.accent + '10' }}>
                <Text style={{ fontSize: 10, color: c.accent }}>Custom</Text>
              </Badge>
            }
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { },
  sectionLabel: { fontSize: fontSizes.lg, fontWeight: '600', marginBottom: spacing.md },
  filterBar: { marginBottom: spacing.md },
  filterPills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderRadius: 999,
  },
  errorBanner: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderRadius: 6, marginBottom: spacing.md },
  list: { gap: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderRadius: 6,
  },
  rowTitle: {
    flex: 1,
    fontSize: fontSizes.sm,
    fontWeight: '500',
  },
});
