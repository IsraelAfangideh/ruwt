/**
 * ModelScreen: Individual model detail page with description and usage stats.
 * Route: /models/:modelId
 */
import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily } from '@/theme/tokens';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { tierColor, tierLabel } from '@/lib/ai/pricing';
import type { ModelTier } from '@/lib/ai/pricing';

interface ModelDetail {
  id: string;
  displayName: string;
  tier: ModelTier;
  description: string;
  input: number;
  output: number;
}

interface ModelStats {
  timesUsed: number;
  totalMessages: number;
  avgCostPerMessage: number;
  winRate: number;
}

export function ModelScreen() {
  const route = useRoute<any>();
  const modelId = route.params?.modelId ?? '';
  const c = useColors();
  const [model, setModel] = useState<ModelDetail | null>(null);
  const [stats, setStats] = useState<ModelStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useDocumentMeta({
    title: model ? `${model.displayName} — AI Model` : 'AI Model',
    description: model ? model.description : 'AI model details and usage statistics.',
    canonicalPath: `/models/${encodeURIComponent(modelId)}`,
  });

  useEffect(() => {
    if (!modelId) return;
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    fetch(`${base}/api/models/${encodeURIComponent(modelId)}`)
      .then((r) => {
        if (!r.ok) throw new Error('Not found');
        return r.json();
      })
      .then((data: { model: ModelDetail; stats: ModelStats }) => {
        setModel(data.model);
        setStats(data.stats);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [modelId]);

  const formatCost = (hundredths: number): string => {
    const dollars = hundredths / 10000;
    return dollars < 0.01 ? `$${dollars.toFixed(4)}` : `$${dollars.toFixed(2)}`;
  };

  if (loading) {
    return (
      <DashboardLayout>
        <View style={[styles.center, { backgroundColor: c.background }]}>
          <ActivityIndicator size="large" />
        </View>
      </DashboardLayout>
    );
  }

  if (error || !model || !stats) {
    return (
      <DashboardLayout>
        <View style={[styles.center, { backgroundColor: c.background }]}>
          <Text style={[styles.errorText, { color: c.textMuted }]}>Model not found.</Text>
        </View>
      </DashboardLayout>
    );
  }

  const statCards: Array<{ label: string; value: string }> = [
    { label: 'Times Used', value: String(stats.timesUsed) },
    { label: 'Total Messages', value: String(stats.totalMessages) },
    { label: 'Avg Cost / Msg', value: formatCost(stats.avgCostPerMessage) },
    { label: 'Win Rate', value: `${stats.winRate}%` },
  ];

  return (
    <DashboardLayout>
      <ScrollView
        style={[styles.container, { backgroundColor: c.background }]}
        contentContainerStyle={styles.content}
        testID="model-screen"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: c.text }]}>{model.displayName}</Text>
          <View style={[styles.tierBadge, { backgroundColor: `${tierColor(model.tier)}20` }]}>
            <Text style={[styles.tierText, { color: tierColor(model.tier) }]}>
              {tierLabel(model.tier)}
            </Text>
          </View>
        </View>

        <Text style={[styles.description, { color: c.textMuted }]}>{model.description}</Text>

        {/* Pricing */}
        <View style={[styles.pricingCard, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.sectionTitle, { color: c.text }]}>Pricing</Text>
          <View style={styles.pricingRow}>
            <View style={styles.pricingItem}>
              <Text style={[styles.pricingLabel, { color: c.textMuted }]}>Input</Text>
              <Text style={[styles.pricingValue, { color: c.text }]}>
                ${model.input.toFixed(2)}/M tokens
              </Text>
            </View>
            <View style={styles.pricingItem}>
              <Text style={[styles.pricingLabel, { color: c.textMuted }]}>Output</Text>
              <Text style={[styles.pricingValue, { color: c.text }]}>
                ${model.output.toFixed(2)}/M tokens
              </Text>
            </View>
          </View>
        </View>

        {/* Stats */}
        <Text style={[styles.sectionTitle, { color: c.text, marginTop: spacing.lg }]}>
          Usage Stats
        </Text>
        <View style={styles.statsGrid}>
          {statCards.map((s) => (
            <View
              key={s.label}
              style={[styles.statCard, { backgroundColor: c.card, borderColor: c.border }]}
            >
              <Text style={[styles.statValue, { color: c.accent }]}>{s.value}</Text>
              <Text style={[styles.statLabel, { color: c.textMuted }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Model ID */}
        <View style={[styles.idSection, { borderColor: c.border }]}>
          <Text style={[styles.idLabel, { color: c.textMuted }]}>Model ID</Text>
          <Text style={[styles.idValue, { color: c.text }]}>{model.id}</Text>
        </View>
      </ScrollView>
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg, maxWidth: 720, alignSelf: 'center', width: '100%' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: fontSizes.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: 8 },
  title: { fontSize: fontSizes.xxl, fontFamily: fontFamily.display, fontWeight: '700' },
  tierBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  tierText: { fontSize: fontSizes.sm, fontWeight: '600' },
  description: { fontSize: fontSizes.md, fontFamily: fontFamily.body, lineHeight: 24, marginBottom: spacing.lg },
  pricingCard: { padding: spacing.md, borderRadius: 12, borderWidth: 1 },
  sectionTitle: { fontSize: fontSizes.lg, fontWeight: '700', fontFamily: fontFamily.body, marginBottom: spacing.sm },
  pricingRow: { flexDirection: 'row', gap: spacing.xl },
  pricingItem: { gap: 4 },
  pricingLabel: { fontSize: fontSizes.xs, textTransform: 'uppercase', letterSpacing: 1 },
  pricingValue: { fontSize: fontSizes.md, fontWeight: '600' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  statCard: {
    width: 150,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    gap: 4,
  },
  statValue: { fontSize: fontSizes.xl, fontWeight: '700' },
  statLabel: { fontSize: fontSizes.xs },
  idSection: { marginTop: spacing.xl, borderTopWidth: 1, paddingTop: spacing.md },
  idLabel: { fontSize: fontSizes.xs, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  idValue: { fontSize: fontSizes.sm, fontFamily: fontFamily.body },
});
