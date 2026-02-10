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
}

export function ChallengeCard({ challenge }: { challenge: Challenge }) {
  const navigation = useNavigation();
  const c = useColors();

  const diffColor = challenge.difficulty === 'easy' ? c.success : challenge.difficulty === 'medium' ? c.accent : c.destructive;

  return (
    <Card style={[styles.card, { borderColor: c.border }]}>
      <CardHeader>
        <View style={styles.badgeRow}>
          <Badge variant="outline" style={{ borderColor: diffColor }}>
            <Text style={[styles.diffText, { color: diffColor }]}>{challenge.difficulty}</Text>
          </Badge>
        </View>
        <CardTitle>{challenge.title}</CardTitle>
        <CardDescription numberOfLines={2}>{challenge.description}</CardDescription>
      </CardHeader>
      <CardContent>
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
  badgeRow: { flexDirection: 'row', marginBottom: spacing.xs },
  diffText: { fontSize: fontSizes.xs, fontWeight: '600', textTransform: 'capitalize' },
  meta: { fontSize: fontSizes.xs },
  footer: { borderTopWidth: 1, paddingTop: spacing.sm, marginTop: spacing.sm },
});
