declare module 'react-native' {
  const StyleSheet: {
    create: <T extends Record<string, unknown>>(styles: T) => T;
    absoluteFill: object;
  };
  export const View: any;
  export const Text: any;
  export const Pressable: any;
  export const ScrollView: any;
  export const TextInput: any;
  export const Image: any;
  export const ActivityIndicator: any;
  export function useColorScheme(): 'light' | 'dark' | null | undefined;
  export type ViewStyle = object;
  export type TextStyle = object;
  export type StyleProp<T> = T | T[] | undefined;
  export type TextInputProps = object;
  export { StyleSheet };
}
