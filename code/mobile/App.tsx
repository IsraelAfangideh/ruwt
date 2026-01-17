import { LogBox } from 'react-native';

// Disable LogBox warnings during E2E tests (mock mode)
if (process.env.EXPO_PUBLIC_MOCK_MODE === 'true') {
  LogBox.ignoreAllLogs(true);
}

import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, ListRenderItem, useColorScheme, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Runner, MOCK_RUNNERS } from '@ruwt/shared';
import { ENDPOINTS, useMockMode, mockFetch } from './src/config';
import ChatScreen from './src/screens/ChatScreen';
import AboutScreen from './src/screens/AboutScreen';
import { ThemeProvider, useColors, colors } from './src/theme';

// --- Custom Navigation Themes ---
const RuwtLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.light.accent,
    background: colors.light.bg,
    card: colors.light.bgElevated,
    text: colors.light.text,
    border: colors.light.border,
  },
};

const RuwtDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.dark.accent,
    background: colors.dark.bg,
    card: colors.dark.bgElevated,
    text: colors.dark.text,
    border: colors.dark.border,
  },
};

// --- Runner List Component ---
function RunnerListScreen({ navigation }: any) {
  const themeColors = useColors();
  const [runners, setRunners] = useState<Runner[]>(() => MOCK_RUNNERS);

  const normalizeName = (name: string) => name.trim().toLowerCase();
  const runnerSignature = (list: Runner[]) =>
    list
      .map((runner) => `${normalizeName(runner.name)}|${runner.kind}|${runner.personality}`)
      .sort()
      .join('||');
  const mergeRunnersByName = (apiRunners: Runner[], baseRunners: Runner[]) => {
    const baseByName = new Map(baseRunners.map((runner) => [normalizeName(runner.name), runner]));

    return apiRunners.map((runner) => {
      const match = baseByName.get(normalizeName(runner.name));
      if (!match) {
        return runner;
      }

      return {
        ...runner,
        id: match.id,
      };
    });
  };

  useEffect(() => {
    mockFetch(ENDPOINTS.runners, { method: 'GET' })
      .then((res) => res.json())
      .then((data: Runner[]) => {
        if (!Array.isArray(data)) {
          return;
        }

        const merged = mergeRunnersByName(data, MOCK_RUNNERS);
        setRunners((prev) => {
          const nextSignature = runnerSignature(merged);
          const prevSignature = runnerSignature(prev);
          if (nextSignature === prevSignature) {
            return prev;
          }

          const prevOrder = new Map(prev.map((runner, index) => [normalizeName(runner.name), index]));
          const ordered = [...merged].sort((a, b) => {
            const aOrder = prevOrder.get(normalizeName(a.name));
            const bOrder = prevOrder.get(normalizeName(b.name));
            if (aOrder != null && bOrder != null) {
              return aOrder - bOrder;
            }
            if (aOrder != null) {
              return -1;
            }
            if (bOrder != null) {
              return 1;
            }
            return normalizeName(a.name).localeCompare(normalizeName(b.name));
          });

          return ordered;
        });
      })
      .catch((err: Error) => {
        console.error('Error fetching runners:', err);
      });
  }, []);

  const renderItem: ListRenderItem<Runner> = ({ item }) => (
    <View style={[styles.card, { backgroundColor: themeColors.bgElevated, borderColor: themeColors.border }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.name, { color: themeColors.text }]}>{item.name}</Text>
        {item.kind && (
          <View style={[styles.chip, { backgroundColor: themeColors.bg, borderColor: themeColors.border }]}>
            <Text style={[styles.chipText, { color: themeColors.textMuted }]}>{item.kind}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.personality, { color: themeColors.textMuted }]}>{item.personality}</Text>
      <TouchableOpacity 
        style={[styles.button, { backgroundColor: themeColors.accent }]}
        onPress={() => navigation.navigate('Chat', { runner: item })}
      >
        <Text style={[styles.buttonText, { color: themeColors.userBubbleText }]}>Chat</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={[
      styles.container,
      {
        backgroundColor: themeColors.bg,
        paddingTop: Platform.OS === 'web' ? 24 : 50,
      }
    ]}>
      {Platform.OS !== 'web' && (
        <Text style={[styles.header, { color: themeColors.text }]}>Ruwt</Text>
      )}
      {Platform.OS === 'web' && (
        <Text style={[
          styles.subtitle,
          styles.subtitleWeb,
          { color: themeColors.textMuted }
        ]}>
          Choose a runner to craft a clear, human reply.
        </Text>
      )}
      <FlatList
        data={runners}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.list,
          Platform.OS === 'web' && styles.listWeb
        ]}
      />
    </SafeAreaView>
  );
}

// --- Navigation Setup ---
const Stack = createNativeStackNavigator();

// Web linking config for deep links
const linking = {
  prefixes: ['http://localhost:8081', 'https://ruwt.social'],
  config: {
    screens: {
      Runners: '',
      Chat: 'chat',
      About: 'about',
    },
  },
};

function AppContent() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const themeColors = useColors();
  const isMockMode = useMockMode();
  
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {isMockMode && (
        <View style={styles.mockBanner}>
          <Text style={styles.mockBannerText}>⚠️ MOCK MODE ACTIVE</Text>
        </View>
      )}
      <NavigationContainer 
        linking={linking}
        theme={isDark ? RuwtDarkTheme : RuwtLightTheme}
      >
        <Stack.Navigator
          screenOptions={{
            headerStyle: {
              backgroundColor: themeColors.bgElevated,
            },
            headerTintColor: themeColors.accent,
            headerTitleStyle: {
              color: themeColors.text,
              fontWeight: '600',
            },
          }}
        >
          <Stack.Screen 
            name="Runners" 
            component={RunnerListScreen} 
            options={({ navigation }) => ({ 
              headerShown: Platform.OS === 'web',
              title: 'RUWT',
              headerRight: Platform.OS === 'web' ? () => (
                <View style={{ paddingRight: 16 }}>
                  <TouchableOpacity onPress={() => navigation.navigate('About')}>
                    <Text style={{ color: themeColors.accent, fontSize: 18 }}>About</Text>
                  </TouchableOpacity>
                </View>
              ) : undefined,
            })}
          />
          <Stack.Screen 
            name="Chat" 
            component={ChatScreen} 
            options={({ route }: any) => ({ title: route.params?.runner?.name || 'Rewrite' })}
          />
          <Stack.Screen 
            name="About" 
            component={AboutScreen} 
            options={{ title: 'About Ruwt' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    fontSize: 36,
    fontWeight: '300',
    textAlign: 'center',
    marginBottom: 24,
    fontFamily: 'Georgia',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 18,
    paddingHorizontal: 20,
  },
  subtitleWeb: {
    textAlign: 'center',
    alignSelf: 'center',
    maxWidth: 520,
    lineHeight: 22,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  listWeb: {
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center',
    paddingTop: 6,
  },
  card: {
    width: '100%',
    padding: 24,
    borderRadius: 20,
    marginBottom: 18,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: 'capitalize',
  },
  name: {
    fontSize: 22,
    fontWeight: '500',
    fontFamily: 'Georgia',
  },
  personality: {
    fontSize: 15,
    marginBottom: 18,
    lineHeight: 22,
  },
  button: {
    minHeight: 44,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontWeight: '600',
    fontSize: 15,
    letterSpacing: 0.5,
  },
  mockBanner: {
    backgroundColor: '#dc2626',
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    zIndex: 9999,
  },
  mockBannerText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
});
