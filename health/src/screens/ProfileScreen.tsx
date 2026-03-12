/**
 * Profile/Settings screen — goals, TDEE info, units, theme, sign out.
 */
import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useColors, useTheme } from '@/theme';
import { spacing, fontSizes, fontFamily, radii } from '@/theme/tokens';
import { Button, Input, Card, CardContent, CardTitle } from '@/components/ui';
import { useAuth } from '@/lib/AuthContext';
import { createClient } from '@/lib/supabase/client';

export function ProfileScreen() {
  const c = useColors();
  const { mode, setMode } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<any>();

  const [goals, setGoals] = useState({
    calorieTarget: '2000',
    proteinTarget: '150',
    carbsTarget: '200',
    fatTarget: '67',
    waterTarget: '8',
    weightGoal: '',
    activityLevel: 'moderate',
  });
  const [profile, setProfile] = useState({
    heightInches: '',
    birthYear: '',
    sex: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tdee, setTdee] = useState<any>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/goals').then(r => r.ok ? r.json() : null),
      fetch('/api/profile').then(r => r.ok ? r.json() : null),
      fetch('/api/ai/tdee').then(r => r.ok ? r.json() : null),
    ]).then(([goalsData, profileData, tdeeData]) => {
      if (goalsData) {
        setGoals({
          calorieTarget: String(goalsData.calorieTarget || 2000),
          proteinTarget: String(goalsData.proteinTarget || 150),
          carbsTarget: String(goalsData.carbsTarget || 200),
          fatTarget: String(goalsData.fatTarget || 67),
          waterTarget: String(goalsData.waterTarget || 8),
          weightGoal: goalsData.weightGoal ? String(goalsData.weightGoal) : '',
          activityLevel: goalsData.activityLevel || 'moderate',
        });
      }
      if (profileData) {
        setProfile({
          heightInches: profileData.heightInches ? String(profileData.heightInches) : '',
          birthYear: profileData.birthYear ? String(profileData.birthYear) : '',
          sex: profileData.sex || '',
        });
      }
      if (tdeeData && !tdeeData.error) setTdee(tdeeData);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleSaveGoals = async () => {
    setSaving(true);
    try {
      await fetch('/api/goals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calorieTarget: parseInt(goals.calorieTarget) || 2000,
          proteinTarget: parseInt(goals.proteinTarget) || 150,
          carbsTarget: parseInt(goals.carbsTarget) || 200,
          fatTarget: parseInt(goals.fatTarget) || 67,
          waterTarget: parseInt(goals.waterTarget) || 8,
          weightGoal: goals.weightGoal ? parseFloat(goals.weightGoal) : null,
          activityLevel: goals.activityLevel,
        }),
      });
      // Save profile fields
      await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          heightInches: profile.heightInches ? parseFloat(profile.heightInches) : null,
          birthYear: profile.birthYear ? parseInt(profile.birthYear) : null,
          sex: profile.sex || null,
        }),
      });
    } catch {}
    setSaving(false);
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  const activityLevels = ['sedentary', 'light', 'moderate', 'active', 'very_active'];

  return (
    <ScrollView style={[styles.scroll, { backgroundColor: c.bg }]} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={[styles.backText, { color: c.accent }]}>&#x2190; Back</Text>
        </Pressable>
        <Text style={[styles.title, { color: c.text }]}>Settings</Text>
      </View>

      {/* Account Info */}
      <Card>
        <CardTitle>Account</CardTitle>
        <CardContent>
          <Text style={[styles.infoText, { color: c.text }]}>
            {user?.email || 'Not signed in'}
          </Text>
          <Text style={[styles.infoSubtext, { color: c.textMuted }]}>
            Shared with ruwt.dev
          </Text>
        </CardContent>
      </Card>

      {/* Body Stats (for TDEE) */}
      <Card>
        <CardTitle>Body Stats</CardTitle>
        <CardContent>
          <Input
            label="Height (inches)"
            value={profile.heightInches}
            onChangeText={v => setProfile(p => ({ ...p, heightInches: v }))}
            keyboardType="numeric"
            placeholder="e.g. 70"
          />
          <Input
            label="Birth Year"
            value={profile.birthYear}
            onChangeText={v => setProfile(p => ({ ...p, birthYear: v }))}
            keyboardType="numeric"
            placeholder="e.g. 1995"
          />
          <View style={styles.sexRow}>
            <Text style={[styles.sexLabel, { color: c.text }]}>Sex</Text>
            <View style={styles.sexBtns}>
              {['male', 'female'].map(s => (
                <Pressable
                  key={s}
                  onPress={() => setProfile(p => ({ ...p, sex: s }))}
                  style={[
                    styles.sexBtn,
                    { borderColor: c.border },
                    profile.sex === s && { borderColor: c.accent, backgroundColor: c.accentBg },
                  ]}
                >
                  <Text style={[styles.sexBtnText, { color: profile.sex === s ? c.accent : c.text }]}>
                    {s === 'male' ? 'Male' : 'Female'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </CardContent>
      </Card>

      {/* TDEE Estimate */}
      {tdee?.estimatedTDEE && (
        <Card>
          <CardTitle>Estimated TDEE</CardTitle>
          <CardContent>
            <Text style={[styles.tdeeValue, { color: c.accent }]}>
              {tdee.estimatedTDEE} cal/day
            </Text>
            <Text style={[styles.tdeeMethod, { color: c.textMuted }]}>
              Method: {tdee.method === 'adaptive' ? 'Adaptive (from your log data)' : 'Mifflin-St Jeor formula'}
              {' \u00B7 '}Confidence: {tdee.confidence}
            </Text>
            {tdee.formula && (
              <Text style={[styles.tdeeDetail, { color: c.textSubtle }]}>
                BMR: {tdee.formula.bmr} cal &times; {tdee.formula.multiplier} activity = {tdee.formula.tdee} cal
              </Text>
            )}
          </CardContent>
        </Card>
      )}

      {/* Nutrition Goals */}
      <Card>
        <CardTitle>Daily Goals</CardTitle>
        <CardContent>
          <Input label="Calorie Target" value={goals.calorieTarget} onChangeText={v => setGoals(g => ({ ...g, calorieTarget: v }))} keyboardType="numeric" />
          <View style={styles.row}>
            <Input label="Protein (g)" value={goals.proteinTarget} onChangeText={v => setGoals(g => ({ ...g, proteinTarget: v }))} keyboardType="numeric" containerStyle={styles.thirdInput} />
            <Input label="Carbs (g)" value={goals.carbsTarget} onChangeText={v => setGoals(g => ({ ...g, carbsTarget: v }))} keyboardType="numeric" containerStyle={styles.thirdInput} />
            <Input label="Fat (g)" value={goals.fatTarget} onChangeText={v => setGoals(g => ({ ...g, fatTarget: v }))} keyboardType="numeric" containerStyle={styles.thirdInput} />
          </View>
          <Input label="Water (cups)" value={goals.waterTarget} onChangeText={v => setGoals(g => ({ ...g, waterTarget: v }))} keyboardType="numeric" />
          <Input label="Target Weight" value={goals.weightGoal} onChangeText={v => setGoals(g => ({ ...g, weightGoal: v }))} keyboardType="numeric" placeholder="Optional" />

          {/* Activity Level */}
          <Text style={[styles.activityLabel, { color: c.text }]}>Activity Level</Text>
          <View style={styles.activityRow}>
            {activityLevels.map(level => (
              <Pressable
                key={level}
                onPress={() => setGoals(g => ({ ...g, activityLevel: level }))}
                style={[
                  styles.activityBtn,
                  { borderColor: c.border },
                  goals.activityLevel === level && { borderColor: c.accent, backgroundColor: c.accentBg },
                ]}
              >
                <Text style={[
                  styles.activityBtnText,
                  { color: goals.activityLevel === level ? c.accent : c.textMuted },
                ]}>
                  {level.replace('_', ' ')}
                </Text>
              </Pressable>
            ))}
          </View>

          <Button onPress={handleSaveGoals} disabled={saving} fullWidth>
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </CardContent>
      </Card>

      {/* Theme */}
      <Card>
        <CardTitle>Appearance</CardTitle>
        <CardContent>
          <View style={styles.themeRow}>
            <Pressable
              onPress={() => setMode('light')}
              style={[
                styles.themeBtn,
                { borderColor: c.border },
                mode === 'light' && { borderColor: c.accent, backgroundColor: c.accentBg },
              ]}
            >
              <Text style={[styles.themeLabel, { color: c.text }]}>Light</Text>
            </Pressable>
            <Pressable
              onPress={() => setMode('dark')}
              style={[
                styles.themeBtn,
                { borderColor: c.border },
                mode === 'dark' && { borderColor: c.accent, backgroundColor: c.accentBg },
              ]}
            >
              <Text style={[styles.themeLabel, { color: c.text }]}>Dark</Text>
            </Pressable>
          </View>
        </CardContent>
      </Card>

      {/* Sign Out */}
      <Button onPress={handleSignOut} variant="destructive" fullWidth>
        Sign Out
      </Button>

      <View style={styles.bottomPad} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    maxWidth: 500,
    alignSelf: 'center',
    width: '100%',
    padding: spacing.md,
    paddingTop: spacing.xl,
    gap: spacing.lg,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { gap: spacing.xs },
  backText: { fontSize: fontSizes.sm, fontFamily: fontFamily.body },
  title: {
    fontSize: fontSizes['2xl'],
    fontWeight: '700',
    fontFamily: fontFamily.display,
  },
  infoText: { fontSize: fontSizes.md, fontFamily: fontFamily.body },
  infoSubtext: { fontSize: fontSizes.xs, fontFamily: fontFamily.body },
  sexRow: { gap: spacing.sm },
  sexLabel: { fontSize: fontSizes.sm, fontWeight: '600', fontFamily: fontFamily.body },
  sexBtns: { flexDirection: 'row', gap: spacing.md },
  sexBtn: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  sexBtnText: { fontSize: fontSizes.sm, fontWeight: '600', fontFamily: fontFamily.body },
  tdeeValue: {
    fontSize: fontSizes['2xl'],
    fontWeight: '700',
    fontFamily: fontFamily.body,
  },
  tdeeMethod: { fontSize: fontSizes.xs, fontFamily: fontFamily.body },
  tdeeDetail: { fontSize: fontSizes.xs, fontFamily: fontFamily.body, marginTop: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.md },
  thirdInput: { flex: 1 },
  activityLabel: { fontSize: fontSizes.sm, fontWeight: '600', fontFamily: fontFamily.body },
  activityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  activityBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  activityBtnText: {
    fontSize: fontSizes.xs,
    fontWeight: '600',
    fontFamily: fontFamily.body,
    textTransform: 'capitalize',
  },
  themeRow: { flexDirection: 'row', gap: spacing.md },
  themeBtn: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  themeLabel: { fontSize: fontSizes.sm, fontWeight: '600', fontFamily: fontFamily.body },
  bottomPad: { height: spacing['2xl'] },
});
