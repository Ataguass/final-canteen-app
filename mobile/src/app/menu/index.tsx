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
import { useAuthStore } from '../../stores/useAuthStore';
import { useTheme } from "../../hooks/useTheme";
import { CanteenHeader } from "../../components/CanteenHeader";
import { useCategories, useMenuItems } from "../../hooks/queries/useMenu";
import { moderateScale, fontScale, verticalScale, scale, isTablet, gridColumns } from '../../utils/responsive';

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
  const theme = useTheme();
  const { colors, isDark } = theme;
  const styles = createStyles(theme);
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { user, accessToken } = useAuthStore();
  const [query, setQuery] = useState("");
  const [categoryMode, setCategoryMode] = useState<CategoryMode>("POPULAR");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("ALL");
  const [failedImageMap, setFailedImageMap] = useState<Record<string, true>>({});
  
  const { data: categories = [], isLoading: isCategoriesLoading, error: categoriesError } = useCategories();
  const { data: items = [], isLoading: isItemsLoading, error: itemsError } = useMenuItems();
  
  const loading = isCategoriesLoading || isItemsLoading;
  
  // Show error if failed
  useEffect(() => {
    if (categoriesError || itemsError) {
      Alert.alert("Error", "Could not load categories or items");
    }
  }, [categoriesError, itemsError]);

  const categoryColumns = screenWidth >= 1000 ? 4 : screenWidth >= 760 ? 3 : 2;
  const gap = moderateScale(12);
  const paddingX = moderateScale(16) * 2;
  const availableWidth = screenWidth - paddingX;
  // Fix precision issues by flooring the width and subtracting 1px to prevent accidental wrapping
  const categoryCardWidth =
    categoryColumns === 4
      ? Math.floor((availableWidth - gap * 3) / 4) - 1
      : categoryColumns === 3
      ? Math.floor((availableWidth - gap * 2) / 3) - 1
      : Math.floor((availableWidth - gap) / 2) - 1;
  const categoryImageHeight = categoryColumns >= 3 ? 96 : 118;

  const onCategoryImageError = useCallback((categoryId: string) => {
    setFailedImageMap((prev) => (prev[categoryId] ? prev : { ...prev, [categoryId]: true }));
  }, []);

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
          <Ionicons name="search-outline" size={20} color={colors.textSecondary} />
          <TextInput
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              if (text.trim()) {
                setSelectedCategoryId("ALL");
              }
            }}
            placeholder="Search categories..."
            placeholderTextColor={colors.textMuted}
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
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
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
            android_ripple={{ color: isDark ? colors.border : "#DBEAFE" }}
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
                android_ripple={{ color: isDark ? colors.border : "#DBEAFE" }}
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
          <Ionicons name="hourglass-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.emptyText}>Loading categories...</Text>
        </View>
      ) : null}

      {!loading && filtered.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
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
                <Pressable android_ripple={{ color: isDark ? colors.surfaceAlt : "#E2E8F0" }}>
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
                        <Ionicons name="fast-food-outline" size={24} color={colors.textMuted} />
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

const createStyles = ({ colors, isDark }: { colors: any, isDark: boolean }) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    padding: moderateScale(16),
    gap: moderateScale(12),
    paddingBottom: verticalScale(28)
  },
  searchBarCard: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: moderateScale(16),
    paddingHorizontal: moderateScale(16),
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(10),
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowRadius: moderateScale(8),
    shadowOffset: { width: 0, height: 3 },
    elevation: 2
  },
  clearBtn: {
    padding: moderateScale(4)
  },

  headerCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: moderateScale(18),
    backgroundColor: colors.card,
    padding: moderateScale(14),
    gap: moderateScale(10),
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowRadius: moderateScale(8),
    shadowOffset: { width: 0, height: 3 },
    elevation: 1
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(10)
  },
  headerIconWrap: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: moderateScale(12),
    backgroundColor: isDark ? "rgba(37, 99, 235, 0.2)" : "#EFF6FF",
    borderWidth: 1,
    borderColor: isDark ? "rgba(37, 99, 235, 0.4)" : "#DBEAFE",
    alignItems: "center",
    justifyContent: "center"
  },
  metricRow: {
    flexDirection: "row",
    gap: moderateScale(8)
  },
  metricChip: {
    flex: 1,
    borderRadius: moderateScale(12),
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    paddingVertical: moderateScale(8),
    paddingHorizontal: moderateScale(10)
  },
  metricLabel: {
    color: colors.textSecondary,
    fontWeight: "600",
    fontSize: fontScale(12)
  },
  metricValue: {
    color: colors.text,
    fontWeight: "800",
    fontSize: fontScale(18),
    marginTop: 1
  },
  title: {
    color: colors.text,
    fontSize: fontScale(23),
    fontWeight: "800"
  },
  subtitle: {
    color: colors.textSecondary,
    fontWeight: "600"
  },
  searchWrap: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: moderateScale(12),
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: moderateScale(10),
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(8)
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    paddingVertical: moderateScale(10),
    fontWeight: "600"
  },
  filterLabel: {
    color: colors.textSecondary,
    fontWeight: "700",
    fontSize: fontScale(12)
  },
  segmentRow: {
    flexDirection: "row",
    gap: moderateScale(8)
  },
  segmentButton: {
    flex: 1,
    minHeight: moderateScale(40),
    borderRadius: moderateScale(12),
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: moderateScale(6)
  },
  segmentButtonActive: {
    borderColor: isDark ? colors.border : "#BFDBFE",
    backgroundColor: isDark ? colors.surfaceAlt : "#EFF6FF"
  },
  segmentButtonText: {
    color: colors.textSecondary,
    fontWeight: "700"
  },
  segmentButtonTextActive: {
    color: isDark ? "#60A5FA" : "#1E3A8A"
  },
  jumpBarRow: {
    gap: moderateScale(8),
    paddingRight: moderateScale(8)
  },
  jumpChip: {
    borderRadius: moderateScale(999),
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(8),
    maxWidth: moderateScale(168)
  },
  jumpChipActive: {
    borderColor: colors.accent,
    backgroundColor: isDark ? "rgba(37, 99, 235, 0.2)" : "#DBEAFE"
  },
  jumpChipText: {
    color: colors.textSecondary,
    fontWeight: "700",
    fontSize: fontScale(13)
  },
  jumpChipTextActive: {
    color: isDark ? "#93C5FD" : "#1E3A8A"
  },
  showingText: {
    color: colors.textSecondary,
    fontWeight: "600",
    fontSize: fontScale(12)
  },
  emptyCard: {
    borderRadius: moderateScale(14),
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    padding: moderateScale(14),
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(8)
  },
  categorySectionCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: moderateScale(16),
    backgroundColor: colors.card,
    padding: moderateScale(12),
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowRadius: moderateScale(8),
    shadowOffset: { width: 0, height: 3 },
    elevation: 1
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: moderateScale(12),
    alignItems: "flex-start"
  },
  gridHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  gridHeaderTitle: {
    color: colors.text,
    fontSize: fontScale(20),
    fontWeight: "800"
  },
  gridHeaderMeta: {
    color: colors.textSecondary,
    fontWeight: "700"
  },
  emptyText: {
    color: colors.textSecondary,
    fontWeight: "600"
  },
  categoryCard: {
    position: "relative",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: moderateScale(14),
    backgroundColor: colors.card,
    overflow: "hidden",
    marginBottom: verticalScale(12),
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: moderateScale(8),
    shadowOffset: { width: 0, height: 3 },
    elevation: 2
  },
  categoryImageWrap: {
    width: "100%",
    position: "relative"
  },
  categoryImage: {
    width: "100%",
    backgroundColor: colors.surfaceAlt
  },
  categoryImageFallback: {
    width: "100%",
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center"
  },
  categoryItemBadge: {
    position: "absolute",
    top: verticalScale(8),
    right: moderateScale(8),
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    paddingHorizontal: moderateScale(8),
    paddingVertical: moderateScale(4),
    borderRadius: moderateScale(8)
  },
  categoryItemBadgeText: {
    color: "white",
    fontSize: fontScale(11),
    fontWeight: "800"
  },
  categoryBody: {
    padding: moderateScale(12),
    gap: moderateScale(4)
  },
  categoryNameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: moderateScale(8)
  },
  categoryName: {
    color: colors.text,
    fontSize: fontScale(16),
    fontWeight: "800"
  },
  categoryMetaPill: {
    alignSelf: "flex-start",
    borderRadius: moderateScale(999),
    paddingVertical: moderateScale(3),
    paddingHorizontal: moderateScale(8),
    backgroundColor: isDark ? "rgba(55, 48, 163, 0.3)" : "#EEF2FF"
  },
  categoryMeta: {
    color: isDark ? "#A5B4FC" : "#3730A3",
    fontWeight: "700",
    fontSize: fontScale(12)
  },
  categoryDescription: {
    color: colors.textSecondary,
    fontSize: fontScale(13),
    lineHeight: 18
  },
  categoryDescriptionMuted: {
    color: colors.textMuted,
    fontSize: fontScale(13),
    fontWeight: "500"
  }
});
