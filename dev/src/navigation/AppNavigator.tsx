import { lazy, Suspense, useEffect, useRef, Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import * as Sentry from '@sentry/react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { CardGridSkeleton } from '@/components/ui/ScreenSkeletons';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import { linking } from './linking';
import { resetNavigation } from './resetNavigation';
import { createClient } from '@/lib/supabase/client';

// Eager: LandingScreen is first paint for most visitors
import { LandingScreen } from '@/screens/LandingScreen';

// Auto-retry dynamic imports: on chunk load failure (stale deploy), reload once
/** @internal Exported for testing only. */
export function lazyWithRetry<T extends { [key: string]: any }>(
  name: string,
  factory: () => Promise<T>,
  extract: (m: T) => any,
) {
  return lazy(() =>
    factory()
      .then(m => ({ default: extract(m) as React.ComponentType<any> }))
      .catch((err: Error) => {
        const key = `chunk_retry_${name}`;
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, '1');
          window.location.reload();
          return new Promise<never>(() => {});
        }
        sessionStorage.removeItem(key);
        throw err;
      }),
  );
}

// Lazy: everything else loads on demand (auto-retries on stale chunk failures)
const LoginScreen = lazyWithRetry('Login', () => import('@/screens/LoginScreen'), m => m.LoginScreen);
const RegisterScreen = lazyWithRetry('Register', () => import('@/screens/RegisterScreen'), m => m.RegisterScreen);
const CallbackScreen = lazyWithRetry('Callback', () => import('@/screens/CallbackScreen'), m => m.CallbackScreen);
const OnboardingScreen = lazyWithRetry('Onboarding', () => import('@/screens/OnboardingScreen'), m => m.OnboardingScreen);
const DashboardScreen = lazyWithRetry('Dashboard', () => import('@/screens/DashboardScreen'), m => m.DashboardScreen);
const ProblemsScreen = lazyWithRetry('Problems', () => import('@/screens/ChallengesScreen'), m => m.ChallengesScreen);
const DiscussScreen = lazyWithRetry('Discuss', () => import('@/screens/DiscussScreen'), m => m.DiscussScreen);
const LeaderboardScreen = lazyWithRetry('Leaderboard', () => import('@/screens/LeaderboardScreen'), m => m.LeaderboardScreen);
const ProfileScreen = lazyWithRetry('Profile', () => import('@/screens/ProfileScreen'), m => m.ProfileScreen);
const SettingsScreen = lazyWithRetry('Settings', () => import('@/screens/SettingsScreen'), m => m.SettingsScreen);
const ArenaScreen = lazyWithRetry('Arena', () => import('@/screens/ArenaScreen'), m => m.ArenaScreen);
const ReplayScreen = lazyWithRetry('Replay', () => import('@/screens/ReplayScreen'), m => m.ReplayScreen);
const DailyChallengeScreen = lazyWithRetry('DailyChallenge', () => import('@/screens/DailyChallengeScreen'), m => m.DailyChallengeScreen);
const AssessmentListScreen = lazyWithRetry('AssessmentList', () => import('@/screens/AssessmentListScreen'), m => m.AssessmentListScreen);
const AssessmentBuilderScreen = lazyWithRetry('AssessmentBuilder', () => import('@/screens/AssessmentIDEScreen'), m => m.AssessmentIDEScreen);
const AssessmentResultsDashboardScreen = lazyWithRetry('AssessmentResultsDashboard', () => import('@/screens/AssessmentResultsDashboardScreen'), m => m.AssessmentResultsDashboardScreen);
const AssessmentLandingScreen = lazyWithRetry('AssessmentLanding', () => import('@/screens/AssessmentLandingScreen'), m => m.AssessmentLandingScreen);
const AssessmentFlowScreen = lazyWithRetry('AssessmentFlow', () => import('@/screens/AssessmentFlowScreen'), m => m.AssessmentFlowScreen);
const AssessmentResultsScreen = lazyWithRetry('AssessmentResults', () => import('@/screens/AssessmentResultsScreen'), m => m.AssessmentResultsScreen);
const HiringScreen = lazyWithRetry('Hiring', () => import('@/screens/TeamsScreen'), m => m.TeamsScreen);
const GuestArenaScreen = lazyWithRetry('GuestArena', () => import('@/screens/GuestArenaScreen'), m => m.GuestArenaScreen);
const PublicProfileScreen = lazyWithRetry('PublicProfile', () => import('@/screens/PublicProfileScreen'), m => m.PublicProfileScreen);
const ShareScreen = lazyWithRetry('Share', () => import('@/screens/ShareScreen'), m => m.ShareScreen);
const CertificateScreen = lazyWithRetry('Certificate', () => import('@/screens/CertificateScreen'), m => m.CertificateScreen);
const OrgManagementScreen = lazyWithRetry('OrgManagement', () => import('@/screens/OrgManagementScreen'), m => m.OrgManagementScreen);
const OrgJoinScreen = lazyWithRetry('OrgJoin', () => import('@/screens/OrgJoinScreen'), m => m.OrgJoinScreen);
const BookmarksScreen = lazyWithRetry('Bookmarks', () => import('@/screens/BookmarksScreen'), m => m.BookmarksScreen);
const ModelsScreen = lazyWithRetry('Models', () => import('@/screens/ModelsScreen'), m => m.ModelsScreen);
const ModelScreen = lazyWithRetry('ModelDetail', () => import('@/screens/ModelScreen'), m => m.ModelScreen);
const NotFoundScreen = lazyWithRetry('NotFound', () => import('@/screens/NotFoundScreen'), m => m.NotFoundScreen);

function LoadingFallback() {
  return <CardGridSkeleton />;
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

  // Global auth listener: handle session expiry (Sentry ID is handled by AuthProvider)
  useEffect(() => {
    const supabase = createClient();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        if (isNavigationReady.current && navigationRef.isReady()) {
          resetNavigation(navigationRef, [{ name: 'Landing' }]);
        }
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
      onStateChange={() => {
        // Move focus to main content on route change so screen readers announce the new page
        const main = document.getElementById('main-content');
        if (main) main.focus();
      }}
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
          <Stack.Screen name="Problems" component={ProblemsScreen} />
          <Stack.Screen name="Discuss" component={DiscussScreen} />
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
          <Stack.Screen name="Hiring" component={HiringScreen} />
          <Stack.Screen name="GuestArena" component={GuestArenaScreen} />
          <Stack.Screen name="PublicProfile" component={PublicProfileScreen} />
          <Stack.Screen name="Share" component={ShareScreen} />
          <Stack.Screen name="Certificate" component={CertificateScreen} />
          <Stack.Screen name="OrgManagement" component={OrgManagementScreen} />
          <Stack.Screen name="OrgJoin" component={OrgJoinScreen} />
          <Stack.Screen name="Bookmarks" component={BookmarksScreen} />
          <Stack.Screen name="Models" component={ModelsScreen} />
          <Stack.Screen name="ModelDetail" component={ModelScreen} />
          <Stack.Screen name="NotFound" component={NotFoundScreen} />
        </Stack.Navigator>
      </Suspense>
      </ChunkErrorBoundary>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
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
