import { useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Input } from '@/components/ui/Input';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily } from '@/theme/tokens';

interface PassThreshold {
  enabled: boolean;
  mode: 'all_dimensions' | 'weighted_average';
  minOverall?: number;
  dimensions: Record<string, number>;
}

interface Props {
  value: PassThreshold | null;
  onChange: (threshold: PassThreshold | null) => void;
}

const DIMENSIONS = [
  { key: 'modelSelection' as const, label: 'Model Selection' },
  { key: 'promptEfficiency' as const, label: 'Prompt Efficiency' },
  { key: 'debugging' as const, label: 'Debugging' },
  { key: 'strategy' as const, label: 'Strategy' },
  { key: 'speed' as const, label: 'Speed' },
];

const DEFAULT_THRESHOLD: PassThreshold = {
  enabled: true,
  mode: 'all_dimensions',
  dimensions: {
    modelSelection: 50,
    promptEfficiency: 50,
    debugging: 50,
    strategy: 50,
    speed: 50,
  },
};

export function PassThresholdEditor({ value, onChange }: Props) {
  const c = useColors();
  const threshold = value ?? DEFAULT_THRESHOLD;

  const toggleEnabled = useCallback(() => {
    if (threshold.enabled) {
      onChange(null);
    } else {
      onChange({ ...DEFAULT_THRESHOLD, enabled: true });
    }
  }, [threshold, onChange]);

  const setMode = useCallback((mode: 'all_dimensions' | 'weighted_average') => {
    onChange({ ...threshold, mode });
  }, [threshold, onChange]);

  const setDimension = useCallback((key: keyof PassThreshold['dimensions'], val: string) => {
    const num = Math.max(0, Math.min(100, parseInt(val, 10) || 0));
    onChange({
      ...threshold,
      dimensions: { ...threshold.dimensions, [key]: num },
    });
  }, [threshold, onChange]);

  const setMinOverall = useCallback((val: string) => {
    const num = Math.max(0, Math.min(100, parseInt(val, 10) || 0));
    onChange({ ...threshold, minOverall: num });
  }, [threshold, onChange]);

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionLabel, { color: c.text }]}>
        Auto-Grading Thresholds (optional)
      </Text>
      <Text style={[styles.sectionHint, { color: c.textMuted }]}>
        Automatically classify candidates as Pass, Fail, or Review based on their AI Profile scores.
      </Text>

      {/* Toggle */}
      <Pressable
        onPress={toggleEnabled}
        style={[
          styles.toggle,
          {
            backgroundColor: threshold.enabled ? c.accent + '20' : c.bgWarm,
            borderColor: threshold.enabled ? c.accent : c.border,
          },
        ]}
      >
        <View
          style={[
            styles.toggleDot,
            {
              backgroundColor: threshold.enabled ? c.accent : c.textMuted,
              alignSelf: threshold.enabled ? 'flex-end' : 'flex-start',
            },
          ]}
        />
        <Text style={[styles.toggleLabel, { color: c.text }]}>
          {threshold.enabled ? 'Auto-grading enabled' : 'Auto-grading disabled'}
        </Text>
      </Pressable>

      {threshold.enabled && (
        <>
          {/* Mode selector */}
          <View style={styles.modeRow}>
            <Pressable
              onPress={() => setMode('all_dimensions')}
              style={[
                styles.modeOption,
                {
                  backgroundColor: threshold.mode === 'all_dimensions' ? c.accent + '20' : 'transparent',
                  borderColor: threshold.mode === 'all_dimensions' ? c.accent : c.border,
                },
              ]}
            >
              <Text style={[styles.modeText, { color: threshold.mode === 'all_dimensions' ? c.accent : c.textMuted }]}>
                All dimensions above threshold
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setMode('weighted_average')}
              style={[
                styles.modeOption,
                {
                  backgroundColor: threshold.mode === 'weighted_average' ? c.accent + '20' : 'transparent',
                  borderColor: threshold.mode === 'weighted_average' ? c.accent : c.border,
                },
              ]}
            >
              <Text style={[styles.modeText, { color: threshold.mode === 'weighted_average' ? c.accent : c.textMuted }]}>
                Weighted average above minimum
              </Text>
            </Pressable>
          </View>

          {threshold.mode === 'weighted_average' && (
            <View style={styles.overallRow}>
              <Text style={[styles.weightLabel, { color: c.text }]}>Minimum Overall Score</Text>
              <View style={{ width: 80 }}>
                <Input
                  placeholder="60"
                  value={String(threshold.minOverall ?? 60)}
                  onChangeText={setMinOverall}
                  keyboardType="numeric"
                />
              </View>
            </View>
          )}

          {/* Dimension thresholds */}
          <View style={styles.dimensionGrid}>
            {DIMENSIONS.map((d) => (
              <View key={d.key} style={styles.dimensionItem}>
                <Text style={[styles.weightLabel, { color: c.text }]}>{d.label}</Text>
                <View style={{ width: 80 }}>
                  <Input
                    placeholder="50"
                    value={String(threshold.dimensions[d.key])}
                    onChangeText={(v) => setDimension(d.key, v)}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            ))}
          </View>

          <Text style={[styles.explainer, { color: c.textMuted }]}>
            Scores are percentile ranks (0–100) compared to the candidate pool.{' '}
            {threshold.mode === 'all_dimensions'
              ? 'PASS = all dimensions at or above threshold. FAIL = any dimension 20+ points below. Otherwise REVIEW.'
              : `PASS = weighted average >= ${threshold.minOverall ?? 60}. FAIL = weighted average < ${Math.max(0, (threshold.minOverall ?? 60) - 20)}. Otherwise REVIEW.`}
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.lg },
  sectionLabel: { fontSize: fontSizes.lg, fontWeight: '600', marginBottom: spacing.xs },
  sectionHint: { fontSize: fontSizes.sm, marginBottom: spacing.md, fontFamily: fontFamily.body },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: spacing.md,
  },
  toggleDot: { width: 12, height: 12, borderRadius: 6 },
  toggleLabel: { fontSize: fontSizes.sm, fontWeight: '500' },
  modeRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  modeOption: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
  },
  modeText: { fontSize: fontSizes.sm, fontWeight: '500', textAlign: 'center' },
  overallRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  dimensionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.md },
  dimensionItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minWidth: 200 },
  weightLabel: { fontSize: fontSizes.sm, fontWeight: '500', width: 130 },
  explainer: { fontSize: fontSizes.xs, fontStyle: 'italic' },
});
