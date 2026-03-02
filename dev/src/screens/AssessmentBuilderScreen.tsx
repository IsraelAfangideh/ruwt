import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
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
import { DIFFICULTIES, getDifficultyStyle } from '@/lib/difficulty';
import { AssessmentAgentChat } from '@/components/AssessmentAgentChat';
import { PassThresholdEditor } from '@/components/PassThresholdEditor';
import { BulkInvitePanel } from '@/components/BulkInvitePanel';
import { InviteManagementTable } from '@/components/InviteManagementTable';
import { CustomChallengeReview } from '@/components/CustomChallengeReview';
interface PassThreshold {
  enabled: boolean;
  mode: 'all_dimensions' | 'weighted_average';
  minOverall?: number;
  dimensions: Record<string, number>;
}

interface Challenge {
  id: string;
  title: string;
  difficulty: string;
  category: string | null;
  skillTested: string | null;
}

interface CustomChallenge {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  category: string;
  skillTested: string | null;
  language: string;
  starterCode: string | null;
  testCases: string;
  hiddenTestCases: string | null;
  testHarness: string | null;
  status: string;
  aiGenerated: number;
  tags: string | null;
}

const PICKER_CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'real_world', label: 'Real-World' },
  { key: 'model_selection', label: 'Model Selection' },
  { key: 'prompt_efficiency', label: 'Prompt Efficiency' },
  { key: 'iterative_debugging', label: 'Iterative Debugging' },
  { key: 'multi_model_strategy', label: 'Multi-Model' },
  { key: 'qa_testing', label: 'QA Testing' },
  { key: 'frontend', label: 'Frontend' },
  { key: 'backend_api', label: 'Backend API' },
  { key: 'data_engineering', label: 'Data Engineering' },
  { key: 'devops', label: 'DevOps' },
];

export function AssessmentBuilderScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const params = (route.params || {}) as { assessmentId?: string };
  const c = useColors();
  const supabase = createClient();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activateError, setActivateError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [timeLimitMinutes, setTimeLimitMinutes] = useState('60');
  const [selectedChallengeIds, setSelectedChallengeIds] = useState<string[]>([]);
  const [allChallenges, setAllChallenges] = useState<Challenge[]>([]);
  const [assessmentId, setAssessmentId] = useState<string | undefined>(params.assessmentId);
  const assessmentIdRef = useRef(assessmentId);
  assessmentIdRef.current = assessmentId;
  const [status, setStatus] = useState('draft');
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showAgent, setShowAgent] = useState(true);

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

  const weightSum = useMemo(() => {
    const vals = Object.values(weights).map((v) => parseInt(v, 10));
    return vals.every(Number.isFinite) ? vals.reduce((a, b) => a + b, 0) : NaN;
  }, [weights]);

  // Pass threshold
  const [passThreshold, setPassThreshold] = useState<PassThreshold | null>(null);

  // Custom challenges
  const [customChallenges, setCustomChallenges] = useState<CustomChallenge[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);

  // Invite management
  const [inviteRefreshKey, setInviteRefreshKey] = useState(0);

  // Challenge picker filters
  const [challengeSearch, setChallengeSearch] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  useEffect(() => {
    const init = async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) {
        navigation.reset({ index: 0, routes: [{ name: 'Login' as never }] });
        return;
      }
      setUser(u);

      // Fetch challenges + org info in parallel
      const [challengesRes, orgsRes] = await Promise.all([
        fetch('/api/challenges').catch(() => null),
        fetch('/api/orgs').catch(() => null),
      ]);

      if (challengesRes?.ok) setAllChallenges(await challengesRes.json());

      // Get org and its custom challenges
      if (orgsRes?.ok) {
        const orgs = await orgsRes.json();
        if (orgs.length > 0) {
          const oid = orgs[0].orgId;
          setOrgId(oid);
          try {
            const ccRes = await fetch(`/api/orgs/${oid}/challenges`);
            if (ccRes.ok) setCustomChallenges(await ccRes.json());
          } catch {}
        }
      }

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
            if (data.passThreshold) {
              try { setPassThreshold(JSON.parse(data.passThreshold)); } catch {}
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
    const matchedIds = allChallenges
      .filter((ch) => template.challengeTitles.includes(ch.title))
      .map((ch) => ch.id);
    setSelectedChallengeIds(matchedIds);
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const rawMinutes = parseInt(timeLimitMinutes, 10);
      const timeLimit = Math.max(300, Number.isFinite(rawMinutes) ? rawMinutes * 60 : 3600);
      let currentId = assessmentId;

      const brandingFields: Record<string, unknown> = {};
      if (companyName) brandingFields.companyName = companyName;
      if (companyLogoUrl) brandingFields.companyLogoUrl = companyLogoUrl;
      if (welcomeMessage) brandingFields.welcomeMessage = welcomeMessage;
      const parseWeight = (v: string) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : 20; };
      const categoryWeights = JSON.stringify({
        modelSelection: parseWeight(weights.modelSelection),
        promptEfficiency: parseWeight(weights.promptEfficiency),
        debugging: parseWeight(weights.debugging),
        strategy: parseWeight(weights.strategy),
        speed: parseWeight(weights.speed),
      });

      const passThresholdStr = passThreshold ? JSON.stringify(passThreshold) : null;

      if (currentId) {
        await fetch(`/api/assessments/${currentId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            description: description || undefined,
            timeLimit,
            ...brandingFields,
            categoryWeights,
            passThreshold: passThresholdStr,
          }),
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

      // Save branding + weights + threshold on newly created assessments
      if (currentId && !assessmentId && (Object.keys(brandingFields).length > 0 || categoryWeights || passThresholdStr)) {
        await fetch(`/api/assessments/${currentId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...brandingFields, categoryWeights, passThreshold: passThresholdStr }),
        });
      }

      if (currentId && selectedChallengeIds.length > 0) {
        await fetch(`/api/assessments/${currentId}/challenges`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ challengeIds: selectedChallengeIds }),
        });
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (_) {}
    setSaving(false);
  }, [assessmentId, title, description, timeLimitMinutes, selectedChallengeIds, companyName, companyLogoUrl, welcomeMessage, weights, passThreshold]);

  const handleActivate = useCallback(async () => {
    /* v8 ignore next */
    if (!assessmentId) return;
    if (!title.trim()) {
      setActivateError('Enter a title before activating.');
      return;
    }
    if (selectedChallengeIds.length === 0) {
      setActivateError('Select at least one challenge before activating.');
      return;
    }
    setActivateError(null);
    await fetch(`/api/assessments/${assessmentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    });
    setStatus('active');
  }, [assessmentId, title, selectedChallengeIds.length]);

  const [inviteError, setInviteError] = useState<string | null>(null);

  const handleGenerateInvite = useCallback(async () => {
    /* v8 ignore next */
    if (!assessmentId) return;
    setInviteError(null);
    const res = await fetch(`/api/assessments/${assessmentId}/invites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (res.ok) {
      setInviteLink(data.url);
    } else {
      setInviteError(data.error || 'Failed to generate invite link');
    }
  }, [assessmentId]);

  // Agent callbacks
  const handleAgentChallengesChanged = useCallback(async () => {
    const currentId = assessmentIdRef.current;
    if (!currentId) return;
    try {
      const res = await fetch(`/api/assessments/${currentId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedChallengeIds(
          (data.challenges ?? [])
            .sort((a: any, b: any) => a.sortOrder - b.sortOrder)
            .map((ch: any) => ch.id)
        );
      }
    } catch {}
  }, []);

  const handleAgentWeightsChanged = useCallback((newWeights: Record<string, number>) => {
    setWeights({
      modelSelection: String(newWeights.modelSelection ?? 20),
      promptEfficiency: String(newWeights.promptEfficiency ?? 20),
      debugging: String(newWeights.debugging ?? 20),
      strategy: String(newWeights.strategy ?? 20),
      speed: String(newWeights.speed ?? 20),
    });
  }, []);

  const handleAgentBrandingChanged = useCallback((fields: Record<string, string>) => {
    if (fields.title !== undefined) setTitle(fields.title);
    if (fields.description !== undefined) setDescription(fields.description);
    if (fields.companyName !== undefined) setCompanyName(fields.companyName);
    if (fields.companyLogoUrl !== undefined) setCompanyLogoUrl(fields.companyLogoUrl);
    if (fields.welcomeMessage !== undefined) setWelcomeMessage(fields.welcomeMessage);
  }, []);

  const handleAgentTimeLimitChanged = useCallback((minutes: number) => {
    setTimeLimitMinutes(String(minutes));
  }, []);

  const handleAgentThresholdChanged = useCallback((threshold: PassThreshold) => {
    setPassThreshold(threshold);
  }, []);

  const handleCustomChallengeCreated = useCallback(async () => {
    if (!orgId) return;
    try {
      const res = await fetch(`/api/orgs/${orgId}/challenges`);
      if (res.ok) setCustomChallenges(await res.json());
    } catch {}
  }, [orgId]);

  const handleAgentAssessmentCreated = useCallback((newId: string) => {
    setAssessmentId(newId);
  }, []);

  const handleApproveCustomChallenge = useCallback((id: string) => {
    setCustomChallenges((prev) =>
      prev.map((ch) => (ch.id === id ? { ...ch, status: 'active' } : ch))
    );
  }, []);

  const handleDeleteCustomChallenge = useCallback((id: string) => {
    setCustomChallenges((prev) => prev.filter((ch) => ch.id !== id));
  }, []);

  const filteredChallenges = useMemo(() => {
    const q = challengeSearch.toLowerCase();
    return allChallenges.filter((ch) => {
      if (q && !ch.title.toLowerCase().includes(q) && !(ch.skillTested ?? '').toLowerCase().includes(q)) return false;
      if (difficultyFilter !== 'all' && ch.difficulty !== difficultyFilter) return false;
      if (categoryFilter !== 'all' && ch.category !== categoryFilter) return false;
      return true;
    });
  }, [allChallenges, challengeSearch, difficultyFilter, categoryFilter]);

  const filteredCustomChallenges = useMemo(() => {
    const q = challengeSearch.toLowerCase();
    return customChallenges.filter((ch) => {
      if (ch.status !== 'active') return false;
      if (q && !ch.title.toLowerCase().includes(q) && !(ch.skillTested ?? '').toLowerCase().includes(q)) return false;
      if (difficultyFilter !== 'all' && ch.difficulty !== difficultyFilter) return false;
      if (categoryFilter !== 'all' && ch.category !== categoryFilter) return false;
      return true;
    });
  }, [customChallenges, challengeSearch, difficultyFilter, categoryFilter]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  /* v8 ignore next */
  if (!user) return null;

  const categoryColor = (cat: string | null) => {
    if (cat === 'model_selection') return c.accent;
    if (cat === 'prompt_efficiency') return c.success;
    if (cat === 'iterative_debugging') return c.destructive;
    if (cat === 'multi_model_strategy') return '#a78bfa';
    return c.textMuted;
  };

  const categoryLabel = (cat: string | null) => {
    const found = PICKER_CATEGORIES.find((c) => c.key === cat);
    return found ? found.label : 'Practice';
  };

  const draftCustomChallenges = customChallenges.filter((ch) => ch.status === 'draft');

  return (
    <DashboardLayout user={user} requireTeam>
      <View style={[styles.section, { borderBottomColor: c.border }]}>
        <Button
          variant="ghost"
          size="sm"
          onPress={() => navigation.navigate('Assessments' as never)}
        >
          {'\u2190'} Back to Assessments
        </Button>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: c.text }]}>
            {params.assessmentId ? 'Edit Assessment' : 'Create Assessment'}
          </Text>
          <View style={styles.actions}>
            <Button onPress={handleSave} disabled={saving || !title}>
              {saving ? 'Saving...' : saveSuccess ? '\u2713 Saved' : 'Save Assessment'}
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
            <Pressable
              onPress={() => setShowAgent(!showAgent)}
              style={[
                styles.agentToggle,
                {
                  backgroundColor: showAgent ? c.accent + '20' : 'transparent',
                  borderColor: showAgent ? c.accent : c.border,
                },
              ]}
            >
              <Text style={{ fontSize: fontSizes.xs, fontWeight: '600', color: showAgent ? c.accent : c.textMuted }}>
                {showAgent ? 'Hide AI' : 'AI Assistant'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Two-panel layout */}
      <View style={styles.twoPanel}>
        {/* Left panel: form content */}
        <View style={[styles.leftPanel, showAgent && styles.leftPanelWithAgent]}>
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
            {Number.isFinite(weightSum) && weightSum !== 100 && (
              <Text style={{ fontSize: fontSizes.xs, color: c.destructive, marginTop: spacing.sm }}>
                Weights must sum to 100 (currently {weightSum})
              </Text>
            )}
            <View style={[styles.divider, { borderBottomColor: c.border }]} />
          </View>

          {/* Pass/Fail Thresholds */}
          <PassThresholdEditor value={passThreshold} onChange={setPassThreshold} />
          <View style={[styles.divider, { borderBottomColor: c.border }]} />

          {/* Challenge Selection */}
          <View style={styles.challengeSection}>
            <Text style={[styles.sectionLabel, { color: c.text }]}>
              Select Challenges ({selectedChallengeIds.length} selected)
            </Text>

            {/* Search + filters */}
            <View style={styles.filterBar}>
              <View style={{ maxWidth: 300, marginBottom: spacing.sm }}>
                <Input
                  placeholder="Search challenges..."
                  value={challengeSearch}
                  onChangeText={setChallengeSearch}
                />
              </View>
              <View style={styles.filterPills}>
                {DIFFICULTIES.map((d) => (
                  <Pressable
                    key={d.key}
                    onPress={() => setDifficultyFilter(d.key)}
                    style={[
                      styles.filterPill,
                      {
                        backgroundColor: difficultyFilter === d.key ? c.accent + '20' : 'transparent',
                        borderColor: difficultyFilter === d.key ? c.accent : c.border,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: fontSizes.xs, color: difficultyFilter === d.key ? c.accent : c.textMuted }}>
                      {d.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.filterPills}>
                {PICKER_CATEGORIES.map((cat) => (
                  <Pressable
                    key={cat.key}
                    onPress={() => setCategoryFilter(cat.key)}
                    style={[
                      styles.filterPill,
                      {
                        backgroundColor: categoryFilter === cat.key ? c.accent + '20' : 'transparent',
                        borderColor: categoryFilter === cat.key ? c.accent : c.border,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: fontSizes.xs, color: categoryFilter === cat.key ? c.accent : c.textMuted }}>
                      {cat.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={{ fontSize: fontSizes.xs, color: c.textMuted, marginTop: spacing.xs }}>
                {filteredChallenges.length + filteredCustomChallenges.length} challenges shown
              </Text>
            </View>

            {/* Platform challenges */}
            <View style={styles.challengeGrid}>
              {filteredChallenges.map((ch) => {
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

              {/* Active custom challenges */}
              {filteredCustomChallenges.map((ch) => {
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
                          <Badge variant="outline" style={{ borderColor: c.accent + '60', backgroundColor: c.accent + '10' }}>
                            <Text style={{ fontSize: fontSizes.xs, color: c.accent }}>
                              Custom
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

          {/* Draft custom challenges to review */}
          {draftCustomChallenges.length > 0 && orgId && (
            <View style={styles.draftSection}>
              <Text style={[styles.sectionLabel, { color: c.text }]}>
                AI-Generated Challenges ({draftCustomChallenges.length} pending review)
              </Text>
              <Text style={[styles.sectionHint, { color: c.textMuted }]}>
                Review and approve these challenges before adding them to your assessment.
              </Text>
              {draftCustomChallenges.map((ch) => (
                <CustomChallengeReview
                  key={ch.id}
                  challenge={ch}
                  orgId={orgId}
                  onApprove={handleApproveCustomChallenge}
                  onDelete={handleDeleteCustomChallenge}
                  compact
                />
              ))}
            </View>
          )}

          {/* Activation / Invite errors */}
          {activateError && (
            <View style={[styles.inviteErrorBanner, { backgroundColor: c.destructive + '15', borderColor: c.destructive + '30' }]}>
              <Text style={{ color: c.destructive, fontSize: fontSizes.sm }}>{activateError}</Text>
            </View>
          )}
          {inviteError && (
            <View style={[styles.inviteErrorBanner, { backgroundColor: c.destructive + '15', borderColor: c.destructive + '30' }]}>
              <Text style={{ color: c.destructive, fontSize: fontSizes.sm }}>{inviteError}</Text>
            </View>
          )}

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

          {/* Bulk Invite + Invite Management (only when active) */}
          {assessmentId && status === 'active' && (
            <View style={styles.inviteSection}>
              <BulkInvitePanel
                assessmentId={assessmentId}
                onInvitesSent={() => setInviteRefreshKey((k) => k + 1)}
              />
              <View style={{ marginTop: spacing.lg }}>
                <InviteManagementTable
                  assessmentId={assessmentId}
                  refreshKey={inviteRefreshKey}
                />
              </View>
            </View>
          )}
        </View>

        {/* Right panel: AI Agent Chat */}
        {showAgent && (
          <View style={styles.rightPanel}>
            <View style={styles.agentSticky}>
              <AssessmentAgentChat
                assessmentId={assessmentId}
                onChallengesChanged={handleAgentChallengesChanged}
                onWeightsChanged={handleAgentWeightsChanged}
                onBrandingChanged={handleAgentBrandingChanged}
                onTimeLimitChanged={handleAgentTimeLimitChanged}
                onThresholdChanged={handleAgentThresholdChanged}
                onCustomChallengeCreated={handleCustomChallengeCreated}
                onAssessmentCreated={handleAgentAssessmentCreated}
              />
            </View>
          </View>
        )}
      </View>
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  section: { marginBottom: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  title: { fontSize: fontSizes['3xl'], fontWeight: '700', fontFamily: fontFamily.body },
  form: { gap: spacing.md, marginBottom: spacing.lg },
  actions: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  agentToggle: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderRadius: 6,
  },
  twoPanel: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  leftPanel: {
    flex: 1,
  },
  leftPanelWithAgent: {
    flex: 3,
  },
  rightPanel: {
    flex: 2,
    maxWidth: 420,
    minWidth: 320,
  },
  agentSticky: {
    position: 'sticky' as any,
    top: spacing.md,
    height: 'calc(100vh - 120px)' as any,
  },
  challengeSection: { marginBottom: spacing.lg },
  sectionLabel: { fontSize: fontSizes.lg, fontWeight: '600', marginBottom: spacing.md },
  challengeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  challengeCard: { minWidth: 260, flex: 1 },
  challengeBadges: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.xs },
  inviteCard: { borderWidth: 2, marginBottom: spacing.lg },
  inviteLabel: { fontWeight: '600', marginBottom: spacing.xs },
  inviteUrl: { fontSize: fontSizes.sm, fontFamily: 'monospace', marginBottom: spacing.sm },
  inviteHint: { fontSize: fontSizes.xs },
  inviteErrorBanner: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderRadius: 6, marginBottom: spacing.md },
  templateSection: { marginBottom: spacing.lg },
  templateGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  templateCard: { minWidth: 220, flex: 1, borderWidth: 1 },
  divider: { borderBottomWidth: 1, marginTop: spacing.lg, marginBottom: spacing.lg },
  brandingSection: { marginBottom: spacing.lg },
  sectionHint: { fontSize: fontSizes.sm, marginBottom: spacing.md, fontFamily: fontFamily.body },
  weightsSection: { marginBottom: spacing.lg },
  weightsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  weightItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minWidth: 200 },
  weightLabel: { fontSize: fontSizes.sm, fontWeight: '500', width: 120 },
  draftSection: { marginBottom: spacing.lg },
  inviteSection: { marginBottom: spacing.lg },
  filterBar: { marginBottom: spacing.md },
  filterPills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.xs },
  filterPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderRadius: 999,
  },
});
