import React from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
  type TextStyle
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
export type ButtonSize = 'small' | 'medium' | 'large';

interface ButtonProps extends PressableProps {
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  icon?: React.ReactNode;
}

export function Button({
  title,
  variant = 'primary',
  size = 'medium',
  loading = false,
  disabled = false,
  style,
  textStyle,
  icon,
  ...props
}: ButtonProps) {
  const { colors, isDark } = useTheme();

  const getContainerStyle = (): StyleProp<ViewStyle> => {
    let baseStyle: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      gap: 8,
    };

    switch (size) {
      case 'small':
        baseStyle.paddingVertical = 8;
        baseStyle.paddingHorizontal = 16;
        break;
      case 'medium':
        baseStyle.paddingVertical = 14;
        baseStyle.paddingHorizontal = 24;
        break;
      case 'large':
        baseStyle.paddingVertical = 18;
        baseStyle.paddingHorizontal = 32;
        break;
    }

    switch (variant) {
      case 'primary':
        baseStyle.backgroundColor = disabled ? colors.surfaceAlt : colors.primary;
        break;
      case 'secondary':
        baseStyle.backgroundColor = disabled ? colors.surfaceAlt : colors.card;
        baseStyle.borderWidth = 1;
        baseStyle.borderColor = colors.border;
        break;
      case 'outline':
        baseStyle.backgroundColor = 'transparent';
        baseStyle.borderWidth = 1;
        baseStyle.borderColor = disabled ? colors.border : colors.primary;
        break;
      case 'danger':
        baseStyle.backgroundColor = disabled ? colors.surfaceAlt : colors.danger;
        break;
      case 'ghost':
        baseStyle.backgroundColor = 'transparent';
        break;
    }

    if (disabled || loading) {
      baseStyle.opacity = 0.6;
    }

    return baseStyle;
  };

  const getTextStyle = (): StyleProp<TextStyle> => {
    let baseStyle: TextStyle = {
      fontWeight: '700',
      textAlign: 'center',
    };

    switch (size) {
      case 'small':
        baseStyle.fontSize = 14;
        break;
      case 'medium':
        baseStyle.fontSize = 16;
        break;
      case 'large':
        baseStyle.fontSize = 18;
        break;
    }

    switch (variant) {
      case 'primary':
      case 'danger':
        baseStyle.color = disabled ? colors.textMuted : '#FFFFFF';
        break;
      case 'secondary':
        baseStyle.color = colors.text;
        break;
      case 'outline':
      case 'ghost':
        baseStyle.color = disabled ? colors.textMuted : colors.primary;
        break;
    }

    return baseStyle;
  };

  const getRippleColor = () => {
    if (variant === 'primary' || variant === 'danger') return 'rgba(255,255,255,0.2)';
    if (isDark) return 'rgba(255,255,255,0.1)';
    return 'rgba(0,0,0,0.1)';
  };

  const textStyleObj = getTextStyle() as TextStyle;

  return (
    <Pressable
      style={[getContainerStyle(), style]}
      disabled={disabled || loading}
      android_ripple={{ color: getRippleColor() }}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={textStyleObj.color as string} />
      ) : (
        <>
          {icon}
          <Text style={[textStyleObj, textStyle]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}
