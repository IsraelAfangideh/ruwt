import { useEffect, useRef } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import { linking } from './linking';
import { createClient } from '@/lib/supabase/client';

import { LandingScreen } from '@/screens/LandingScreen';
import { LoginScreen } from '@/screens/LoginScreen';
import { RegisterScreen } from '@/screens/RegisterScreen';
import { CallbackScreen } from '@/screens/CallbackScreen';
import { OnboardingScreen } from '@/screens/OnboardingScreen';
import { DashboardScreen } from '@/screens/DashboardScreen';
import { ChallengesScreen } from '@/screens/ChallengesScreen';
import { LeaderboardScreen } from '@/screens/LeaderboardScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { ArenaScreen } from '@/screens/ArenaScreen';
import { ReplayScreen } from '@/screens/ReplayScreen';
import { DailyChallengeScreen } from '@/screens/DailyChallengeScreen';
import { APIKeysScreen } from '@/screens/APIKeysScreen';
import { AssessmentListScreen } from '@/screens/AssessmentListScreen';
import { AssessmentBuilderScreen } from '@/screens/AssessmentBuilderScreen';
import { AssessmentResultsDashboardScreen } from '@/screens/AssessmentResultsDashboardScreen';
import { AssessmentLandingScreen } from '@/screens/AssessmentLandingScreen';
import { AssessmentFlowScreen } from '@/screens/AssessmentFlowScreen';
import { AssessmentResultsScreen } from '@/screens/AssessmentResultsScreen';
import { TeamsScreen } from '@/screens/TeamsScreen';
import { GuestArenaScreen } from '@/screens/GuestArenaScreen';
import { PublicProfileScreen } from '@/screens/PublicProfileScreen';
import { ShareScreen } from '@/screens/ShareScreen';
import { CertificateScreen } from '@/screens/CertificateScreen';
import { NotFoundScreen } from '@/screens/NotFoundScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function AppNavigator() {
  const isNavigationReady = useRef(false);

  // Global session expiry detection: listen for SIGNED_OUT and reset to Login
  useEffect(() => {
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && isNavigationReady.current && navigationRef.isReady()) {
        navigationRef.reset({ index: 0, routes: [{ name: 'Login' }] });
      }
    });
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <NavigationContainer
      ref={navigationRef}
      linking={linking}
      onReady={() => { isNavigationReady.current = true; }}
    >
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { flex: 1 },
        }}
      >
        <Stack.Screen name="Landing" component={LandingScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="Callback" component={CallbackScreen} />
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen name="Challenges" component={ChallengesScreen} />
        <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="Arena" component={ArenaScreen} />
        <Stack.Screen name="Replay" component={ReplayScreen} />
        <Stack.Screen name="DailyChallenge" component={DailyChallengeScreen} />
        <Stack.Screen name="APIKeys" component={APIKeysScreen} />
        <Stack.Screen name="Assessments" component={AssessmentListScreen} />
        <Stack.Screen name="AssessmentBuilder" component={AssessmentBuilderScreen} />
        <Stack.Screen name="AssessmentResultsDashboard" component={AssessmentResultsDashboardScreen} />
        <Stack.Screen name="AssessmentLanding" component={AssessmentLandingScreen} />
        <Stack.Screen name="AssessmentFlow" component={AssessmentFlowScreen} />
        <Stack.Screen name="AssessmentResults" component={AssessmentResultsScreen} />
        <Stack.Screen name="Teams" component={TeamsScreen} />
        <Stack.Screen name="GuestArena" component={GuestArenaScreen} />
        <Stack.Screen name="PublicProfile" component={PublicProfileScreen} />
        <Stack.Screen name="Share" component={ShareScreen} />
        <Stack.Screen name="Certificate" component={CertificateScreen} />
        <Stack.Screen name="NotFound" component={NotFoundScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
