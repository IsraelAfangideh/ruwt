import { View, Text, StyleSheet } from 'react-native';
import { spacing, fontSizes, fontFamily } from '@/theme/tokens';

const FEATURES = [
  '60+ real-world challenges',
  'Hints when you get stuck',
  'Get discovered by employers',
];

export function BrandPanel() {
  return (
    <View style={styles.panel}>
      <View style={styles.content}>
        <Text style={styles.logo}>Ruwt</Text>
        <Text style={styles.tagline}>
          Get better at AI coding.{'\n'}Get discovered.
        </Text>
        <View style={styles.features}>
          {FEATURES.map((feat) => (
            <View key={feat} style={styles.featureRow}>
              <View style={styles.checkCircle}>
                <Text style={styles.check}>{'\u2713'}</Text>
              </View>
              <Text style={styles.featureText}>{feat}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: '42%',
    backgroundColor: '#1a1816',
    justifyContent: 'center',
    padding: spacing['2xl'],
  },
  content: {
    maxWidth: 380,
    alignSelf: 'center',
  },
  logo: {
    fontSize: 44,
    fontWeight: '700',
    color: '#f5f3f0',
    fontFamily: fontFamily.display,
    marginBottom: spacing.xl,
  },
  tagline: {
    fontSize: 28,
    fontWeight: '600',
    color: '#f5f3f0',
    fontFamily: fontFamily.body,
    lineHeight: 38,
    marginBottom: spacing.xl,
  },
  features: {
    gap: spacing.md,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(201, 169, 98, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    color: '#c9a962',
    fontSize: 13,
    fontWeight: '700',
  },
  featureText: {
    color: '#e8e4df',
    fontSize: fontSizes.md,
    fontFamily: fontFamily.body,
  },
});
