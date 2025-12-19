import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useColors } from '../theme';
import SineWaveLoader from './SineWaveLoader';
import * as Updates from 'expo-updates';
type Props = {
  message?: string;
};


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
/**
 * LoadingScreen - Full-page loading state with Ruwt branding
 */
export default function LoadingScreen({ message }: Props) {
  const colors = useColors();
  
  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Text style={[styles.logo, { color: colors.text }]}>Ruwt</Text>
      <SineWaveLoader size="large" style={styles.loader} />
      {message && (
        <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text>
      )}
    <UpdateInfo />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  logo: {
    fontSize: 42,
    fontWeight: '300',
    fontFamily: 'Georgia',
    letterSpacing: -0.5,
    marginBottom: 48,
  },
  loader: {
    marginBottom: 32,
  },
  message: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
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

