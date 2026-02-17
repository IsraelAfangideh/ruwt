/**
 * ReplayScreen: Full-page replay viewer for a challenge attempt.
 * Route: /replay/:attemptId
 */
import { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily } from '@/theme/tokens';
import { getModelById, tierColor, formatCostFromHundredths } from '@/lib/ai/pricing';

interface ReplayMessage {
  role: string;
  content: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  cost?: number;
  createdAt: string;
}

interface ReplayData {
  attempt: {
    id: string;
    status: string;
    totalCost: number;
    inputTokens: number;
    outputTokens: number;
    submittedAt: string | null;
    createdAt: string;
  };
  challenge: { title: string; difficulty: string; category: string };
  solver: { name: string; avatarUrl: string | null };
  messages: ReplayMessage[];
  stats: { messageCount: number; modelsUsed: string[]; totalCost: number };
}

export function ReplayScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const params = (route.params || {}) as { attemptId?: string };
  const attemptId = params.attemptId ?? '';

  const c = useColors();
  const [data, setData] = useState<ReplayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!attemptId) {
      setError('No attempt ID provided');
      setLoading(false);
      return;
    }
    const load = async () => {
      try {
        const res = await fetch(`/api/attempts/${attemptId}/replay`);
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          setError(err.error || 'Failed to load replay');
          setLoading(false);
          return;
        }
        setData(await res.json());
      } catch {
        setError('Failed to load replay');
      }
      setLoading(false);
    };
    load();
  }, [attemptId]);

  const handleShare = async () => {
    const url = `${window.location.origin}/replay/${attemptId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <Text style={[styles.errorText, { color: c.destructive }]}>{error}</Text>
        <Pressable onPress={() => navigation.navigate('Challenges' as never)} style={styles.backLink}>
          <Text style={{ color: c.accent, fontSize: fontSizes.sm }}>Back to Challenges</Text>
        </Pressable>
      </View>
    );
  }

  if (!data) return null;

  return (
    <ScrollView style={[styles.page, { backgroundColor: c.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: c.text }]}>
            {data.solver.name}'s Replay
          </Text>
          <Text style={[styles.subtitle, { color: c.textMuted }]}>
            {data.challenge.title} ({data.challenge.difficulty})
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable onPress={handleShare} style={[styles.shareBtn, { borderColor: c.border }]}>
            <Text style={{ color: c.text, fontSize: fontSizes.sm }}>
              {copied ? 'Copied!' : 'Share'}
            </Text>
          </Pressable>
          <Pressable onPress={() => navigation.goBack()} style={styles.closeBtn}>
            <Text style={{ color: c.textMuted, fontSize: 20 }}>{'\u00D7'}</Text>
          </Pressable>
        </View>
      </View>

      {/* Strategy summary */}
      <View style={[styles.summary, { backgroundColor: c.muted + '20', borderBottomColor: c.border }]}>
        <Text style={[styles.summaryText, { color: c.text }]}>
          Solved in {data.stats.messageCount} messages using {data.stats.modelsUsed.length} model{data.stats.modelsUsed.length !== 1 ? 's' : ''} for {formatCostFromHundredths(data.stats.totalCost)}
        </Text>
        <View style={styles.summaryModels}>
          {data.stats.modelsUsed.map((modelId) => {
            const mi = getModelById(modelId);
            return (
              <View key={modelId} style={[styles.modelBadge, { borderColor: mi ? tierColor(mi.tier) : c.border }]}>
                <Text style={{ fontSize: fontSizes.xs, color: mi ? tierColor(mi.tier) : c.textMuted }}>
                  {mi?.displayName || modelId.split('/').pop()}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Message timeline */}
      <View style={styles.timeline}>
        {data.messages.map((msg, i) => {
          const mi = msg.model ? getModelById(msg.model) : undefined;
          return (
            <View key={i} style={[styles.msgRow, { borderBottomColor: c.border }]}>
              <View style={styles.msgHeader}>
                <View style={[styles.roleBadge, { backgroundColor: msg.role === 'user' ? c.accent + '20' : c.muted + '30' }]}>
                  <Text style={{ fontSize: fontSizes.xs, fontWeight: '700', color: msg.role === 'user' ? c.accent : c.textMuted }}>
                    {msg.role === 'user' ? 'USER' : 'AI'}
                  </Text>
                </View>
                {mi && (
                  <Text style={{ fontSize: fontSizes.xs, color: tierColor(mi.tier) }}>
                    {mi.displayName}
                  </Text>
                )}
                {msg.cost != null && msg.cost > 0 && (
                  <Text style={{ fontSize: fontSizes.xs, color: c.textMuted, marginLeft: 'auto' }}>
                    {formatCostFromHundredths(msg.cost)} {'\u00B7'} {((msg.inputTokens ?? 0) + (msg.outputTokens ?? 0)).toLocaleString()} {((msg.inputTokens ?? 0) + (msg.outputTokens ?? 0)) === 1 ? 'token' : 'tokens'}
                  </Text>
                )}
              </View>
              <Text style={[styles.msgContent, { color: c.text }]} selectable>
                {msg.content.length > 2000 ? msg.content.slice(0, 2000) + '...' : msg.content}
              </Text>
            </View>
          );
        })}
        {data.messages.length === 0 && (
          <View style={[styles.center, { paddingVertical: spacing.xl }]}>
            <Text style={{ color: c.textMuted }}>No messages recorded for this attempt.</Text>
          </View>
        )}
      </View>

      {/* Try this challenge CTA */}
      <View style={styles.ctaSection}>
        <Pressable
          onPress={() => (navigation.navigate as any)('Arena', { challengeId: data.challenge.title })}
          style={[styles.ctaButton, { backgroundColor: c.accent }]}
        >
          <Text style={[styles.ctaText, { color: '#0d1117' }]}>Try This Challenge</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate('Challenges' as never)} style={styles.backLink}>
          <Text style={{ color: c.textMuted, fontSize: fontSizes.sm }}>Back to Challenges</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: fontSizes.md, marginBottom: spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { fontSize: fontSizes.xl, fontWeight: '700', fontFamily: fontFamily.body },
  subtitle: { fontSize: fontSizes.sm, marginTop: 2 },
  shareBtn: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  closeBtn: { padding: spacing.sm },
  summary: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
  },
  summaryText: { fontSize: fontSizes.sm, fontWeight: '600', marginBottom: spacing.sm },
  summaryModels: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  modelBadge: { borderWidth: 1, borderRadius: 9999, paddingHorizontal: 8, paddingVertical: 2 },
  timeline: { maxWidth: 800, alignSelf: 'center', width: '100%' },
  msgRow: { padding: spacing.lg, borderBottomWidth: 1 },
  msgHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  msgContent: { fontSize: fontSizes.sm, lineHeight: 20, fontFamily: 'monospace' },
  ctaSection: { alignItems: 'center', paddingVertical: spacing.xl },
  ctaButton: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: 8 },
  ctaText: { fontSize: fontSizes.md, fontWeight: '600' },
  backLink: { marginTop: spacing.md },
});
