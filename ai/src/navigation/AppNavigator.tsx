import { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '@/lib/AuthContext';
import { linking } from './linking';
import type { RootStackParamList } from './types';
import { LandingScreen } from '@/screens/LandingScreen';
import { DownloadScreen } from '@/screens/DownloadScreen';
import { BlogIndexScreen } from '@/screens/BlogIndexScreen';
import { BlogPostScreen } from '@/screens/BlogPostScreen';
import { LoginScreen } from '@/screens/LoginScreen';
import { RegisterScreen } from '@/screens/RegisterScreen';
import { CallbackScreen } from '@/screens/CallbackScreen';
import { DashboardScreen } from '@/screens/DashboardScreen';
import { HitsScreen } from '@/screens/HitsScreen';
import { OrgSettingsScreen } from '@/screens/OrgSettingsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  const { user, loading } = useAuth();
  const navRef = useRef<any>(null);
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
          <>
            <Stack.Screen name="Landing" component={LandingScreen} />
            <Stack.Screen name="Download" component={DownloadScreen} />
            <Stack.Screen name="Blog" component={BlogIndexScreen} />
            <Stack.Screen name="BlogPost" component={BlogPostScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="Callback" component={CallbackScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Dashboard" component={DashboardScreen} />
            <Stack.Screen name="Hits" component={HitsScreen} />
            <Stack.Screen name="OrgSettings" component={OrgSettingsScreen} />
            <Stack.Screen name="Callback" component={CallbackScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
