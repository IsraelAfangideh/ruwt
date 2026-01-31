import { Share, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';

export type ShareResult = 
  | { success: true; method: 'native' | 'web' | 'clipboard' }
  | { success: false; error: string };

/**
 * Cross-platform share utility
 * - Mobile (iOS/Android): Uses native Share.share() API
 * - Web: Uses Web Share API if available, otherwise falls back to clipboard
 */
export async function shareMessage(text: string): Promise<ShareResult> {
  try {
    // Mobile platforms - use React Native Share API
    if (Platform.OS !== 'web') {
      const result = await Share.share({
        message: text,
      });

      // Share.share() returns { action: Share.sharedAction | Share.dismissedAction }
      if (result.action === Share.sharedAction) {
        return { success: true, method: 'native' };
      } else {
        // User dismissed the share sheet
        return { success: false, error: 'Share cancelled' };
      }
    }

    // Web platform
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          text: text,
        });
        return { success: true, method: 'web' };
      } catch (error: any) {
        // User cancelled or error occurred
        if (error.name === 'AbortError') {
          return { success: false, error: 'Share cancelled' };
        }
        // If Web Share API fails, fall through to clipboard fallback
      }
    }

    // Fallback: Copy to clipboard (desktop browsers without Web Share API)
    await Clipboard.setStringAsync(text);
    return { success: true, method: 'clipboard' };
  } catch (error: any) {
    console.error('Share error:', error);
    return { success: false, error: error.message || 'Failed to share' };
  }
}

