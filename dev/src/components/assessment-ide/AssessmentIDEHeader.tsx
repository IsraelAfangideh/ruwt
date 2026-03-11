import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Badge } from '@/components/ui/Badge';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily } from '@/theme/tokens';

interface Props {
  title: string;
  assessmentId: string | undefined;
  status: string;
  isEditing: boolean;
  dirty: boolean;
}

export function AssessmentIDEHeader({ title, assessmentId, status, isEditing, dirty }: Props) {
  const c = useColors();
  const navigation = useNavigation();

  return (
    <View style={[styles.header, { backgroundColor: c.bg, borderBottomColor: c.border }]}>
      <View style={styles.left}>
        <Pressable
          onPress={() => {
            if (dirty && !window.confirm('You have unsaved changes. Leave anyway?')) return;
            navigation.navigate('Assessments' as never);
          }}
          accessibilityRole="button"
          accessibilityLabel="Back to Assessments"
          style={[styles.backBtn, { borderColor: c.border }]}
        >
          <Text style={{ fontSize: fontSizes.sm, color: c.textMuted }}>{'\u2190'}</Text>
        </Pressable>
        <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>
          {title || (isEditing ? 'Edit Assessment' : 'New Assessment')}
        </Text>
        {assessmentId && (
          <Badge
            variant="outline"
            style={{
              borderColor: status === 'active' ? c.success + '60' : c.accent + '60',
              backgroundColor: status === 'active' ? c.success + '10' : c.accent + '10',
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: '600', color: status === 'active' ? c.success : c.accent }}>
              {status === 'active' ? 'ACTIVE' : 'DRAFT'}
            </Text>
          </Badge>
        )}
      </View>
      {assessmentId && status === 'active' && (
        <Pressable
          onPress={() => (navigation as any).navigate('AssessmentResultsDashboard', { assessmentId })}
          accessibilityRole="button"
          accessibilityLabel="View results"
          style={[styles.resultsBtn, { borderColor: c.accent }]}
        >
          <Text style={{ fontSize: fontSizes.xs, fontWeight: '600', color: c.accent }}>View Results</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    minHeight: 48,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    minWidth: 0,
  },
  backBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderRadius: 6,
  },
  title: {
    fontSize: fontSizes.lg,
    fontWeight: '600',
    fontFamily: fontFamily.body,
    flexShrink: 1,
  },
  resultsBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderWidth: 1,
    borderRadius: 6,
  },
});
