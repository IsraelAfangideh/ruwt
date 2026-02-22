import { lazy, Suspense, useEffect, useRef, Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import * as Sentry from '@sentry/react';
import { View, Text, ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import { linking } from './linking';
import { createClient } from '@/lib/supabase/client';

// Eager: LandingScreen is first paint for most visitors
import { LandingScreen } from '@/screens/LandingScreen';

// Lazy: everything else loads on demand
const LoginScreen = lazy(() => import('@/screens/LoginScreen').then(m => ({ default: m.LoginScreen })));
const RegisterScreen = lazy(() => import('@/screens/RegisterScreen').then(m => ({ default: m.RegisterScreen })));
const CallbackScreen = lazy(() => import('@/screens/CallbackScreen').then(m => ({ default: m.CallbackScreen })));
const OnboardingScreen = lazy(() => import('@/screens/OnboardingScreen').then(m => ({ default: m.OnboardingScreen })));
const DashboardScreen = lazy(() => import('@/screens/DashboardScreen').then(m => ({ default: m.DashboardScreen })));
const ChallengesScreen = lazy(() => import('@/screens/ChallengesScreen').then(m => ({ default: m.ChallengesScreen })));
const LeaderboardScreen = lazy(() => import('@/screens/LeaderboardScreen').then(m => ({ default: m.LeaderboardScreen })));
const ProfileScreen = lazy(() => import('@/screens/ProfileScreen').then(m => ({ default: m.ProfileScreen })));
const SettingsScreen = lazy(() => import('@/screens/SettingsScreen').then(m => ({ default: m.SettingsScreen })));
const ArenaScreen = lazy(() => import('@/screens/ArenaScreen').then(m => ({ default: m.ArenaScreen })));
const ReplayScreen = lazy(() => import('@/screens/ReplayScreen').then(m => ({ default: m.ReplayScreen })));
const DailyChallengeScreen = lazy(() => import('@/screens/DailyChallengeScreen').then(m => ({ default: m.DailyChallengeScreen })));
const AssessmentListScreen = lazy(() => import('@/screens/AssessmentListScreen').then(m => ({ default: m.AssessmentListScreen })));
const AssessmentBuilderScreen = lazy(() => import('@/screens/AssessmentBuilderScreen').then(m => ({ default: m.AssessmentBuilderScreen })));
const AssessmentResultsDashboardScreen = lazy(() => import('@/screens/AssessmentResultsDashboardScreen').then(m => ({ default: m.AssessmentResultsDashboardScreen })));
const AssessmentLandingScreen = lazy(() => import('@/screens/AssessmentLandingScreen').then(m => ({ default: m.AssessmentLandingScreen })));
const AssessmentFlowScreen = lazy(() => import('@/screens/AssessmentFlowScreen').then(m => ({ default: m.AssessmentFlowScreen })));
const AssessmentResultsScreen = lazy(() => import('@/screens/AssessmentResultsScreen').then(m => ({ default: m.AssessmentResultsScreen })));
const TeamsScreen = lazy(() => import('@/screens/TeamsScreen').then(m => ({ default: m.TeamsScreen })));
const GuestArenaScreen = lazy(() => import('@/screens/GuestArenaScreen').then(m => ({ default: m.GuestArenaScreen })));
const PublicProfileScreen = lazy(() => import('@/screens/PublicProfileScreen').then(m => ({ default: m.PublicProfileScreen })));
const ShareScreen = lazy(() => import('@/screens/ShareScreen').then(m => ({ default: m.ShareScreen })));
const CertificateScreen = lazy(() => import('@/screens/CertificateScreen').then(m => ({ default: m.CertificateScreen })));
const OrgManagementScreen = lazy(() => import('@/screens/OrgManagementScreen').then(m => ({ default: m.OrgManagementScreen })));
const OrgJoinScreen = lazy(() => import('@/screens/OrgJoinScreen').then(m => ({ default: m.OrgJoinScreen })));
const NotFoundScreen = lazy(() => import('@/screens/NotFoundScreen').then(m => ({ default: m.NotFoundScreen })));

function LoadingFallback() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color="#c9a962" />
    </View>
  );
}

class ChunkErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Chunk load failures happen when a deploy invalidates cached chunks
    Sentry.captureException(error, {
      tags: { type: 'chunk_error' },
      contexts: { react: { componentStack: info.componentStack ?? undefined } },
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorWrap}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorMsg}>
            A new version may have been deployed. Reload to continue.
          </Text>
          <Pressable
            style={({ pressed }: { pressed: boolean }) => [
              styles.reloadBtn,
              pressed && { opacity: 0.8 },
            ]}
            onPress={() => window.location.reload()}
          >
            <Text style={styles.reloadText}>Reload</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

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
      <ChunkErrorBoundary>
      <Suspense fallback={<LoadingFallback />}>
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
          <Stack.Screen name="OrgManagement" component={OrgManagementScreen} />
          <Stack.Screen name="OrgJoin" component={OrgJoinScreen} />
          <Stack.Screen name="NotFound" component={NotFoundScreen} />
        </Stack.Navigator>
      </Suspense>
      </ChunkErrorBoundary>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f3f0',
  },
  errorWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f3f0',
    padding: 32,
    gap: 12,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1816',
  },
  errorMsg: {
    fontSize: 14,
    color: '#6b6560',
    textAlign: 'center',
    maxWidth: 320,
  },
  reloadBtn: {
    marginTop: 8,
    backgroundColor: '#c9a962',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  reloadText: {
    color: '#1a1816',
    fontSize: 14,
    fontWeight: '600',
  },
});
