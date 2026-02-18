import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button } from '@/components/ui/Button';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily } from '@/theme/tokens';

export function NotFoundScreen() {
  const c = useColors();
  const navigation = useNavigation();

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <Text style={[styles.code, { color: c.accent }]}>404</Text>
      <Text style={[styles.title, { color: c.text }]}>Page not found</Text>
      <Text style={[styles.description, { color: c.textMuted }]}>
        The page you are looking for does not exist or has been moved.
      </Text>
      <Button
        onPress={() => navigation.navigate('Challenges' as never)}
        style={styles.button}
      >
        Back to Challenges
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  code: {
    fontSize: 72,
    fontWeight: '700',
    fontFamily: fontFamily.display,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: fontSizes['2xl'],
    fontWeight: '600',
    fontFamily: fontFamily.body,
    marginBottom: spacing.sm,
  },
  description: {
    fontSize: fontSizes.md,
    fontFamily: fontFamily.body,
    textAlign: 'center',
    marginBottom: spacing.xl,
    maxWidth: 400,
  },
  button: {
    minWidth: 200,
  },
});
