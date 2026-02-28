import { View, StyleSheet } from 'react-native';
import { useTheme } from '@/theme';
import { Button } from '@/components/ui/Button';

export function ThemeToggle() {
  const { mode, setMode } = useTheme();

  return (
    <View style={styles.wrap}>
      <Button
        variant="outline"
        size="icon"
        onPress={() => setMode(mode === 'dark' ? 'light' : 'dark')}
        accessibilityLabel={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        testID="theme-toggle"
      >
        {mode === 'dark' ? '☀' : '☽'}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({ wrap: {} });
