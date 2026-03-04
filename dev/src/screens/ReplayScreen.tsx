/**
 * ReplayScreen: Full-page replay viewer for a challenge attempt.
 * Route: /replay/:attemptId
 * Supports ?embed=1 for compact iframe embedding.
 *
 * When code snapshots are available, renders a split-pane "video" experience:
 * - Left: read-only Monaco editor showing code at current timeline position
 * - Right: chat messages up to current position
 * - Bottom: timeline scrubber with play/pause
 *
 * Falls back to text-only timeline for old replays without snapshots.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily } from '@/theme/tokens';
import { getModelById, tierColor, formatCostFromHundredths } from '@/lib/ai/pricing';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { CommentSection } from '@/components/CommentSection';

const MonacoEditor = React.lazy(() => import('@monaco-editor/react'));

interface ReplayMessage {
  role: string;
  content: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  cost?: number;
  codeSnapshot?: string | null;
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

  // Video replay state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const playTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatScrollRef = useRef<any>(null);

  useDocumentMeta({
    title: data ? `Replay: ${data.challenge.title}` : undefined,
    description: data ? `Watch how ${data.solver.name} solved "${data.challenge.title}" using ${(data.attempt.inputTokens + data.attempt.outputTokens).toLocaleString()} tokens. ${data.challenge.difficulty} challenge replay on ruwt.dev.` : undefined,
    canonicalPath: attemptId ? `/replay/${attemptId}` : undefined,
  });

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
        const replayData = await res.json() as ReplayData;
        setData(replayData);
        // Start at last message
        if (replayData.messages.length > 0) {
          setCurrentIndex(replayData.messages.length - 1);
        }
      } catch {
        setError('Failed to load replay');
      }
      setLoading(false);
    };
    load();
  }, [attemptId]);

  // Check if any message has a non-empty code snapshot
  const hasSnapshots = data?.messages.some((m) => !!m.codeSnapshot) ?? false;

  // Get code snapshot at current index (walk backward to find most recent snapshot)
  const getCodeAtIndex = useCallback((idx: number): string => {
    if (!data) return '';
    for (let i = idx; i >= 0; i--) {
      if (data.messages[i].codeSnapshot) return data.messages[i].codeSnapshot!;
    }
    return '';
  }, [data]);

  // Messages visible up to current index
  const visibleMessages = data?.messages.slice(0, currentIndex + 1) ?? [];

  // Auto-play logic
  useEffect(() => {
    if (!isPlaying || !data) return;
    if (currentIndex >= data.messages.length - 1) {
      setIsPlaying(false);
      return;
    }
    playTimerRef.current = setTimeout(() => {
      setCurrentIndex((prev) => prev + 1);
    }, 2000);
    return () => {
      if (playTimerRef.current) clearTimeout(playTimerRef.current);
    };
  }, [isPlaying, currentIndex, data]);

  // Scroll chat to bottom when index changes
  useEffect(() => {
    chatScrollRef.current?.scrollToEnd?.({ animated: true });
  }, [currentIndex]);

  const togglePlay = useCallback(() => {
    if (!data) return;
    if (currentIndex >= data.messages.length - 1) {
      // Restart from beginning
      setCurrentIndex(0);
      setIsPlaying(true);
    } else {
      setIsPlaying((prev) => !prev);
    }
  }, [currentIndex, data]);

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

  // Header (shared between video and text modes)
  const headerEl = (
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
  );

  // Summary bar (shared)
  const summaryEl = (
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
  );

  // Comments + CTA (shared)
  const footerEl = (
    <>
      <View style={[styles.commentsSection, { borderTopColor: c.border }]}>
        <Text style={[styles.commentsTitle, { color: c.text }]}>Comments</Text>
        <CommentSection
          targetType="replay"
          targetId={attemptId}
          apiPath={`/api/attempts/${attemptId}/comments`}
          promptText="Share your thoughts on this replay..."
        />
      </View>
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
    </>
  );

  // ── Video replay mode (has code snapshots) ──
  if (hasSnapshots) {
    const currentCode = getCodeAtIndex(currentIndex);

    return (
      <View style={[styles.page, { backgroundColor: c.bg }]} testID="replay-screen">
        {headerEl}
        {summaryEl}

        {/* Split pane — chat left, editor right (matches arena layout) */}
        <div style={{ display: 'flex', height: 400, maxWidth: 1200, alignSelf: 'center', width: '100%' }}>
          {/* Left: Chat messages */}
          <div style={{ width: 380, display: 'flex', flexDirection: 'column', minWidth: 300, borderRight: `1px solid ${c.border}` }}>
            <ScrollView ref={chatScrollRef} style={{ flex: 1 }} testID="replay-chat">
              {visibleMessages.map((msg, i) => {
                const mi = msg.model ? getModelById(msg.model) : undefined;
                return (
                  <View key={i} style={[styles.chatMsg, { borderBottomColor: c.border }]}>
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
                          {formatCostFromHundredths(msg.cost)}
                        </Text>
                      )}
                    </View>
                    <Text style={[styles.chatMsgContent, { color: c.text }]} selectable numberOfLines={8}>
                      {msg.content.length > 500 ? msg.content.slice(0, 500) + '...' : msg.content}
                    </Text>
                  </View>
                );
              })}
              {data.messages.length === 0 && (
                <View style={[styles.center, { paddingVertical: spacing.xl }]}>
                  <Text style={{ color: c.textMuted }}>No messages recorded.</Text>
                </View>
              )}
            </ScrollView>
          </div>

          {/* Right: Monaco editor */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <React.Suspense fallback={<ActivityIndicator style={{ margin: 40 }} />}>
              <MonacoEditor
                height="400px"
                language="javascript"
                value={currentCode}
                theme="vs-dark"
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  fontSize: 13,
                  fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  renderLineHighlight: 'none',
                }}
              />
            </React.Suspense>
          </div>
        </div>

        {/* Timeline scrubber */}
        <View style={[styles.scrubber, { borderTopColor: c.border, backgroundColor: c.bg }]} testID="replay-scrubber">
          <View style={styles.scrubberTrack}>
            {data.messages.map((_msg, i) => (
              <Pressable
                key={i}
                onPress={() => { setCurrentIndex(i); setIsPlaying(false); }}
                testID={`scrubber-dot-${i}`}
                style={[
                  styles.scrubberDot,
                  {
                    backgroundColor: i <= currentIndex ? c.accent : c.border,
                    width: i === currentIndex ? 12 : 8,
                    height: i === currentIndex ? 12 : 8,
                  },
                ]}
              />
            ))}
          </View>
          <Text style={{ color: c.textMuted, fontSize: fontSizes.xs, minWidth: 50, textAlign: 'right' }}>
            {currentIndex + 1} / {data.messages.length}
          </Text>
          <Pressable onPress={togglePlay} style={[styles.playBtn, { backgroundColor: c.accent }]} testID="replay-play-btn">
            <Text style={{ color: '#0d1117', fontSize: 14, fontWeight: '700' }}>
              {isPlaying ? '\u23F8' : '\u25B6'}
            </Text>
          </Pressable>
        </View>

        <ScrollView>
          {footerEl}
        </ScrollView>
      </View>
    );
  }

  // ── Text-only mode (legacy replays without snapshots) ──
  return (
    <ScrollView style={[styles.page, { backgroundColor: c.bg }]} testID="replay-screen">
      {headerEl}
      {summaryEl}

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

      {footerEl}
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
    maxWidth: 1200,
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
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  summaryText: { fontSize: fontSizes.sm, fontWeight: '600', marginBottom: spacing.sm },
  summaryModels: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  modelBadge: { borderWidth: 1, borderRadius: 9999, paddingHorizontal: 8, paddingVertical: 2 },
  timeline: { maxWidth: 1200, alignSelf: 'center', width: '100%' },
  msgRow: { padding: spacing.lg, borderBottomWidth: 1 },
  msgHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  msgContent: { fontSize: fontSizes.sm, lineHeight: 20, fontFamily: 'monospace' },
  chatMsg: { padding: spacing.sm, borderBottomWidth: 1 },
  chatMsgContent: { fontSize: fontSizes.xs, lineHeight: 18, fontFamily: 'monospace' },
  commentsSection: { padding: spacing.lg, borderTopWidth: 1, maxWidth: 1200, alignSelf: 'center', width: '100%' },
  commentsTitle: { fontSize: fontSizes.lg, fontWeight: '700', fontFamily: fontFamily.body, marginBottom: spacing.sm },
  ctaSection: { alignItems: 'center', paddingVertical: spacing.xl },
  ctaButton: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: 8 },
  ctaText: { fontSize: fontSizes.md, fontWeight: '600' },
  backLink: { marginTop: spacing.md },
  scrubber: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
    borderTopWidth: 1,
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
    gap: spacing.sm,
  },
  playBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrubberTrack: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  scrubberDot: {
    borderRadius: 6,
  },
});
