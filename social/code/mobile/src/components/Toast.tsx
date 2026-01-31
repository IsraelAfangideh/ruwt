import React, { useEffect, useMemo } from 'react';
import { Text, StyleSheet, Animated, Pressable, View } from 'react-native';
import { useColors } from '../theme';

export type ToastType = 'info' | 'success' | 'error';

interface ToastProps {
  visible: boolean;
  message: string;
  onDismiss: () => void;
  duration?: number;
  topOffset?: number;
  type?: ToastType;
}

export default function Toast({
  visible,
  message,
  onDismiss,
  duration = 2000,
  topOffset = 60,
  type = 'info',
}: ToastProps) {
  const colors = useColors();
  const opacity = React.useRef(new Animated.Value(0)).current;
  const translateY = React.useRef(new Animated.Value(-20)).current;

  const palette = useMemo(() => {
    if (type === 'success') {
      return {
        accent: colors.success,
        icon: '✓',
        iconLabel: 'Success',
      };
    }
    if (type === 'error') {
      return {
        accent: colors.error,
        icon: '!',
        iconLabel: 'Error',
      };
    }
    return {
      accent: colors.accent,
      icon: 'i',
      iconLabel: 'Info',
    };
  }, [type, colors]);

  useEffect(() => {
    if (visible) {
      // Fade in and slide up
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-dismiss after duration
      const timer = setTimeout(() => {
        // Fade out and slide down
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: -20,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => {
          onDismiss();
        });
      }, duration);

      return () => clearTimeout(timer);
    } else {
      // Reset animation values when hidden
      opacity.setValue(0);
      translateY.setValue(-20);
    }
  }, [visible, message, duration, onDismiss, opacity, translateY]);

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        {
          top: topOffset,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <Pressable
        accessibilityRole="alert"
        accessibilityLabel={`${palette.iconLabel}: ${message}. Tap to dismiss.`}
        onPress={onDismiss}
        style={[
          styles.card,
          {
            backgroundColor: colors.bgElevated,
            borderColor: colors.borderStrong,
            borderLeftColor: palette.accent,
            shadowColor: colors.text,
          },
        ]}
      >
        <View style={[styles.iconPill, { backgroundColor: palette.accent }]}>
          <Text style={[styles.iconText, { color: colors.userBubbleText }]}>{palette.icon}</Text>
        </View>
        <Text
          style={[styles.message, { color: colors.text }]}
          numberOfLines={3}
        >
          {message}
        </Text>
        <Text style={[styles.dismiss, { color: colors.textMuted }]}>×</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    zIndex: 1000,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 560,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderLeftWidth: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 6,
  },
  iconPill: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconText: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 18,
  },
  message: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
    lineHeight: 20,
  },
  dismiss: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 20,
    paddingLeft: 6,
  },
});

