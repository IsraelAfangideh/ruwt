import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { TrialInfo } from '@/components/TrialBanner';

export type AppMode = 'practice' | 'hiring';

export interface OrgInfo {
  id: string;
  name: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  subscriptionStatus: 'none' | 'active' | 'past_due' | 'canceled';
  subscriptionPlan: 'monthly' | 'annual' | null;
  subscriptionEndsAt: string | null;
  trial: TrialInfo | null;
}

export interface ProfileData {
  email: string;
  name: string | null;
  avatarUrl: string | null;
  credits: number;
  username: string | null;
  onboardingCompleted: number;
  currentStreak: number;
  longestStreak: number;
  lastStreakDate: string | null;
  streakFreezes: number;
  newsletterSubscribed: number;
  accountType: 'individual' | 'team';
  subscriptionStatus: 'none' | 'active' | 'past_due' | 'canceled';
  subscriptionPlan: 'monthly' | 'annual' | null;
  subscriptionEndsAt: string | null;
  trial: TrialInfo | null;
  canStartTrial: boolean;
  org: OrgInfo | null;
  preferredMode: AppMode | null;
}

interface AppModeContextType {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  profile: ProfileData | null;
  profileLoading: boolean;
  orgInfo: OrgInfo | null;
  isOrgMember: boolean;
  canAccessHiringMode: boolean;
  refreshProfile: () => Promise<void>;
}

const AppModeContext = createContext<AppModeContextType | undefined>(undefined);

const STORAGE_KEY = 'ruwt-app-mode';

function getStoredMode(): AppMode | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'practice' || v === 'hiring') return v;
  } catch { /* SSR / private browsing */ }
  return null;
}

function storeMode(mode: AppMode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch { /* SSR / private browsing */ }
}

function deriveCanAccessHiring(org: OrgInfo | null): boolean {
  if (!org) return false;
  if (org.subscriptionStatus === 'active') return true;
  // Canceled but still within paid period
  if (org.subscriptionStatus === 'canceled' && org.subscriptionEndsAt) {
    if (new Date(org.subscriptionEndsAt) > new Date()) return true;
  }
  // Active trial
  if (org.trial?.isActive) return true;
  return false;
}

export function AppModeProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [mode, setModeState] = useState<AppMode>(getStoredMode() ?? 'practice');

  const orgInfo = profile?.org ?? null;
  const isOrgMember = orgInfo !== null;
  const canAccessHiringMode = deriveCanAccessHiring(orgInfo);

  const fetchProfile = useCallback(async () => {
    try {
      const r = await fetch('/api/profile');
      if (r.ok) {
        const data = await r.json() as ProfileData;
        setProfile(data);

        const org = data.org ?? null;
        const canHire = deriveCanAccessHiring(org);

        // Resolve initial mode: server preference > localStorage > default
        const stored = getStoredMode();
        const serverPref = data.preferredMode;
        let resolvedMode: AppMode = 'practice';

        if (serverPref === 'hiring' || serverPref === 'practice') {
          resolvedMode = serverPref;
        } else if (stored === 'hiring' || stored === 'practice') {
          resolvedMode = stored;
        }

        // Force practice if they can't access hiring
        if (resolvedMode === 'hiring' && !canHire) {
          resolvedMode = 'practice';
        }

        setModeState(resolvedMode);
        storeMode(resolvedMode);
      }
    } catch { /* network error — stay with defaults */ }
    setProfileLoading(false);
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const setMode = useCallback((next: AppMode) => {
    setModeState(next);
    storeMode(next);
    // Persist to server (fire-and-forget)
    fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferredMode: next }),
    }).catch(() => { /* ignore */ });
  }, []);

  const value = useMemo(() => ({
    mode,
    setMode,
    profile,
    profileLoading,
    orgInfo,
    isOrgMember,
    canAccessHiringMode,
    refreshProfile: fetchProfile,
  }), [mode, setMode, profile, profileLoading, orgInfo, isOrgMember, canAccessHiringMode, fetchProfile]);

  return <AppModeContext.Provider value={value}>{children}</AppModeContext.Provider>;
}

export function useAppMode(): AppModeContextType {
  const context = useContext(AppModeContext);
  if (!context) throw new Error('useAppMode must be used within AppModeProvider');
  return context;
}
