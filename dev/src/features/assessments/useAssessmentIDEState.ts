/**
 * All state + effects for the Assessment IDE.
 * Extracted from the old AssessmentBuilderScreen monolith.
 */
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRoute } from '@react-navigation/native';
import { useAuthGuard } from '@/shared/hooks/useAuthGuard';
import type { PassThreshold } from '@/features/assessments/PassThresholdEditor';
import type { AssessmentTemplate } from '@/features/assessments/assessment-templates';

export interface Challenge {
  id: string;
  title: string;
  difficulty: string;
  category: string | null;
  skillTested: string | null;
}

export interface CustomChallenge {
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

export interface Weights {
  modelSelection: string;
  promptEfficiency: string;
  debugging: string;
  strategy: string;
  speed: string;
}

export interface AssessmentIDEState {
  // Auth
  user: any;
  loading: boolean;
  loadError: string | null;

  // Assessment identity
  assessmentId: string | undefined;
  status: string;
  title: string;
  description: string;
  timeLimitMinutes: string;
  dirty: boolean;
  isEditing: boolean;

  // Challenges
  allChallenges: Challenge[];
  selectedChallengeIds: string[];
  customChallenges: CustomChallenge[];
  orgId: string | null;

  // Branding
  companyName: string;
  companyLogoUrl: string;
  welcomeMessage: string;

  // Weights
  weights: Weights;
  weightSum: number;

  // Threshold
  passThreshold: PassThreshold | null;

  // Invite
  inviteLink: string | null;
  inviteRefreshKey: number;
  copied: boolean;
  generatingInvite: boolean;
  inviteError: string | null;

  // Save/Activate state
  saving: boolean;
  saveSuccess: boolean;
  saveError: string | null;
  activating: boolean;
  activateError: string | null;
  confirmActivate: boolean;

  // Setters
  setTitle: (v: string) => void;
  setDescription: (v: string) => void;
  setTimeLimitMinutes: (v: string) => void;
  setCompanyName: (v: string) => void;
  setCompanyLogoUrl: (v: string) => void;
  setWelcomeMessage: (v: string) => void;
  setWeights: React.Dispatch<React.SetStateAction<Weights>>;
  setPassThreshold: (v: PassThreshold | null) => void;
  setSelectedChallengeIds: React.Dispatch<React.SetStateAction<string[]>>;
  setConfirmActivate: (v: boolean) => void;

  // Actions
  handleSave: () => Promise<void>;
  handleActivate: () => Promise<void>;
  handleGenerateInvite: () => Promise<void>;
  toggleChallenge: (id: string) => void;
  applyTemplate: (template: AssessmentTemplate) => void;
  copyInviteLink: () => Promise<void>;

  // Agent callbacks
  handleAgentChallengesChanged: () => Promise<void>;
  handleAgentWeightsChanged: (newWeights: Record<string, number>) => void;
  handleAgentBrandingChanged: (fields: Record<string, string>) => void;
  handleAgentTimeLimitChanged: (minutes: number) => void;
  handleAgentThresholdChanged: (threshold: PassThreshold) => void;
  handleCustomChallengeCreated: () => Promise<void>;
  handleAgentAssessmentCreated: (newId: string) => void;
  handleApproveCustomChallenge: (id: string) => void;
  handleDeleteCustomChallenge: (id: string) => void;
  handleInvitesSent: () => void;
}

export function useAssessmentIDEState(): AssessmentIDEState {
  const { user, loading: authLoading } = useAuthGuard();
  const route = useRoute();
  const params = (route.params || {}) as { assessmentId?: string };

  const [dataLoading, setDataLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  const [activateError, setActivateError] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [confirmActivate, setConfirmActivate] = useState(false);
  const [dirty, setDirty] = useState(false);
  const initialLoadDone = useRef(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [timeLimitMinutes, setTimeLimitMinutes] = useState('60');
  const [selectedChallengeIds, setSelectedChallengeIds] = useState<string[]>([]);
  const [allChallenges, setAllChallenges] = useState<Challenge[]>([]);
  const [assessmentId, setAssessmentId] = useState<string | undefined>(params.assessmentId);
  const assessmentIdRef = useRef(assessmentId);
  assessmentIdRef.current = assessmentId;
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [status, setStatus] = useState('draft');
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Branding
  const [companyName, setCompanyName] = useState('');
  const [companyLogoUrl, setCompanyLogoUrl] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState('');

  // Weights
  const [weights, setWeights] = useState<Weights>({
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

  // Clear pending timers on unmount
  useEffect(() => {
    return () => { timersRef.current.forEach(clearTimeout); };
  }, []);

  // Warn before unloading with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) { e.preventDefault(); }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  // Mark dirty when form fields change (skip initial load)
  useEffect(() => {
    if (initialLoadDone.current) setDirty(true);
  }, [title, description, timeLimitMinutes, selectedChallengeIds, companyName, companyLogoUrl, welcomeMessage, weights, passThreshold]);

  // Init: load challenges, orgs, existing assessment (auth handled by useAuthGuard)
  useEffect(() => {
    if (authLoading || !user) return;
    const init = async () => {
      // Parallelize all initial fetches
      const fetches: [Promise<Response | null>, Promise<Response | null>, Promise<Response | null>] = [
        fetch('/api/challenges').catch(() => null),
        fetch('/api/orgs').catch(() => null),
        params.assessmentId ? fetch(`/api/assessments/${params.assessmentId}`).catch(() => null) : Promise.resolve(null),
      ];
      const [challengesRes, orgsRes, assessmentRes] = await Promise.all(fetches);

      if (challengesRes?.ok) {
        setAllChallenges(await challengesRes.json());
      } else {
        setLoadError('Failed to load challenges. Try refreshing the page.');
      }

      if (orgsRes?.ok) {
        const orgs = await orgsRes.json();
        if (orgs.length > 0) {
          const oid = orgs[0].id;
          setOrgId(oid);
          try {
            const ccRes = await fetch(`/api/orgs/${oid}/challenges`);
            if (ccRes.ok) setCustomChallenges(await ccRes.json());
          } catch {}
        }
      }

      if (assessmentRes?.ok) {
        const data = await assessmentRes.json();
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

      setDataLoading(false);
      setTimeout(() => { initialLoadDone.current = true; }, 0);
    };
    init();
  }, [authLoading, user, params.assessmentId]);

  const toggleChallenge = useCallback((id: string) => {
    setSelectedChallengeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const applyTemplate = useCallback((template: AssessmentTemplate) => {
    setTitle(template.name + ' Assessment');
    setDescription(template.description);
    setTimeLimitMinutes(String(template.timeLimitMinutes));
    const matchedIds = allChallenges
      .filter((ch) => template.challengeTitles.includes(ch.title))
      .map((ch) => ch.id);
    setSelectedChallengeIds(matchedIds);
  }, [allChallenges]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const rawMinutes = parseInt(timeLimitMinutes, 10);
      const timeLimit = Math.min(14400, Math.max(300, Number.isFinite(rawMinutes) ? rawMinutes * 60 : 3600));
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
        const res = await fetch(`/api/assessments/${currentId}`, {
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
        if (!res.ok) throw new Error('Failed to save assessment');
      } else {
        const res = await fetch('/api/assessments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, description: description || undefined, timeLimit }),
        });
        if (!res.ok) throw new Error('Failed to create assessment');
        const data = await res.json();
        currentId = data.id;
        setAssessmentId(data.id);
      }

      // Save branding + weights + threshold on newly created assessments
      if (currentId && !assessmentId) {
        const res = await fetch(`/api/assessments/${currentId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...brandingFields, categoryWeights, passThreshold: passThresholdStr }),
        });
        if (!res.ok) throw new Error('Failed to save assessment details');
      }

      if (currentId) {
        const res = await fetch(`/api/assessments/${currentId}/challenges`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ challengeIds: selectedChallengeIds }),
        });
        if (!res.ok) throw new Error('Failed to save challenges');
      }
      setDirty(false);
      setSaveSuccess(true);
      timersRef.current.push(setTimeout(() => setSaveSuccess(false), 2500));
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
      timersRef.current.push(setTimeout(() => setSaveError(null), 4000));
    }
    setSaving(false);
  }, [assessmentId, title, description, timeLimitMinutes, selectedChallengeIds, companyName, companyLogoUrl, welcomeMessage, weights, passThreshold]);

  const handleActivate = useCallback(async () => {
    /* istanbul ignore next -- @preserve */
    if (!assessmentId) return;
    if (!title.trim()) {
      setActivateError('Enter a title before activating.');
      timersRef.current.push(setTimeout(() => setActivateError(null), 4000));
      return;
    }
    if (selectedChallengeIds.length === 0) {
      setActivateError('Select at least one challenge before activating.');
      timersRef.current.push(setTimeout(() => setActivateError(null), 4000));
      return;
    }
    setActivateError(null);
    setActivating(true);
    try {
      const res = await fetch(`/api/assessments/${assessmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' }),
      });
      if (!res.ok) throw new Error('Failed to activate');
      setStatus('active');
    } catch (err) {
      setActivateError(err instanceof Error ? err.message : 'Activation failed');
      timersRef.current.push(setTimeout(() => setActivateError(null), 4000));
    }
    setActivating(false);
  }, [assessmentId, title, selectedChallengeIds.length]);

  const handleGenerateInvite = useCallback(async () => {
    /* istanbul ignore next -- @preserve */
    if (!assessmentId) return;
    setInviteError(null);
    setGeneratingInvite(true);
    try {
      const res = await fetch(`/api/assessments/${assessmentId}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({ error: 'Invalid response' }));
      if (res.ok) {
        setInviteLink(data.url);
      } else {
        setInviteError(data.error || 'Failed to generate invite link');
        timersRef.current.push(setTimeout(() => setInviteError(null), 4000));
      }
    } catch {
      setInviteError('Network error — please try again');
      timersRef.current.push(setTimeout(() => setInviteError(null), 4000));
    }
    setGeneratingInvite(false);
  }, [assessmentId]);

  const copyInviteLink = useCallback(async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      timersRef.current.push(setTimeout(() => setCopied(false), 2000));
    } catch {}
  }, [inviteLink]);

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

  const handleInvitesSent = useCallback(() => {
    setInviteRefreshKey((k) => k + 1);
  }, []);

  return {
    user,
    loading: authLoading || dataLoading,
    loadError,
    assessmentId,
    status,
    title,
    description,
    timeLimitMinutes,
    dirty,
    isEditing: !!params.assessmentId,
    allChallenges,
    selectedChallengeIds,
    customChallenges,
    orgId,
    companyName,
    companyLogoUrl,
    welcomeMessage,
    weights,
    weightSum,
    passThreshold,
    inviteLink,
    inviteRefreshKey,
    copied,
    generatingInvite,
    inviteError,
    saving,
    saveSuccess,
    saveError,
    activating,
    activateError,
    confirmActivate,
    setTitle,
    setDescription,
    setTimeLimitMinutes,
    setCompanyName,
    setCompanyLogoUrl,
    setWelcomeMessage,
    setWeights,
    setPassThreshold,
    setSelectedChallengeIds,
    setConfirmActivate,
    handleSave,
    handleActivate,
    handleGenerateInvite,
    toggleChallenge,
    applyTemplate,
    copyInviteLink,
    handleAgentChallengesChanged,
    handleAgentWeightsChanged,
    handleAgentBrandingChanged,
    handleAgentTimeLimitChanged,
    handleAgentThresholdChanged,
    handleCustomChallengeCreated,
    handleAgentAssessmentCreated,
    handleApproveCustomChallenge,
    handleDeleteCustomChallenge,
    handleInvitesSent,
  };
}
