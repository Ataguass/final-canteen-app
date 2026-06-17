import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../hooks/useAuth";
import { CanteenHeader } from "../../components/CanteenHeader";
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
  isAvailable?: boolean;
};

type CategoryMode = "POPULAR" | "ALL";

const isRenderableImageUri = (uri?: string | null): boolean => {
  if (!uri) return false;
  const normalized = uri.trim().toLowerCase();
  return (
    normalized.startsWith("http://") ||
    normalized.startsWith("https://") ||
    normalized.startsWith("file://") ||
    normalized.startsWith("content://") ||
    normalized.startsWith("data:image/")
  );
};

export default function Screen() {
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { user, accessToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [categoryMode, setCategoryMode] = useState<CategoryMode>("POPULAR");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("ALL");
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [failedImageMap, setFailedImageMap] = useState<Record<string, true>>({});
  const categoryColumns = screenWidth >= 1000 ? 4 : screenWidth >= 760 ? 3 : 2;
  const gap = 12;
  const availableWidth = screenWidth - 32; // 16px padding on left/right
  // Fix precision issues by flooring the width, preventing accidental wrapping
  const categoryCardWidth =
    categoryColumns === 4
      ? Math.floor((availableWidth - gap * 3) / 4)
      : categoryColumns === 3
      ? Math.floor((availableWidth - gap * 2) / 3)
      : Math.floor((availableWidth - gap) / 2);
  const categoryImageHeight = categoryColumns >= 3 ? 96 : 118;

  const onCategoryImageError = useCallback((categoryId: string) => {
    setFailedImageMap((prev) => (prev[categoryId] ? prev : { ...prev, [categoryId]: true }));
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!user?.tenantId || !accessToken) return;
      try {
        setLoading(true);
        const [categoryResponse, itemResponse] = await Promise.all([
          menuService.listCategories(accessToken, user.tenantId),
          menuService.listItems(accessToken, user.tenantId)
        ]);
        setCategories(categoryResponse.data);
        setItems(itemResponse.data);
      } catch (error) {
        Alert.alert("Error", error instanceof Error ? error.message : "Could not load categories");
      } finally {
        setLoading(false);
      }
    };
    load().catch(() => undefined);
  }, [user?.tenantId, accessToken]);

  const availableItems = useMemo(
    () => items.filter((item) => item.isAvailable !== false),
    [items]
  );

  const itemCountByCategoryId = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of availableItems) {
      if (!item.categoryId) continue;
      map.set(item.categoryId, (map.get(item.categoryId) ?? 0) + 1);
    }
    return map;
  }, [availableItems]);

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.name.localeCompare(b.name)),
    [categories]
  );

  const popularCategories = useMemo(() => {
    return [...categories]
      .filter((category) => (itemCountByCategoryId.get(category.id) ?? 0) > 0)
      .sort((a, b) => {
        const countDiff = (itemCountByCategoryId.get(b.id) ?? 0) - (itemCountByCategoryId.get(a.id) ?? 0);
        if (countDiff !== 0) return countDiff;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 12);
  }, [categories, itemCountByCategoryId]);

  const jumpCategories = useMemo(() => {
    if (categoryMode === "POPULAR" && popularCategories.length > 0) {
      return popularCategories;
    }
    return sortedCategories;
  }, [categoryMode, popularCategories, sortedCategories]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const bySearch = !normalized
      ? jumpCategories
      : jumpCategories.filter((category) => category.name.toLowerCase().includes(normalized));
    if (selectedCategoryId === "ALL") return bySearch;
    return bySearch.filter((category) => category.id === selectedCategoryId);
  }, [jumpCategories, query, selectedCategoryId]);

  const visibleCategories = useMemo(
    () => [...filtered].sort((a, b) => a.name.localeCompare(b.name)),
    [filtered]
  );

  return (
    <>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        <CanteenHeader showBackButton title="Menu" subtitle="Categories & Items" />
        <View style={styles.searchBarCard}>
          <Ionicons name="search-outline" size={20} color="#64748B" />
          <TextInput
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              if (text.trim()) {
                setSelectedCategoryId("ALL");
              }
            }}
            placeholder="Search categories..."
            placeholderTextColor="#94A3B8"
            style={styles.searchInput}
          />
          {query.trim() ? (
            <Pressable
              onPress={() => {
                setQuery("");
                setSelectedCategoryId("ALL");
              }}
              style={styles.clearBtn}
            >
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </Pressable>
          ) : null}
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.jumpBarRow}
        >
          <Pressable
            onPress={() => setSelectedCategoryId("ALL")}
            style={[styles.jumpChip, selectedCategoryId === "ALL" && styles.jumpChipActive]}
            android_ripple={{ color: "#DBEAFE" }}
          >
            <Text style={[styles.jumpChipText, selectedCategoryId === "ALL" && styles.jumpChipTextActive]}>
              All
            </Text>
          </Pressable>
          {jumpCategories.map((category) => {
            const selected = selectedCategoryId === category.id;
            return (
              <Pressable
                key={category.id}
                onPress={() => setSelectedCategoryId(category.id)}
                style={[styles.jumpChip, selected && styles.jumpChipActive]}
                android_ripple={{ color: "#DBEAFE" }}
              >
                <Text style={[styles.jumpChipText, selected && styles.jumpChipTextActive]} numberOfLines={1}>
                  {category.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

      {loading ? (
        <View style={styles.emptyCard}>
          <Ionicons name="hourglass-outline" size={18} color="#64748B" />
          <Text style={styles.emptyText}>Loading categories...</Text>
        </View>
      ) : null}

      {!loading && filtered.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="search-outline" size={18} color="#64748B" />
          <Text style={styles.emptyText}>No categories found.</Text>
        </View>
      ) : null}

      <View style={styles.categoryGrid}>
        {visibleCategories.map((category) => {
          const itemCount = itemCountByCategoryId.get(category.id) ?? 0;
          const canShowImage = isRenderableImageUri(category.imageUrl) && !failedImageMap[category.id];

          return (
            <View
              key={category.id}
              style={[styles.categoryCard, { width: categoryCardWidth }]}
            >
              <Link
                href={{
                  pathname: "/(student)/menu/[categoryId]",
                  params: { categoryId: category.id }
                }}
                asChild
              >
                <Pressable android_ripple={{ color: "#E2E8F0" }}>
                  <View style={styles.categoryImageWrap}>
                    {canShowImage ? (
                      <Image
                        source={{ uri: category.imageUrl! }}
                        style={[styles.categoryImage, { height: categoryImageHeight }]}
                        resizeMode="cover"
                        onError={() => onCategoryImageError(category.id)}
                      />
                    ) : (
                      <View style={[styles.categoryImageFallback, { height: categoryImageHeight }]}>
                        <Ionicons name="fast-food-outline" size={24} color="#94A3B8" />
                      </View>
                    )}
                    <View style={styles.categoryItemBadge}>
                      <Text style={styles.categoryItemBadgeText}>{itemCount} items</Text>
                    </View>
                  </View>
                  <View style={styles.categoryBody}>
                    <Text style={styles.categoryName} numberOfLines={1}>
                      {category.name}
                    </Text>
                    {category.description ? (
                      <Text style={styles.categoryDescription} numberOfLines={2}>
                        {category.description}
                      </Text>
                    ) : (
                      <Text style={styles.categoryDescriptionMuted}>Tap to view items</Text>
                    )}
                  </View>
                </Pressable>
              </Link>
            </View>
          );
        })}
      </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#EEF2F7"
  },
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 28
  },
  searchBarCard: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2
  },
  clearBtn: {
    padding: 4
  },

  headerCard: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 18,
    backgroundColor: "white",
    padding: 14,
    gap: 10,
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  headerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center"
  },
  metricRow: {
    flexDirection: "row",
    gap: 8
  },
  metricChip: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    paddingVertical: 8,
    paddingHorizontal: 10
  },
  metricLabel: {
    color: "#64748B",
    fontWeight: "600",
    fontSize: 12
  },
  metricValue: {
    color: "#0F172A",
    fontWeight: "800",
    fontSize: 18,
    marginTop: 1
  },
  title: {
    color: "#0F172A",
    fontSize: 23,
    fontWeight: "800"
  },
  subtitle: {
    color: "#64748B",
    fontWeight: "600"
  },
  searchWrap: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  searchInput: {
    flex: 1,
    color: "#0F172A",
    paddingVertical: 10,
    fontWeight: "600"
  },
  filterLabel: {
    color: "#475569",
    fontWeight: "700",
    fontSize: 12
  },
  segmentRow: {
    flexDirection: "row",
    gap: 8
  },
  segmentButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6
  },
  segmentButtonActive: {
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF"
  },
  segmentButtonText: {
    color: "#475569",
    fontWeight: "700"
  },
  segmentButtonTextActive: {
    color: "#1E3A8A"
  },
  jumpBarRow: {
    gap: 8,
    paddingRight: 8
  },
  jumpChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: 168
  },
  jumpChipActive: {
    borderColor: "#1D4ED8",
    backgroundColor: "#DBEAFE"
  },
  jumpChipText: {
    color: "#334155",
    fontWeight: "700",
    fontSize: 13
  },
  jumpChipTextActive: {
    color: "#1E3A8A"
  },
  showingText: {
    color: "#64748B",
    fontWeight: "600",
    fontSize: 12
  },
  emptyCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  categorySectionCard: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    backgroundColor: "white",
    padding: 12,
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    alignItems: "flex-start"
  },
  gridHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  gridHeaderTitle: {
    color: "#0F172A",
    fontSize: 20,
    fontWeight: "800"
  },
  gridHeaderMeta: {
    color: "#64748B",
    fontWeight: "700"
  },
  emptyText: {
    color: "#64748B",
    fontWeight: "600"
  },
  categoryCard: {
    position: "relative",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    backgroundColor: "white",
    overflow: "hidden",
    marginBottom: 12,
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2
  },
  categoryImageWrap: {
    width: "100%",
    position: "relative"
  },
  categoryImage: {
    width: "100%",
    backgroundColor: "#F1F5F9"
  },
  categoryImageFallback: {
    width: "100%",
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center"
  },
  categoryItemBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8
  },
  categoryItemBadgeText: {
    color: "white",
    fontSize: 11,
    fontWeight: "800"
  },
  categoryBody: {
    padding: 12,
    gap: 4
  },
  categoryNameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  categoryName: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "800"
  },
  categoryMetaPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 8,
    backgroundColor: "#EEF2FF"
  },
  categoryMeta: {
    color: "#3730A3",
    fontWeight: "700",
    fontSize: 12
  },
  categoryDescription: {
    color: "#64748B",
    fontSize: 13,
    lineHeight: 18
  },
  categoryDescriptionMuted: {
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "500"
  }
});
