/**
 * Web stub for react-native-safe-area-context (used by @react-navigation/elements).
 */
import type { ReactNode } from 'react';

const insets = { top: 0, right: 0, bottom: 0, left: 0 };

export const initialWindowMetrics = null;

export function SafeAreaProvider({ children }: { children: ReactNode }) {
  return children as React.JSX.Element;
}

export function useSafeAreaInsets() {
  return insets;
}

export function useSafeAreaFrame() {
  return { x: 0, y: 0, width: typeof window !== 'undefined' ? window.innerWidth : 1024, height: typeof window !== 'undefined' ? window.innerHeight : 768 };
}

export const SafeAreaConsumer = ({ children }: { children: (i: typeof insets) => ReactNode }) => children(insets) as React.JSX.Element;

export const SafeAreaInsetsContext = { Provider: SafeAreaProvider, Consumer: SafeAreaConsumer };

export default SafeAreaProvider;
