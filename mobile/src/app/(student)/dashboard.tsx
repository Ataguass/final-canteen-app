import { Link, useRouter } from "expo-router";
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
  View,
  useWindowDimensions
} from "react-native";
import { useAuth } from "../../hooks/useAuth";
import { useCart } from "../../hooks/useCart";
import { bannerService, type Banner } from "../../services/bannerService";
import { menuService } from "../../services/menuService";
import { orderService, type Order } from "../../services/orderService";
import { tenantService, type FeatureSettings } from "../../services/tenantService";

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
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const { user, accessToken } = useAuth();
  const { addItem } = useCart();
  const bannerScrollRef = useRef<ScrollView | null>(null);
  const specialScrollRef = useRef<ScrollView | null>(null);
  const bannerIndexRef = useRef(0);
  const specialIndexRef = useRef(0);
  const bannerInteractingRef = useRef(false);
  const specialInteractingRef = useRef(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [featureSettings, setFeatureSettings] = useState<FeatureSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const bannerCardWidth = Math.max(280, screenWidth - 32);
  const bannerPitch = bannerCardWidth + HORIZONTAL_GAP;

  const load = useCallback(async () => {
    if (!user?.tenantId || !accessToken) return;
    try {
      setLoading(true);
      const [cats, menu, bannerList, orderList, featureConfig] = await Promise.all([
        menuService.listCategories(accessToken, user.tenantId),
        menuService.listItems(accessToken, user.tenantId),
        bannerService.listBanners(accessToken, user.tenantId),
        orderService.listOrders(accessToken, user.tenantId),
        tenantService
          .getFeatureSettings(accessToken, user.tenantId)
          .catch(() => ({ success: true, data: { id: "", name: "", todaySpecialsEnabled: true } }))
      ]);
      setCategories(cats.data);
      setItems(menu.data.filter((x) => x.isAvailable));
      setBanners(bannerList.data);
      setOrders(orderList.data);
      setFeatureSettings(featureConfig.data);
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "Failed to load dashboard"
      );
    } finally {
      setLoading(false);
    }
  }, [accessToken, user?.tenantId]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const todaySpecialItemIds = useMemo(
    () => new Set(items.filter((item) => item.stockQty > 0 && item.isTodaySpecial).map((item) => item.id)),
    [items]
  );

  const todaySpecialItems = useMemo(
    () =>
      items
        .filter((item) => todaySpecialItemIds.has(item.id))
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
      Alert.alert("Out of stock", "This item is currently not available.");
      return;
    }
    addItem({ menuItemId: item.id, name: item.name, price: item.price }, 1);
    Alert.alert("Added", `${item.name} added to cart.`);
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
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Welcome, {user?.name ?? "Student"}</Text>
            <Text style={styles.heroSubtitle}>Order fresh meals in seconds</Text>
          </View>
          <Pressable
            onPress={load}
            style={styles.refreshButton}
            disabled={loading}
          >
            <Text style={styles.refreshButtonText}>
              {loading ? "Refreshing..." : "Refresh"}
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.sectionWrap}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Banner Spotlight</Text>
          <Text style={styles.sectionMeta}>{banners.length} active</Text>
        </View>

        {banners.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No active banners right now.</Text>
          </View>
        ) : (
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
            onMomentumScrollEnd={onBannerMomentumEnd}
            contentContainerStyle={styles.horizontalList}
          >
            {bannerLoopData.map((banner, index) => (
              <Pressable
                key={`${banner.id}-${index}`}
                onPress={() => onOpenBanner(banner)}
                style={[styles.bannerCard, { width: bannerCardWidth }]}
              >
                <Image
                  source={{ uri: banner.imageUrl }}
                  style={styles.bannerImage}
                  resizeMode="cover"
                />
                <View style={styles.bannerOverlay}>
                  <Text style={styles.bannerTitle}>{banner.title}</Text>
                  {banner.actionUrl ? (
                    <Text style={styles.bannerActionHint}>Tap to open</Text>
                  ) : null}
                </View>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      {(featureSettings?.todaySpecialsEnabled ?? true) ? (
        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Today's Specials</Text>
            <Pressable onPress={() => router.push("/(student)/search")}>
              <Text style={styles.linkText}>Browse all</Text>
            </Pressable>
          </View>
          {todaySpecialItems.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No special items set for today.</Text>
            </View>
          ) : (
            <ScrollView
              ref={specialScrollRef}
              horizontal
              snapToInterval={SPECIAL_PITCH}
              snapToAlignment="start"
              decelerationRate="fast"
              showsHorizontalScrollIndicator={false}
              onScrollBeginDrag={() => {
                specialInteractingRef.current = true;
              }}
              onScrollEndDrag={() => {
                setTimeout(() => {
                  specialInteractingRef.current = false;
                }, 240);
              }}
              onMomentumScrollEnd={onSpecialMomentumEnd}
              contentContainerStyle={styles.horizontalList}
            >
              {specialLoopData.map((item, index) => (
                <View key={`${item.id}-${index}`} style={styles.specialCard}>
                  {item.image ? (
                    <Image
                      source={{ uri: item.image }}
                      style={styles.specialCardImage}
                      resizeMode="cover"
                    />
                  ) : null}
                  <View style={styles.specialBadge}>
                    <Text style={styles.specialBadgeText}>TODAY SPECIAL</Text>
                  </View>
                  <Text style={styles.specialCardName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.description ? (
                    <Text style={styles.specialCardDescription} numberOfLines={2}>
                      {item.description}
                    </Text>
                  ) : (
                    <View style={{ height: 34 }} />
                  )}
                  <Text style={styles.specialCardPrice}>{formatCurrency(item.price)}</Text>
                  <View style={styles.specialActions}>
                    <Link
                      href={{
                        pathname: "/menu/item/[id]",
                        params: { id: item.id }
                      }}
                      asChild
                    >
                      <Pressable style={[styles.itemActionButton, styles.itemActionSecondary]}>
                        <Text style={styles.itemActionText}>View</Text>
                      </Pressable>
                    </Link>
                    <Pressable
                      onPress={() => onAddToCart(item)}
                      style={[styles.itemActionButton, styles.itemActionPrimary]}
                    >
                      <Text style={styles.itemActionText}>Add</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      ) : null}

      <View style={styles.sectionWrap}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Categories</Text>
          <Pressable onPress={() => router.push("/(student)/menu/index")}>
            <Text style={styles.linkText}>View all</Text>
          </Pressable>
        </View>
        {categories.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No categories available.</Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
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
                <Pressable style={styles.categoryCard}>
                  {category.imageUrl ? (
                    <Image
                      source={{ uri: category.imageUrl }}
                      style={styles.categoryImage}
                      resizeMode="cover"
                    />
                  ) : null}
                  <View style={styles.categoryBody}>
                    <Text style={styles.categoryName}>{category.name}</Text>
                    {category.description ? (
                      <Text style={styles.categoryDescription} numberOfLines={2}>
                        {category.description}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              </Link>
            ))}
          </ScrollView>
        )}
      </View>

      <View style={styles.sectionWrap}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Recent Orders</Text>
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
                <Text style={styles.orderNumber}>{order.orderNumber}</Text>
                <Text style={styles.orderMeta}>Status: {order.status}</Text>
                <Text style={styles.orderMeta}>
                  Total: {formatCurrency(order.totalAmount)}
                </Text>
              </Pressable>
            </Link>
          ))
        )}
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#EEF2F7"
  },
  content: {
    padding: 16,
    paddingBottom: 28,
    gap: 14
  },
  heroCard: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 10
  },
  heroTopRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start"
  },
  heroTitle: {
    color: "#0F172A",
    fontSize: 24,
    fontWeight: "800"
  },
  heroSubtitle: {
    color: "#64748B",
    marginTop: 2,
    fontWeight: "600"
  },
  refreshButton: {
    backgroundColor: "#0F172A",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  refreshButtonText: {
    color: "white",
    fontWeight: "700"
  },
  sectionWrap: {
    gap: 10
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  sectionTitle: {
    color: "#0F172A",
    fontSize: 19,
    fontWeight: "800"
  },
  sectionMeta: {
    color: "#64748B",
    fontWeight: "700",
    fontSize: 12
  },
  horizontalList: {
    gap: 12,
    paddingRight: 8
  },
  bannerCard: {
    height: 200,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF"
  },
  bannerImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "#E2E8F0"
  },
  bannerOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(15,23,42,0.5)"
  },
  bannerTitle: {
    color: "white",
    fontWeight: "800",
    fontSize: 16
  },
  bannerActionHint: {
    color: "#E2E8F0",
    marginTop: 2,
    fontWeight: "600",
    fontSize: 12
  },
  emptyCard: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC"
  },
  emptyText: {
    color: "#64748B",
    fontWeight: "600"
  },
  categoryCard: {
    width: 230,
    borderRadius: 14,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden"
  },
  categoryImage: {
    width: "100%",
    height: 96,
    backgroundColor: "#E2E8F0"
  },
  categoryBody: {
    padding: 11,
    gap: 4
  },
  categoryName: {
    color: "#0F172A",
    fontWeight: "800",
    fontSize: 16
  },
  categoryDescription: {
    color: "#64748B",
    fontWeight: "500"
  },
  specialCard: {
    width: 246,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FDE68A",
    backgroundColor: "#FFFBEB",
    padding: 10,
    gap: 7
  },
  specialCardImage: {
    width: "100%",
    height: 110,
    borderRadius: 10,
    backgroundColor: "#F1F5F9"
  },
  specialBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#F59E0B",
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  specialBadgeText: {
    color: "white",
    fontWeight: "800",
    fontSize: 10
  },
  specialCardName: {
    color: "#0F172A",
    fontWeight: "800",
    fontSize: 16
  },
  specialCardDescription: {
    color: "#64748B",
    minHeight: 34
  },
  specialCardPrice: {
    color: "#92400E",
    fontWeight: "800",
    fontSize: 16
  },
  specialActions: {
    flexDirection: "row",
    gap: 8
  },
  linkText: {
    color: "#2563EB",
    fontWeight: "700"
  },
  itemActionButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10
  },
  itemActionPrimary: {
    backgroundColor: "#F97316"
  },
  itemActionSecondary: {
    backgroundColor: "#334155"
  },
  itemActionText: {
    color: "white",
    textAlign: "center",
    fontWeight: "700"
  },
  orderCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "white",
    padding: 12,
    gap: 4
  },
  orderNumber: {
    color: "#0F172A",
    fontWeight: "800",
    fontSize: 16
  },
  orderMeta: {
    color: "#475569",
    fontWeight: "600"
  }
});
