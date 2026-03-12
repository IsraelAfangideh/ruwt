/**
 * Main dashboard — today's calorie ring, macro bars, AI quick-log, meal list, workout summary.
 */
import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily, radii } from '@/theme/tokens';
import { useAuth } from '@/lib/AuthContext';
import { NutritionRing } from '@/components/NutritionRing';
import { MacroBar } from '@/components/MacroBar';
import { MealCard, EmptyMealCard } from '@/components/MealCard';
import { WorkoutCard } from '@/components/WorkoutCard';
import { Card, CardContent, Button } from '@/components/ui';
import type { MealType } from '@/lib/nutrition';

interface DashboardData {
  date: string;
  goals: { calorieTarget: number; proteinTarget: number; carbsTarget: number; fatTarget: number; waterTarget: number };
  nutrition: { calories: number; protein: number; carbs: number; fat: number };
  meals: { id: string; mealType: string; calories: number; itemCount: number }[];
  workouts: { id: string; name: string; durationMinutes?: number }[];
  latestWeight: { weight: number; weightUnit: string; date: string } | null;
  waterCups: number;
}

interface StreakData {
  currentStreak: number;
  longestStreak: number;
}

export function DashboardScreen() {
  const c = useColors();
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState<StreakData | null>(null);

  // Quick-log state
  const [quickLogText, setQuickLogText] = useState('');
  const [quickLogParsing, setQuickLogParsing] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard');
      if (res.ok) {
        setData(await res.json());
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDashboard();
    // Fetch streak
    fetch('/api/streak')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setStreak(d); })
      .catch(() => {});
  }, [fetchDashboard]);

  // Quick-log: parse + auto-log
  const handleQuickLog = async () => {
    if (!quickLogText.trim() || quickLogParsing) return;
    setQuickLogParsing(true);
    try {
      const parseRes = await fetch('/api/ai/parse-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: quickLogText.trim() }),
      });
      const parseData = await parseRes.json();
      if (!parseRes.ok || !parseData.items?.length) throw new Error('Parse failed');

      const today = new Date().toISOString().slice(0, 10);
      const logRes = await fetch('/api/ai/log-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: today,
          mealType: parseData.suggestedMealType || 'snack',
          items: parseData.items.map((item: any) => ({
            foodId: item.matchedFoodId || undefined,
            name: item.name,
            quantity: item.quantity,
            servingSize: item.servingSize || 1,
            servingUnit: item.servingUnit || item.unit,
            calories: item.estimatedCalories,
            protein: item.estimatedProtein,
            carbs: item.estimatedCarbs,
            fat: item.estimatedFat,
          })),
        }),
      });
      if (logRes.ok) {
        setQuickLogText('');
        fetchDashboard();
      }
    } catch {}
    setQuickLogParsing(false);
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <Text style={[styles.errorText, { color: c.error }]}>Failed to load dashboard</Text>
        <Button onPress={fetchDashboard}>Retry</Button>
      </View>
    );
  }

  const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
  const mealsByType = new Map(data.meals.map(m => [m.mealType, m]));

  const handleAddWater = async () => {
    const newCups = (data.waterCups || 0) + 1;
    setData(prev => prev ? { ...prev, waterCups: newCups } : prev);
    await fetch('/api/daily-log', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ waterCups: newCups }),
    });
  };

  return (
    <ScrollView style={[styles.scroll, { backgroundColor: c.bg }]} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <View style={styles.greetingRow}>
            <Text style={[styles.greeting, { color: c.text }]}>
              {getGreeting()}, {user?.user_metadata?.name?.split(' ')[0] || 'there'}
            </Text>
            {streak && streak.currentStreak > 0 && (
              <View style={styles.streakBadge}>
                <Text style={styles.streakIcon}>&#x1F525;</Text>
                <Text style={[styles.streakText, { color: c.accent }]}>{streak.currentStreak}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.date, { color: c.textMuted }]}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </Text>
        </View>
        <Pressable onPress={() => navigation.navigate('Profile')} accessibilityLabel="Profile">
          <View style={[styles.avatar, { backgroundColor: c.accent }]}>
            <Text style={styles.avatarText}>{(user?.email || '?')[0].toUpperCase()}</Text>
          </View>
        </Pressable>
      </View>

      {/* AI Quick Log */}
      <Card>
        <CardContent>
          <Text style={[styles.quickLogLabel, { color: c.textMuted }]}>&#x2728; Quick Log</Text>
          <View style={styles.quickLogRow}>
            <TextInput
              style={[styles.quickLogInput, { color: c.text, borderColor: c.border }]}
              placeholder="e.g., 2 eggs and toast"
              placeholderTextColor={c.textMuted}
              value={quickLogText}
              onChangeText={setQuickLogText}
              onSubmitEditing={handleQuickLog}
            />
            <Pressable
              onPress={handleQuickLog}
              disabled={!quickLogText.trim() || quickLogParsing}
              style={[
                styles.quickLogBtn,
                { backgroundColor: c.accent },
                (!quickLogText.trim() || quickLogParsing) && { opacity: 0.5 },
              ]}
            >
              {quickLogParsing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.quickLogBtnText}>Log</Text>
              )}
            </Pressable>
          </View>
        </CardContent>
      </Card>

      {/* Calorie Ring */}
      <Card>
        <CardContent>
          <View style={styles.ringSection}>
            <NutritionRing
              consumed={data.nutrition.calories}
              target={data.goals.calorieTarget}
            />
          </View>
          <View style={styles.macros}>
            <MacroBar label="Protein" current={data.nutrition.protein} target={data.goals.proteinTarget} macro="protein" />
            <MacroBar label="Carbs" current={data.nutrition.carbs} target={data.goals.carbsTarget} macro="carbs" />
            <MacroBar label="Fat" current={data.nutrition.fat} target={data.goals.fatTarget} macro="fat" />
          </View>
        </CardContent>
      </Card>

      {/* AI Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>AI Tools</Text>
        <View style={styles.aiRow}>
          <Pressable
            onPress={() => navigation.navigate('Coach')}
            style={[styles.aiCard, { backgroundColor: c.card, borderColor: c.border }]}
          >
            <Text style={styles.aiCardIcon}>&#x1F4AC;</Text>
            <Text style={[styles.aiCardTitle, { color: c.text }]}>Coach</Text>
            <Text style={[styles.aiCardDesc, { color: c.textMuted }]}>Ask anything</Text>
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('MealHistory')}
            style={[styles.aiCard, { backgroundColor: c.card, borderColor: c.border }]}
          >
            <Text style={styles.aiCardIcon}>&#x1F4C5;</Text>
            <Text style={[styles.aiCardTitle, { color: c.text }]}>History</Text>
            <Text style={[styles.aiCardDesc, { color: c.textMuted }]}>Past meals</Text>
          </Pressable>
        </View>
      </View>

      {/* Meals */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: c.text }]}>Meals</Text>
          <Button variant="link" size="sm" onPress={() => navigation.navigate('LogMeal')}>
            + Add
          </Button>
        </View>
        <View style={styles.mealList}>
          {mealTypes.map(type => {
            const meal = mealsByType.get(type);
            return meal ? (
              <MealCard
                key={type}
                mealType={type}
                calories={meal.calories}
                itemCount={meal.itemCount}
                onPress={() => navigation.navigate('LogMeal', { mealType: type, date: data.date })}
              />
            ) : (
              <EmptyMealCard
                key={type}
                mealType={type}
                onPress={() => navigation.navigate('LogMeal', { mealType: type, date: data.date })}
              />
            );
          })}
        </View>
      </View>

      {/* Workouts */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: c.text }]}>Workouts</Text>
          <Button variant="link" size="sm" onPress={() => navigation.navigate('LogWorkout')}>
            + Add
          </Button>
        </View>
        {data.workouts.length > 0 ? (
          <View style={styles.mealList}>
            {data.workouts.map(w => (
              <WorkoutCard key={w.id} name={w.name} durationMinutes={w.durationMinutes} />
            ))}
          </View>
        ) : (
          <Pressable
            onPress={() => navigation.navigate('LogWorkout')}
            style={[styles.emptyState, { borderColor: c.border }]}
          >
            <Text style={[styles.emptyText, { color: c.textMuted }]}>No workouts logged today</Text>
            <Text style={[styles.emptySubtext, { color: c.accent }]}>Tap to start</Text>
          </Pressable>
        )}
      </View>

      {/* Quick Stats Row */}
      <View style={styles.statsRow}>
        {/* Water */}
        <Pressable
          onPress={handleAddWater}
          style={[styles.statCard, { backgroundColor: c.card, borderColor: c.border }]}
        >
          <Text style={styles.statIcon}>&#x1F4A7;</Text>
          <Text style={[styles.statValue, { color: c.text }]}>{data.waterCups}</Text>
          <Text style={[styles.statLabel, { color: c.textMuted }]}>
            / {data.goals.waterTarget} cups
          </Text>
        </Pressable>

        {/* Weight */}
        <Pressable
          onPress={() => navigation.navigate('Progress')}
          style={[styles.statCard, { backgroundColor: c.card, borderColor: c.border }]}
        >
          <Text style={styles.statIcon}>&#x2696;&#xFE0F;</Text>
          <Text style={[styles.statValue, { color: c.text }]}>
            {data.latestWeight ? `${data.latestWeight.weight}` : '\u2014'}
          </Text>
          <Text style={[styles.statLabel, { color: c.textMuted }]}>
            {data.latestWeight ? data.latestWeight.weightUnit : 'Log weight'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.bottomPad} />
    </ScrollView>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  errorText: { fontSize: fontSizes.md, fontFamily: fontFamily.body },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.md,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  greeting: {
    fontSize: fontSizes['2xl'],
    fontWeight: '700',
    fontFamily: fontFamily.display,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  streakIcon: { fontSize: 18 },
  streakText: {
    fontSize: fontSizes.md,
    fontWeight: '700',
    fontFamily: fontFamily.body,
  },
  date: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamily.body,
    marginTop: 2,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: fontSizes.md,
  },
  quickLogLabel: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    fontFamily: fontFamily.body,
    marginBottom: spacing.sm,
  },
  quickLogRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  quickLogInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSizes.sm,
    fontFamily: fontFamily.body,
  },
  quickLogBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLogBtnText: {
    color: '#fff',
    fontSize: fontSizes.sm,
    fontWeight: '700',
    fontFamily: fontFamily.body,
  },
  aiRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  aiCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  aiCardIcon: { fontSize: 24 },
  aiCardTitle: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
    fontFamily: fontFamily.body,
  },
  aiCardDesc: {
    fontSize: fontSizes.xs,
    fontFamily: fontFamily.body,
  },
  ringSection: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  macros: {
    gap: spacing.md,
  },
  section: { gap: spacing.md },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: fontSizes.lg,
    fontWeight: '700',
    fontFamily: fontFamily.body,
  },
  mealList: { gap: spacing.sm },
  emptyState: {
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    gap: spacing.xs,
  } as any,
  emptyText: { fontSize: fontSizes.sm, fontFamily: fontFamily.body },
  emptySubtext: { fontSize: fontSizes.sm, fontFamily: fontFamily.body, fontWeight: '600' },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  statIcon: { fontSize: 24 },
  statValue: {
    fontSize: fontSizes.xl,
    fontWeight: '700',
    fontFamily: fontFamily.body,
  },
  statLabel: {
    fontSize: fontSizes.xs,
    fontFamily: fontFamily.body,
  },
  bottomPad: { height: spacing['2xl'] },
});
