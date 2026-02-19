import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily, radii } from '@/theme/tokens';
import { getDifficultyStyle } from '@/lib/difficulty';

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

  const diffStyle = getDifficultyStyle(challenge.difficulty);
  const diffColor = diffStyle.color;
  const diffBg = diffStyle.bg;

  const catLabel = categoryLabel(challenge.category);
  const catColor = challenge.category === 'model_selection' ? c.accent
    : challenge.category === 'prompt_efficiency' ? c.success
    : challenge.category === 'iterative_debugging' ? c.destructive
    : challenge.category === 'multi_model_strategy' ? '#a78bfa'
    : challenge.category === 'real_world' ? '#f59e0b'
    : challenge.category === 'qa_testing' ? '#ec4899'
    : challenge.category === 'frontend' ? '#06b6d4'
    : challenge.category === 'backend_api' ? '#8b5cf6'
    : challenge.category === 'data_engineering' ? '#10b981'
    : challenge.category === 'devops' ? '#f97316'
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

  const isRealWorld = challenge.category === 'real_world';

  // Strip markdown headings (## Task:, ## Bug:, etc.) from description for card preview
  const cleanDescription = challenge.description
    .replace(/^#{1,3}\s+[^\n]*\n?/gm, '')
    .trim();

  return (
    <Pressable
      onPress={() => (navigation.navigate as any)('Arena', { challengeId: challenge.id })}
      style={({ pressed }: { pressed: boolean }) => [styles.pressable, pressed && styles.pressed]}
    >
      <Card style={[styles.card, isRealWorld && styles.realWorldCard]}>
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
                <Text style={[styles.pillText, { color: '#3b82f6' }]}>{langLabel}</Text>
              </View>
            )}
          </View>
          <CardTitle>{challenge.title}</CardTitle>
          <CardDescription numberOfLines={2}>{cleanDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          {challenge.skillTested && (
            <Text style={[styles.skill, { color: c.textMuted }]}>{challenge.skillTested}</Text>
          )}
          <Text style={[styles.meta, { color: c.textSubtle }]}>
            Efficiency goal: ${challenge.maxCost != null ? (challenge.maxCost / 10000).toFixed(4) : 'N/A'}
          </Text>
        </CardContent>
        <View style={styles.footer}>
          {challenge.stats && challenge.stats.solvers > 0 && (
            <Text style={[styles.statsLine, { color: c.textSubtle }]}>
              {challenge.stats.solvers} solver{challenge.stats.solvers !== 1 ? 's' : ''}
              {challenge.stats.avgCost != null && ` · avg ${(challenge.stats.avgCost / 10000) < 0.01 ? `$${(challenge.stats.avgCost / 10000).toFixed(4)}` : `$${(challenge.stats.avgCost / 10000).toFixed(2)}`}`}
            </Text>
          )}
          <Text style={[styles.cta, { color: c.accent }]}>Start Problem  →</Text>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: { flex: 1, minWidth: 280 },
  pressed: { opacity: 0.92, transform: [{ scale: 0.98 }] },
  card: { flex: 1 },
  realWorldCard: { borderLeftWidth: 3, borderLeftColor: '#f59e0b' },
  badgeRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs },
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  pillText: { fontSize: fontSizes.xs, fontWeight: '600', fontFamily: fontFamily.body },
  skill: { fontSize: fontSizes.xs, fontStyle: 'italic' },
  meta: { fontSize: fontSizes.xs },
  statsLine: { fontSize: fontSizes.xs, marginBottom: spacing.xs },
  footer: { marginTop: spacing.xs, alignItems: 'flex-start' },
  cta: { fontSize: fontSizes.sm, fontWeight: '600', fontFamily: fontFamily.body },
});
