import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { useColors, useTheme } from '@/theme';
import { spacing, fontSizes, fontFamily, radii } from '@/theme/tokens';
import { getDifficultyStyle } from '@/lib/difficulty';
import { formatCostFromHundredths } from '@/lib/ai/pricing';

const IS_WEB = typeof document !== 'undefined';

export interface Challenge {
  id: string;
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard' | string;
  maxTokens?: number | null;
  maxCost?: number | null;
  wallClockLimit?: number | null;
  category?: string | null;
  skillTested?: string | null;
  tier?: string | null;
  sortOrder?: number | null;
  language?: string | null;
  tags?: string[] | null;
  stats?: { solvers: number; avgCost: number | null } | null;
  userStatus?: 'not_started' | 'in_progress' | 'passed' | 'attempted';
  userBestCost?: number | null;
}

function categoryLabel(cat: string | null | undefined) {
  if (cat === 'model_selection') return 'Model Selection';
  if (cat === 'prompt_efficiency') return 'Prompt Efficiency';
  if (cat === 'iterative_debugging') return 'Debugging';
  if (cat === 'multi_model_strategy') return 'Multi-Model';
  if (cat === 'real_world') return 'Real-World';
  if (cat === 'qa_testing') return 'QA Testing';
  if (cat === 'frontend') return 'Frontend';
  if (cat === 'backend_api') return 'Backend API';
  if (cat === 'data_engineering') return 'Data';
  if (cat === 'devops') return 'DevOps';
  return null;
}

export function ChallengeCard({ challenge }: { challenge: Challenge }) {
  const navigation = useNavigation();
  const c = useColors();
  const { isDark } = useTheme();
  const [hovered, setHovered] = useState(false);

  const diffStyle = getDifficultyStyle(challenge.difficulty, isDark);
  const diffColor = diffStyle.color;
  const diffBg = diffStyle.bg;

  const catLabel = categoryLabel(challenge.category);
  const catColor = challenge.category === 'model_selection' ? (isDark ? c.accent : '#6b5520')
    : challenge.category === 'prompt_efficiency' ? (isDark ? c.success : '#3a6b3a')
    : challenge.category === 'iterative_debugging' ? (isDark ? c.destructive : '#8b4040')
    : challenge.category === 'multi_model_strategy' ? (isDark ? '#c4b5fd' : '#6d28d9')
    : challenge.category === 'real_world' ? (isDark ? '#fbbf24' : '#a16207')
    : challenge.category === 'qa_testing' ? (isDark ? '#f9a8d4' : '#be185d')
    : challenge.category === 'frontend' ? (isDark ? '#67e8f9' : '#0e7490')
    : challenge.category === 'backend_api' ? (isDark ? '#c4b5fd' : '#6d28d9')
    : challenge.category === 'data_engineering' ? (isDark ? '#6ee7b7' : '#047857')
    : challenge.category === 'devops' ? (isDark ? '#fdba74' : '#c2410c')
    : c.textMuted;
  const catBg = challenge.category === 'model_selection' ? c.accentBg
    : challenge.category === 'prompt_efficiency' ? c.successBg
    : challenge.category === 'iterative_debugging' ? c.errorBg
    : challenge.category === 'multi_model_strategy' ? '#a78bfa15'
    : challenge.category === 'real_world' ? '#f59e0b15'
    : challenge.category === 'qa_testing' ? '#ec489915'
    : challenge.category === 'frontend' ? '#06b6d415'
    : challenge.category === 'backend_api' ? '#8b5cf615'
    : challenge.category === 'data_engineering' ? '#10b98115'
    : challenge.category === 'devops' ? '#f9731615'
    : 'transparent';

  const langLabel = challenge.language === 'python' ? 'Python' : challenge.language === 'typescript' ? 'TypeScript' : null;
  const userStatus = challenge.userStatus;
  const isSolved = userStatus === 'passed';
  const isInProgress = userStatus === 'in_progress';
  const isRealWorld = challenge.category === 'real_world';
  const hasEfficiencyGoal = challenge.maxCost != null;
  const hasSolvers = challenge.stats && challenge.stats.solvers > 0;

  const cleanDescription = challenge.description
    .replace(/^#{1,3}\s+[^\n]*\n?/gm, '')
    .trim();

  const ctaText = isSolved ? 'Improve Score' : isInProgress ? 'Continue' : 'Start Problem';
  const ctaColor = isSolved ? c.success : isInProgress ? c.accent : c.accent;

  // Web hover handlers
  const webHoverProps = IS_WEB ? {
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
  } : {};

  return (
    <Pressable
      onPress={() => (navigation.navigate as any)('Arena', { challengeId: challenge.id })}
      accessibilityRole="link"
      accessibilityLabel={`${challenge.title}, ${diffStyle.label} difficulty${isSolved ? ', Solved' : isInProgress ? ', In progress' : ''}`}
      testID={`challenge-${challenge.id}`}
      style={({ pressed }: { pressed: boolean }) => [
        styles.pressable,
        pressed && styles.pressed,
      ]}
      {...webHoverProps}
    >
      <Card style={[
        styles.card,
        isRealWorld && !isSolved && styles.realWorldCard,
        isSolved && { borderLeftWidth: 3, borderLeftColor: c.success },
        hovered && styles.hovered,
      ]}>
        {/* Status indicator stripe for in-progress */}
        {isInProgress && (
          <View style={[styles.progressStripe, { backgroundColor: c.accent }]} accessible={false} aria-hidden={true} />
        )}

        <CardHeader>
          <View style={styles.badgeRow}>
            <View style={[styles.pill, { backgroundColor: diffBg }]}>
              <Text style={[styles.pillText, { color: diffColor }]}>
                {diffStyle.label}
              </Text>
            </View>
            {catLabel && (
              <View style={[styles.pill, { backgroundColor: catBg }]}>
                <Text style={[styles.pillText, { color: catColor }]}>{catLabel}</Text>
              </View>
            )}
            {langLabel && (
              <View style={[styles.pill, { backgroundColor: '#3b82f615' }]}>
                <Text style={[styles.pillText, { color: isDark ? '#93c5fd' : '#1d4ed8' }]}>{langLabel}</Text>
              </View>
            )}
            {isSolved && (
              <View style={[styles.statusBadge, { backgroundColor: c.successBg, marginLeft: 'auto' as any }]} accessibilityLabel="Solved">
                <Text style={[styles.statusText, { color: c.success }]}>{'\u2713'}</Text>
              </View>
            )}
          </View>
          <CardTitle>{challenge.title}</CardTitle>
          <CardDescription numberOfLines={2}>{cleanDescription}</CardDescription>
        </CardHeader>

        <CardContent>
          {challenge.skillTested && (
            <Text style={[styles.skill, { color: c.textMuted }]}>
              <Text style={styles.skillLabel}>Skill: </Text>
              {challenge.skillTested}
            </Text>
          )}
          {hasEfficiencyGoal && (
            <Text style={[styles.meta, { color: c.textSubtle }]}>
              Efficiency goal: {formatCostFromHundredths(challenge.maxCost!)}
            </Text>
          )}
        </CardContent>

        {/* Spacer pushes footer to bottom */}
        <View style={styles.spacer} />

        <View style={styles.footer}>
          {hasSolvers && (
            <Text style={[styles.statsLine, { color: c.textSubtle }]}>
              {challenge.stats!.solvers} solver{challenge.stats!.solvers !== 1 ? 's' : ''}
              {challenge.stats!.avgCost != null && ` \u00b7 avg ${formatCostFromHundredths(challenge.stats!.avgCost)}`}
            </Text>
          )}
          {isSolved && challenge.userBestCost != null && (
            <Text style={[styles.statsLine, { color: c.success }]}>
              Your best: {formatCostFromHundredths(challenge.userBestCost)}
            </Text>
          )}

          {/* CTA link */}
          <Text style={[styles.ctaLink, { color: ctaColor }]}>
            {ctaText} {'\u2192'}
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: { flex: 1, minWidth: 280 },
  pressed: { opacity: 0.92, transform: [{ scale: 0.98 }] },
  card: {
    flex: 1,
    display: 'flex' as any,
    flexDirection: 'column',
    // @ts-ignore web-only transition
    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
  },
  hovered: {
    transform: [{ translateY: -2 }],
    // @ts-ignore web-only shadow
    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
  },
  realWorldCard: { borderLeftWidth: 3, borderLeftColor: '#f59e0b' },
  progressStripe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
  },
  badgeRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs, flexWrap: 'wrap', alignItems: 'center' },
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  pillText: { fontSize: fontSizes.xs, fontWeight: '600', fontFamily: fontFamily.body },
  statusBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: { fontSize: 12, fontWeight: '700' },
  skill: { fontSize: fontSizes.xs, fontStyle: 'italic' },
  skillLabel: { fontStyle: 'normal', fontWeight: '600' },
  meta: { fontSize: fontSizes.xs },
  spacer: { flex: 1 },
  footer: { marginTop: spacing.sm, alignItems: 'flex-start' },
  statsLine: { fontSize: fontSizes.xs, marginBottom: spacing.xs },
  ctaLink: { marginTop: spacing.sm, fontSize: fontSizes.sm, fontWeight: '700', fontFamily: fontFamily.body },
});
