import { useEffect, useState, useCallback } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Pressable } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { createClient } from '@/lib/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily } from '@/theme/tokens';
import { ASSESSMENT_TEMPLATES, type AssessmentTemplate } from '@/lib/assessment-templates';
import { getDifficultyStyle } from '@/lib/difficulty';

interface Challenge {
  id: string;
  title: string;
  difficulty: string;
  category: string | null;
  skillTested: string | null;
}

export function AssessmentBuilderScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const params = (route.params || {}) as { assessmentId?: string };
  const c = useColors();
  const supabase = createClient();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [timeLimitMinutes, setTimeLimitMinutes] = useState('60');
  const [selectedChallengeIds, setSelectedChallengeIds] = useState<string[]>([]);
  const [allChallenges, setAllChallenges] = useState<Challenge[]>([]);
  const [assessmentId, setAssessmentId] = useState<string | undefined>(params.assessmentId);
  const [status, setStatus] = useState('draft');
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Branding fields
  const [companyName, setCompanyName] = useState('');
  const [companyLogoUrl, setCompanyLogoUrl] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState('');

  // Category weights
  const [weights, setWeights] = useState({
    modelSelection: '20',
    promptEfficiency: '20',
    debugging: '20',
    strategy: '20',
    speed: '20',
  });

  useEffect(() => {
    const init = async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) {
        navigation.reset({ index: 0, routes: [{ name: 'Login' as never }] });
        return;
      }
      setUser(u);

      // Fetch all challenges
      try {
        const res = await fetch('/api/challenges');
        if (res.ok) setAllChallenges(await res.json());
      } catch (_) {}

      // If editing, fetch existing assessment
      if (params.assessmentId) {
        try {
          const res = await fetch(`/api/assessments/${params.assessmentId}`);
          if (res.ok) {
            const data = await res.json();
            setTitle(data.title);
            setDescription(data.description ?? '');
            setTimeLimitMinutes(String(Math.floor(data.timeLimit / 60)));
            setStatus(data.status);
            setSelectedChallengeIds(
              (data.challenges ?? [])
                .sort((a: any, b: any) => a.sortOrder - b.sortOrder)
                .map((ch: any) => ch.id)
            );
            if (data.companyName) setCompanyName(data.companyName);
            if (data.companyLogoUrl) setCompanyLogoUrl(data.companyLogoUrl);
            if (data.welcomeMessage) setWelcomeMessage(data.welcomeMessage);
            if (data.categoryWeights) {
              try {
                const w = JSON.parse(data.categoryWeights);
                setWeights({
                  modelSelection: String(w.modelSelection ?? 20),
                  promptEfficiency: String(w.promptEfficiency ?? 20),
                  debugging: String(w.debugging ?? 20),
                  strategy: String(w.strategy ?? 20),
                  speed: String(w.speed ?? 20),
                });
              } catch {}
            }
          }
        } catch (_) {}
      }
      setLoading(false);
    };
    init();
  }, [navigation, supabase.auth, params.assessmentId]);

  const toggleChallenge = (id: string) => {
    setSelectedChallengeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const applyTemplate = (template: AssessmentTemplate) => {
    setTitle(template.name + ' Assessment');
    setDescription(template.description);
    setTimeLimitMinutes(String(template.timeLimitMinutes));
    // Match challenges by title
    const matchedIds = allChallenges
      .filter((ch) => template.challengeTitles.includes(ch.title))
      .map((ch) => ch.id);
    setSelectedChallengeIds(matchedIds);
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const timeLimit = Math.max(300, parseInt(timeLimitMinutes, 10) * 60 || 3600);
      let currentId = assessmentId;

      const brandingFields: Record<string, unknown> = {};
      if (companyName) brandingFields.companyName = companyName;
      if (companyLogoUrl) brandingFields.companyLogoUrl = companyLogoUrl;
      if (welcomeMessage) brandingFields.welcomeMessage = welcomeMessage;
      const categoryWeights = JSON.stringify({
        modelSelection: parseInt(weights.modelSelection, 10) || 20,
        promptEfficiency: parseInt(weights.promptEfficiency, 10) || 20,
        debugging: parseInt(weights.debugging, 10) || 20,
        strategy: parseInt(weights.strategy, 10) || 20,
        speed: parseInt(weights.speed, 10) || 20,
      });

      if (currentId) {
        await fetch(`/api/assessments/${currentId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, description: description || undefined, timeLimit, ...brandingFields, categoryWeights }),
        });
      } else {
        const res = await fetch('/api/assessments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, description: description || undefined, timeLimit }),
        });
        if (res.ok) {
          const data = await res.json();
          currentId = data.id;
          setAssessmentId(data.id);
        }
      }

      // Save branding + weights on newly created assessments
      if (currentId && !assessmentId && (Object.keys(brandingFields).length > 0 || categoryWeights)) {
        await fetch(`/api/assessments/${currentId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...brandingFields, categoryWeights }),
        });
      }

      if (currentId && selectedChallengeIds.length > 0) {
        await fetch(`/api/assessments/${currentId}/challenges`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ challengeIds: selectedChallengeIds }),
        });
      }
    } catch (_) {}
    setSaving(false);
  }, [assessmentId, title, description, timeLimitMinutes, selectedChallengeIds, companyName, companyLogoUrl, welcomeMessage, weights]);

  const handleActivate = useCallback(async () => {
    if (!assessmentId) return;
    await fetch(`/api/assessments/${assessmentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    });
    setStatus('active');
  }, [assessmentId]);

  const handleGenerateInvite = useCallback(async () => {
    if (!assessmentId) return;
    const res = await fetch(`/api/assessments/${assessmentId}/invites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (res.ok) {
      const data = await res.json();
      setInviteLink(data.url);
    }
  }, [assessmentId]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  if (!user) return null;

  const categoryColor = (cat: string | null) => {
    if (cat === 'model_selection') return c.accent;
    if (cat === 'prompt_efficiency') return c.success;
    if (cat === 'iterative_debugging') return c.destructive;
    if (cat === 'multi_model_strategy') return '#a78bfa';
    return c.textMuted;
  };

  const categoryLabel = (cat: string | null) => {
    if (cat === 'model_selection') return 'Model Selection';
    if (cat === 'prompt_efficiency') return 'Prompt Efficiency';
    if (cat === 'iterative_debugging') return 'Iterative Debugging';
    if (cat === 'multi_model_strategy') return 'Multi-Model';
    return 'Practice';
  };

  return (
    <DashboardLayout user={user}>
      <View style={[styles.section, { borderBottomColor: c.border }]}>
        <Button
          variant="ghost"
          size="sm"
          onPress={() => navigation.navigate('Assessments' as never)}
        >
          ← Back to Assessments
        </Button>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: c.text }]}>
            {params.assessmentId ? 'Edit Assessment' : 'Create Assessment'}
          </Text>
          <View style={styles.actions}>
            <Button onPress={handleSave} disabled={saving || !title}>
              {saving ? 'Saving...' : 'Save Assessment'}
            </Button>
            {assessmentId && status === 'draft' && (
              <Button variant="outline" onPress={handleActivate}>
                Activate
              </Button>
            )}
            {assessmentId && status === 'active' && (
              <Button variant="secondary" onPress={handleGenerateInvite}>
                Generate Invite Link
              </Button>
            )}
          </View>
        </View>
      </View>

      {/* Template selector */}
      {!params.assessmentId && (
        <View style={styles.templateSection}>
          <Text style={[styles.sectionLabel, { color: c.text }]}>Start from a Template</Text>
          <View style={styles.templateGrid}>
            {ASSESSMENT_TEMPLATES.map((t) => (
              <Pressable key={t.id} onPress={() => applyTemplate(t)}>
                <Card style={[styles.templateCard, { borderColor: c.border }]}>
                  <CardHeader>
                    <CardTitle>{t.name}</CardTitle>
                    <CardDescription>{t.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Text style={{ fontSize: fontSizes.xs, color: c.textMuted }}>
                      {t.challengeTitles.length} challenges {'\u00B7'} {t.timeLimitMinutes} min
                    </Text>
                  </CardContent>
                </Card>
              </Pressable>
            ))}
          </View>
          <View style={[styles.divider, { borderBottomColor: c.border }]} />
        </View>
      )}

      <View style={styles.form}>
        <Input
          label="Title"
          placeholder="Senior Frontend Engineer Assessment"
          value={title}
          onChangeText={setTitle}
        />
        <Input
          label="Description (optional)"
          placeholder="Describe what this assessment evaluates"
          value={description}
          onChangeText={setDescription}
        />
        <Input
          label="Time Limit (minutes)"
          placeholder="60"
          value={timeLimitMinutes}
          onChangeText={setTimeLimitMinutes}
          keyboardType="numeric"
        />
      </View>

      {/* Company Branding */}
      <View style={styles.brandingSection}>
        <Text style={[styles.sectionLabel, { color: c.text }]}>Company Branding (optional)</Text>
        <Text style={[styles.sectionHint, { color: c.textMuted }]}>
          Add your company details to create a branded assessment experience for candidates.
        </Text>
        <View style={styles.form}>
          <Input
            label="Company Name"
            placeholder="Acme Corp"
            value={companyName}
            onChangeText={setCompanyName}
          />
          <Input
            label="Company Logo URL"
            placeholder="https://example.com/logo.png"
            value={companyLogoUrl}
            onChangeText={setCompanyLogoUrl}
          />
          <Input
            label="Welcome Message"
            placeholder="Welcome to our AI engineering assessment..."
            value={welcomeMessage}
            onChangeText={setWelcomeMessage}
          />
        </View>
        <View style={[styles.divider, { borderBottomColor: c.border }]} />
      </View>

      {/* Score Weights */}
      <View style={styles.weightsSection}>
        <Text style={[styles.sectionLabel, { color: c.text }]}>Score Weights</Text>
        <Text style={[styles.sectionHint, { color: c.textMuted }]}>
          Adjust how each dimension is weighted in the AI Profile radar chart. Higher weight = more important.
        </Text>
        <View style={styles.weightsGrid}>
          {([
            { key: 'modelSelection', label: 'Model Selection' },
            { key: 'promptEfficiency', label: 'Prompt Efficiency' },
            { key: 'debugging', label: 'Debugging' },
            { key: 'strategy', label: 'Strategy' },
            { key: 'speed', label: 'Speed' },
          ] as const).map((w) => (
            <View key={w.key} style={styles.weightItem}>
              <Text style={[styles.weightLabel, { color: c.text }]}>{w.label}</Text>
              <View style={{ width: 80 }}>
                <Input
                  placeholder="20"
                  value={weights[w.key]}
                  onChangeText={(v) => setWeights((prev) => ({ ...prev, [w.key]: v }))}
                  keyboardType="numeric"
                />
              </View>
            </View>
          ))}
        </View>
        <View style={[styles.divider, { borderBottomColor: c.border }]} />
      </View>

      <View style={styles.challengeSection}>
        <Text style={[styles.sectionLabel, { color: c.text }]}>
          Select Challenges ({selectedChallengeIds.length} selected)
        </Text>
        <View style={styles.challengeGrid}>
          {allChallenges.map((ch) => {
            const selected = selectedChallengeIds.includes(ch.id);
            return (
              <Pressable key={ch.id} onPress={() => toggleChallenge(ch.id)}>
                <Card
                  style={[
                    styles.challengeCard,
                    { borderColor: selected ? c.accent : c.border },
                    selected && { borderWidth: 2 },
                  ]}
                >
                  <CardHeader>
                    <View style={styles.challengeBadges}>
                      <Badge
                        variant="outline"
                        style={{
                          borderColor: getDifficultyStyle(ch.difficulty).color,
                          backgroundColor: getDifficultyStyle(ch.difficulty).bg,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: fontSizes.xs,
                            color: getDifficultyStyle(ch.difficulty).color,
                          }}
                        >
                          {getDifficultyStyle(ch.difficulty).label}
                        </Text>
                      </Badge>
                      <Badge variant="outline" style={{ borderColor: categoryColor(ch.category) }}>
                        <Text style={{ fontSize: fontSizes.xs, color: categoryColor(ch.category) }}>
                          {categoryLabel(ch.category)}
                        </Text>
                      </Badge>
                    </View>
                    <CardTitle>{ch.title}</CardTitle>
                    {ch.skillTested && (
                      <CardDescription>{ch.skillTested}</CardDescription>
                    )}
                  </CardHeader>
                </Card>
              </Pressable>
            );
          })}
        </View>
      </View>

      {inviteLink && (
        <Card style={[styles.inviteCard, { borderColor: c.accent }]}>
          <CardContent>
            <Text style={[styles.inviteLabel, { color: c.text }]}>Candidate Invite Link:</Text>
            <Text style={[styles.inviteUrl, { color: c.accent }]} selectable>
              {inviteLink}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center', marginBottom: spacing.sm }}>
              <Button
                variant="outline"
                size="sm"
                onPress={async () => {
                  try {
                    await navigator.clipboard.writeText(inviteLink);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  } catch {}
                }}
              >
                {copied ? 'Copied!' : 'Copy to Clipboard'}
              </Button>
            </View>
            <Text style={[styles.inviteHint, { color: c.textMuted }]}>
              Share this link with your candidate. They'll need to create an account to start.
            </Text>
          </CardContent>
        </Card>
      )}
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  section: { marginBottom: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  title: { fontSize: fontSizes['3xl'], fontWeight: '700', fontFamily: fontFamily.body },
  form: { gap: spacing.md, marginBottom: spacing.lg },
  challengeSection: { marginBottom: spacing.lg },
  sectionLabel: { fontSize: fontSizes.lg, fontWeight: '600', marginBottom: spacing.md },
  challengeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  challengeCard: { minWidth: 260, flex: 1 },
  challengeBadges: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  inviteCard: { borderWidth: 2, marginBottom: spacing.lg },
  inviteLabel: { fontWeight: '600', marginBottom: spacing.xs },
  inviteUrl: { fontSize: fontSizes.sm, fontFamily: 'monospace', marginBottom: spacing.sm },
  inviteHint: { fontSize: fontSizes.xs },
  templateSection: { marginBottom: spacing.lg },
  templateGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  templateCard: { minWidth: 220, flex: 1, borderWidth: 1 },
  divider: { borderBottomWidth: 1, marginTop: spacing.lg },
  brandingSection: { marginBottom: spacing.lg },
  sectionHint: { fontSize: fontSizes.sm, marginBottom: spacing.md, fontFamily: fontFamily.body },
  weightsSection: { marginBottom: spacing.lg },
  weightsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  weightItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minWidth: 200 },
  weightLabel: { fontSize: fontSizes.sm, fontWeight: '500', width: 120 },
});
