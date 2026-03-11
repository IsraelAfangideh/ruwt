import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Input } from '@/components/ui/Input';
import { PassThresholdEditor, type PassThreshold } from '@/components/PassThresholdEditor';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily } from '@/theme/tokens';
import type { Weights } from '@/hooks/useAssessmentIDEState';

interface Props {
  // Branding
  companyName: string;
  companyLogoUrl: string;
  welcomeMessage: string;
  onCompanyNameChange: (v: string) => void;
  onCompanyLogoUrlChange: (v: string) => void;
  onWelcomeMessageChange: (v: string) => void;

  // Weights
  weights: Weights;
  weightSum: number;
  onWeightsChange: React.Dispatch<React.SetStateAction<Weights>>;

  // Threshold
  passThreshold: PassThreshold | null;
  onPassThresholdChange: (v: PassThreshold | null) => void;

  // Time limit
  timeLimitMinutes: string;
  onTimeLimitChange: (v: string) => void;
}

const WEIGHT_FIELDS = [
  { key: 'modelSelection' as const, label: 'Model Selection' },
  { key: 'promptEfficiency' as const, label: 'Prompt Efficiency' },
  { key: 'debugging' as const, label: 'Debugging' },
  { key: 'strategy' as const, label: 'Strategy' },
  { key: 'speed' as const, label: 'Speed' },
];

export function AssessmentAdvancedSection({
  companyName,
  companyLogoUrl,
  welcomeMessage,
  onCompanyNameChange,
  onCompanyLogoUrlChange,
  onWelcomeMessageChange,
  weights,
  weightSum,
  onWeightsChange,
  passThreshold,
  onPassThresholdChange,
  timeLimitMinutes,
  onTimeLimitChange,
}: Props) {
  const c = useColors();
  const [expanded, setExpanded] = useState(false);

  const mins = parseInt(timeLimitMinutes, 10);
  const timeLimitInvalid = timeLimitMinutes !== '' && (!Number.isFinite(mins) || mins < 5 || mins > 240);

  return (
    <View style={styles.container}>
      <Pressable
        onPress={() => setExpanded(!expanded)}
        accessibilityRole="button"
        accessibilityLabel={expanded ? 'Collapse advanced settings' : 'Expand advanced settings'}
        style={[styles.toggle, { borderColor: c.border }]}
      >
        <Text style={[styles.toggleText, { color: c.text }]}>
          {expanded ? '\u25BC' : '\u25B6'} Advanced Settings
        </Text>
      </Pressable>

      {expanded && (
        <View style={styles.content}>
          {/* Time Limit */}
          <View style={styles.section}>
            <Input
              label="Time Limit (minutes)"
              placeholder="60"
              value={timeLimitMinutes}
              onChangeText={onTimeLimitChange}
              keyboardType="numeric"
            />
            <Text style={{ fontSize: fontSizes.xs, color: timeLimitInvalid ? c.destructive : c.textMuted, marginTop: 4 }}>
              {timeLimitInvalid
                ? `${!Number.isFinite(mins) ? 'Enter a number' : mins < 5 ? 'Minimum is 5 minutes' : 'Maximum is 240 minutes'}`
                : 'Minimum 5 min, maximum 240 min'}
            </Text>
          </View>

          {/* Score Weights */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: c.text }]}>Score Weights</Text>
            <Text style={[styles.sectionHint, { color: c.textMuted }]}>
              Adjust how each dimension is weighted in the AI Profile radar chart.
            </Text>
            <View style={styles.weightsGrid}>
              {WEIGHT_FIELDS.map((w) => (
                <View key={w.key} style={styles.weightItem}>
                  <Text style={[styles.weightLabel, { color: c.text }]}>{w.label}</Text>
                  <View style={{ width: 80 }}>
                    <Input
                      placeholder="20"
                      value={weights[w.key]}
                      onChangeText={(v) => onWeightsChange((prev) => ({ ...prev, [w.key]: v }))}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              ))}
            </View>
            <View style={{ marginTop: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 4 }}>
                <View style={{ flex: 1, height: 6, backgroundColor: c.border, borderRadius: 3, overflow: 'hidden' }}>
                  <View style={{
                    height: 6,
                    borderRadius: 3,
                    width: `${Math.min(100, Number.isFinite(weightSum) ? weightSum : 0)}%`,
                    backgroundColor: weightSum === 100 ? c.success : weightSum > 100 ? c.destructive : c.accent,
                  } as any} />
                </View>
                <Text style={{
                  fontSize: fontSizes.xs,
                  fontWeight: '600',
                  color: weightSum === 100 ? c.success : Number.isFinite(weightSum) ? c.destructive : c.textMuted,
                  minWidth: 50,
                }}>
                  {Number.isFinite(weightSum) ? `${weightSum}/100` : '\u2014/100'}
                </Text>
              </View>
              {Number.isFinite(weightSum) && weightSum !== 100 && (
                <Text style={{ fontSize: fontSizes.xs, color: c.destructive }}>
                  Weights must sum to 100
                </Text>
              )}
            </View>
          </View>

          {/* Pass Threshold */}
          <PassThresholdEditor value={passThreshold} onChange={onPassThresholdChange} />

          {/* Company Branding */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: c.text }]}>Company Branding (optional)</Text>
            <Text style={[styles.sectionHint, { color: c.textMuted }]}>
              Add your company details for a branded candidate experience.
            </Text>
            <View style={styles.form}>
              <Input label="Company Name" placeholder="Acme Corp" value={companyName} onChangeText={onCompanyNameChange} />
              <View>
                <Input label="Company Logo URL" placeholder="https://example.com/logo.png" value={companyLogoUrl} onChangeText={onCompanyLogoUrlChange} />
                {companyLogoUrl && /^https?:\/\//i.test(companyLogoUrl) && (
                  <View style={{ marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <img
                      src={companyLogoUrl}
                      alt="Logo preview"
                      style={{ maxHeight: 40, maxWidth: 120, objectFit: 'contain', borderRadius: 4 }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <Text style={{ fontSize: fontSizes.xs, color: c.textMuted }}>Preview</Text>
                  </View>
                )}
              </View>
              <Input label="Welcome Message" placeholder="Welcome to our AI engineering assessment..." value={welcomeMessage} onChangeText={onWelcomeMessageChange} />
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  toggle: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: spacing.md,
  },
  toggleText: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
  },
  content: {
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  section: {},
  sectionLabel: { fontSize: fontSizes.md, fontWeight: '600', marginBottom: spacing.xs },
  sectionHint: { fontSize: fontSizes.sm, marginBottom: spacing.md, fontFamily: fontFamily.body },
  form: { gap: spacing.md },
  weightsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  weightItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minWidth: 200 },
  weightLabel: { fontSize: fontSizes.sm, fontWeight: '500', width: 120 },
});
