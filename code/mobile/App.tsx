import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, ListRenderItem, useColorScheme, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Runner } from '@ruwt/shared';
import { ENDPOINTS } from './src/config';
import ChatScreen from './src/screens/ChatScreen';
import LoadingScreen from './src/components/LoadingScreen';
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
  const [runners, setRunners] = useState<Runner[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(ENDPOINTS.runners)
      .then((res) => res.json())
      .then((data) => {
        setRunners(data);
      })
      .catch((err: Error) => {
        console.error('Error fetching runners:', err);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const renderItem: ListRenderItem<Runner> = ({ item }) => (
    <View style={[styles.card, { backgroundColor: themeColors.bgElevated, borderColor: themeColors.border }]}>
      <Text style={[styles.name, { color: themeColors.text }]}>{item.name}</Text>
      <Text style={[styles.personality, { color: themeColors.textMuted }]}>{item.personality}</Text>
      <TouchableOpacity 
        style={[styles.button, { backgroundColor: themeColors.accent }]}
        onPress={() => navigation.navigate('Chat', { runner: item })}
      >
        <Text style={[styles.buttonText, { color: themeColors.userBubbleText }]}>Send Runner</Text>
      </TouchableOpacity>
    </View>
  );

  // Show loading screen while fetching runners
  if (isLoading) {
    return <LoadingScreen message="Gathering your runners..." />;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.bg }]}>
      <Text style={[styles.header, { color: themeColors.text }]}>Ruwt</Text>
      <FlatList
        data={runners}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

// --- Navigation Setup ---
const Stack = createNativeStackNavigator();

// Web linking config for deep links
const linking = {
  prefixes: ['http://localhost:8081'],
  config: {
    screens: {
      Runners: '',
      Chat: 'chat',
    },
  },
};

function AppContent() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const themeColors = useColors();
  
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
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
            options={({ route }: any) => ({ title: route.params?.runner?.name || 'Peacemaker' })}
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
    paddingTop: 50,
  },
  header: {
    fontSize: 36,
    fontWeight: '300',
    textAlign: 'center',
    marginBottom: 24,
    fontFamily: 'Georgia',
    letterSpacing: -0.5,
  },
  list: {
    paddingHorizontal: 20,
  },
  card: {
    padding: 24,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  name: {
    fontSize: 22,
    fontWeight: '500',
    marginBottom: 6,
    fontFamily: 'Georgia',
  },
  personality: {
    fontSize: 15,
    marginBottom: 20,
    lineHeight: 22,
  },
  button: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    fontWeight: '600',
    fontSize: 15,
    letterSpacing: 0.3,
  },
});
