import { lazy, Suspense, useEffect, useRef, Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import * as Sentry from '@sentry/react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { CardGridSkeleton } from '@/shared/ui/ScreenSkeletons';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import { linking } from './linking';
import { resetNavigation } from './resetNavigation';
import { createClient } from '@/shared/lib/supabase/client';

// Eager: LandingScreen is first paint for most visitors
import { LandingScreen } from '@/features/marketing/LandingScreen';

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
/* istanbul ignore next -- @preserve */
const LoginScreen = lazyWithRetry('Login', () => import('@/features/auth/LoginScreen'), m => m.LoginScreen);
/* istanbul ignore next -- @preserve */
const RegisterScreen = lazyWithRetry('Register', () => import('@/features/auth/RegisterScreen'), m => m.RegisterScreen);
/* istanbul ignore next -- @preserve */
const CallbackScreen = lazyWithRetry('Callback', () => import('@/features/auth/CallbackScreen'), m => m.CallbackScreen);
/* istanbul ignore next -- @preserve */
const OnboardingScreen = lazyWithRetry('Onboarding', () => import('@/features/marketing/OnboardingScreen'), m => m.OnboardingScreen);
/* istanbul ignore next -- @preserve */
const DashboardScreen = lazyWithRetry('Dashboard', () => import('@/features/dashboard/DashboardScreen'), m => m.DashboardScreen);
/* istanbul ignore next -- @preserve */
const ProblemsScreen = lazyWithRetry('Problems', () => import('@/features/challenges/ChallengesScreen'), m => m.ChallengesScreen);
/* istanbul ignore next -- @preserve */
const DiscussScreen = lazyWithRetry('Discuss', () => import('@/features/social/DiscussScreen'), m => m.DiscussScreen);
/* istanbul ignore next -- @preserve */
const LeaderboardScreen = lazyWithRetry('Leaderboard', () => import('@/features/leaderboard/LeaderboardScreen'), m => m.LeaderboardScreen);
/* istanbul ignore next -- @preserve */
const ProfileScreen = lazyWithRetry('Profile', () => import('@/features/profile/ProfileScreen'), m => m.ProfileScreen);
/* istanbul ignore next -- @preserve */
const SettingsScreen = lazyWithRetry('Settings', () => import('@/features/profile/SettingsScreen'), m => m.SettingsScreen);
/* istanbul ignore next -- @preserve */
const ArenaScreen = lazyWithRetry('Arena', () => import('@/features/arena/ArenaScreen'), m => m.ArenaScreen);
/* istanbul ignore next -- @preserve */
const ReplayScreen = lazyWithRetry('Replay', () => import('@/features/replay/ReplayScreen'), m => m.ReplayScreen);
/* istanbul ignore next -- @preserve */
const DailyChallengeScreen = lazyWithRetry('DailyChallenge', () => import('@/features/challenges/DailyChallengeScreen'), m => m.DailyChallengeScreen);
/* istanbul ignore next -- @preserve */
const AssessmentListScreen = lazyWithRetry('AssessmentList', () => import('@/features/assessments/screens/AssessmentListScreen'), m => m.AssessmentListScreen);
/* istanbul ignore next -- @preserve */
const AssessmentBuilderScreen = lazyWithRetry('AssessmentBuilder', () => import('@/features/assessments/screens/AssessmentIDEScreen'), m => m.AssessmentIDEScreen);
/* istanbul ignore next -- @preserve */
const AssessmentResultsDashboardScreen = lazyWithRetry('AssessmentResultsDashboard', () => import('@/features/assessments/screens/AssessmentResultsDashboardScreen'), m => m.AssessmentResultsDashboardScreen);
/* istanbul ignore next -- @preserve */
const AssessmentLandingScreen = lazyWithRetry('AssessmentLanding', () => import('@/features/assessments/screens/AssessmentLandingScreen'), m => m.AssessmentLandingScreen);
/* istanbul ignore next -- @preserve */
const AssessmentFlowScreen = lazyWithRetry('AssessmentFlow', () => import('@/features/assessments/screens/AssessmentFlowScreen'), m => m.AssessmentFlowScreen);
/* istanbul ignore next -- @preserve */
const AssessmentResultsScreen = lazyWithRetry('AssessmentResults', () => import('@/features/assessments/screens/AssessmentResultsScreen'), m => m.AssessmentResultsScreen);
/* istanbul ignore next -- @preserve */
const ScorecardScreen = lazyWithRetry('Scorecard', () => import('@/features/assessments/screens/ScorecardScreen'), m => m.ScorecardScreen);
/* istanbul ignore next -- @preserve */
const HiringScreen = lazyWithRetry('Hiring', () => import('@/features/teams/TeamsScreen'), m => m.TeamsScreen);
/* istanbul ignore next -- @preserve */
const HiringManagersScreen = lazyWithRetry('ForHiringManagers', () => import('@/features/marketing/HiringManagersScreen'), m => m.HiringManagersScreen);
/* istanbul ignore next -- @preserve */
const GuestArenaScreen = lazyWithRetry('GuestArena', () => import('@/features/arena/GuestArenaScreen'), m => m.GuestArenaScreen);
/* istanbul ignore next -- @preserve */
const PublicProfileScreen = lazyWithRetry('PublicProfile', () => import('@/features/profile/PublicProfileScreen'), m => m.PublicProfileScreen);
/* istanbul ignore next -- @preserve */
const ShareScreen = lazyWithRetry('Share', () => import('@/features/social/ShareScreen'), m => m.ShareScreen);
/* istanbul ignore next -- @preserve */
const CertificateScreen = lazyWithRetry('Certificate', () => import('@/features/profile/CertificateScreen'), m => m.CertificateScreen);
/* istanbul ignore next -- @preserve */
const OrgManagementScreen = lazyWithRetry('OrgManagement', () => import('@/features/teams/OrgManagementScreen'), m => m.OrgManagementScreen);
/* istanbul ignore next -- @preserve */
const OrgJoinScreen = lazyWithRetry('OrgJoin', () => import('@/features/teams/OrgJoinScreen'), m => m.OrgJoinScreen);
/* istanbul ignore next -- @preserve */
const BookmarksScreen = lazyWithRetry('Bookmarks', () => import('@/features/challenges/BookmarksScreen'), m => m.BookmarksScreen);
/* istanbul ignore next -- @preserve */
const ModelsScreen = lazyWithRetry('Models', () => import('@/features/marketing/ModelsScreen'), m => m.ModelsScreen);
/* istanbul ignore next -- @preserve */
const ModelScreen = lazyWithRetry('ModelDetail', () => import('@/features/marketing/ModelScreen'), m => m.ModelScreen);
/* istanbul ignore next -- @preserve */
const ProjectListScreen = lazyWithRetry('ProjectList', () => import('@/features/ide/ProjectListScreen'), m => m.ProjectListScreen);
/* istanbul ignore next -- @preserve */
const IDEScreen = lazyWithRetry('IDE', () => import('@/features/ide/IDEScreen'), m => m.IDEScreen);
/* istanbul ignore next -- @preserve */
const TakeHomeScreen = lazyWithRetry('TakeHome', () => import('@/features/ide/TakeHomeScreen'), m => m.TakeHomeScreen);
/* istanbul ignore next -- @preserve */
const IntelligenceScreen = lazyWithRetry('Intelligence', () => import('@/features/intelligence/IntelligenceScreen'), m => m.IntelligenceScreen);
const AdminActivationScreen = lazyWithRetry('AdminActivation', () => import('@/features/admin/AdminActivationScreen'), m => m.AdminActivationScreen);
/* istanbul ignore next -- @preserve */
const NotFoundScreen = lazyWithRetry('NotFound', () => import('@/features/marketing/NotFoundScreen'), m => m.NotFoundScreen);

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
      contexts: { react: { componentStack: /* istanbul ignore next -- @preserve */ info.componentStack ?? undefined } },
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
            /* istanbul ignore next -- @preserve */
            style={({ pressed }: { pressed: boolean }) => [
              styles.reloadBtn,
              /* istanbul ignore next -- @preserve */
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
      /* istanbul ignore next -- @preserve */
      if (event === 'SIGNED_OUT') {
        /* istanbul ignore next -- @preserve */
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
          <Stack.Screen name="Scorecard" component={ScorecardScreen} />
          <Stack.Screen name="Hiring" component={HiringScreen} />
          <Stack.Screen name="ForHiringManagers" component={HiringManagersScreen} />
          <Stack.Screen name="GuestArena" component={GuestArenaScreen} />
          <Stack.Screen name="PublicProfile" component={PublicProfileScreen} />
          <Stack.Screen name="Share" component={ShareScreen} />
          <Stack.Screen name="Certificate" component={CertificateScreen} />
          <Stack.Screen name="OrgManagement" component={OrgManagementScreen} />
          <Stack.Screen name="OrgJoin" component={OrgJoinScreen} />
          <Stack.Screen name="Bookmarks" component={BookmarksScreen} />
          <Stack.Screen name="Models" component={ModelsScreen} />
          <Stack.Screen name="ModelDetail" component={ModelScreen} />
          <Stack.Screen name="ProjectList" component={ProjectListScreen} />
          <Stack.Screen name="IDE" component={IDEScreen} />
          <Stack.Screen name="TakeHome" component={TakeHomeScreen} />
          <Stack.Screen name="Intelligence" component={IntelligenceScreen} />
          <Stack.Screen name="AdminActivation" component={AdminActivationScreen} />
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
