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

/** Relative timestamp string ("just now", "5m ago", "3h ago", "2d ago", "1mo ago"). */
export function timeAgo(ts: string | null): string {
  if (!ts) return '';
  const diffSec = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return 'yesterday';
  if (diffDay < 30) return `${diffDay}d ago`;
  return `${Math.floor(diffDay / 30)}mo ago`;
}

/** Convert a DB category key like "model_selection" to "Model Selection". */
export function formatCategory(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Generate the last 91 days (13 full weeks) as ISO date strings. */
export function generateHeatmapDays(): string[] {
  const days: string[] = [];
  const today = new Date();
  for (let i = 90; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
}

/** Format elapsed seconds as "m:ss". */
export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
