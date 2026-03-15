/**
 * AFISparkline: SVG sparkline showing AFI score trend over time.
 * Fetches history from /api/afi-history and renders a mini line chart.
 */
import { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors } from '@/shared/theme';
import { fontSizes, fontFamily, spacing } from '@/shared/theme/tokens';
import { AFI_TIER_COLORS, type AFITier } from '@/shared/lib/scoring';

interface HistoryPoint {
  score: number;
  tier: string;
  date: string;
}

interface AFISparklineProps {
  username: string;
  currentTier: AFITier;
  width?: number;
  height?: number;
}

export function AFISparkline({ username, currentTier, width = 200, height = 48 }: AFISparklineProps) {
  const c = useColors();
  const [points, setPoints] = useState<HistoryPoint[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/afi-history?username=${encodeURIComponent(username)}`);
        if (res.ok) {
          const data = await res.json() as { history: HistoryPoint[] };
          setPoints(data.history || []);
        }
      } catch {
        // Silent fail — sparkline is decorative
      }
    };
    load();
  }, [username]);

  if (points.length < 2) return null;

  const scores = points.map((p) => p.score);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const range = maxScore - minScore || 1;
  const padding = 4;
  const chartW = width - padding * 2;
  const chartH = height - padding * 2;

  const pathPoints = scores.map((score, i) => {
    const x = padding + (i / (scores.length - 1)) * chartW;
    const y = padding + chartH - ((score - minScore) / range) * chartH;
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const color = AFI_TIER_COLORS[currentTier];
  const trend = scores[scores.length - 1] - scores[0];

  return (
    <View style={styles.container}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <path
          d={pathPoints.join(' ')}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Current point */}
        <circle
          cx={padding + chartW}
          cy={padding + chartH - ((scores[scores.length - 1] - minScore) / range) * chartH}
          r={3}
          fill={color}
        />
      </svg>
      <Text style={[styles.trendText, { color: trend >= 0 ? c.success : c.destructive }]}>
        {trend >= 0 ? '+' : ''}{trend} pts
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  trendText: {
    fontSize: fontSizes.xs,
    fontWeight: '600',
    fontFamily: fontFamily.body,
  },
});
