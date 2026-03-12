/**
 * Progress screen — weight chart, nutrition averages, workout trends.
 * Uses simple SVG charts (no chart library needed).
 */
import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily, radii } from '@/theme/tokens';
import { Card, CardContent, CardTitle } from '@/components/ui';

interface ProgressData {
  range: number;
  weight: { date: string; weight: number; unit: string }[];
  nutrition: { date: string; calories: number; protein: number; carbs: number; fat: number }[];
  workouts: { date: string; count: number; totalMinutes: number }[];
}

type RangeOption = 7 | 30 | 90;

export function ProgressScreen() {
  const c = useColors();
  const navigation = useNavigation<any>();
  const [range, setRange] = useState<RangeOption>(7);
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/progress?range=${range}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [range]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  const avgCalories = data?.nutrition.length
    ? Math.round(data.nutrition.reduce((s, n) => s + n.calories, 0) / data.nutrition.length)
    : 0;
  const avgProtein = data?.nutrition.length
    ? Math.round(data.nutrition.reduce((s, n) => s + n.protein, 0) / data.nutrition.length)
    : 0;
  const totalWorkouts = data?.workouts.reduce((s, w) => s + w.count, 0) || 0;
  const totalMinutes = data?.workouts.reduce((s, w) => s + w.totalMinutes, 0) || 0;
  void totalMinutes; // Available for workout duration display

  return (
    <ScrollView style={[styles.scroll, { backgroundColor: c.bg }]} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={[styles.backText, { color: c.accent }]}>← Back</Text>
        </Pressable>
        <Text style={[styles.title, { color: c.text }]}>Progress</Text>
      </View>

      {/* Range Selector */}
      <View style={styles.rangeRow}>
        {([7, 30, 90] as RangeOption[]).map(r => (
          <Pressable
            key={r}
            onPress={() => setRange(r)}
            style={[
              styles.rangeBtn,
              { borderColor: c.border },
              range === r && { backgroundColor: c.accent },
            ]}
          >
            <Text style={[
              styles.rangeBtnText,
              { color: range === r ? '#fff' : c.text },
            ]}>{r}d</Text>
          </Pressable>
        ))}
      </View>

      {/* Summary Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.statValue, { color: c.text }]}>{avgCalories}</Text>
          <Text style={[styles.statLabel, { color: c.textMuted }]}>Avg cal/day</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.statValue, { color: c.text }]}>{avgProtein}g</Text>
          <Text style={[styles.statLabel, { color: c.textMuted }]}>Avg protein</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.statValue, { color: c.text }]}>{totalWorkouts}</Text>
          <Text style={[styles.statLabel, { color: c.textMuted }]}>Workouts</Text>
        </View>
      </View>

      {/* Weight Chart */}
      {data?.weight && data.weight.length > 0 && (
        <Card>
          <CardTitle>Weight Trend</CardTitle>
          <CardContent>
            <SimpleLineChart
              data={data.weight.map(w => ({ label: w.date.slice(5), value: w.weight }))}
              color={c.accent}

              textColor={c.textMuted}
            />
          </CardContent>
        </Card>
      )}

      {/* Calorie Chart */}
      {data?.nutrition && data.nutrition.length > 0 && (
        <Card>
          <CardTitle>Daily Calories</CardTitle>
          <CardContent>
            <SimpleBarChart
              data={data.nutrition.map(n => ({ label: n.date.slice(5), value: n.calories }))}
              color={c.accent}

              textColor={c.textMuted}
            />
          </CardContent>
        </Card>
      )}

      <View style={styles.bottomPad} />
    </ScrollView>
  );
}

/** Simple SVG line chart */
function SimpleLineChart({ data, color, textColor }: {
  data: { label: string; value: number }[];
  color: string;
  textColor: string;
}) {
  if (!data.length) return null;
  const w = 320, h = 120, pad = 30;
  const vals = data.map(d => d.value);
  const min = Math.min(...vals) * 0.95;
  const max = Math.max(...vals) * 1.05;
  const range = max - min || 1;

  const points = data.map((d, i) => ({
    x: pad + (i / Math.max(data.length - 1, 1)) * (w - pad * 2),
    y: pad + (1 - (d.value - min) / range) * (h - pad * 2),
  }));

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ maxWidth: w }}>
      <path d={pathD} fill="none" stroke={color} strokeWidth="2" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill={color} />
      ))}
      <text x={pad} y={h - 5} fill={textColor} fontSize="9">{data[0]?.label}</text>
      <text x={w - pad} y={h - 5} fill={textColor} fontSize="9" textAnchor="end">{data[data.length - 1]?.label}</text>
      <text x={5} y={pad + 4} fill={textColor} fontSize="9">{Math.round(max)}</text>
      <text x={5} y={h - pad} fill={textColor} fontSize="9">{Math.round(min)}</text>
    </svg>
  );
}

/** Simple SVG bar chart */
function SimpleBarChart({ data, color, textColor }: {
  data: { label: string; value: number }[];
  color: string;
  textColor: string;
}) {
  if (!data.length) return null;
  const w = 320, h = 120, pad = 30;
  const max = Math.max(...data.map(d => d.value)) * 1.1 || 1;
  const barW = Math.max(4, (w - pad * 2) / data.length - 2);

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ maxWidth: w }}>
      {data.map((d, i) => {
        const barH = (d.value / max) * (h - pad * 2);
        const x = pad + i * ((w - pad * 2) / data.length);
        return (
          <rect
            key={i}
            x={x}
            y={h - pad - barH}
            width={barW}
            height={barH}
            fill={color}
            rx="2"
          />
        );
      })}
      <text x={pad} y={h - 5} fill={textColor} fontSize="9">{data[0]?.label}</text>
      <text x={w - pad} y={h - 5} fill={textColor} fontSize="9" textAnchor="end">{data[data.length - 1]?.label}</text>
    </svg>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
    padding: spacing.md,
    gap: spacing.lg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: { gap: spacing.xs, paddingTop: spacing.md },
  backText: { fontSize: fontSizes.sm, fontFamily: fontFamily.body },
  title: {
    fontSize: fontSizes['2xl'],
    fontWeight: '700',
    fontFamily: fontFamily.display,
  },
  rangeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rangeBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  rangeBtnText: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    fontFamily: fontFamily.body,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  statValue: {
    fontSize: fontSizes.xl,
    fontWeight: '700',
    fontFamily: fontFamily.body,
  },
  statLabel: {
    fontSize: fontSizes.xs,
    fontFamily: fontFamily.body,
  },
  bottomPad: { height: spacing['2xl'] },
});
