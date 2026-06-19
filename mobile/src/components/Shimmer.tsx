import React, { useEffect } from "react";
import { StyleProp, ViewStyle, StyleSheet, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { useTheme } from "../hooks/useTheme";

interface ShimmerProps {
  style?: StyleProp<ViewStyle>;
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
}

export function Shimmer({ style, width, height, borderRadius = 8 }: ShimmerProps) {
  const { isDark } = useTheme();
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 800, easing: Easing.ease }),
        withTiming(0.3, { duration: 800, easing: Easing.ease })
      ),
      -1, // Loop indefinitely
      true // Reverse
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const baseColor = isDark ? "#334155" : "#E2E8F0"; // Slate-700 for dark, Slate-200 for light

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height: height as any,
          backgroundColor: baseColor,
          borderRadius,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}
