import { View, Text, StyleSheet } from 'react-native';
import { Button } from '@/components/ui/Button';
import { useColors } from '@/theme';
import { spacing, fontSizes } from '@/theme/tokens';

interface Props {
  assessmentId: string | undefined;
  status: string;
  title: string;
  saving: boolean;
  saveSuccess: boolean;
  saveError: string | null;
  activating: boolean;
  activateError: string | null;
  confirmActivate: boolean;
  weightSum: number;
  inviteError: string | null;
  onSave: () => void;
  onActivate: () => void;
  onSetConfirmActivate: (v: boolean) => void;
}

export function AssessmentActionBar({
  assessmentId,
  status,
  title,
  saving,
  saveSuccess,
  saveError,
  activating,
  activateError,
  confirmActivate,
  weightSum,
  inviteError,
  onSave,
  onActivate,
  onSetConfirmActivate,
}: Props) {
  const c = useColors();
  const saveDisabled = saving || !title || !Number.isFinite(weightSum) || weightSum !== 100;

  return (
    <View style={[styles.bar, { backgroundColor: c.bg, borderTopColor: c.border }]}>
      <View style={styles.left}>
        {[saveError, activateError, inviteError].filter(Boolean).map((err) => (
          <Text key={err} style={{ fontSize: fontSizes.xs, color: c.destructive }}>{err}</Text>
        ))}
        {!saving && !saveSuccess && !saveError && saveDisabled && weightSum !== 100 && title && (
          <Text style={{ fontSize: 10, color: c.destructive }}>Weights must = 100</Text>
        )}
      </View>
      <View style={styles.right}>
        {assessmentId && status === 'draft' && (
          confirmActivate ? (
            <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
              <Button variant="outline" onPress={() => { onSetConfirmActivate(false); onActivate(); }} disabled={activating}>
                {activating ? 'Activating...' : 'Confirm Activate'}
              </Button>
              <Button variant="ghost" size="sm" onPress={() => onSetConfirmActivate(false)}>
                Cancel
              </Button>
            </View>
          ) : (
            <Button variant="outline" onPress={() => onSetConfirmActivate(true)} disabled={activating}>
              Activate
            </Button>
          )
        )}
        <Button onPress={onSave} disabled={saveDisabled}>
          {saving ? 'Saving...' : saveError ? '\u2717 Error' : saveSuccess ? '\u2713 Saved' : 'Save Draft'}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    minHeight: 40,
    gap: spacing.sm,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
});
