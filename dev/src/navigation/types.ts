export type RootStackParamList = {
  Landing: undefined;
  Login: undefined;
  Register: undefined;
  Callback: undefined;
  Challenges: undefined;
  Leaderboard: undefined;
  Profile: undefined;
  Settings: undefined;
  Arena: { challengeId: string };
  Replay: { attemptId: string };
  Assessments: undefined;
  AssessmentBuilder: { assessmentId?: string };
  AssessmentResultsDashboard: { assessmentId: string };
  AssessmentLanding: { token: string };
  AssessmentFlow: { sessionId: string };
  AssessmentResults: { shareToken: string };
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
