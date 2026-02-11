import type { LinkingOptions } from '@react-navigation/native';

export const linking: LinkingOptions<ReactNavigation.RootParamList> = {
  prefixes: [],
  config: {
    screens: {
      Landing: '',
      Login: 'login',
      Register: 'register',
      Callback: 'callback',
      Challenges: 'challenges',
      Leaderboard: 'leaderboard',
      Profile: 'profile',
      Settings: 'settings',
      Arena: 'arena/:challengeId',
      Assessments: 'assessments',
      AssessmentBuilder: 'assessments/build/:assessmentId?',
      AssessmentResultsDashboard: 'assessments/:assessmentId/results',
      AssessmentLanding: 'assess/:token',
      AssessmentFlow: 'assess/session/:sessionId',
      AssessmentResults: 'results/:shareToken',
    },
  },
};
