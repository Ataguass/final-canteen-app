import React from 'react';
import { View, Text, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

export type BadgeVariant = 'primary' | 'danger' | 'success' | 'warning' | 'neutral';

interface BadgeProps {
  text?: string;
  count?: number;
  maxCount?: number;
  variant?: BadgeVariant;
  style?: StyleProp<ViewStyle>;
  isDot?: boolean;
}

export function Badge({ 
  text, 
  count, 
  maxCount = 99, 
  variant = 'primary', 
  style,
  isDot = false
}: BadgeProps) {
  const { colors } = useTheme();

  const getBackgroundColor = () => {
    switch (variant) {
      case 'primary': return colors.primary;
      case 'danger': return colors.danger;
      case 'success': return '#10B981';
      case 'warning': return '#F59E0B';
      case 'neutral': return colors.surfaceAlt;
      default: return colors.primary;
    }
  };

  const getTextColor = () => {
    if (variant === 'neutral') return colors.text;
    return '#FFFFFF';
  };

  if (isDot) {
    return (
      <View
        style={[
          styles.dot,
          { backgroundColor: getBackgroundColor() },
          style
        ]}
      />
    );
  }

  let displayText = text;
  if (count !== undefined) {
    displayText = count > maxCount ? `${maxCount}+` : count.toString();
  }

  if (!displayText) return null;

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: getBackgroundColor() },
        style
      ]}
    >
      <Text style={[styles.text, { color: getTextColor() }]}>
        {displayText}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 20,
    minHeight: 20,
  },
  text: {
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  }
});
