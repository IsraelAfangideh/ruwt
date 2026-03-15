/**
 * ReplayViewer: Modal overlay showing the conversation replay for a challenge attempt.
 */
import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useColors } from '@/shared/theme';
import { spacing, fontSizes, fontFamily } from '@/shared/theme/tokens';
import { getModelById, tierColor, formatCostFromHundredths } from '@/shared/lib/ai/pricing';
import { SplitPaneSkeleton } from '@/shared/ui/ScreenSkeletons';

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

interface ReplayViewerProps {
  attemptId: string;
  onClose: () => void;
}

export function ReplayViewer({ attemptId, onClose }: ReplayViewerProps) {
  const c = useColors();
  const navigation = useNavigation();
  const [data, setData] = useState<ReplayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    if (!data) return;
    const shareText = [
      `I solved "${data.challenge.title}" on ruwt.dev for ${formatCostFromHundredths(data.stats.totalCost)} using ${data.stats.modelsUsed.length} model${data.stats.modelsUsed.length !== 1 ? 's' : ''}`,
      `${data.challenge.difficulty} | ${(data.attempt.inputTokens + data.attempt.outputTokens).toLocaleString()} tokens | ${data.stats.messageCount} AI messages`,
      `Watch the replay: ${window.location.origin}/replay/${attemptId}`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      /* istanbul ignore next -- @preserve */
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/attempts/${attemptId}/replay`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as { error?: string };
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

  return (
    <View style={[styles.overlay]}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.modal, { backgroundColor: c.card, borderColor: c.border }]}>
        {/* Header */}
        <View style={[styles.modalHeader, { borderBottomColor: c.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.modalTitle, { color: c.text }]}>
              {data ? `${data.solver.name}'s Replay` : 'Loading Replay...'}
            </Text>
            {data && (
              <Text style={[styles.modalSubtitle, { color: c.textMuted }]}>
                {data.challenge.title} ({data.challenge.difficulty})
              </Text>
            )}
          </View>
          <Pressable onPress={handleShare} style={styles.fullReplayBtn}>
            <Text style={{ color: c.accent, fontSize: fontSizes.xs, fontWeight: '600' }}>
              {copied ? 'Copied!' : 'Share'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => { onClose(); (navigation.navigate as any)('Replay', { attemptId }); }}
            style={styles.fullReplayBtn}
          >
            <Text style={{ color: c.accent, fontSize: fontSizes.xs, fontWeight: '600' }}>Full replay</Text>
          </Pressable>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Text style={{ color: c.textMuted, fontSize: 20 }}>{'\u00D7'}</Text>
          </Pressable>
        </View>

        {loading ? (
          <SplitPaneSkeleton />
        ) : error ? (
          <View style={styles.center}>
            <Text style={{ color: c.destructive }}>{error}</Text>
          </View>
        ) : data ? (
          <>
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
            <ScrollView style={styles.timeline}>
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
                <View style={styles.center}>
                  <Text style={{ color: c.textMuted }}>No messages recorded for this attempt.</Text>
                </View>
              )}
            </ScrollView>
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute' as any,
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  backdrop: {
    position: 'absolute' as any,
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modal: {
    width: '90%',
    maxWidth: 700,
    maxHeight: '85%',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    zIndex: 101,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: fontSizes.lg, fontWeight: '700', fontFamily: fontFamily.body },
  modalSubtitle: { fontSize: fontSizes.xs, marginTop: 2 },
  fullReplayBtn: { padding: spacing.sm, marginRight: spacing.xs },
  closeBtn: { padding: spacing.sm },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  summary: { padding: spacing.md, borderBottomWidth: 1 },
  summaryText: { fontSize: fontSizes.sm, fontWeight: '600', marginBottom: spacing.sm },
  summaryModels: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  modelBadge: { borderWidth: 1, borderRadius: 9999, paddingHorizontal: 8, paddingVertical: 2 },
  timeline: { flex: 1 },
  msgRow: { padding: spacing.md, borderBottomWidth: 1 },
  msgHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  msgContent: { fontSize: fontSizes.sm, lineHeight: 20, fontFamily: 'monospace' },
});
