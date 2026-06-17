import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  ImageBackground
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../hooks/useAuth";
import { useCart } from "../../hooks/useCart";
import { useToast } from "../../components/Toast";
import { menuService } from "../../services/menuService";
import { moderateScale, fontScale, verticalScale, scale, isTablet, gridColumns } from '../../utils/responsive';
import { useTheme } from '../../hooks/useTheme';

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
};

const formatCurrency = (value: number): string => `₹ ${value.toFixed(2)}`;

export default function Screen() {
  const theme = useTheme();
  const { colors, isDark } = theme;
  const styles = createStyles(theme);
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const router = useRouter();
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();
  const { user, accessToken } = useAuth();
  const { addItem } = useCart();
  const { showToast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(false);
  const itemColumns = screenWidth >= 700 ? 3 : 2;
  const itemCardWidth = itemColumns === 3 ? "32%" : "48.5%";

  useEffect(() => {
    const load = async () => {
      if (!user?.tenantId || !accessToken) return;
      try {
        setLoading(true);
        const [cats, menu] = await Promise.all([
          menuService.listCategories(accessToken, user.tenantId),
          menuService.listItems(accessToken, user.tenantId)
        ]);
        setCategories(cats.data);
        setItems(menu.data.filter((x) => x.isAvailable));
      } finally {
        setLoading(false);
      }
    };
    load().catch(() => undefined);
  }, [user?.tenantId, accessToken]);

  const currentCategoryObj = useMemo(
    () => categories.find((c) => c.id === categoryId),
    [categories, categoryId]
  );

  const currentCategory = currentCategoryObj?.name ?? "Category";

  const filtered = useMemo(() => {
    return items.filter((item) => item.categoryId === categoryId);
  }, [items, categoryId]);

  const onAddToCart = (item: MenuItem) => {
    if (item.stockQty <= 0) {
      Alert.alert("Out of stock", "This item is currently out of stock.");
      return;
    }
    addItem({ menuItemId: item.id, name: item.name, price: item.price }, 1);
    showToast(`${item.name} added to cart.`, "success");
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top > 0 ? insets.top + 10 : 48 }]}>
      <View style={styles.topNav}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.topNavTitle}>Category</Text>
        <View style={{ width: moderateScale(40) }} />
      </View>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerCard}>
        {currentCategoryObj?.imageUrl ? (
          <ImageBackground
            source={{ uri: currentCategoryObj.imageUrl }}
            style={styles.heroBg}
            imageStyle={styles.heroBgImage}
          >
            <View style={styles.heroOverlay}>
              <View style={styles.headerTopRow}>
                <View style={styles.headerTitleWrap}>
                  <Text style={styles.headerTitleOverlay}>{currentCategory}</Text>
                  <Text style={styles.headerSubtitleOverlay}>Browse and choose your food</Text>
                </View>
                <View style={styles.itemCountChipOverlay}>
                  <Text style={styles.itemCountChipTextOverlay}>{loading ? "..." : `${filtered.length} items`}</Text>
                </View>
              </View>

              {currentCategoryObj?.description ? (
                <Text style={styles.categoryDescriptionOverlay}>{currentCategoryObj.description}</Text>
              ) : null}
            </View>
          </ImageBackground>
        ) : (
          <View style={styles.heroNoImage}>
            <View style={styles.headerTopRow}>
              <View style={styles.headerTitleWrap}>
                <Text style={styles.headerTitle}>{currentCategory}</Text>
                <Text style={styles.headerSubtitle}>Browse and choose your food</Text>
              </View>
              <View style={styles.itemCountChip}>
                <Text style={styles.itemCountChipText}>{loading ? "..." : `${filtered.length} items`}</Text>
              </View>
            </View>

            {currentCategoryObj?.description ? (
              <Text style={styles.categoryDescription}>{currentCategoryObj.description}</Text>
            ) : null}
          </View>
        )}
      </View>

      {filtered.length === 0 && !loading ? (
        <View style={styles.emptyCard}>
          <Ionicons name="restaurant-outline" size={30} color={colors.textSecondary} />
          <Text style={styles.emptyTitle}>No items in this category</Text>
          <Text style={styles.emptySub}>Try another category from Search screen.</Text>
        </View>
      ) : null}

      <View style={styles.listHeaderRow}>
        <Text style={styles.listHeaderTitle}>Items</Text>
        <Text style={styles.listHeaderMeta}>{filtered.length} shown</Text>
      </View>

      <View style={styles.itemGrid}>
        {filtered.map((item) => {
          const isOutOfStock = item.stockQty <= 0;
          return (
            <View key={item.id} style={[styles.itemCard, { width: itemCardWidth }]}>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/menu/item/[id]",
                    params: { id: item.id }
                  })
                }
                style={styles.itemTapArea}
              >
                {item.image ? (
                  <Image
                    source={{ uri: item.image }}
                    style={styles.itemImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.itemImageFallback}>
                    <Ionicons name="fast-food-outline" size={20} color={colors.textMuted} />
                  </View>
                )}
                <View style={styles.itemBody}>
                  <View style={styles.itemNameRow}>
                    <Text style={styles.itemName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.itemPrice}>{formatCurrency(item.price)}</Text>
                  </View>
                  <View style={styles.categoryPill}>
                    <Text style={styles.categoryPillText}>{currentCategory}</Text>
                  </View>
                  {item.description ? (
                    <Text numberOfLines={2} style={styles.itemDescription}>
                      {item.description}
                    </Text>
                  ) : null}
                </View>
              </Pressable>

              <Pressable
                onPress={() => onAddToCart(item)}
                disabled={isOutOfStock}
                style={[styles.addBtn, isOutOfStock && styles.addBtnDisabled]}
              >
                <Text style={styles.addBtnText}>{isOutOfStock ? "Unavailable" : "Add to Cart"}</Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </ScrollView>
    </View>
  );
}

const createStyles = ({ colors, isDark }: { colors: any, isDark: boolean }) => ({
  screen: {
    flex: 1,
    backgroundColor: colors.background
  },
  topNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: moderateScale(16),
    paddingBottom: verticalScale(10)
  },
  backBtn: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: moderateScale(20),
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border
  },
  topNavTitle: {
    fontSize: fontScale(18),
    fontWeight: "900",
    color: colors.text
  },
  content: {
    padding: moderateScale(16),
    gap: moderateScale(12),
    paddingBottom: verticalScale(24)
  },
  headerCard: {
    borderRadius: moderateScale(20),
    backgroundColor: colors.card,
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: moderateScale(12),
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
    marginBottom: verticalScale(8)
  },
  heroBg: {
    width: "100%",
    minHeight: moderateScale(180),
    justifyContent: "flex-end"
  },
  heroBgImage: {
    borderRadius: moderateScale(20)
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    borderRadius: moderateScale(20),
    padding: moderateScale(18),
    gap: moderateScale(12),
    justifyContent: "flex-end"
  },
  heroNoImage: {
    padding: moderateScale(18),
    gap: moderateScale(12),
    borderRadius: moderateScale(20)
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: moderateScale(10)
  },
  headerTitleWrap: {
    flex: 1,
    gap: moderateScale(4)
  },
  headerTitle: {
    color: colors.text,
    fontSize: fontScale(26),
    fontWeight: "900",
  },
  headerTitleOverlay: {
    color: "white",
    fontSize: fontScale(26),
    fontWeight: "900",
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: moderateScale(4)
  },
  headerSubtitle: {
    color: colors.textSecondary,
    fontWeight: "600",
    fontSize: fontScale(14)
  },
  headerSubtitleOverlay: {
    color: "rgba(255,255,255,0.85)",
    fontWeight: "600",
    fontSize: fontScale(14)
  },
  itemCountChip: {
    borderRadius: moderateScale(999),
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(6)
  },
  itemCountChipOverlay: {
    borderRadius: moderateScale(999),
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(6),
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)"
  },
  itemCountChipText: {
    color: colors.text,
    fontWeight: "800",
    fontSize: fontScale(12)
  },
  itemCountChipTextOverlay: {
    color: "white",
    fontWeight: "800",
    fontSize: fontScale(12)
  },
  categoryDescription: {
    color: colors.textSecondary,
    lineHeight: 20
  },
  categoryDescriptionOverlay: {
    color: "rgba(255,255,255,0.9)",
    lineHeight: 20
  },
  emptyCard: {
    borderRadius: moderateScale(14),
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: moderateScale(18),
    alignItems: "center",
    gap: moderateScale(6)
  },
  emptyTitle: {
    color: colors.text,
    fontWeight: "800",
    fontSize: fontScale(18)
  },
  emptySub: {
    color: colors.textSecondary,
    textAlign: "center"
  },
  listHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  listHeaderTitle: {
    color: colors.text,
    fontSize: fontScale(17),
    fontWeight: "800"
  },
  listHeaderMeta: {
    color: colors.textSecondary,
    fontWeight: "700"
  },
  itemGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "flex-start"
  },
  itemCard: {
    borderRadius: moderateScale(16),
    backgroundColor: colors.card,
    overflow: "hidden",
    marginBottom: verticalScale(14),
    shadowColor: colors.text,
    shadowOpacity: 0.06,
    shadowRadius: moderateScale(10),
    shadowOffset: { width: 0, height: 4 },
    elevation: 3
  },
  itemTapArea: {
    gap: moderateScale(6)
  },
  itemImage: {
    width: "100%",
    height: moderateScale(106),
    backgroundColor: colors.surfaceAlt
  },
  itemImageFallback: {
    width: "100%",
    height: moderateScale(106),
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center"
  },
  itemBody: {
    padding: moderateScale(10),
    gap: moderateScale(6)
  },
  itemNameRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: moderateScale(8)
  },
  itemName: {
    color: colors.text,
    fontWeight: "800",
    fontSize: fontScale(16),
    flex: 1
  },
  itemDescription: {
    color: colors.textSecondary,
    fontSize: fontScale(12)
  },
  itemDescriptionMuted: {
    color: colors.textMuted,
    fontSize: fontScale(12),
    fontWeight: "600"
  },
  itemPrice: {
    color: isDark ? "#FDBA74" : "#C2410C",
    fontWeight: "800",
    backgroundColor: isDark ? "rgba(194, 65, 12, 0.2)" : "#FFF7ED",
    borderWidth: 1,
    borderColor: isDark ? "rgba(194, 65, 12, 0.4)" : "#FED7AA",
    borderRadius: moderateScale(999),
    paddingHorizontal: moderateScale(8),
    paddingVertical: moderateScale(3),
    fontSize: fontScale(12)
  },
  categoryPill: {
    alignSelf: "flex-start",
    borderRadius: moderateScale(999),
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: moderateScale(8),
    paddingVertical: moderateScale(3)
  },
  categoryPillText: {
    color: colors.textSecondary,
    fontWeight: "700",
    fontSize: fontScale(12)
  },
  addBtn: {
    marginHorizontal: moderateScale(10),
    marginBottom: verticalScale(10),
    borderRadius: moderateScale(10),
    backgroundColor: "#FF6B35",
    paddingVertical: moderateScale(10)
  },
  addBtnDisabled: {
    backgroundColor: colors.textMuted
  },
  addBtnText: {
    color: "white",
    textAlign: "center",
    fontWeight: "800"
  }
});
