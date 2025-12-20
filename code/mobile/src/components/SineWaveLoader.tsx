import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Easing, ViewStyle } from 'react-native';
import { useColors } from '../theme';

type Props = {
  width?: number;
  height?: number;
  style?: ViewStyle;
  size?: 'small' | 'medium' | 'large';
};

/**
 * SineWaveLoader - Animated loading indicator matching Ruwt brand
 * 
 * Matches the animation from brand/mark/svg/animated_hero_replica.svg:
 * - Runner dot moves horizontally between ~20% and ~80% of width
 * - 4 second round trip (2s each direction)
 * - Sender/Receiver poles pulse with opacity and scale
 * - Runner has glow effect
 */
export default function SineWaveLoader({ 
  width: customWidth, 
  height: customHeight, 
  style,
  size = 'medium' 
}: Props) {
  const colors = useColors();
  
  // Animation values
  const runnerAnim = useRef(new Animated.Value(0)).current;
  const senderPulse = useRef(new Animated.Value(0)).current;
  const receiverPulse = useRef(new Animated.Value(0)).current;
  
  // Size presets - proportions match SVG viewBox (440x240 with content at 400x200)
  const sizes = {
    small: { width: 100, height: 30, dotSize: 6, poleSize: 6 },
    medium: { width: 200, height: 50, dotSize: 6, poleSize: 6 },
    large: { width: 300, height: 60, dotSize: 6, poleSize: 6 },
  };
  
  const { width, height, dotSize, poleSize } = {
    ...sizes[size],
    width: customWidth ?? sizes[size].width,
    height: customHeight ?? sizes[size].height,
  };
  
  // Start animations (matching SVG timing exactly)
  useEffect(() => {
    // Runner animation: 4s round trip (2s each way), ease-in-out
    const runnerAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(runnerAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(runnerAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    
    // Sender pulse: 2s cycle, ease-in-out
    const senderAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(senderPulse, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(senderPulse, {
          toValue: 0,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    
    // Receiver pulse: 2s cycle with 0.5s delay, ease-in-out
    const receiverAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(receiverPulse, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(receiverPulse, {
          toValue: 0,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    
    runnerAnimation.start();
    senderAnimation.start();
    // Start receiver with delay to match SVG
    setTimeout(() => receiverAnimation.start(), 500);
    
    return () => {
      runnerAnimation.stop();
      senderAnimation.stop();
      receiverAnimation.stop();
    };
  }, [runnerAnim, senderPulse, receiverPulse]);
  
  // Runner position: moves from 20% to 80% of width (matching SVG cx:80 to cx:320 in 400px)
  const runnerTranslateX = runnerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [width * 0.2, width * 0.8 - dotSize],
  });
  
  // Sender pulse: opacity 0.7 -> 1 -> 0.7, scale 1 -> 1.25 -> 1
  const senderOpacity = senderPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.7, 1],
  });
  const senderScale = senderPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.25],
  });
  
  // Receiver pulse: same as sender
  const receiverOpacity = receiverPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.7, 1],
  });
  const receiverScale = receiverPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.25],
  });
  
  return (
    <View style={[styles.container, { width, height }, style]}>
      {/* Sender Dot (left) */}
      <Animated.View 
        style={[
          styles.pole, 
          { 
            backgroundColor: colors.textSubtle,
            width: poleSize * 2,
            height: poleSize * 2,
            borderRadius: poleSize,
            left: 0,
            opacity: senderOpacity,
            transform: [{ scale: senderScale }],
          }
        ]} 
      />
      
      {/* Receiver Dot (right) */}
      <Animated.View 
        style={[
          styles.pole, 
          { 
            backgroundColor: colors.textSubtle,
            width: poleSize * 2,
            height: poleSize * 2,
            borderRadius: poleSize,
            right: 0,
            opacity: receiverOpacity,
            transform: [{ scale: receiverScale }],
          }
        ]} 
      />
      
      {/* Runner Glow (behind runner dot) */}
      <Animated.View
        style={[
          styles.runnerGlow,
          {
            backgroundColor: colors.accent,
            width: dotSize * 2.5,
            height: dotSize * 2.5,
            borderRadius: dotSize * 1.25,
            opacity: 0.2,
            transform: [{ translateX: runnerTranslateX }],
          },
        ]}
      />
      
      {/* Runner Dot (the moving one) */}
      <Animated.View
        style={[
          styles.runnerDot,
          {
            backgroundColor: colors.accent,
            shadowColor: colors.accent,
            width: dotSize * 2,
            height: dotSize * 2,
            borderRadius: dotSize,
            transform: [{ translateX: runnerTranslateX }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    justifyContent: 'center',
  },
  pole: {
    position: 'absolute',
    top: '50%',
    marginTop: -6,
  },
  runnerGlow: {
    position: 'absolute',
    top: '50%',
    marginTop: -7.5,
  },
  runnerDot: {
    position: 'absolute',
    top: '50%',
    marginTop: -6,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 6,
  },
});
