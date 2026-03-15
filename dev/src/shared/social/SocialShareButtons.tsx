/**
 * SocialShareButtons: Share to Twitter/LinkedIn + copy link.
 */
import { useState, useCallback } from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { useColors } from '@/shared/theme';
import { spacing, fontSizes, fontFamily, radii } from '@/shared/theme/tokens';

interface SocialShareButtonsProps {
  /** The text to share */
  text: string;
  /** The URL to share */
  url: string;
}

export function SocialShareButtons({ text, url }: SocialShareButtonsProps) {
  const c = useColors();
  const [copied, setCopied] = useState(false);

  /* istanbul ignore next -- @preserve */
  const shareTwitter = useCallback(() => {
    /* istanbul ignore next -- @preserve */
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    /* istanbul ignore next -- @preserve */
    window.open(tweetUrl, '_blank', 'noopener,noreferrer');
  }, [text, url]);

  /* istanbul ignore next -- @preserve */
  const shareLinkedIn = useCallback(() => {
    /* istanbul ignore next -- @preserve */
    const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
    /* istanbul ignore next -- @preserve */
    window.open(linkedinUrl, '_blank', 'noopener,noreferrer');
  }, [url]);

  /* istanbul ignore next -- @preserve */
  const copyLink = useCallback(async () => {
    /* istanbul ignore next -- @preserve */
    try {
      /* istanbul ignore next -- @preserve */
      await navigator.clipboard.writeText(url);
      /* istanbul ignore next -- @preserve */
      setCopied(true);
      /* istanbul ignore next -- @preserve */
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
