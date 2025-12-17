import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Easing } from 'react-native';
import { useColors } from '../theme';

type Props = {
  isRunner?: boolean;
};

/**
 * TypingIndicator - Shows when someone is typing/thinking
 * Uses animated dots that match the Ruwt brand aesthetic
 */
export default function TypingIndicator({ isRunner = true }: Props) {
  const colors = useColors();
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    const createDotAnimation = (dotValue: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dotValue, {
            toValue: 1,
            duration: 300,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(dotValue, {
            toValue: 0,
            duration: 300,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.delay(600 - delay), // Sync timing
        ])
      );
    };
    
    const anim1 = createDotAnimation(dot1, 0);
    const anim2 = createDotAnimation(dot2, 150);
    const anim3 = createDotAnimation(dot3, 300);
    
    anim1.start();
    anim2.start();
    anim3.start();
    
    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
    };
  }, [dot1, dot2, dot3]);
  
  const bubbleColor = isRunner ? colors.runnerBubble : colors.userBubble;
  const dotColor = isRunner ? colors.accent : colors.userBubbleText;
  
  const createDotStyle = (animValue: Animated.Value) => ({
    backgroundColor: dotColor,
    transform: [
      {
        translateY: animValue.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -4],
        }),
      },
    ],
    opacity: animValue.interpolate({
      inputRange: [0, 1],
      outputRange: [0.4, 1],
    }),
  });
  
  return (
    <View style={[styles.bubble, { backgroundColor: bubbleColor }]}>
      <Animated.View style={[styles.dot, createDotStyle(dot1)]} />
      <Animated.View style={[styles.dot, createDotStyle(dot2)]} />
      <Animated.View style={[styles.dot, createDotStyle(dot3)]} />
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
    gap: 6,
    alignSelf: 'flex-start',
    marginVertical: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

