/**
 * HighlightReel: Vertical timeline of key moments from an assessment session.
 * Shows model switches, error recoveries, cost spikes, and passes.
 */
import { View, Text, StyleSheet } from 'react-native';
import { Card, CardContent } from '@/components/ui/Card';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily } from '@/theme/tokens';

export interface HighlightMoment {
  timestamp: string;
  type: 'model_switch' | 'error_recovery' | 'cost_spike' | 'escalation' | 'pass';
  narrative: string;
  challengeIndex: number;
  cost?: number;
}

interface HighlightReelProps {
  highlights: HighlightMoment[];
}

const TYPE_CONFIG: Record<string, { icon: string; color: string }> = {
  escalation: { icon: '\u2191', color: '#a78bfa' },     // ↑ purple
  model_switch: { icon: '\u21C4', color: '#60a5fa' },   // ⇄ blue
  error_recovery: { icon: '\u2714', color: '#5a8a5a' },  // ✔ green
  cost_spike: { icon: '\u26A0', color: '#e5a639' },      // ⚠ amber
  pass: { icon: '\u2605', color: '#5a8a5a' },             // ★ green
};

function formatTime(timestamp: string): string {
  try {
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function formatCost(cents: number): string {
  const dollars = cents / 10000;
  return dollars < 0.01 ? `$${dollars.toFixed(4)}` : `$${dollars.toFixed(2)}`;
}

export function HighlightReel({ highlights }: HighlightReelProps) {
  const c = useColors();

  if (highlights.length === 0) return null;

  return (
    <Card style={[styles.card, { borderColor: c.border }]}>
      <CardContent>
        <Text style={[styles.title, { color: c.text }]}>Key Moments</Text>
        <View style={styles.timeline}>
          {highlights.map((h, i) => {
            const config = TYPE_CONFIG[h.type] ?? { icon: '\u2022', color: c.textMuted };
            return (
              <View key={i} style={styles.entry}>
                {/* Timeline line */}
                {i < highlights.length - 1 && (
                  <View style={[styles.line, { backgroundColor: c.border }]} />
                )}
                {/* Dot */}
                <View style={[styles.dot, { backgroundColor: config.color }]}>
                  <Text style={styles.dotIcon}>{config.icon}</Text>
                </View>
                {/* Content */}
                <View style={styles.content}>
                  <View style={styles.entryHeader}>
                    <Text style={[styles.time, { color: c.textMuted }]}>
                      {formatTime(h.timestamp)}
                    </Text>
                    {h.cost != null && h.cost > 0 && (
                      <Text style={[styles.cost, { color: c.accent }]}>
                        {formatCost(h.cost)}
                      </Text>
                    )}
                  </View>
                  <Text style={[styles.narrative, { color: c.text }]}>{h.narrative}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </CardContent>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
  },
  title: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
    fontFamily: fontFamily.body,
    marginBottom: spacing.md,
  },
  timeline: {
    paddingLeft: spacing.xs,
  },
  entry: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    position: 'relative',
  },
  line: {
    position: 'absolute',
    left: 11,
    top: 24,
    bottom: -spacing.md,
    width: 1,
  },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    flexShrink: 0,
  },
  dotIcon: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '700',
  },
  content: {
    flex: 1,
    paddingTop: 2,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  time: {
    fontSize: fontSizes.xs,
    fontFamily: 'monospace',
  },
  cost: {
    fontSize: fontSizes.xs,
    fontWeight: '600',
  },
  narrative: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamily.body,
    lineHeight: 20,
  },
});
