/**
 * FeaturedReplay: Hardcoded example showing a strategic 2-message solve.
 */
import { View, Text, StyleSheet } from 'react-native';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { useColors } from '@/theme';
import { spacing, fontSizes } from '@/theme/tokens';

const EXAMPLE_MESSAGES = [
  {
    role: 'user',
    content: 'Implement a debounce function that takes a callback and delay. Return a function that only executes after the delay has passed since the last call.',
    model: null,
    cost: 0,
    tokens: 0,
    tier: null,
  },
  {
    role: 'assistant',
    content: '```javascript\nfunction debounce(fn, delay) {\n  let timer;\n  return function(...args) {\n    clearTimeout(timer);\n    timer = setTimeout(() => fn.apply(this, args), delay);\n  };\n}\n```',
    model: 'Llama 3.1 8B',
    cost: 12, // hundredths of cents
    tokens: 187,
    tier: 'budget' as const,
  },
];

export function FeaturedReplay() {
  const c = useColors();

  return (
    <Card style={styles.card}>
      <CardHeader>
        <Text style={[styles.label, { color: c.textMuted }]}>EXAMPLE STRATEGY</Text>
        <CardTitle>How a Top Solver Spent $0.0012</CardTitle>
      </CardHeader>
      <CardContent>
        <View style={styles.timeline}>
          {EXAMPLE_MESSAGES.map((msg, i) => (
            <View key={i} style={[styles.msg, { borderLeftColor: msg.role === 'user' ? c.accent : c.success }]}>
              <View style={styles.msgHeader}>
                <View style={[styles.rolePill, { backgroundColor: msg.role === 'user' ? c.accent + '20' : c.success + '20' }]}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: msg.role === 'user' ? c.accent : c.success }}>
                    {msg.role === 'user' ? 'USER' : 'AI'}
                  </Text>
                </View>
                {msg.model && (
                  <Text style={{ fontSize: fontSizes.xs, color: c.success }}>{msg.model} (Budget)</Text>
                )}
                {msg.cost > 0 && (
                  <Text style={{ fontSize: fontSizes.xs, color: c.textMuted, marginLeft: 'auto' }}>
                    {msg.tokens} tok {'\u00B7'} ${(msg.cost / 10000).toFixed(4)}
                  </Text>
                )}
              </View>
              <Text style={[styles.msgText, { color: c.text }]} numberOfLines={4}>
                {msg.content.replace(/```\w*\n?/g, '').trim()}
              </Text>
            </View>
          ))}
        </View>
        <View style={[styles.insight, { backgroundColor: c.accent + '10', borderColor: c.accent + '30' }]}>
          <Text style={[styles.insightText, { color: c.text }]}>
            Key insight: A clear, specific prompt to a Budget model solved this in one shot for under $0.01.
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
