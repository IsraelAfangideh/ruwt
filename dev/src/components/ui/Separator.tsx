import { View, type ViewStyle } from 'react-native';
import { useColors } from '@/theme';

export function Separator({ style, vertical }: { style?: ViewStyle; vertical?: boolean }) {
  const c = useColors();
  return (
    <View
      style={[
        { backgroundColor: c.border },
        vertical ? { width: 1, alignSelf: 'stretch' } : { height: 1, width: '100%' },
        style,
      ]}
    />
  );
}
