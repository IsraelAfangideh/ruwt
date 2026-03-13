/**
 * Log Workout screen — name workout, search exercises, track sets with
 * reps/weight/duration/distance, workout duration & notes, AI generate.
 */
import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily, radii } from '@/theme/tokens';
import { Button, Input, Card, CardContent } from '@/components/ui';

interface ExerciseItem {
  id: string;
  name: string;
  category: string;
  type: string;
  muscleGroup?: string;
}

interface SetEntry {
  reps?: number;
  weight?: number;
  durationSeconds?: number;
  distanceMiles?: number;
}

interface ExerciseBlock {
  id: string;
  exercise: ExerciseItem;
  sets: SetEntry[];
  notes: string;
}

/** Convert AI/prefill exercise data into an ExerciseBlock. */
function toExerciseBlock(ex: any): ExerciseBlock {
  return {
    id: crypto.randomUUID(),
    exercise: {
      id: ex.exerciseId || `gen-${crypto.randomUUID()}`,
      name: ex.matchedName || ex.name,
      category: '',
      type: ex.durationSeconds ? 'cardio' : 'strength',
    },
    sets: Array.from({ length: ex.sets || 3 }, () => ({
      reps: ex.reps,
      weight: undefined,
      durationSeconds: ex.durationSeconds,
    })),
    notes: '',
  };
}

export function LogWorkoutScreen() {
  const c = useColors();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const today = new Date().toISOString().slice(0, 10);

  const [name, setName] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [workoutNotes, setWorkoutNotes] = useState('');
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<ExerciseItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [blocks, setBlocks] = useState<ExerciseBlock[]>([]);
  const [saving, setSaving] = useState(false);
  const [weightUnit, setWeightUnit] = useState<'lbs' | 'kg'>('lbs');

  // AI generate state
  const [showGenerate, setShowGenerate] = useState(false);
  const [genType, setGenType] = useState('');
  const [generating, setGenerating] = useState(false);

  // Pre-fill from AI generation (via route params)
  useEffect(() => {
    const prefill = route.params?.prefill;
    if (prefill?.name) setName(prefill.name);
    if (prefill?.exercises) {
      setBlocks(prefill.exercises.map(toExerciseBlock));
    }
  }, [route.params?.prefill]);

  // Debounced exercise search
  useEffect(() => {
    if (!search.trim()) {
      setSearchResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/exercises?q=${encodeURIComponent(search)}&limit=20`);
        if (res.ok) setSearchResults(await res.json());
      } catch {}
      setSearching(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const addExercise = (exercise: ExerciseItem) => {
    const defaultSet: SetEntry = exercise.type === 'cardio'
      ? {}
      : { reps: 10 };
    setBlocks(prev => [...prev, {
      id: crypto.randomUUID(),
      exercise,
      sets: [defaultSet],
      notes: '',
    }]);
    setSearch('');
    setSearchResults([]);
  };

  const removeBlock = (blockIdx: number) => {
    setBlocks(prev => prev.filter((_, i) => i !== blockIdx));
  };

  const addSet = (blockIdx: number) => {
    setBlocks(prev => prev.map((block, i) => {
      if (i !== blockIdx) return block;
      // Copy the last set's values as defaults for the new set
      const lastSet = block.sets[block.sets.length - 1];
      return { ...block, sets: [...block.sets, { ...lastSet }] };
    }));
  };

  const removeSet = (blockIdx: number, setIdx: number) => {
    setBlocks(prev => prev.map((block, i) => {
      if (i !== blockIdx || block.sets.length <= 1) return block;
      return { ...block, sets: block.sets.filter((_, si) => si !== setIdx) };
    }));
  };

  const updateSet = (blockIdx: number, setIdx: number, updates: Partial<SetEntry>) => {
    setBlocks(prev => prev.map((block, i) => {
      if (i !== blockIdx) return block;
      return {
        ...block,
        sets: block.sets.map((s, si) => si === setIdx ? { ...s, ...updates } : s),
      };
    }));
  };

  const updateBlockNotes = (blockIdx: number, notes: string) => {
    setBlocks(prev => prev.map((block, i) => i === blockIdx ? { ...block, notes } : block));
  };

  const handleGenerate = async () => {
    if (!genType.trim()) return;
    setGenerating(true);
    try {
      const res = await fetch('/api/ai/generate-workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: genType.trim() }),
      });
      if (res.ok) {
        const workout = await res.json();
        if (workout.name) setName(workout.name);
        if (workout.exercises) {
          setBlocks(workout.exercises.map(toExerciseBlock));
        }
        if (workout.estimatedDuration) setDurationMinutes(String(workout.estimatedDuration));
        setShowGenerate(false);
      }
    } catch {}
    setGenerating(false);
  };

  const handleSave = async () => {
    if (!name.trim() || blocks.length === 0) return;
    setSaving(true);
    try {
      // Flatten blocks into sets array for the API
      const flatSets = blocks.flatMap((block, _bi) =>
        block.sets.map((s, si) => ({
          exerciseId: block.exercise.id,
          setNumber: si + 1,
          reps: s.reps || null,
          weight: s.weight || null,
          weightUnit,
          durationSeconds: s.durationSeconds || null,
          distanceMiles: s.distanceMiles || null,
        }))
      );

      const res = await fetch('/api/workouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          date: today,
          durationMinutes: durationMinutes ? parseInt(durationMinutes) : null,
          notes: workoutNotes.trim() || null,
          sets: flatSets,
        }),
      });
      if (res.ok) navigation.goBack();
    } catch {}
    setSaving(false);
  };

  const totalSets = blocks.reduce((sum, b) => sum + b.sets.length, 0);

  return (
    <ScrollView style={[styles.scroll, { backgroundColor: c.bg }]} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={[styles.backText, { color: c.accent }]}>&#x2190; Back</Text>
        </Pressable>
        <Text style={[styles.title, { color: c.text }]}>&#x1F4AA; Log Workout</Text>
        <Text style={[styles.dateText, { color: c.textMuted }]}>{today}</Text>
      </View>

      {/* Workout info */}
      <Card>
        <CardContent>
          <Input
            label="Workout Name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Upper Body, Leg Day, Morning Run..."
          />
          <View style={styles.row}>
            <Input
              label="Duration (min)"
              value={durationMinutes}
              onChangeText={setDurationMinutes}
              placeholder="e.g. 60"
              keyboardType="numeric"
              containerStyle={styles.halfInput}
            />
            <View style={[styles.halfInput, { gap: spacing.xs }]}>
              <Text style={[styles.fieldLabel, { color: c.text }]}>Weight Unit</Text>
              <View style={styles.unitRow}>
                {(['lbs', 'kg'] as const).map(u => (
                  <Pressable
                    key={u}
                    onPress={() => setWeightUnit(u)}
                    style={[
                      styles.unitBtn,
                      { borderColor: c.border },
                      weightUnit === u && { borderColor: c.accent, backgroundColor: c.accentBg },
                    ]}
                  >
                    <Text style={[styles.unitBtnText, { color: weightUnit === u ? c.accent : c.textMuted }]}>
                      {u}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
          <Input
            label="Notes (optional)"
            value={workoutNotes}
            onChangeText={setWorkoutNotes}
            placeholder="How did it go? Energy level, PRs, etc."
            multiline
          />
        </CardContent>
      </Card>

      {/* AI Generate */}
      {!showGenerate ? (
        <Pressable onPress={() => setShowGenerate(true)}>
          <Text style={[styles.generateLink, { color: c.accent }]}>
            &#x2728; Generate workout with AI
          </Text>
        </Pressable>
      ) : (
        <Card>
          <CardContent>
            <Text style={[styles.genTitle, { color: c.text }]}>&#x2728; AI Workout Generator</Text>
            <Input
              label="Workout type"
              value={genType}
              onChangeText={setGenType}
              placeholder="e.g. push day, leg day, full body, cardio..."
            />
            <View style={styles.genButtons}>
              <Button onPress={handleGenerate} disabled={generating || !genType.trim()} size="sm">
                {generating ? 'Generating...' : 'Generate'}
              </Button>
              <Button variant="ghost" onPress={() => setShowGenerate(false)} size="sm">
                Cancel
              </Button>
            </View>
          </CardContent>
        </Card>
      )}

      {/* Exercise Search */}
      <View style={styles.searchSection}>
        <Input
          label="Add Exercise"
          value={search}
          onChangeText={setSearch}
          placeholder="Search exercises..."
        />
        {searching && <ActivityIndicator size="small" color={c.accent} />}
        {searchResults.length > 0 && (
          <View style={[styles.resultsList, { backgroundColor: c.card, borderColor: c.border }]}>
            {searchResults.map(ex => (
              <Pressable
                key={ex.id}
                onPress={() => addExercise(ex)}
                style={({ pressed }: { pressed: boolean }) => [
                  styles.resultItem,
                  { borderColor: c.border },
                  pressed && { backgroundColor: c.bgWarm },
                ]}
              >
                <View style={styles.resultRow}>
                  <Text style={[styles.resultName, { color: c.text }]}>{ex.name}</Text>
                  <Text style={[styles.resultBadge, { color: c.accent, backgroundColor: c.accentBg }]}>
                    {ex.type}
                  </Text>
                </View>
                <Text style={[styles.resultCategory, { color: c.textMuted }]}>
                  {ex.category}{ex.muscleGroup ? ` \u00B7 ${ex.muscleGroup}` : ''}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* Exercise Blocks */}
      {blocks.map((block, bi) => {
        const isCardio = block.exercise.type === 'cardio';
        const isFlexibility = block.exercise.type === 'flexibility';

        return (
          <Card key={block.id}>
            <CardContent>
              {/* Exercise header */}
              <View style={styles.blockHeader}>
                <View style={styles.blockNameWrap}>
                  <Text style={[styles.blockName, { color: c.text }]}>{block.exercise.name}</Text>
                  <Text style={[styles.blockMeta, { color: c.textMuted }]}>
                    {block.exercise.category}{block.exercise.muscleGroup ? ` \u00B7 ${block.exercise.muscleGroup}` : ''}
                  </Text>
                </View>
                <Pressable onPress={() => removeBlock(bi)} hitSlop={8}>
                  <Text style={[styles.removeBlockBtn, { color: c.error }]}>&#x2715;</Text>
                </Pressable>
              </View>

              {/* Column headers */}
              <View style={[styles.setHeaderRow, { borderColor: c.border }]}>
                <Text style={[styles.setHeaderText, styles.setCol, { color: c.textMuted }]}>SET</Text>
                {!isCardio && !isFlexibility && (
                  <>
                    <Text style={[styles.setHeaderText, styles.inputCol, { color: c.textMuted }]}>REPS</Text>
                    <Text style={[styles.setHeaderText, styles.inputCol, { color: c.textMuted }]}>{weightUnit.toUpperCase()}</Text>
                  </>
                )}
                {(isCardio || isFlexibility) && (
                  <>
                    <Text style={[styles.setHeaderText, styles.inputCol, { color: c.textMuted }]}>TIME (s)</Text>
                    {isCardio && (
                      <Text style={[styles.setHeaderText, styles.inputCol, { color: c.textMuted }]}>MILES</Text>
                    )}
                  </>
                )}
                <Text style={[styles.setHeaderText, styles.removeCol, { color: c.textMuted }]}></Text>
              </View>

              {/* Set rows */}
              {block.sets.map((set, si) => (
                <View key={si} style={[styles.setInputRow, { borderColor: c.border }]}>
                  <Text style={[styles.setNumber, styles.setCol, { color: c.textMuted }]}>{si + 1}</Text>
                  {!isCardio && !isFlexibility && (
                    <>
                      <Input
                        value={set.reps != null ? String(set.reps) : ''}
                        onChangeText={v => updateSet(bi, si, { reps: parseInt(v) || undefined })}
                        placeholder="—"
                        keyboardType="numeric"
                        containerStyle={styles.inputCol}
                      />
                      <Input
                        value={set.weight != null ? String(set.weight) : ''}
                        onChangeText={v => updateSet(bi, si, { weight: parseFloat(v) || undefined })}
                        placeholder="—"
                        keyboardType="numeric"
                        containerStyle={styles.inputCol}
                      />
                    </>
                  )}
                  {(isCardio || isFlexibility) && (
                    <>
                      <Input
                        value={set.durationSeconds != null ? String(set.durationSeconds) : ''}
                        onChangeText={v => updateSet(bi, si, { durationSeconds: parseInt(v) || undefined })}
                        placeholder="—"
                        keyboardType="numeric"
                        containerStyle={styles.inputCol}
                      />
                      {isCardio && (
                        <Input
                          value={set.distanceMiles != null ? String(set.distanceMiles) : ''}
                          onChangeText={v => updateSet(bi, si, { distanceMiles: parseFloat(v) || undefined })}
                          placeholder="—"
                          keyboardType="numeric"
                          containerStyle={styles.inputCol}
                        />
                      )}
                    </>
                  )}
                  <Pressable onPress={() => removeSet(bi, si)} style={styles.removeCol} hitSlop={8}>
                    <Text style={[styles.removeSetText, { color: block.sets.length > 1 ? c.error : c.border }]}>&#x2715;</Text>
                  </Pressable>
                </View>
              ))}

              {/* Add set + notes */}
              <View style={styles.blockFooter}>
                <Pressable onPress={() => addSet(bi)} style={[styles.addSetBtn, { borderColor: c.border }]}>
                  <Text style={[styles.addSetText, { color: c.accent }]}>+ Add Set</Text>
                </Pressable>
                <Input
                  value={block.notes}
                  onChangeText={v => updateBlockNotes(bi, v)}
                  placeholder="Exercise notes..."
                  containerStyle={styles.blockNotesInput}
                />
              </View>
            </CardContent>
          </Card>
        );
      })}

      {/* Summary + Save */}
      {blocks.length > 0 && (
        <View style={[styles.summaryRow, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.summaryText, { color: c.text }]}>
            {blocks.length} exercise{blocks.length !== 1 ? 's' : ''} &middot; {totalSets} set{totalSets !== 1 ? 's' : ''}
          </Text>
        </View>
      )}

      <Button
        onPress={handleSave}
        disabled={saving || !name.trim() || blocks.length === 0}
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
  row: { flexDirection: 'row', gap: spacing.md },
  halfInput: { flex: 1 },
  fieldLabel: { fontSize: fontSizes.sm, fontWeight: '600', fontFamily: fontFamily.body },
  unitRow: { flexDirection: 'row', gap: spacing.sm },
  unitBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  unitBtnText: { fontSize: fontSizes.sm, fontWeight: '600', fontFamily: fontFamily.body },
  generateLink: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    fontFamily: fontFamily.body,
    textAlign: 'center',
  },
  genTitle: {
    fontSize: fontSizes.md,
    fontWeight: '700',
    fontFamily: fontFamily.body,
    marginBottom: spacing.sm,
  },
  genButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  searchSection: { gap: spacing.sm },
  resultsList: {
    borderWidth: 1,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  resultItem: {
    padding: spacing.md,
    borderBottomWidth: 1,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultName: { fontSize: fontSizes.sm, fontWeight: '600', fontFamily: fontFamily.body },
  resultBadge: {
    fontSize: fontSizes.xs,
    fontWeight: '600',
    fontFamily: fontFamily.body,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
    overflow: 'hidden',
  },
  resultCategory: { fontSize: fontSizes.xs, fontFamily: fontFamily.body, marginTop: 2 },

  // Exercise block
  blockHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  blockNameWrap: { flex: 1 },
  blockName: { fontSize: fontSizes.md, fontWeight: '700', fontFamily: fontFamily.body },
  blockMeta: { fontSize: fontSizes.xs, fontFamily: fontFamily.body },
  removeBlockBtn: { fontSize: fontSizes.lg, padding: spacing.xs },

  // Set table
  setHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingBottom: spacing.xs,
    marginBottom: spacing.xs,
  },
  setHeaderText: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    fontFamily: fontFamily.body,
    textAlign: 'center',
  },
  setCol: { width: 36, textAlign: 'center' },
  inputCol: { flex: 1 },
  removeCol: { width: 28, alignItems: 'center' },
  setInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: 2,
  },
  setNumber: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
    fontFamily: fontFamily.body,
  },

  // Block footer
  blockFooter: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  addSetBtn: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: radii.full,
    borderStyle: 'dashed',
  },
  addSetText: { fontSize: fontSizes.xs, fontWeight: '600', fontFamily: fontFamily.body },
  removeSetText: { fontSize: fontSizes.sm },
  blockNotesInput: { flex: 1 },

  // Summary
  summaryRow: {
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    alignItems: 'center',
  },
  summaryText: { fontSize: fontSizes.sm, fontWeight: '600', fontFamily: fontFamily.body },

  bottomPad: { height: spacing['2xl'] },
});
