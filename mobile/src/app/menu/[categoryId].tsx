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
          <Ionicons name="chevron-back" size={24} color="#0F172A" />
        </Pressable>
        <Text style={styles.topNavTitle}>Category</Text>
        <View style={{ width: 40 }} />
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
          <Ionicons name="restaurant-outline" size={30} color="#94A3B8" />
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
                    <Ionicons name="fast-food-outline" size={20} color="#94A3B8" />
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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC"
  },
  topNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0"
  },
  topNavTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0F172A"
  },
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 24
  },
  headerCard: {
    borderRadius: 20,
    backgroundColor: "white",
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
    marginBottom: 8
  },
  heroBg: {
    width: "100%",
    minHeight: 180,
    justifyContent: "flex-end"
  },
  heroBgImage: {
    borderRadius: 20
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    borderRadius: 20,
    padding: 18,
    gap: 12,
    justifyContent: "flex-end"
  },
  heroNoImage: {
    padding: 18,
    gap: 12,
    borderRadius: 20
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10
  },
  headerTitleWrap: {
    flex: 1,
    gap: 4
  },
  headerTitle: {
    color: "#0F172A",
    fontSize: 26,
    fontWeight: "900",
  },
  headerTitleOverlay: {
    color: "white",
    fontSize: 26,
    fontWeight: "900",
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4
  },
  headerSubtitle: {
    color: "#64748B",
    fontWeight: "600",
    fontSize: 14
  },
  headerSubtitleOverlay: {
    color: "rgba(255,255,255,0.85)",
    fontWeight: "600",
    fontSize: 14
  },
  itemCountChip: {
    borderRadius: 999,
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  itemCountChipOverlay: {
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)"
  },
  itemCountChipText: {
    color: "#0F172A",
    fontWeight: "800",
    fontSize: 12
  },
  itemCountChipTextOverlay: {
    color: "white",
    fontWeight: "800",
    fontSize: 12
  },
  categoryDescription: {
    color: "#475569",
    lineHeight: 20
  },
  categoryDescriptionOverlay: {
    color: "rgba(255,255,255,0.9)",
    lineHeight: 20
  },
  emptyCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
    padding: 18,
    alignItems: "center",
    gap: 6
  },
  emptyTitle: {
    color: "#0F172A",
    fontWeight: "800",
    fontSize: 18
  },
  emptySub: {
    color: "#64748B",
    textAlign: "center"
  },
  listHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  listHeaderTitle: {
    color: "#0F172A",
    fontSize: 17,
    fontWeight: "800"
  },
  listHeaderMeta: {
    color: "#64748B",
    fontWeight: "700"
  },
  itemGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "flex-start"
  },
  itemCard: {
    borderRadius: 16,
    backgroundColor: "white",
    overflow: "hidden",
    marginBottom: 14,
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3
  },
  itemTapArea: {
    gap: 6
  },
  itemImage: {
    width: "100%",
    height: 106,
    backgroundColor: "#F1F5F9"
  },
  itemImageFallback: {
    width: "100%",
    height: 106,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center"
  },
  itemBody: {
    padding: 10,
    gap: 6
  },
  itemNameRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8
  },
  itemName: {
    color: "#0F172A",
    fontWeight: "800",
    fontSize: 16,
    flex: 1
  },
  itemDescription: {
    color: "#64748B",
    fontSize: 12
  },
  itemDescriptionMuted: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "600"
  },
  itemPrice: {
    color: "#C2410C",
    fontWeight: "800",
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FED7AA",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 12
  },
  categoryPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  categoryPillText: {
    color: "#475569",
    fontWeight: "700",
    fontSize: 12
  },
  addBtn: {
    marginHorizontal: 10,
    marginBottom: 10,
    borderRadius: 10,
    backgroundColor: "#FF6B35",
    paddingVertical: 10
  },
  addBtnDisabled: {
    backgroundColor: "#9CA3AF"
  },
  addBtnText: {
    color: "white",
    textAlign: "center",
    fontWeight: "800"
  }
});
