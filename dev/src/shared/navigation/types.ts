export type RootStackParamList = {
  Landing: undefined;
  Login: undefined;
  Register: undefined;
  Callback: undefined;
  Onboarding: undefined;
  Dashboard: undefined;
  Problems: undefined;
  Discuss: undefined;
  Leaderboard: undefined;
  Profile: undefined;
  Settings: undefined;
  Arena: { challengeId: string };
  Replay: { attemptId: string };
  DailyChallenge: undefined;
  Assessments: undefined;
  AssessmentBuilder: { assessmentId?: string };
  AssessmentResultsDashboard: { assessmentId: string };
  AssessmentLanding: { token: string };
  AssessmentFlow: { sessionId: string };
  AssessmentResults: { shareToken: string };
  Hiring: undefined;
  GuestArena: { challengeId: string };
  PublicProfile: { username: string };
  Share: { attemptId: string };
  Certificate: { shareToken: string };
  OrgManagement: { orgId?: string };
  OrgJoin: { token: string };
  Bookmarks: undefined;
  Models: undefined;
  ModelDetail: { modelId: string };
  NotFound: undefined;
};

/** Default screen to show after login / OAuth callback. */
export const DEFAULT_AUTH_REDIRECT = 'Assessments' as const satisfies keyof RootStackParamList;

/** Routes that are valid post-auth redirect targets (OAuth callback whitelist). */
export const ALLOWED_AUTH_REDIRECTS = new Set<keyof RootStackParamList>([
  'Problems', 'Leaderboard', 'Profile', 'Settings',
  'Arena', 'DailyChallenge', 'Assessments', 'AssessmentBuilder',
  'Hiring', 'OrgManagement', 'Replay', 'Share', 'Certificate',
]);

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
