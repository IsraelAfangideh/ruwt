/**
 * FeaturedReplay: Fetches a real featured replay from the API, falls back to hardcoded example.
 */
import { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { useColors } from '@/theme';
import { spacing, fontSizes } from '@/theme/tokens';
import { getModelById, tierColor, tierLabel, formatCostFromHundredths } from '@/lib/ai/pricing';

interface FeaturedMessage {
  role: string;
  content: string;
  model?: string | null;
  inputTokens?: number;
  outputTokens?: number;
  cost?: number;
}

interface FeaturedData {
  solver: { name: string };
  stats: { messageCount: number; modelsUsed: string[]; totalCost: number };
  messages: FeaturedMessage[];
}

const FALLBACK_MESSAGES: FeaturedMessage[] = [
  {
    role: 'user',
    content: 'Implement a debounce function that takes a callback and delay. Return a function that only executes after the delay has passed since the last call.',
    model: null,
    cost: 0,
  },
  {
    role: 'assistant',
    content: '```javascript\nfunction debounce(fn, delay) {\n  let timer;\n  return function(...args) {\n    clearTimeout(timer);\n    timer = setTimeout(() => fn.apply(this, args), delay);\n  };\n}\n```',
    model: 'Llama 3.1 8B',
    cost: 12,
    inputTokens: 40,
    outputTokens: 147,
  },
];

export function FeaturedReplay() {
  const c = useColors();
  const [liveData, setLiveData] = useState<FeaturedData | null>(null);

  useEffect(() => {
    fetch('/api/featured-replay')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.messages && data.messages.length > 0) {
          setLiveData(data);
        }
      })
      .catch(() => {});
  }, []);

  const messages = liveData?.messages ?? FALLBACK_MESSAGES;
  const totalCost = liveData?.stats.totalCost ?? 12;
  const messageCount = liveData?.stats.messageCount ?? 2;
  const modelsUsed = liveData?.stats.modelsUsed ?? [];

  const insightText = liveData
    ? `${liveData.solver.name} solved this in ${messageCount} message${messageCount !== 1 ? 's' : ''} using ${modelsUsed.length} model${modelsUsed.length !== 1 ? 's' : ''} for ${formatCostFromHundredths(totalCost)}.`
    : 'Key insight: A clear, specific prompt to a Budget model solved this in one shot for under $0.01.';

  return (
    <Card style={styles.card}>
      <CardHeader>
        <Text style={[styles.label, { color: c.textMuted }]}>
          {liveData ? 'REAL STRATEGY' : 'EXAMPLE STRATEGY'}
        </Text>
        <CardTitle>
          {liveData
            ? `How ${liveData.solver.name} Spent ${formatCostFromHundredths(totalCost)}`
            : 'How a Top Solver Spent $0.0012'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <View style={styles.timeline}>
          {messages.slice(0, 4).map((msg, i) => {
            const mi = msg.model ? getModelById(msg.model) : undefined;
            const modelDisplay = mi
              ? `${mi.displayName} (${tierLabel(mi.tier)})`
              : msg.model === 'Llama 3.1 8B'
                ? 'Llama 3.1 8B (Budget)'
                : null;
            const modelColor = mi ? tierColor(mi.tier) : c.success;
            const tokens = (msg.inputTokens ?? 0) + (msg.outputTokens ?? 0);

            return (
              <View key={i} style={[styles.msg, { borderLeftColor: msg.role === 'user' ? c.accent : modelColor }]}>
                <View style={styles.msgHeader}>
                  <View style={[styles.rolePill, { backgroundColor: msg.role === 'user' ? c.accent + '20' : modelColor + '20' }]}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: msg.role === 'user' ? c.accent : modelColor }}>
                      {msg.role === 'user' ? 'USER' : 'AI'}
                    </Text>
                  </View>
                  {modelDisplay && (
                    <Text style={{ fontSize: fontSizes.xs, color: modelColor }}>{modelDisplay}</Text>
                  )}
                  {(msg.cost ?? 0) > 0 && (
                    <Text style={{ fontSize: fontSizes.xs, color: c.textMuted, marginLeft: 'auto' }}>
                      {tokens > 0 ? `${tokens} tok \u00B7 ` : ''}{formatCostFromHundredths(msg.cost!)}
                    </Text>
                  )}
                </View>
                <Text style={[styles.msgText, { color: c.text }]} numberOfLines={4}>
                  {msg.content.replace(/```\w*\n?/g, '').trim()}
                </Text>
              </View>
            );
          })}
        </View>
        <View style={[styles.insight, { backgroundColor: c.accent + '10', borderColor: c.accent + '30' }]}>
          <Text style={[styles.insightText, { color: c.text }]}>
            {insightText}
          </Text>
        </View>
      </CardContent>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { maxWidth: 600, alignSelf: 'center', width: '100%' },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  timeline: { gap: spacing.sm },
  msg: { borderLeftWidth: 3, paddingLeft: spacing.md, paddingVertical: spacing.xs },
  msgHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  rolePill: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  msgText: { fontSize: fontSizes.sm, lineHeight: 20, fontFamily: 'monospace' },
  insight: { marginTop: spacing.md, padding: spacing.md, borderRadius: 8, borderWidth: 1 },
  insightText: { fontSize: fontSizes.sm, fontStyle: 'italic' },
});
