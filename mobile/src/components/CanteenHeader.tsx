import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../hooks/useAuth';
import { useCart } from '../hooks/useCart';
import { moderateScale, fontScale, verticalScale, scale, isTablet, gridColumns } from '../utils/responsive';
import { useTheme } from '../hooks/useTheme';

type CanteenHeaderProps = {
  showBackButton?: boolean;
  title?: string;
  subtitle?: string;
  showLocationIcon?: boolean;
};

export function CanteenHeader({
  showBackButton = false,
  title,
  subtitle,
  showLocationIcon = false,
}: CanteenHeaderProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { items: cartItems } = useCart();
  const { colors, isDark, toggleTheme } = useTheme();
  const styles = createStyles(colors, isDark);

  const displayTitle = title ?? user?.name ?? 'Student';
  const displaySubtitle = subtitle ?? 'Campus Canteen';

  return (
    <View style={styles.headerRow}>
      <View style={styles.headerLeft}>
        {showBackButton && (
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
        )}
        {!showBackButton && showLocationIcon && (
          <Ionicons name="location" size={26} color="#F97316" />
        )}
        <View>
          <Text style={styles.locationTitle}>
            {displayTitle}{' '}
            {!showBackButton && showLocationIcon && (
              <Ionicons name="chevron-down" size={14} color={colors.text} />
            )}
          </Text>
          {displaySubtitle ? (
            <Text style={styles.locationSubtitle}>{displaySubtitle}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.headerRight}>
        <Pressable onPress={() => router.push('/cart')} style={styles.iconButton}>
          <Ionicons name="cart-outline" size={28} color={colors.text} />
          {cartItems && cartItems.length > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartItems.length}</Text>
            </View>
          )}
        </Pressable>
        <Pressable onPress={() => router.push('/(student)/profile')} style={styles.iconButton}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {user?.name?.charAt(0).toUpperCase() ?? 'S'}
            </Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(8),
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(8),
  },
  backButton: {
    padding: moderateScale(4),
    marginRight: moderateScale(4),
  },
  locationTitle: {
    fontSize: fontScale(18),
    fontWeight: '800',
    color: colors.text,
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationSubtitle: {
    fontSize: fontScale(13),
    color: colors.textSecondary,
    fontWeight: '500',
  },
  headerRight: {
    flexDirection: 'row',
    gap: moderateScale(10),
    alignItems: 'center',
  },
  iconButton: {
    padding: moderateScale(4),
    position: 'relative',
  },
  avatarCircle: {
    width: moderateScale(36),
    height: moderateScale(36),
    borderRadius: moderateScale(18),
    backgroundColor: isDark ? "rgba(37, 99, 235, 0.2)" : '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: isDark ? "#93C5FD" : '#1D4ED8',
    fontWeight: '700',
    fontSize: fontScale(16),
  },
  cartBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#EF4444',
    width: moderateScale(18),
    height: moderateScale(18),
    borderRadius: moderateScale(9),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: isDark ? colors.background : '#FFFBEB',
  },
  cartBadgeText: {
    color: 'white',
    fontSize: fontScale(10),
    fontWeight: '800',
  },
});
