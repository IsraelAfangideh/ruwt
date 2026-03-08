/**
 * SocialShareButtons: Share to Twitter/LinkedIn + copy link.
 */
import { useState, useCallback } from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily, radii } from '@/theme/tokens';

interface SocialShareButtonsProps {
  /** The text to share */
  text: string;
  /** The URL to share */
  url: string;
}

export function SocialShareButtons({ text, url }: SocialShareButtonsProps) {
  const c = useColors();
  const [copied, setCopied] = useState(false);

  const shareTwitter = useCallback(() => {
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    window.open(tweetUrl, '_blank', 'noopener,noreferrer');
  }, [text, url]);

  const shareLinkedIn = useCallback(() => {
    const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
    window.open(linkedinUrl, '_blank', 'noopener,noreferrer');
  }, [url]);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }, [url]);

  return (
    <View style={styles.container}>
      <Pressable
        onPress={shareTwitter}
        style={[styles.button, { backgroundColor: '#1DA1F2' }]}
        testID="share-twitter"
      >
        <Text style={styles.buttonText}>Share on X</Text>
      </Pressable>

      <Pressable
        onPress={shareLinkedIn}
        style={[styles.button, { backgroundColor: '#0A66C2' }]}
        testID="share-linkedin"
      >
        <Text style={styles.buttonText}>Share on LinkedIn</Text>
      </Pressable>

      <Pressable
        onPress={copyLink}
        style={[styles.button, { backgroundColor: c.muted, borderColor: c.border, borderWidth: 1 }]}
        testID="share-copy-link"
      >
        <Text style={[styles.buttonText, { color: c.text }]}>
          {copied ? 'Copied!' : 'Copy Link'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  button: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.md,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: fontSizes.xs,
    fontWeight: '600',
    fontFamily: fontFamily.body,
  },
});
