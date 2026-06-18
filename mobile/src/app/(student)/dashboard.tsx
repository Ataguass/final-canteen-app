import { Link, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import {
  Alert,
  Image,
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  DeviceEventEmitter
} from "react-native";
import { useAuthStore } from '../../stores/useAuthStore';
import { useCartStore } from '../../stores/useCartStore';
import { useOrders } from "../../hooks/queries/useOrders";
import { useBanners } from "../../hooks/queries/useBanners";
import { useCategories, useMenuItems } from "../../hooks/queries/useMenu";
import { useFeatureSettings } from "../../hooks/queries/useSettings";
import { useToast } from "../../components/Toast";
import { moderateScale, fontScale, verticalScale, scale, isTablet, gridColumns } from '../../utils/responsive';
import { useTheme } from '../../hooks/useTheme';
import { Banner } from "../../types";

type Category = {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
};

type MenuItem = {
  id: string;
  categoryId?: string;
  name: string;
  price: number;
  stockQty: number;
  isAvailable: boolean;
  description?: string | null;
  image?: string | null;
  isTodaySpecial?: boolean;
};

const formatCurrency = (value: number): string => `₹ ${value.toFixed(2)}`;
const HORIZONTAL_GAP = 12;
const SPECIAL_CARD_WIDTH = 246;
const SPECIAL_PITCH = SPECIAL_CARD_WIDTH + HORIZONTAL_GAP;

export default function Screen() {
  const theme = useTheme();
  const { colors, isDark } = theme;
  const styles = createStyles(theme);
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const { user, accessToken } = useAuthStore();
  const { items: cartItems, addItem } = useCartStore();
  const { showToast } = useToast();
  const cartItemsCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const bannerScrollRef = useRef<ScrollView | null>(null);
  const specialScrollRef = useRef<ScrollView | null>(null);
  const bannerIndexRef = useRef(0);
  const specialIndexRef = useRef(0);
  const bannerInteractingRef = useRef(false);
  const specialInteractingRef = useRef(false);

  const { data: categories = [], isLoading: isCategoriesLoading } = useCategories();
  const { data: items = [], isLoading: isItemsLoading } = useMenuItems();
  const { data: banners = [], isLoading: isBannersLoading } = useBanners();
  const { data: orders = [], isLoading: isOrdersLoading } = useOrders();
  const { data: featureSettings, isLoading: isSettingsLoading } = useFeatureSettings();

  const loading = isCategoriesLoading || isItemsLoading || isBannersLoading || isOrdersLoading || isSettingsLoading;

  const bannerCardWidth = Math.max(280, screenWidth - 32);
  const bannerPitch = bannerCardWidth + HORIZONTAL_GAP;

  const todaySpecialItemIds = useMemo(
    () => new Set(items.filter((item) => item.stockQty > 0 && item.isTodaySpecial).map((item) => item.id)),
    [items]
  );

  const todaySpecialItems = useMemo(
    () =>
      items
        .filter((item) => item.isAvailable && todaySpecialItemIds.has(item.id))
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 8),
    [items, todaySpecialItemIds]
  );

  const bannerLoopData = useMemo(
    () => (banners.length > 1 ? [...banners, ...banners, ...banners] : banners),
    [banners]
  );

  const specialLoopData = useMemo(
    () =>
      todaySpecialItems.length > 1
        ? [...todaySpecialItems, ...todaySpecialItems, ...todaySpecialItems]
        : todaySpecialItems,
    [todaySpecialItems]
  );

  const recentOrders = useMemo(
    () =>
      [...orders]
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
        .slice(0, 4),
    [orders]
  );

  const onAddToCart = (item: MenuItem) => {
    if (item.stockQty <= 0) {
      showToast("This item is currently not available.", "error");
      return;
    }
    addItem({ menuItemId: item.id, name: item.name, price: item.price }, 1);
    showToast(`${item.name} added to cart.`, "success");
  };

  const onOpenBanner = async (banner: Banner) => {
    if (!banner.actionUrl) return;
    const canOpen = await Linking.canOpenURL(banner.actionUrl);
    if (!canOpen) {
      Alert.alert("Invalid URL", "This banner action URL is not valid.");
      return;
    }
    await Linking.openURL(banner.actionUrl);
  };

  const normalizeCarouselIndex = (
    rawIndex: number,
    baseLength: number,
    pitch: number,
    ref: MutableRefObject<ScrollView | null>,
    indexRef: MutableRefObject<number>
  ) => {
    if (baseLength <= 1) return;
    if (rawIndex < baseLength) {
      const normalized = rawIndex + baseLength;
      indexRef.current = normalized;
      ref.current?.scrollTo({ x: normalized * pitch, animated: false });
      return;
    }
    if (rawIndex >= baseLength * 2) {
      const normalized = rawIndex - baseLength;
      indexRef.current = normalized;
      ref.current?.scrollTo({ x: normalized * pitch, animated: false });
      return;
    }
    indexRef.current = rawIndex;
  };

  const onBannerMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const rawIndex = Math.round(event.nativeEvent.contentOffset.x / bannerPitch);
    normalizeCarouselIndex(rawIndex, banners.length, bannerPitch, bannerScrollRef, bannerIndexRef);
    bannerInteractingRef.current = false;
  };

  const onSpecialMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const rawIndex = Math.round(event.nativeEvent.contentOffset.x / SPECIAL_PITCH);
    normalizeCarouselIndex(
      rawIndex,
      todaySpecialItems.length,
      SPECIAL_PITCH,
      specialScrollRef,
      specialIndexRef
    );
    specialInteractingRef.current = false;
  };

  useEffect(() => {
    if (banners.length <= 1) return;
    const start = banners.length;
    bannerIndexRef.current = start;
    const timer = setTimeout(() => {
      bannerScrollRef.current?.scrollTo({ x: start * bannerPitch, animated: false });
    }, 80);
    return () => clearTimeout(timer);
  }, [banners.length, bannerPitch]);

  useEffect(() => {
    if (todaySpecialItems.length <= 1) return;
    const start = todaySpecialItems.length;
    specialIndexRef.current = start;
    const timer = setTimeout(() => {
      specialScrollRef.current?.scrollTo({ x: start * SPECIAL_PITCH, animated: false });
    }, 80);
    return () => clearTimeout(timer);
  }, [todaySpecialItems.length]);

  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      if (bannerInteractingRef.current) return;
      const next = bannerIndexRef.current + 1;
      bannerIndexRef.current = next;
      bannerScrollRef.current?.scrollTo({ x: next * bannerPitch, animated: true });
      if (next >= banners.length * 2) {
        setTimeout(() => {
          bannerIndexRef.current = banners.length;
          bannerScrollRef.current?.scrollTo({ x: banners.length * bannerPitch, animated: false });
        }, 420);
      }
    }, 3400);
    return () => clearInterval(interval);
  }, [banners.length, bannerPitch]);

  useEffect(() => {
    if (todaySpecialItems.length <= 1) return;
    const interval = setInterval(() => {
      if (specialInteractingRef.current) return;
      const next = specialIndexRef.current + 1;
      specialIndexRef.current = next;
      specialScrollRef.current?.scrollTo({ x: next * SPECIAL_PITCH, animated: true });
      if (next >= todaySpecialItems.length * 2) {
        setTimeout(() => {
          specialIndexRef.current = todaySpecialItems.length;
          specialScrollRef.current?.scrollTo({
            x: todaySpecialItems.length * SPECIAL_PITCH,
            animated: false
          });
        }, 420);
      }
    }, 3600);
    return () => clearInterval(interval);
  }, [todaySpecialItems.length]);

  return (
    <View style={styles.screen}>
      <View style={styles.topHeader}>
        <View style={styles.headerLeft}>
          <Pressable onPress={() => DeviceEventEmitter.emit("openStudentDrawer")}>
            <Ionicons name="menu" size={28} color={colors.text} />
          </Pressable>
          <Text style={styles.headerUserName}>Welcome, {user?.name?.split(" ")[0] ?? "Student"}</Text>
          <Ionicons name="chevron-down" size={16} color={colors.text} />
        </View>
        <View style={styles.headerRight}>
          <Pressable onPress={() => router.push("/cart" as any)} style={styles.cartIconWrapper}>
            <Ionicons name="cart-outline" size={26} color={colors.text} />
            {cartItemsCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartItemsCount}</Text>
              </View>
            )}
          </Pressable>
          <Pressable onPress={() => router.push("/(student)/profile" as any)} style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>{user?.name?.[0]?.toUpperCase() ?? "S"}</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Pressable 
          style={styles.searchContainer} 
          onPress={() => router.push("/(student)/search")}
        >
          <Ionicons name="search" size={20} color="#FF6B35" />
          <TextInput 
            placeholder="Search for snacks, lunch..." 
            style={styles.searchInput} 
            placeholderTextColor={colors.textMuted} 
            editable={false}
            pointerEvents="none"
          />
          <View style={styles.micWrap}>
            <Ionicons name="mic" size={18} color="#FF6B35" />
          </View>
        </Pressable>

        {banners.length > 0 ? (
          <View style={styles.sectionWrap}>
            <ScrollView
              ref={bannerScrollRef}
              horizontal
              snapToInterval={bannerPitch}
              snapToAlignment="start"
              decelerationRate="fast"
              showsHorizontalScrollIndicator={false}
              onScrollBeginDrag={() => {
                bannerInteractingRef.current = true;
              }}
              onScrollEndDrag={() => {
                setTimeout(() => {
                  bannerInteractingRef.current = false;
                }, 240);
              }}
              contentContainerStyle={{ paddingRight: 16 }}
            >
              {banners.map((banner, i) => (
                <Pressable
                  key={banner.id + "_" + i}
                  onPress={() => onOpenBanner(banner)}
                  style={[
                    styles.bannerCard,
                    { width: bannerPitch - 16, marginRight: 16 }
                  ]}
                >
                  <Image
                    source={{ uri: banner.imageUrl }}
                    style={styles.bannerImage}
                    resizeMode="cover"
                  />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {categories.length > 0 ? (
          <View style={[styles.sectionWrap, { marginTop: 8 }]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalCategories}
            >
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={{
                    pathname: "/(student)/menu/[categoryId]",
                    params: { categoryId: category.id }
                  }}
                  asChild
                >
                  <Pressable style={styles.categoryCircleItem}>
                    <View style={styles.categoryCircleWrap}>
                      {category.imageUrl ? (
                        <Image
                          source={{ uri: category.imageUrl }}
                          style={styles.categoryCircleImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <Ionicons name="fast-food" size={24} color={colors.textMuted} />
                      )}
                    </View>
                    <Text style={styles.categoryCircleName} numberOfLines={1}>{category.name}</Text>
                  </Pressable>
                </Link>
              ))}
            </ScrollView>
          </View>
        ) : null}



        {todaySpecialItems.length > 0 ? (
          <View style={styles.sectionWrap}>
            <Text style={styles.sectionTitleRecommended}>RECOMMENDED FOR YOU</Text>
            <View style={styles.gridContainer}>
              {todaySpecialItems.slice(0, 6).map((item, i) => (
                <View key={item.id + "_" + i} style={styles.gridCard}>
                  <View style={styles.gridImageWrap}>
                    <Image source={{ uri: item.image || "https://via.placeholder.com/150" }} style={styles.gridImage} />
                    <Pressable style={styles.gridAddBtn} onPress={() => onAddToCart(item)}>
                       <Ionicons name="add" size={20} color="#FF6B35" />
                    </Pressable>
                  </View>
                  <Text style={styles.gridName} numberOfLines={1}>{item.name}</Text>
                  <View style={styles.gridMetaRow}>
                    <Text style={styles.gridPriceText}>₹{item.price.toFixed(0)}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}
        
        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitleRecommended}>RECENT ORDERS</Text>
            <Pressable onPress={() => router.push("/(student)/orders")}>
              <Text style={styles.linkText}>View all</Text>
            </Pressable>
          </View>
          {recentOrders.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No orders yet.</Text>
            </View>
          ) : (
            recentOrders.map((order) => (
              <Link
                key={order.id}
                href={{
                  pathname: "/(student)/orders/[id]",
                  params: { id: order.id }
                }}
                asChild
              >
                <Pressable style={styles.orderCard}>
                  <View>
                    <Text style={styles.orderNumber}>{order.orderNumber}</Text>
                    <Text style={styles.orderMeta}>Status: {order.status}</Text>
                  </View>
                  <Text style={styles.orderPrice}>
                    {formatCurrency(order.totalAmount)}
                  </Text>
                </Pressable>
              </Link>
            ))
          )}
        </View>
        <View style={{ height: moderateScale(40) }} />
      </ScrollView>
    </View>
  );
}

const createStyles = ({ colors, isDark }: { colors: any, isDark: boolean }) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: moderateScale(16),
    paddingTop: verticalScale(54),
    paddingBottom: verticalScale(12),
    backgroundColor: colors.background,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(6),
  },
  headerUserName: {
    color: colors.text,
    fontSize: fontScale(18),
    fontWeight: "800",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(16),
  },
  cartIconWrapper: {
    position: "relative",
  },
  cartBadge: {
    position: "absolute",
    top: verticalScale(-4),
    right: moderateScale(-6),
    backgroundColor: "#EF4444",
    width: moderateScale(18),
    height: moderateScale(18),
    borderRadius: moderateScale(9),
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#F8FAFC",
  },
  cartBadgeText: {
    color: "white",
    fontSize: fontScale(9),
    fontWeight: "900",
  },
  userAvatar: {
    width: moderateScale(32),
    height: moderateScale(32),
    borderRadius: moderateScale(16),
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
  },
  userAvatarText: {
    color: "#1D4ED8",
    fontWeight: "800",
    fontSize: fontScale(14),
  },
  content: {
    paddingTop: verticalScale(8),
    paddingHorizontal: moderateScale(16),
    gap: moderateScale(20),
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: moderateScale(999),
    paddingHorizontal: moderateScale(18),
    paddingVertical: moderateScale(14),
    gap: moderateScale(12),
    shadowColor: colors.text,
    shadowOpacity: 0.06,
    shadowRadius: moderateScale(12),
    shadowOffset: { width: 0, height: 4 },
    elevation: 3
  },
  searchInput: {
    flex: 1,
    fontSize: fontScale(15),
    fontWeight: "600",
    color: colors.text,
    padding: 0,
  },
  micWrap: {
    paddingLeft: moderateScale(10),
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
  },
  sectionWrap: {
    gap: moderateScale(16),
  },
  bannerCard: {
    height: moderateScale(160),
    borderRadius: moderateScale(16),
    overflow: "hidden",
    backgroundColor: colors.card,
  },
  bannerImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "#E2E8F0",
  },
  horizontalCategories: {
    gap: moderateScale(20),
    paddingRight: moderateScale(16),
    paddingVertical: moderateScale(4),
  },
  categoryCircleItem: {
    alignItems: "center",
    width: moderateScale(72),
    gap: moderateScale(8),
  },
  categoryCircleWrap: {
    width: moderateScale(72),
    height: moderateScale(72),
    borderRadius: moderateScale(36),
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryCircleImage: {
    width: "100%",
    height: "100%",
  },
  categoryCircleName: {
    fontSize: fontScale(13),
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },

  sectionTitleRecommended: {
    color: colors.textSecondary,
    fontSize: fontScale(14),
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: moderateScale(24),
  },
  gridCard: {
    width: "48%",
    gap: moderateScale(8),
  },
  gridImageWrap: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: moderateScale(20),
    backgroundColor: colors.surfaceAlt,
    overflow: "hidden",
  },
  gridImage: {
    width: "100%",
    height: "100%",
  },

  gridAddBtn: {
    position: "absolute",
    bottom: verticalScale(8),
    right: moderateScale(8),
    backgroundColor: colors.card,
    width: moderateScale(32),
    height: moderateScale(32),
    borderRadius: moderateScale(16),
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.text,
    shadowOpacity: 0.1,
    shadowRadius: moderateScale(4),
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  gridName: {
    fontSize: fontScale(16),
    fontWeight: "800",
    color: colors.text,
    marginTop: verticalScale(2),
  },
  gridMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(4),
  },
  gridMetaText: {
    fontSize: fontScale(12),
    fontWeight: "600",
    color: colors.textSecondary,
  },
  gridPriceText: {
    fontSize: fontScale(12),
    fontWeight: "700",
    color: colors.text,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  linkText: {
    color: "#FF6B35",
    fontWeight: "700",
  },
  emptyCard: {
    borderRadius: moderateScale(12),
    padding: moderateScale(14),
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: {
    color: colors.textSecondary,
    fontWeight: "600",
  },
  orderCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: moderateScale(12),
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: moderateScale(14),
    shadowColor: colors.text,
    shadowOpacity: 0.02,
    shadowRadius: moderateScale(8),
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  orderNumber: {
    color: colors.text,
    fontWeight: "800",
    fontSize: fontScale(15),
  },
  orderMeta: {
    color: colors.textSecondary,
    fontWeight: "600",
    marginTop: verticalScale(4),
  },
  orderPrice: {
    color: colors.text,
    fontWeight: "800",
    fontSize: fontScale(15),
  }
});
