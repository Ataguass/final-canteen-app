import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useCart } from "../../hooks/useCart";
import { useToast } from "../../components/Toast";
import { menuService } from "../../services/menuService";
import { moderateScale, fontScale, verticalScale, scale, isTablet, gridColumns } from '../../utils/responsive';

type SpeechRecognitionModule = {
  requestPermissionsAsync: () => Promise<{ granted?: boolean }>;
  start: (options?: Record<string, unknown>) => void;
  stop: () => void;
  addListener: (
    eventName: string,
    listener: (event?: {
      results?: Array<{ transcript?: string }>;
      error?: string;
      message?: string;
    }) => void
  ) => { remove: () => void };
};

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
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { user, accessToken } = useAuth();
  const { addItem } = useCart();
  const { showToast } = useToast();
  const searchInputRef = useRef<TextInput>(null);
  const speechModuleRef = useRef<SpeechRecognitionModule | null>(null);
  const speechListenersRef = useRef<Array<{ remove: () => void }>>([]);
  const hasShownVoiceFallbackRef = useRef(false);

  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [isListening, setIsListening] = useState(false);

  const itemGridColumns = screenWidth >= 1200 ? 4 : screenWidth >= 900 ? 3 : 2;
  const itemCardWidth = itemGridColumns === 4 ? "23.5%" : itemGridColumns === 3 ? "32%" : "48.5%";
  const itemImageHeight = itemGridColumns === 4 ? 88 : itemGridColumns === 3 ? 98 : 108;

  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(() => searchInputRef.current?.focus(), 120);
      return () => clearTimeout(timer);
    }, [])
  );

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
        setItems(menu.data.filter((item) => item.isAvailable));
      } catch (error) {
        Alert.alert("Error", error instanceof Error ? error.message : "Failed to load menu");
      } finally {
        setLoading(false);
      }
    };
    load().catch(() => undefined);
  }, [user?.tenantId, accessToken]);

  useEffect(
    () => () => {
      speechListenersRef.current.forEach((listener) => listener.remove());
      speechListenersRef.current = [];
      if (speechModuleRef.current) {
        try {
          speechModuleRef.current.stop();
        } catch {
          // ignore stop errors during unmount
        }
      }
    },
    []
  );

  const focusSearchInput = useCallback(() => {
    searchInputRef.current?.focus();
  }, []);

  const getSpeechModule = useCallback(async (): Promise<SpeechRecognitionModule | null> => {
    if (speechModuleRef.current) return speechModuleRef.current;
    try {
      const speechPackage = await import("expo-speech-recognition");
      const module = speechPackage.ExpoSpeechRecognitionModule as SpeechRecognitionModule | undefined;
      if (!module) return null;
      speechModuleRef.current = module;
      return module;
    } catch {
      return null;
    }
  }, []);

  const ensureSpeechListeners = useCallback((module: SpeechRecognitionModule) => {
    if (speechListenersRef.current.length > 0) return;
    const resultListener = module.addListener("result", (event) => {
      const transcript = event?.results?.[0]?.transcript?.trim();
      if (transcript) setQuery(transcript);
    });
    const endListener = module.addListener("end", () => setIsListening(false));
    const errorListener = module.addListener("error", () => setIsListening(false));
    speechListenersRef.current = [resultListener, endListener, errorListener];
  }, []);

  const onMicPress = useCallback(async () => {
    focusSearchInput();

    if (Constants.appOwnership === "expo") {
      if (!hasShownVoiceFallbackRef.current) {
        hasShownVoiceFallbackRef.current = true;
        Alert.alert(
          "Voice search in Expo Go",
          "Tap the keyboard mic to speak. Full mic button voice search works in development build."
        );
      }
      return;
    }

    const module = await getSpeechModule();
    if (!module) {
      if (!hasShownVoiceFallbackRef.current) {
        hasShownVoiceFallbackRef.current = true;
        Alert.alert(
          "Voice search unavailable",
          "Voice search is not available in this build. Use your keyboard mic to speak."
        );
      }
      return;
    }

    ensureSpeechListeners(module);

    if (isListening) {
      module.stop();
      setIsListening(false);
      return;
    }

    const permission = await module.requestPermissionsAsync();
    if (!permission?.granted) {
      Alert.alert("Permission needed", "Please allow microphone access for voice search.");
      return;
    }

    try {
      module.start({
        lang: "en-IN",
        interimResults: true,
        maxAlternatives: 1,
        continuous: false
      });
      setIsListening(true);
    } catch (error) {
      setIsListening(false);
      Alert.alert(
        "Voice search failed",
        error instanceof Error ? error.message : "Could not start voice search."
      );
    }
  }, [ensureSpeechListeners, focusSearchInput, getSpeechModule, isListening]);

  const categoryById = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((category) => map.set(category.id, category.name));
    return map;
  }, [categories]);

  const itemCountByCategoryId = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((item) => {
      if (!item.categoryId) return;
      map.set(item.categoryId, (map.get(item.categoryId) ?? 0) + 1);
    });
    return map;
  }, [items]);

  const trimmedQuery = query.trim().toLowerCase();
  const isTyping = trimmedQuery.length > 0;

  const discoveryCategories = useMemo(() => {
    return [...categories]
      .sort((a, b) => {
        const countDiff = (itemCountByCategoryId.get(b.id) ?? 0) - (itemCountByCategoryId.get(a.id) ?? 0);
        if (countDiff !== 0) return countDiff;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 18);
  }, [categories, itemCountByCategoryId]);

  const suggestedCategories = useMemo(() => {
    if (!isTyping) return [];
    return categories
      .filter((category) => category.name.toLowerCase().includes(trimmedQuery))
      .slice(0, 8);
  }, [categories, isTyping, trimmedQuery]);

  const filteredItems = useMemo(() => {
    if (!isTyping) return [];
    return items
      .filter((item) => {
        const categoryName = (item.categoryId && categoryById.get(item.categoryId)) ?? "";
        const description = item.description ?? "";
        return (
          item.name.toLowerCase().includes(trimmedQuery) ||
          categoryName.toLowerCase().includes(trimmedQuery) ||
          description.toLowerCase().includes(trimmedQuery)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items, trimmedQuery, isTyping, categoryById]);

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
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.searchBarCard}>
        <Pressable
          onPress={() => router.back()}
          style={styles.iconButton}
          android_ripple={{ color: "#F1F5F9", borderless: true }}
        >
          <Ionicons name="chevron-back" size={22} color="#1E293B" />
        </Pressable>
        <TextInput
          ref={searchInputRef}
          value={query}
          onChangeText={setQuery}
          placeholder="Search for snacks, meals..."
          placeholderTextColor="#94A3B8"
          style={styles.searchInput}
          autoFocus
          returnKeyType="search"
        />
        {query ? (
          <Pressable onPress={() => setQuery("")} style={styles.iconButton}>
            <Ionicons name="close-circle" size={20} color="#94A3B8" />
          </Pressable>
        ) : (
          <Pressable onPress={onMicPress} style={styles.iconButton}>
            <Ionicons name={isListening ? "stop-circle-outline" : "mic-outline"} size={20} color="#334155" />
          </Pressable>
        )}
      </View>

      {!isTyping ? (
        <View style={styles.discoverySection}>
          <Text style={styles.discoveryTitle}>WHAT'S ON YOUR MIND?</Text>
          <View style={styles.discoveryGrid}>
            {discoveryCategories.map((category) => (
              <Pressable
                key={category.id}
                onPress={() =>
                  router.push({
                    pathname: "/(student)/menu/[categoryId]",
                    params: { categoryId: category.id }
                  })
                }
                style={styles.discoveryItem}
              >
                <View style={styles.discoveryImageWrap}>
                  {category.imageUrl ? (
                    <Image source={{ uri: category.imageUrl }} style={styles.discoveryImage} resizeMode="cover" />
                  ) : (
                    <View style={styles.discoveryFallback}>
                      <Ionicons name="fast-food-outline" size={24} color="#94A3B8" />
                    </View>
                  )}
                </View>
                <Text style={styles.discoveryName} numberOfLines={1}>
                  {category.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <>
          <View style={styles.suggestionCard}>
            <Text style={styles.suggestionTitle}>Suggestions</Text>
            {suggestedCategories.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionChipRow}>
                {suggestedCategories.map((category) => (
                  <Pressable
                    key={category.id}
                    onPress={() => setQuery(category.name)}
                    style={styles.suggestionChip}
                  >
                    <Ionicons name="pricetag-outline" size={13} color="#334155" />
                    <Text style={styles.suggestionChipText} numberOfLines={1}>
                      {category.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.noSuggestionText}>No category suggestions</Text>
            )}
          </View>

          <View style={styles.resultHeader}>
            <Text style={styles.resultTitle}>Items</Text>
            <Text style={styles.resultMeta}>
              {loading ? "Loading..." : `${filteredItems.length} shown`}
            </Text>
          </View>

          {filteredItems.length > 0 ? (
            <View style={styles.itemGrid}>
              {filteredItems.map((item) => {
                const isOutOfStock = item.stockQty <= 0;
                const categoryName =
                  (item.categoryId && categoryById.get(item.categoryId)) ?? "Uncategorized";

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
                        <Image source={{ uri: item.image }} style={[styles.itemImage, { height: itemImageHeight }]} resizeMode="cover" />
                      ) : (
                        <View style={[styles.itemImageFallback, { height: itemImageHeight }]}>
                          <Ionicons name="fast-food-outline" size={22} color="#94A3B8" />
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
                          <Text style={styles.categoryPillText} numberOfLines={1}>
                            {categoryName}
                          </Text>
                        </View>
                        {item.description ? (
                          <Text numberOfLines={2} style={styles.itemDescription}>
                            {item.description}
                          </Text>
                        ) : (
                          <Text style={styles.itemDescriptionMuted}>Tap to view details</Text>
                        )}
                        <Text style={[styles.itemStock, isOutOfStock ? styles.itemStockOut : styles.itemStockIn]}>
                          {isOutOfStock ? "Out of stock" : `In stock: ${item.stockQty}`}
                        </Text>
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
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons name="search-outline" size={18} color="#64748B" />
              <Text style={styles.emptyText}>No matching items found.</Text>
            </View>
          )}
        </>
      )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC"
  },
  content: {
    padding: moderateScale(16),
    gap: moderateScale(14),
    paddingBottom: verticalScale(28)
  },
  searchBarCard: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    borderRadius: moderateScale(24),
    minHeight: moderateScale(56),
    paddingHorizontal: moderateScale(12),
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(8),
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowRadius: moderateScale(8),
    shadowOffset: { width: 0, height: 3 },
    elevation: 1
  },
  iconButton: {
    width: moderateScale(32),
    height: moderateScale(32),
    borderRadius: moderateScale(10),
    alignItems: "center",
    justifyContent: "center"
  },
  searchInput: {
    flex: 1,
    color: "#0F172A",
    fontSize: fontScale(18),
    fontWeight: "700",
    paddingVertical: moderateScale(10)
  },
  discoverySection: {
    gap: moderateScale(12)
  },
  discoveryTitle: {
    color: "#64748B",
    fontSize: fontScale(14),
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase"
  },
  discoveryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "flex-start"
  },
  discoveryItem: {
    width: "31.5%",
    marginBottom: verticalScale(14),
    alignItems: "center",
    gap: moderateScale(6)
  },
  discoveryImageWrap: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: moderateScale(999),
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  discoveryImage: {
    width: "100%",
    height: "100%"
  },
  discoveryFallback: {
    alignItems: "center",
    justifyContent: "center"
  },
  discoveryName: {
    color: "#1F2937",
    fontWeight: "700",
    fontSize: fontScale(14),
    textAlign: "center"
  },
  suggestionCard: {
    borderRadius: moderateScale(14),
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    padding: moderateScale(11),
    gap: moderateScale(8)
  },
  suggestionTitle: {
    color: "#0F172A",
    fontWeight: "800"
  },
  suggestionChipRow: {
    gap: moderateScale(8),
    paddingRight: moderateScale(8)
  },
  suggestionChip: {
    borderRadius: moderateScale(999),
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
    paddingVertical: moderateScale(7),
    paddingHorizontal: moderateScale(11),
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(5),
    maxWidth: moderateScale(170)
  },
  suggestionChipText: {
    color: "#334155",
    fontWeight: "700",
    fontSize: fontScale(12)
  },
  noSuggestionText: {
    color: "#94A3B8",
    fontWeight: "600"
  },
  resultHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  resultTitle: {
    color: "#0F172A",
    fontSize: fontScale(21),
    fontWeight: "800"
  },
  resultMeta: {
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
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: moderateScale(14),
    padding: moderateScale(10),
    backgroundColor: "#FFFFFF",
    marginBottom: verticalScale(10)
  },
  itemTapArea: {
    gap: moderateScale(6)
  },
  itemImage: {
    width: "100%",
    borderRadius: moderateScale(10),
    backgroundColor: "#E2E8F0"
  },
  itemImageFallback: {
    width: "100%",
    borderRadius: moderateScale(10),
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center"
  },
  itemBody: {
    gap: moderateScale(6)
  },
  itemNameRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: moderateScale(8)
  },
  itemName: {
    color: "#0F172A",
    fontWeight: "800",
    fontSize: fontScale(16),
    flex: 1
  },
  itemPrice: {
    color: "#C2410C",
    fontWeight: "800",
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FED7AA",
    borderRadius: moderateScale(999),
    paddingHorizontal: moderateScale(8),
    paddingVertical: moderateScale(3),
    fontSize: fontScale(12)
  },
  categoryPill: {
    alignSelf: "flex-start",
    borderRadius: moderateScale(999),
    backgroundColor: "#EEF2FF",
    paddingHorizontal: moderateScale(8),
    paddingVertical: moderateScale(3)
  },
  categoryPillText: {
    color: "#3730A3",
    fontWeight: "700",
    fontSize: fontScale(12)
  },
  itemDescription: {
    color: "#475569",
    fontSize: fontScale(12)
  },
  itemDescriptionMuted: {
    color: "#94A3B8",
    fontSize: fontScale(12),
    fontWeight: "600"
  },
  itemStock: {
    fontWeight: "700"
  },
  itemStockIn: {
    color: "#047857"
  },
  itemStockOut: {
    color: "#B91C1C"
  },
  addBtn: {
    marginTop: verticalScale(8),
    borderRadius: moderateScale(10),
    backgroundColor: "#FF6B35",
    paddingVertical: moderateScale(10)
  },
  addBtnDisabled: {
    backgroundColor: "#9CA3AF"
  },
  addBtnText: {
    color: "white",
    textAlign: "center",
    fontWeight: "800"
  },
  emptyCard: {
    borderRadius: moderateScale(12),
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
    padding: moderateScale(14),
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(8)
  },
  emptyText: {
    color: "#64748B",
    fontWeight: "600"
  }
});
