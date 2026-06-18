import React from 'react';
import { View, Text, Image, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';

export type AvatarSize = 'small' | 'medium' | 'large' | 'xlarge';

interface AvatarProps {
  name?: string;
  imageUrl?: string;
  size?: AvatarSize;
  style?: StyleProp<ViewStyle>;
}

export function Avatar({ name, imageUrl, size = 'medium', style }: AvatarProps) {
  const { colors } = useTheme();

  const getDimensions = () => {
    switch (size) {
      case 'small': return 32;
      case 'medium': return 48;
      case 'large': return 64;
      case 'xlarge': return 96;
      default: return 48;
    }
  };

  const dim = getDimensions();
  const radius = dim / 2;

  const getInitials = (fullName?: string) => {
    if (!fullName) return '';
    const parts = fullName.trim().split(' ');
    if (parts.length === 0) return '';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const containerStyle = [
    styles.container,
    {
      width: dim,
      height: dim,
      borderRadius: radius,
      backgroundColor: colors.surfaceAlt,
    },
    style
  ];

  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={containerStyle as any}
        resizeMode="cover"
      />
    );
  }

  const initials = getInitials(name);

  return (
    <View style={containerStyle}>
      {initials ? (
        <Text style={[styles.text, { fontSize: dim * 0.4, color: colors.primary }]}>
          {initials}
        </Text>
      ) : (
        <Ionicons name="person" size={dim * 0.5} color={colors.textMuted} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  text: {
    fontWeight: '800',
  },
});
