/**
 * ModelsScreen: Grid of all AI models with tier badges and usage stats.
 * Route: /models
 */
import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily } from '@/theme/tokens';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { tierColor, tierLabel } from '@/lib/ai/pricing';
import type { ModelTier } from '@/lib/ai/pricing';

interface ModelEntry {
  id: string;
  displayName: string;
  tier: ModelTier;
  description: string;
  costIndicator: string;
  input: number;
  output: number;
  stats: { timesUsed: number; totalMessages: number; avgCost: number };
}

export function ModelsScreen() {
  useDocumentMeta({
    title: 'AI Models',
    description: 'Browse all AI models available on ruwt.dev with usage stats and pricing tiers.',
    canonicalPath: '/models',
  });

  const navigation = useNavigation();
  const c = useColors();
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ModelTier | 'all'>('all');

  useEffect(() => {
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    fetch(`${base}/api/models`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: ModelEntry[]) => setModels(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const tiers: Array<ModelTier | 'all'> = ['all', 'reasoning', 'premium', 'mid', 'budget', 'micro'];
  const filtered = filter === 'all' ? models : models.filter((m) => m.tier === filter);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: c.bg }]}
      contentContainerStyle={styles.content}
      testID="models-screen"
    >
      <Text style={[styles.title, { color: c.text }]}>AI Models</Text>
      <Text style={[styles.subtitle, { color: c.textMuted }]}>
        Browse the models powering ruwt.dev challenges
      </Text>

      {/* Tier filter */}
      <View style={styles.filterRow}>
        {tiers.map((t) => (
          <Pressable
            key={t}
            onPress={() => setFilter(t)}
            style={[
              styles.filterChip,
              {
                backgroundColor: filter === t ? (t === 'all' ? c.accent : tierColor(t as ModelTier)) : 'transparent',
                borderColor: t === 'all' ? c.accent : tierColor(t as ModelTier),
              },
            ]}
          >
            <Text
              style={[
                styles.filterText,
                { color: filter === t ? '#0d1117' : c.textMuted },
              ]}
            >
              {t === 'all' ? 'All' : tierLabel(t as ModelTier)}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: spacing.xl }} />
      ) : filtered.length === 0 ? (
        <Text style={[styles.empty, { color: c.textMuted }]}>No models found.</Text>
      ) : (
        <View style={styles.grid}>
          {filtered.map((model) => (
            <Pressable
              key={model.id}
              onPress={() => (navigation as any).navigate('ModelDetail', { modelId: model.id })}
              style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}
              testID={`model-card-${model.displayName}`}
            >
              <View style={styles.cardHeader}>
                <Text style={[styles.modelName, { color: c.text }]}>{model.displayName}</Text>
                <View style={[styles.tierBadge, { backgroundColor: `${tierColor(model.tier)}20` }]}>
                  <Text style={[styles.tierText, { color: tierColor(model.tier) }]}>
                    {tierLabel(model.tier)}
                  </Text>
                </View>
              </View>
              <Text style={[styles.description, { color: c.textMuted }]} numberOfLines={2}>
                {model.description}
              </Text>
              <Text style={[styles.cost, { color: c.accent }]}>{model.costIndicator}</Text>
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={[styles.statValue, { color: c.text }]}>{model.stats.timesUsed}</Text>
                  <Text style={[styles.statLabel, { color: c.textMuted }]}>uses</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={[styles.statValue, { color: c.text }]}>{model.stats.totalMessages}</Text>
                  <Text style={[styles.statLabel, { color: c.textMuted }]}>msgs</Text>
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg, maxWidth: 960, alignSelf: 'center', width: '100%' },
  title: { fontSize: fontSizes['2xl'], fontFamily: fontFamily.display, fontWeight: '700' },
  subtitle: { fontSize: fontSizes.sm, fontFamily: fontFamily.body, marginBottom: spacing.md },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.lg },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  filterText: { fontSize: fontSizes.xs, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  card: {
    width: 280,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modelName: { fontSize: fontSizes.md, fontWeight: '700', fontFamily: fontFamily.body, flex: 1 },
  tierBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  tierText: { fontSize: fontSizes.xs, fontWeight: '600' },
  description: { fontSize: fontSizes.sm, fontFamily: fontFamily.body, lineHeight: 20 },
  cost: { fontSize: fontSizes.md, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: spacing.lg, marginTop: 4 },
  stat: { alignItems: 'center' },
  statValue: { fontSize: fontSizes.md, fontWeight: '700' },
  statLabel: { fontSize: fontSizes.xs },
  empty: { fontSize: fontSizes.sm, textAlign: 'center', paddingVertical: spacing.xl },
});
