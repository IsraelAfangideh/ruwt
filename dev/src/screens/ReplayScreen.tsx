/**
 * ReplayScreen: Full-page replay viewer for a challenge attempt.
 * Route: /replay/:attemptId
 * Supports ?embed=1 for compact iframe embedding.
 */
import { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily } from '@/theme/tokens';
import { getModelById, tierColor, formatCostFromHundredths } from '@/lib/ai/pricing';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';

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
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);

  useDocumentMeta({
    title: data ? `Replay: ${data.challenge.title}` : undefined,
    description: data ? `Watch how ${data.solver.name} solved "${data.challenge.title}" using ${(data.attempt.inputTokens + data.attempt.outputTokens).toLocaleString()} tokens. ${data.challenge.difficulty} challenge replay on ruwt.dev.` : undefined,
    canonicalPath: attemptId ? `/replay/${attemptId}` : undefined,
  });

  // Detect embed mode
  const isEmbed = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('embed') === '1';

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

  const replayUrl = typeof window !== 'undefined' ? `${window.location.origin}/replay/${attemptId}` : '';

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(replayUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch { /* fallback */ }
  };

  const handleShareTwitter = () => {
    if (!data) return;
    const text = `I solved "${data.challenge.title}" on ruwt.dev for ${formatCostFromHundredths(data.stats.totalCost)} using ${data.stats.modelsUsed.length} model${data.stats.modelsUsed.length !== 1 ? 's' : ''}`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(replayUrl)}`;
    window.open(url, '_blank');
  };

  const handleShareLinkedIn = () => {
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(replayUrl)}`;
    window.open(url, '_blank');
  };

  const handleCopyEmbed = async () => {
    const embedCode = `<iframe src="${replayUrl}?embed=1" width="100%" height="600" frameborder="0" style="border:1px solid #30363d;border-radius:8px;"></iframe>`;
    try {
      await navigator.clipboard.writeText(embedCode);
      setCopiedEmbed(true);
      setTimeout(() => setCopiedEmbed(false), 2000);
    } catch { /* fallback */ }
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

  // Embed mode: compact, no nav
  if (isEmbed) {
    return (
      <ScrollView style={[styles.page, { backgroundColor: c.bg }]}>
        <View style={[styles.summary, { backgroundColor: c.muted + '20', borderBottomColor: c.border }]}>
          <Text style={[styles.summaryText, { color: c.text }]}>
            {data.solver.name} solved "{data.challenge.title}" in {data.stats.messageCount} messages for {formatCostFromHundredths(data.stats.totalCost)}
          </Text>
        </View>
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
                </View>
                <Text style={[styles.msgContent, { color: c.text }]} selectable>
                  {msg.content.length > 2000 ? msg.content.slice(0, 2000) + '...' : msg.content}
                </Text>
              </View>
            );
          })}
        </View>
        <View style={{ alignItems: 'center', padding: spacing.md }}>
          <Text style={{ color: c.textMuted, fontSize: fontSizes.xs }}>
            View on <Text style={{ color: c.accent }} onPress={() => window.open(replayUrl, '_blank')}>ruwt.dev</Text>
          </Text>
        </View>
      </ScrollView>
    );
  }

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
          {/* Share group */}
          <Pressable onPress={handleCopyLink} style={[styles.shareBtn, { borderColor: c.border }]}>
            <Text style={{ color: c.text, fontSize: fontSizes.sm }}>
              {copiedLink ? 'Copied!' : 'Copy Link'}
            </Text>
          </Pressable>
          <Pressable onPress={handleShareTwitter} style={[styles.shareBtn, { borderColor: c.border }]}>
            <Text style={{ color: c.text, fontSize: fontSizes.sm }}>Twitter</Text>
          </Pressable>
          <Pressable onPress={handleShareLinkedIn} style={[styles.shareBtn, { borderColor: c.border }]}>
            <Text style={{ color: c.text, fontSize: fontSizes.sm }}>LinkedIn</Text>
          </Pressable>
          <Pressable onPress={handleCopyEmbed} style={[styles.shareBtn, { borderColor: c.border }]}>
            <Text style={{ color: c.text, fontSize: fontSizes.sm }}>
              {copiedEmbed ? 'Copied!' : 'Embed'}
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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
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
