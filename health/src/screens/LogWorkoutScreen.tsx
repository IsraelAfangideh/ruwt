/**
 * Log Workout screen — name workout, add exercises and sets, save.
 */
import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily } from '@/theme/tokens';
import { Button, Input, Card, CardContent } from '@/components/ui';

interface ExerciseItem {
  id: string;
  name: string;
  category: string;
  type: string;
}

interface WorkoutSet {
  exerciseId: string;
  exerciseName: string;
  setNumber: number;
  reps?: number;
  weight?: number;
  durationSeconds?: number;
  distanceMiles?: number;
}

export function LogWorkoutScreen() {
  const c = useColors();
  const navigation = useNavigation<any>();
  const today = new Date().toISOString().slice(0, 10);

  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const [_exercises, _setExercises] = useState<ExerciseItem[]>([]);
  const [searching, _setSearching] = useState(false);
  const [sets, setSets] = useState<WorkoutSet[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!search.trim()) {
      _setExercises([]);
      return;
    }
    const timeout = setTimeout(async () => {
      _setSearching(true);
      try {
        // TODO: Wire up /api/exercises endpoint when available
        _setExercises([]);
      } catch { /* exercise search not yet implemented */ }
      _setSearching(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const addSet = (exercise: ExerciseItem) => {
    const existingSets = sets.filter(s => s.exerciseId === exercise.id);
    setSets(prev => [...prev, {
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      setNumber: existingSets.length + 1,
      reps: exercise.type === 'strength' ? 10 : undefined,
      weight: exercise.type === 'strength' ? 0 : undefined,
      durationSeconds: exercise.type === 'cardio' ? 0 : undefined,
    }]);
    setSearch('');
    _setExercises([]);
  };
  void addSet; // Exercise search not yet wired up

  const updateSet = (index: number, updates: Partial<WorkoutSet>) => {
    setSets(prev => prev.map((s, i) => i === index ? { ...s, ...updates } : s));
  };

  const removeSet = (index: number) => {
    setSets(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/workouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          date: today,
          sets: sets.map(s => ({
            exerciseId: s.exerciseId,
            setNumber: s.setNumber,
            reps: s.reps,
            weight: s.weight,
            durationSeconds: s.durationSeconds,
            distanceMiles: s.distanceMiles,
          })),
        }),
      });
      if (res.ok) navigation.goBack();
    } catch {}
    setSaving(false);
  };

  return (
    <ScrollView style={[styles.scroll, { backgroundColor: c.bg }]} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={[styles.backText, { color: c.accent }]}>← Back</Text>
        </Pressable>
        <Text style={[styles.title, { color: c.text }]}>💪 Log Workout</Text>
        <Text style={[styles.dateText, { color: c.textMuted }]}>{today}</Text>
      </View>

      <Input
        label="Workout Name"
        value={name}
        onChangeText={setName}
        placeholder="e.g. Upper Body, Leg Day, Morning Run..."
      />

      {/* Exercise Search */}
      <View style={styles.searchSection}>
        <Input
          label="Add Exercise"
          value={search}
          onChangeText={setSearch}
          placeholder="Search exercises..."
        />
        {searching && <ActivityIndicator size="small" color={c.accent} />}
      </View>

      {/* Sets */}
      {sets.length > 0 && (
        <Card>
          <CardContent>
            <Text style={[styles.setsTitle, { color: c.text }]}>
              Exercises ({sets.length} set{sets.length !== 1 ? 's' : ''})
            </Text>
            {sets.map((s, i) => (
              <View key={i} style={[styles.setRow, { borderColor: c.border }]}>
                <View style={styles.setInfo}>
                  <Text style={[styles.setName, { color: c.text }]}>{s.exerciseName}</Text>
                  <Text style={[styles.setNum, { color: c.textMuted }]}>Set {s.setNumber}</Text>
                </View>
                <View style={styles.setInputs}>
                  {s.reps !== undefined && (
                    <Input
                      value={String(s.reps || '')}
                      onChangeText={v => updateSet(i, { reps: parseInt(v) || 0 })}
                      placeholder="Reps"
                      keyboardType="numeric"
                      containerStyle={styles.smallInput}
                    />
                  )}
                  {s.weight !== undefined && (
                    <Input
                      value={String(s.weight || '')}
                      onChangeText={v => updateSet(i, { weight: parseFloat(v) || 0 })}
                      placeholder="Weight"
                      keyboardType="numeric"
                      containerStyle={styles.smallInput}
                    />
                  )}
                  {s.durationSeconds !== undefined && (
                    <Input
                      value={String(s.durationSeconds || '')}
                      onChangeText={v => updateSet(i, { durationSeconds: parseInt(v) || 0 })}
                      placeholder="Seconds"
                      keyboardType="numeric"
                      containerStyle={styles.smallInput}
                    />
                  )}
                </View>
                <Pressable onPress={() => removeSet(i)}>
                  <Text style={[styles.removeBtn, { color: c.error }]}>✕</Text>
                </Pressable>
              </View>
            ))}
          </CardContent>
        </Card>
      )}

      <Button
        onPress={handleSave}
        disabled={saving || !name.trim()}
        fullWidth
        size="lg"
      >
        {saving ? 'Saving...' : 'Save Workout'}
      </Button>

      <View style={styles.bottomPad} />
    </ScrollView>
  );
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
  header: { gap: spacing.xs, paddingTop: spacing.md },
  backText: { fontSize: fontSizes.sm, fontFamily: fontFamily.body },
  title: {
    fontSize: fontSizes['2xl'],
    fontWeight: '700',
    fontFamily: fontFamily.display,
  },
  dateText: { fontSize: fontSizes.sm, fontFamily: fontFamily.body },
  searchSection: { gap: spacing.sm },
  setsTitle: { fontSize: fontSizes.md, fontWeight: '700', fontFamily: fontFamily.body },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },
  setInfo: { flex: 1, gap: 2 },
  setName: { fontSize: fontSizes.sm, fontWeight: '600', fontFamily: fontFamily.body },
  setNum: { fontSize: fontSizes.xs, fontFamily: fontFamily.body },
  setInputs: { flexDirection: 'row', gap: spacing.sm },
  smallInput: { width: 70 },
  removeBtn: { fontSize: fontSizes.md, paddingLeft: spacing.sm },
  bottomPad: { height: spacing['2xl'] },
});
