/**
 * Root navigator — switches between auth screens and app screens based on user state.
 */
import { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '@/lib/AuthContext';
import { linking } from './linking';
import type { RootStackParamList } from './types';

// Screens
import { LandingScreen } from '@/screens/LandingScreen';
import { LoginScreen } from '@/screens/LoginScreen';
import { RegisterScreen } from '@/screens/RegisterScreen';
import { CallbackScreen } from '@/screens/CallbackScreen';
import { DashboardScreen } from '@/screens/DashboardScreen';
import { LogMealScreen } from '@/screens/LogMealScreen';
import { LogWorkoutScreen } from '@/screens/LogWorkoutScreen';
import { FoodSearchScreen } from '@/screens/FoodSearchScreen';
import { ProgressScreen } from '@/screens/ProgressScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  const { user, loading } = useAuth();
  const navRef = useRef<any>(null);

  // On sign-out (user becomes null), reset to Landing
  const prevUserRef = useRef(user);
  useEffect(() => {
    if (prevUserRef.current && !user && navRef.current) {
      navRef.current.reset({ index: 0, routes: [{ name: 'Landing' }] });
    }
    prevUserRef.current = user;
  }, [user]);

  if (loading) return null;

  return (
    <NavigationContainer linking={linking} ref={navRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          // Auth screens
          <>
            <Stack.Screen name="Landing" component={LandingScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="Callback" component={CallbackScreen} />
          </>
        ) : (
          // App screens
          <>
            <Stack.Screen name="Dashboard" component={DashboardScreen} />
            <Stack.Screen name="LogMeal" component={LogMealScreen} />
            <Stack.Screen name="LogWorkout" component={LogWorkoutScreen} />
            <Stack.Screen name="FoodSearch" component={FoodSearchScreen} />
            <Stack.Screen name="Progress" component={ProgressScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
