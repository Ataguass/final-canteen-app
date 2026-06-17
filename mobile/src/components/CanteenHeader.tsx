import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../hooks/useAuth';
import { useCart } from '../hooks/useCart';

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

  const displayTitle = title ?? user?.name ?? 'Student';
  const displaySubtitle = subtitle ?? 'Campus Canteen';

  return (
    <View style={styles.headerRow}>
      <View style={styles.headerLeft}>
        {showBackButton && (
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#0F172A" />
          </Pressable>
        )}
        {!showBackButton && showLocationIcon && (
          <Ionicons name="location" size={26} color="#F97316" />
        )}
        <View>
          <Text style={styles.locationTitle}>
            {displayTitle}{' '}
            {!showBackButton && showLocationIcon && (
              <Ionicons name="chevron-down" size={14} color="#0F172A" />
            )}
          </Text>
          {displaySubtitle ? (
            <Text style={styles.locationSubtitle}>{displaySubtitle}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.headerRight}>
        <Pressable onPress={() => router.push('/cart')} style={styles.iconButton}>
          <Ionicons name="cart-outline" size={28} color="#0F172A" />
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

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButton: {
    padding: 4,
    marginRight: 4,
  },
  locationTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationSubtitle: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  headerRight: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  iconButton: {
    padding: 4,
    position: 'relative',
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#1D4ED8',
    fontWeight: '700',
    fontSize: 16,
  },
  cartBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#EF4444',
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFBEB',
  },
  cartBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '800',
  },
});
