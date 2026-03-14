/**
 * AIProfileRadar: SVG radar chart showing 5-axis AI proficiency profile.
 * Axes: Model Selection, Prompt Efficiency, Debugging, Strategy, Speed
 */
import { View, StyleSheet } from 'react-native';
import { useColors } from '@/shared/theme';
import { fontFamily } from '@/shared/theme/tokens';

export interface AIProfile {
  modelSelection: number;   // 0-100
  promptEfficiency: number; // 0-100
  debugging: number;        // 0-100
  strategy: number;         // 0-100
  speed: number;            // 0-100
}

interface AIProfileRadarProps {
  profile: AIProfile;
  size?: number;
}

const AXES = [
  { key: 'modelSelection', label: 'Model Selection' },
  { key: 'promptEfficiency', label: 'Prompt Efficiency' },
  { key: 'debugging', label: 'Debugging' },
  { key: 'strategy', label: 'Strategy' },
  { key: 'speed', label: 'Speed' },
] as const;

function polarToCartesian(cx: number, cy: number, r: number, angleRad: number) {
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  };
}

export function AIProfileRadar({ profile, size = 280 }: AIProfileRadarProps) {
  const c = useColors();
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size / 2 - 40;
  const n = AXES.length;
  const angleStep = (2 * Math.PI) / n;
  const startAngle = -Math.PI / 2; // Start at top

  // Grid rings at 25%, 50%, 75%, 100%
  const rings = [0.25, 0.5, 0.75, 1.0];

  // Build data polygon points
  const values = AXES.map((a) => profile[a.key as keyof AIProfile] / 100);
  const dataPoints = values.map((v, i) => {
    const angle = startAngle + i * angleStep;
    return polarToCartesian(cx, cy, v * maxR, angle);
  });
  const dataPath = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + 'Z';

  return (
    <View style={styles.container}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Grid rings */}
        {rings.map((ring) => {
          const ringPoints = Array.from({ length: n }, (_, i) => {
            const angle = startAngle + i * angleStep;
            return polarToCartesian(cx, cy, ring * maxR, angle);
          });
          const ringPath = ringPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + 'Z';
          return (
            <path
              key={ring}
              d={ringPath}
              fill="none"
              stroke={c.border as string}
              strokeWidth={0.5}
              opacity={0.4}
            />
          );
        })}

        {/* Axis lines */}
        {AXES.map((_, i) => {
          const angle = startAngle + i * angleStep;
          const end = polarToCartesian(cx, cy, maxR, angle);
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={end.x}
              y2={end.y}
              stroke={c.border as string}
              strokeWidth={0.5}
              opacity={0.4}
            />
          );
        })}

        {/* Data polygon */}
        <path
          d={dataPath}
          fill={`${c.accent}30`}
          stroke={c.accent as string}
          strokeWidth={2}
        />

        {/* Data points */}
        {dataPoints.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={4}
            fill={c.accent as string}
          />
        ))}

        {/* Axis labels */}
        {AXES.map((axis, i) => {
          const angle = startAngle + i * angleStep;
          const labelR = maxR + 24;
          const pos = polarToCartesian(cx, cy, labelR, angle);
          const value = profile[axis.key as keyof AIProfile];
          return (
            <text
              key={axis.key}
              x={pos.x}
              y={pos.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={c.textMuted as string}
              fontSize={11}
              fontFamily={fontFamily.body}
            >
              {axis.label} ({value})
            </text>
          );
        })}
      </svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
