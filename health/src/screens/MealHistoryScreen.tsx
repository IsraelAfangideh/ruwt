/**
 * Meal History — timeline of past meals with "copy to today" action.
 */
import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily } from '@/theme/tokens';
import { Card, CardContent, Button } from '@/components/ui';
import { MEAL_TYPE_LABELS, MEAL_TYPE_ICONS, type MealType } from '@/lib/nutrition';

interface MealHistoryItem {
  id: string;
  date: string;
  mealType: string;
  items: { foodName: string; quantity: number; calories: number; foodId: string }[];
  totals: { calories: number; protein: number; carbs: number; fat: number };
}

export function MealHistoryScreen() {
  const c = useColors();
  const navigation = useNavigation<any>();
  const [history, setHistory] = useState<Record<string, MealHistoryItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [copying, setCopying] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/meal-history?days=14')
      .then(r => r.ok ? r.json() : {})
      .then(setHistory)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleCopyToToday = async (meal: MealHistoryItem) => {
    setCopying(meal.id);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const res = await fetch('/api/meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: today,
          mealType: meal.mealType,
          items: meal.items.map(item => ({
            foodId: item.foodId,
            quantity: item.quantity,
          })),
        }),
      });
      if (res.ok) {
        navigation.navigate('Dashboard');
      }
    } catch {}
    setCopying(null);
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  const dates = Object.keys(history).sort().reverse();

  return (
    <ScrollView style={[styles.scroll, { backgroundColor: c.bg }]} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={[styles.backText, { color: c.accent }]}>&#x2190; Back</Text>
        </Pressable>
        <Text style={[styles.title, { color: c.text }]}>Meal History</Text>
      </View>

      {dates.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: c.textMuted }]}>No meals logged yet</Text>
        </View>
      ) : (
        dates.map(date => (
          <View key={date} style={styles.dateGroup}>
            <Text style={[styles.dateLabel, { color: c.textMuted }]}>
              {formatDate(date)}
            </Text>
            {history[date].map(meal => (
              <Card key={meal.id}>
                <CardContent>
                  <View style={styles.mealHeader}>
                    <Text style={[styles.mealType, { color: c.text }]}>
                      {MEAL_TYPE_ICONS[meal.mealType as MealType] || ''} {MEAL_TYPE_LABELS[meal.mealType as MealType] || meal.mealType}
                    </Text>
                    <Text style={[styles.mealCal, { color: c.accent }]}>
                      {Math.round(meal.totals.calories)} cal
                    </Text>
                  </View>
                  {meal.items.map((item, i) => (
                    <Text key={i} style={[styles.itemText, { color: c.textMuted }]}>
                      {item.foodName} x{item.quantity}
                    </Text>
                  ))}
                  <View style={styles.macroRow}>
                    <Text style={[styles.macroText, { color: c.textSubtle }]}>
                      {Math.round(meal.totals.protein)}p &middot; {Math.round(meal.totals.carbs)}c &middot; {Math.round(meal.totals.fat)}f
                    </Text>
                  </View>
                  <Button
                    variant="outline"
                    size="sm"
                    onPress={() => handleCopyToToday(meal)}
                    disabled={copying === meal.id}
                  >
                    {copying === meal.id ? 'Copying...' : 'Copy to today'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </View>
        ))
      )}

      <View style={styles.bottomPad} />
    </ScrollView>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (dateStr === today.toISOString().slice(0, 10)) return 'Today';
  if (dateStr === yesterday.toISOString().slice(0, 10)) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
    padding: spacing.md,
    gap: spacing.lg,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { gap: spacing.xs, paddingTop: spacing.md },
  backText: { fontSize: fontSizes.sm, fontFamily: fontFamily.body },
  title: {
    fontSize: fontSizes['2xl'],
    fontWeight: '700',
    fontFamily: fontFamily.display,
  },
  dateGroup: { gap: spacing.sm },
  dateLabel: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
    fontFamily: fontFamily.body,
    textTransform: 'uppercase',
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  mealType: {
    fontSize: fontSizes.md,
    fontWeight: '700',
    fontFamily: fontFamily.body,
  },
  mealCal: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
    fontFamily: fontFamily.body,
  },
  itemText: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamily.body,
    paddingLeft: spacing.sm,
  },
  macroRow: { marginTop: spacing.xs, marginBottom: spacing.sm },
  macroText: { fontSize: fontSizes.xs, fontFamily: fontFamily.body },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['2xl'],
  },
  emptyText: { fontSize: fontSizes.md, fontFamily: fontFamily.body },
  bottomPad: { height: spacing['2xl'] },
});
