import React from 'react';
import { View, StyleSheet, type ViewProps, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

interface CardProps extends ViewProps {
  children: React.ReactNode;
  variant?: 'elevated' | 'outlined' | 'flat';
  padding?: 'none' | 'small' | 'medium' | 'large';
  style?: StyleProp<ViewStyle>;
}

export function Card({
  children,
  variant = 'elevated',
  padding = 'medium',
  style,
  ...props
}: CardProps) {
  const { colors, isDark } = useTheme();

  const getContainerStyle = (): StyleProp<ViewStyle> => {
    let baseStyle: ViewStyle = {
      backgroundColor: colors.card,
      borderRadius: 16,
      overflow: 'hidden',
    };

    switch (padding) {
      case 'small':
        baseStyle.padding = 12;
        break;
      case 'medium':
        baseStyle.padding = 16;
        break;
      case 'large':
        baseStyle.padding = 24;
        break;
      case 'none':
        baseStyle.padding = 0;
        break;
    }

    switch (variant) {
      case 'elevated':
        if (isDark) {
          baseStyle.borderWidth = 1;
          baseStyle.borderColor = colors.border;
        } else {
          baseStyle.shadowColor = '#000';
          baseStyle.shadowOffset = { width: 0, height: 2 };
          baseStyle.shadowOpacity = 0.05;
          baseStyle.shadowRadius = 8;
          baseStyle.elevation = 2;
        }
        break;
      case 'outlined':
        baseStyle.borderWidth = 1;
        baseStyle.borderColor = colors.border;
        break;
      case 'flat':
        baseStyle.backgroundColor = colors.surfaceAlt;
        break;
    }

    return baseStyle;
  };

  return (
    <View style={[getContainerStyle(), style]} {...props}>
      {children}
    </View>
  );
}
