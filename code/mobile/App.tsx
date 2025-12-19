import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, FlatList, SafeAreaView, TouchableOpacity, ListRenderItem, useColorScheme } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Updates from 'expo-updates';
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
        setIsLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setIsLoading(false);
      });
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

// In App.tsx
function UpdateInfo() {
  const themeColors = useColors();
  const { isUpdatePending, isUpdateAvailable, isDownloading } = Updates.useUpdates();
  
  // If an update is downloaded and ready, TELL ME.
  const statusText = isUpdatePending ? 'Update Ready (Restart to Apply)' 
    : isDownloading ? 'Downloading Update...'
    : isUpdateAvailable ? 'Update Found...'
    : 'Running Latest';

  return (
    <View style={[styles.updateInfo, { 
      backgroundColor: isUpdatePending ? '#4caf50' : themeColors.bgElevated, // Green if ready to restart
      borderColor: themeColors.border 
    }]}>
      <Text style={[styles.updateInfoLabel, { color: themeColors.textMuted }]}>
        Build: {Updates.updateId ? Updates.updateId.slice(0, 8) : 'Native'}
      </Text>
      <Text style={[styles.updateInfoText, { color: themeColors.text }]}>
        {statusText}
      </Text>
      {isUpdatePending && (
        <TouchableOpacity onPress={() => Updates.reloadAsync()}>
          <Text style={{fontWeight: 'bold', color: 'white', marginTop: 4}}>TAP TO RESTART</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

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
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="Chat" 
            component={ChatScreen} 
            options={({ route }: any) => ({ title: route.params?.runner?.name || 'Peacemaker' })}
          />
        </Stack.Navigator>
      </NavigationContainer>
      <UpdateInfo />
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
  updateInfo: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  updateInfoLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  updateInfoText: {
    fontSize: 13,
    marginBottom: 4,
    fontFamily: 'System',
  },
});
