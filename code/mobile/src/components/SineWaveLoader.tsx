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
 * Shows a runner dot moving between two poles with a wave motion
 */
export default function SineWaveLoader({ 
  width: customWidth, 
  height: customHeight, 
  style,
  size = 'medium' 
}: Props) {
  const colors = useColors();
  const animatedValue = useRef(new Animated.Value(0)).current;
  
  // Size presets
  const sizes = {
    small: { width: 80, height: 30, dotSize: 8, poleSize: 5 },
    medium: { width: 160, height: 50, dotSize: 10, poleSize: 6 },
    large: { width: 240, height: 70, dotSize: 14, poleSize: 8 },
  };
  
  const { width, height, dotSize, poleSize } = {
    ...sizes[size],
    width: customWidth ?? sizes[size].width,
    height: customHeight ?? sizes[size].height,
  };
  
  const amplitude = height / 3;
  
  // Start ping-pong animation
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    
    return () => animation.stop();
  }, [animatedValue]);
  
  // Animated dot position
  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [poleSize, width - poleSize - dotSize],
  });
  
  // Sine wave Y position - creates smooth wave motion
  const translateY = animatedValue.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0, -amplitude, 0, amplitude * 0.7, 0],
  });
  
  // Opacity pulse for glow effect
  const opacity = animatedValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.9, 1, 0.9],
  });
  
  return (
    <View style={[styles.container, { width, height }, style]}>
      {/* Connection line */}
      <View 
        style={[
          styles.line, 
          { 
            backgroundColor: colors.accent,
            opacity: 0.2,
            width: width - (poleSize * 2),
            left: poleSize,
          }
        ]} 
      />
      
      {/* Left pole */}
      <View 
        style={[
          styles.pole, 
          { 
            backgroundColor: colors.textSubtle,
            width: poleSize * 2,
            height: poleSize * 2,
            borderRadius: poleSize,
            left: 0,
          }
        ]} 
      />
      
      {/* Right pole */}
      <View 
        style={[
          styles.pole, 
          { 
            backgroundColor: colors.textSubtle,
            width: poleSize * 2,
            height: poleSize * 2,
            borderRadius: poleSize,
            right: 0,
          }
        ]} 
      />
      
      {/* Animated runner dot */}
      <Animated.View
        style={[
          styles.runnerDot,
          {
            backgroundColor: colors.accent,
            shadowColor: colors.accent,
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            opacity,
            transform: [
              { translateX },
              { translateY },
            ],
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
  line: {
    position: 'absolute',
    height: 2,
    top: '50%',
    marginTop: -1,
  },
  pole: {
    position: 'absolute',
    top: '50%',
    transform: [{ translateY: -6 }],
  },
  runnerDot: {
    position: 'absolute',
    top: '50%',
    marginTop: -5,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 6,
  },
});
