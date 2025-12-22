import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, StyleSheet, Easing, ViewStyle } from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { useColors } from '../theme';

type Props = {
  width?: number;
  height?: number;
  style?: ViewStyle;
  size?: 'small' | 'medium' | 'large';
};

/**
 * SineWaveLoader - Exact replica of brand/mark/svg/animated_hero_replica.svg
 * 
 * Matches the SVG animation exactly:
 * - Sine wave path draws in over 3s with 1s delay (stroke-dasharray animation)
 * - Runner dot moves horizontally from cx:80 to cx:320 (4s round trip)
 * - Sender/Receiver dots pulse (opacity 0.7->1, radius 6->7.5) every 2s
 * - Receiver pulse has 0.5s delay
 * - Runner has glow effect (r:10, opacity:0.2)
 */
export default function SineWaveLoader({ 
  width: customWidth, 
  height: customHeight, 
  style,
  size = 'medium' 
}: Props) {
  const colors = useColors();
  
  // Animation values
  const pathDrawAnim = useRef(new Animated.Value(0)).current;
  const runnerAnim = useRef(new Animated.Value(0)).current;
  const senderPulse = useRef(new Animated.Value(0)).current;
  const receiverPulse = useRef(new Animated.Value(0)).current;
  
  // State for animated values (for SVG components that need re-renders)
  const [pathDashoffset, setPathDashoffset] = useState(600);
  const [runnerX, setRunnerX] = useState(80);
  const [senderRadius, setSenderRadius] = useState(6);
  const [senderOpacity, setSenderOpacity] = useState(0.7);
  const [receiverRadius, setReceiverRadius] = useState(6);
  const [receiverOpacity, setReceiverOpacity] = useState(0.7);
  
  // Size presets - matching SVG viewBox proportions (440x240)
  const sizes = {
    small: { width: 100, height: 60 },
    medium: { width: 200, height: 120 },
    large: { width: 300, height: 180 },
  };
  
  const { width, height } = {
    ...sizes[size],
    width: customWidth ?? sizes[size].width,
    height: customHeight ?? sizes[size].height,
  };
  
  // SVG viewBox: "-20 -20 440 240"
  const svgViewBox = '-20 -20 440 240';
  const centerY = 100;
  const pathData = 'M0,100 Q100,20 200,100 T400,100';
  
  // Start animations and update state
  useEffect(() => {
    // Path drawing: 3s animation with 1s delay, then stays drawn
    const pathAnimation = Animated.sequence([
      Animated.delay(1000), // 1s delay
      Animated.timing(pathDrawAnim, {
        toValue: 1,
        duration: 3000, // 3s draw
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false,
      }),
    ]);
    
    // Runner animation: 4s round trip (2s each way), ease-in-out, infinite
    const runnerAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(runnerAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(runnerAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    );
    
    // Sender pulse: 2s cycle, ease-in-out, infinite
    const senderAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(senderPulse, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(senderPulse, {
          toValue: 0,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    );
    
    // Receiver pulse: 2s cycle with 0.5s delay, ease-in-out, infinite
    const receiverAnimation = Animated.loop(
      Animated.sequence([
        Animated.delay(500), // 0.5s delay
        Animated.timing(receiverPulse, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(receiverPulse, {
          toValue: 0,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    );
    
    // Listeners to update state from animation values
    const pathListener = pathDrawAnim.addListener(({ value }) => {
      setPathDashoffset(600 - (600 * value));
    });
    
    const runnerListener = runnerAnim.addListener(({ value }) => {
      setRunnerX(80 + (320 - 80) * value);
    });
    
    const senderListener = senderPulse.addListener(({ value }) => {
      setSenderRadius(6 + (7.5 - 6) * value);
      setSenderOpacity(0.7 + (1 - 0.7) * value);
    });
    
    const receiverListener = receiverPulse.addListener(({ value }) => {
      setReceiverRadius(6 + (7.5 - 6) * value);
      setReceiverOpacity(0.7 + (1 - 0.7) * value);
    });
    
    pathAnimation.start();
    runnerAnimation.start();
    senderAnimation.start();
    receiverAnimation.start();
    
    return () => {
      pathAnimation.stop();
      runnerAnimation.stop();
      senderAnimation.stop();
      receiverAnimation.stop();
      pathDrawAnim.removeListener(pathListener);
      runnerAnim.removeListener(runnerListener);
      senderPulse.removeListener(senderListener);
      receiverPulse.removeListener(receiverListener);
    };
  }, [pathDrawAnim, runnerAnim, senderPulse, receiverPulse]);
  
  return (
    <View style={[styles.container, { width, height }, style]}>
      <Svg 
        width={width} 
        height={height} 
        viewBox={svgViewBox}
        style={styles.svg}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Background (matching SVG) */}
        <Rect x="-20" y="-20" width="440" height="240" fill={colors.bg} />
        
        {/* Sine Wave Path with drawing animation */}
        <Path
          d={pathData}
          stroke={colors.accent}
          strokeWidth={2}
          fill="none"
          strokeDasharray="600"
          strokeDashoffset={pathDashoffset}
        />
        
        {/* Sender Dot */}
        <Circle
          cx={0}
          cy={centerY}
          r={senderRadius}
          fill={colors.textMuted}
          opacity={senderOpacity}
        />
        
        {/* Runner Glow (follows runner) */}
        <Circle
          cx={runnerX}
          cy={centerY}
          r={10}
          fill={colors.accent}
          opacity={0.2}
        />
        
        {/* Runner Dot (the moving one) */}
        <Circle
          cx={runnerX}
          cy={centerY}
          r={6}
          fill={colors.accent}
        />
        
        {/* Receiver Dot */}
        <Circle
          cx={400}
          cy={centerY}
          r={receiverRadius}
          fill={colors.textMuted}
          opacity={receiverOpacity}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  svg: {
    width: '100%',
    height: '100%',
  },
});
