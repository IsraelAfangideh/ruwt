export type RootStackParamList = {
  Landing: undefined;
  Login: undefined;
  Register: undefined;
  Callback: undefined;
  Onboarding: undefined;
  Dashboard: undefined;
  Challenges: undefined;
  Leaderboard: undefined;
  Profile: undefined;
  Settings: undefined;
  Arena: { challengeId: string };
  Replay: { attemptId: string };
  DailyChallenge: undefined;
  APIKeys: undefined;
  Assessments: undefined;
  AssessmentBuilder: { assessmentId?: string };
  AssessmentResultsDashboard: { assessmentId: string };
  AssessmentLanding: { token: string };
  AssessmentFlow: { sessionId: string };
  AssessmentResults: { shareToken: string };
  Teams: undefined;
  GuestArena: { challengeId: string };
  PublicProfile: { username: string };
  Share: { attemptId: string };
  Certificate: { shareToken: string };
  NotFound: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
