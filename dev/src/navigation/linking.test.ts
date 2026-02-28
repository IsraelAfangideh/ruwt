import { describe, it, expect } from 'vitest';
import { linking } from './linking';

describe('linking', () => {
  const screens = linking.config!.screens as Record<string, string>;

  // ---------------------------------------------------------------------------
  // Structure
  // ---------------------------------------------------------------------------
  it('has empty prefixes array', () => {
    expect(linking.prefixes).toEqual([]);
  });

  it('has a config with screens', () => {
    expect(linking.config).toBeDefined();
    expect(screens).toBeDefined();
    expect(Object.keys(screens).length).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------------------
  // Every screen name in types.ts should have a route
  // ---------------------------------------------------------------------------
  const expectedScreens = [
    'Landing', 'Login', 'Register', 'Callback', 'Onboarding',
    'Dashboard', 'Challenges', 'Leaderboard', 'Profile', 'Settings',
    'Arena', 'Replay', 'DailyChallenge',
    'Assessments', 'AssessmentBuilder', 'AssessmentResultsDashboard',
    'AssessmentLanding', 'AssessmentFlow', 'AssessmentResults',
    'Teams', 'GuestArena', 'PublicProfile', 'Share', 'Certificate',
    'OrgManagement', 'OrgJoin', 'NotFound',
  ];

  it('defines a route for every screen in RootStackParamList', () => {
    for (const name of expectedScreens) {
      expect(screens[name], `screen "${name}" should have a route`).toBeDefined();
    }
  });

  // ---------------------------------------------------------------------------
  // Specific routes
  // ---------------------------------------------------------------------------
  it('Landing maps to root path', () => {
    expect(screens.Landing).toBe('');
  });

  it('Login maps to "login"', () => {
    expect(screens.Login).toBe('login');
  });

  it('Arena route includes :challengeId param', () => {
    expect(screens.Arena).toBe('arena/:challengeId');
  });

  it('Replay route includes :attemptId param', () => {
    expect(screens.Replay).toBe('replay/:attemptId');
  });

  it('PublicProfile route includes :username param', () => {
    expect(screens.PublicProfile).toBe('u/:username');
  });

  it('AssessmentBuilder route has optional :assessmentId param', () => {
    expect(screens.AssessmentBuilder).toBe('assessments/build/:assessmentId?');
  });

  it('AssessmentLanding route maps to assess/:token', () => {
    expect(screens.AssessmentLanding).toBe('assess/:token');
  });

  it('GuestArena route maps to try/:challengeId', () => {
    expect(screens.GuestArena).toBe('try/:challengeId');
  });

  it('Certificate route maps to cert/:shareToken', () => {
    expect(screens.Certificate).toBe('cert/:shareToken');
  });

  it('OrgManagement has optional :orgId param', () => {
    expect(screens.OrgManagement).toBe('org/:orgId?');
  });

  it('OrgJoin route maps to org/join/:token', () => {
    expect(screens.OrgJoin).toBe('org/join/:token');
  });

  it('NotFound is a wildcard catch-all', () => {
    expect(screens.NotFound).toBe('*');
  });
});
