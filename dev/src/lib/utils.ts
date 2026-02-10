import type { StyleProp, ViewStyle, TextStyle } from 'react-native';

/** Flatten style arrays for RN (simple merge - no tailwind) */
export function flattenStyle<T extends ViewStyle | TextStyle>(
  style: StyleProp<T>
): T | undefined {
  if (style == null) return undefined;
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.filter(Boolean)) as T;
  }
  return style as T;
}
