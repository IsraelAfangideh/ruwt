import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useColors } from '@/theme';
import { spacing, fontSizes } from '@/theme/tokens';

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
}

function categoryLabel(cat: string | null | undefined) {
  if (cat === 'model_selection') return 'Model Selection';
  if (cat === 'prompt_efficiency') return 'Prompt Efficiency';
  if (cat === 'iterative_debugging') return 'Debugging';
  return null;
}

export function ChallengeCard({ challenge }: { challenge: Challenge }) {
  const navigation = useNavigation();
  const c = useColors();

  const diffColor = challenge.difficulty === 'easy' ? c.success : challenge.difficulty === 'medium' ? c.accent : c.destructive;
  const catLabel = categoryLabel(challenge.category);
  const catColor = challenge.category === 'model_selection' ? c.accent
    : challenge.category === 'prompt_efficiency' ? c.success
    : challenge.category === 'iterative_debugging' ? c.destructive
    : c.textMuted;

  return (
    <Card style={[styles.card, { borderColor: c.border }]}>
      <CardHeader>
        <View style={styles.badgeRow}>
          <Badge variant="outline" style={{ borderColor: diffColor }}>
            <Text style={[styles.diffText, { color: diffColor }]}>{challenge.difficulty}</Text>
          </Badge>
          {catLabel && (
            <Badge variant="outline" style={{ borderColor: catColor }}>
              <Text style={[styles.diffText, { color: catColor }]}>{catLabel}</Text>
            </Badge>
          )}
        </View>
        <CardTitle>{challenge.title}</CardTitle>
        <CardDescription numberOfLines={2}>{challenge.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {challenge.skillTested && (
          <Text style={[styles.skill, { color: c.textMuted }]}>{challenge.skillTested}</Text>
        )}
        <Text style={[styles.meta, { color: c.textMuted }]}>
          Efficiency goal: ${challenge.maxCost != null ? (challenge.maxCost / 10000).toFixed(4) : 'N/A'}
        </Text>
      </CardContent>
      <CardFooter style={styles.footer}>
        <Button
          variant="secondary"
          size="sm"
          onPress={() => navigation.navigate('Arena', { challengeId: challenge.id })}
          fullWidth
        >
          Start Problem →
        </Button>
      </CardFooter>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, minWidth: 280 },
  badgeRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.xs },
  diffText: { fontSize: fontSizes.xs, fontWeight: '600', textTransform: 'capitalize' },
  skill: { fontSize: fontSizes.xs, fontStyle: 'italic', marginBottom: spacing.xs },
  meta: { fontSize: fontSizes.xs },
  footer: { borderTopWidth: 1, paddingTop: spacing.sm, marginTop: spacing.sm },
});
