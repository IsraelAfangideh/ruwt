/**
 * TrialBanner: Gold-accent banner showing free trial status, usage counters, and upgrade CTA.
 * Renders between header and main content in DashboardLayout.
 */
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button } from './ui/Button';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily } from '@/theme/tokens';

export interface TrialInfo {
  isActive: boolean;
  daysRemaining: number;
  assessmentsUsed: number;
  assessmentsLimit: number;
  invitesUsed: number;
  invitesLimit: number;
}

interface TrialBannerProps {
  trial: TrialInfo;
  subscriptionStatus?: string;
}

export function TrialBanner({ trial, subscriptionStatus }: TrialBannerProps) {
  const navigation = useNavigation();
  const c = useColors();

  // Don't show banner if user has a paid subscription
  if (subscriptionStatus === 'active') return null;

  const isExpired = !trial.isActive;
  const isWarning = trial.daysRemaining <= 7 && trial.daysRemaining > 0;
  const assessmentsAtLimit = trial.assessmentsUsed >= trial.assessmentsLimit;
  const invitesAtLimit = trial.invitesUsed >= trial.invitesLimit;

  const bgColor = isExpired
    ? c.destructive + '15'
    : isWarning
      ? '#d4a843' + '20'
      : '#c9a962' + '15';
  const borderColor = isExpired
    ? c.destructive + '40'
    : isWarning
      ? '#d4a843' + '60'
      : '#c9a962' + '40';
  const textColor = isExpired ? c.destructive : '#c9a962';

  return (
    <View
      style={[styles.banner, { backgroundColor: bgColor, borderColor }]}
      testID="trial-banner"
      accessibilityRole="status"
    >
      <View style={styles.content}>
        {isExpired ? (
          <Text style={[styles.label, { color: c.destructive }]}>
            Trial expired — subscribe to continue using Teams features.
          </Text>
        ) : (
          <View style={styles.row}>
            <Text style={[styles.label, { color: textColor }]}>
              Free Trial: {trial.daysRemaining} day{trial.daysRemaining !== 1 ? 's' : ''} remaining
            </Text>
            <View style={styles.counters}>
              <Text
                style={[
                  styles.counter,
                  { color: assessmentsAtLimit ? c.destructive : c.textMuted },
                ]}
              >
                {trial.assessmentsUsed}/{trial.assessmentsLimit} assessments
              </Text>
              <Text style={[styles.separator, { color: c.textMuted }]}>|</Text>
              <Text
                style={[
                  styles.counter,
                  { color: invitesAtLimit ? c.destructive : c.textMuted },
                ]}
              >
                {trial.invitesUsed}/{trial.invitesLimit} invites
              </Text>
            </View>
          </View>
        )}
      </View>
      <Button
        size="sm"
        onPress={() => navigation.navigate('Hiring' as never)}
        style={{ backgroundColor: '#c9a962' }}
        textStyle={{ color: '#1a1816', fontWeight: '600' }}
      >
        Subscribe
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: spacing.md,
  },
  content: { flex: 1, marginRight: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  label: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    fontFamily: fontFamily.body,
  },
  counters: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  counter: {
    fontSize: fontSizes.xs,
    fontFamily: fontFamily.body,
  },
  separator: {
    fontSize: fontSizes.xs,
  },
});
