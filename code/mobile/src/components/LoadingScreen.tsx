import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors } from '../theme';
import SineWaveLoader from './SineWaveLoader';

type Props = {
  message?: string;
};

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
});

