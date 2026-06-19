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
  TextInput,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from '../../../stores/useAuthStore';
import { useCartStore } from '../../../stores/useCartStore';
import { useFavoritesStore } from '../../../stores/useFavoritesStore';
import { useMenuItem } from "../../../hooks/queries/useMenu";
import { moderateScale, fontScale, verticalScale, scale, isTablet, gridColumns } from '../../../utils/responsive';
import { useTheme } from '../../../hooks/useTheme';
import { Shimmer } from "../../../components/Shimmer";

const formatCurrency = (value: number): string => `₹ ${value.toFixed(2)}`;

export default function Screen() {
  const theme = useTheme();
  const { colors, isDark } = theme;
  const styles = createStyles(theme);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, accessToken } = useAuthStore();
  const { addItem } = useCartStore();
  const { addFavorite, removeFavorite, isFavorite } = useFavoritesStore();
  
  const { data: item, isLoading } = useMenuItem(id);

  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");

  const isOutOfStock = useMemo(() => (item ? item.stockQty <= 0 : true), [item]);

  const onAdd = () => {
    if (!item) return;
    if (quantity <= 0) {
      Alert.alert("Invalid quantity", "Please enter quantity greater than 0.");
      return;
    }
    if (quantity > item.stockQty) {
      Alert.alert("Not enough stock", `Only ${item.stockQty} item(s) available.`);
      return;
    }
    addItem({ menuItemId: item.id, name: item.name, price: item.price, note: note.trim() || undefined }, quantity);
    Alert.alert(
      "Added to Cart",
      `${quantity}x ${item.name} has been added.`,
      [
        { text: "Continue Shopping", style: "cancel" },
        { text: "View Cart", onPress: () => router.push("/cart") }
      ]
    );
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top > 0 ? insets.top + 10 : 20 }]}>
      <View style={styles.topNav}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.topNavTitle}>Item Details</Text>
        <View style={{ width: moderateScale(40) }} />
      </View>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heroCard}>
        {isLoading ? (
          <View style={[styles.itemImage, { backgroundColor: isDark ? "#1E293B" : "#F1F5F9", justifyContent: "center", alignItems: "center" }]}>
            <Shimmer width="100%" height="100%" borderRadius={0} />
          </View>
        ) : item?.image ? (
          <Image source={{ uri: item.image }} style={styles.itemImage} resizeMode="cover" />
        ) : (
          <View style={styles.itemImageFallback}>
            <Ionicons name="fast-food-outline" size={32} color={colors.textMuted} />
          </View>
        )}
        <View style={styles.heroContent}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            {isLoading ? (
              <Shimmer width={200} height={32} borderRadius={8} />
            ) : (
              <Text style={[styles.itemName, { flex: 1 }]}>{item?.name}</Text>
            )}
            {!isLoading && item && (
              <Pressable
                onPress={() => isFavorite(item.id) ? removeFavorite(item.id) : addFavorite(item.id)}
                style={styles.heartBtn}
              >
                <Ionicons 
                  name={isFavorite(item.id) ? "heart" : "heart-outline"} 
                  size={24} 
                  color={isFavorite(item.id) ? "#EF4444" : colors.textSecondary} 
                />
              </Pressable>
            )}
          </View>
          
          <View style={styles.badgeRow}>
            {isLoading ? (
              <Shimmer width={80} height={28} borderRadius={14} />
            ) : (
              <View style={styles.priceBadge}>
                <Text style={styles.priceBadgeText}>{formatCurrency(item?.price || 0)}</Text>
              </View>
            )}
            {isLoading ? (
              <Shimmer width={100} height={28} borderRadius={14} />
            ) : item && item.stockQty > 0 ? (
              <View style={styles.stockBadge}>
                <Ionicons name="checkmark-circle" size={14} color="#059669" />
                <Text style={styles.stockBadgeText}>In Stock ({item.stockQty})</Text>
              </View>
            ) : !isLoading && item ? (
              <View style={[styles.stockBadge, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}>
                <Ionicons name="close-circle" size={14} color="#DC2626" />
                <Text style={[styles.stockBadgeText, { color: "#DC2626" }]}>Out of Stock</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.infoCard}>
          <Shimmer width="40%" height={20} style={{ marginBottom: 12 }} />
          <Shimmer width="100%" height={16} style={{ marginBottom: 8 }} />
          <Shimmer width="90%" height={16} style={{ marginBottom: 8 }} />
          <Shimmer width="60%" height={16} />
        </View>
      ) : item?.description ? (
        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>About this item</Text>
          <Text style={styles.itemDescription}>
            {item.description}
          </Text>
        </View>
      ) : null}

      <View style={styles.configCard}>
        <Text style={styles.cardTitle}>Customize order</Text>
        <View style={styles.quantityRow}>
          <Text style={styles.fieldLabel}>Quantity</Text>
          <View style={styles.qtyControl}>
            <Pressable
              onPress={() => setQuantity((q) => Math.max(q - 1, 1))}
              style={styles.qtyBtn}
            >
              <Text style={styles.qtyBtnText}>-</Text>
            </Pressable>
            <TextInput
              value={String(quantity)}
              onChangeText={(txt) => {
                const parsed = Number.parseInt(txt, 10);
                setQuantity(Number.isNaN(parsed) || parsed <= 0 ? 1 : parsed);
              }}
              keyboardType="numeric"
              style={styles.qtyInput}
            />
            <Pressable
              onPress={() =>
                setQuantity((q) => {
                  if (!item || item.stockQty <= 0) return 1;
                  return Math.min(q + 1, item.stockQty);
                })
              }
              style={[styles.qtyBtn, styles.qtyBtnPlus]}
            >
              <Text style={styles.qtyBtnText}>+</Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.fieldLabel}>Note (optional)</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="No onion, less spicy, etc."
          placeholderTextColor={colors.textMuted}
          style={styles.noteInput}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>

      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Line Total</Text>
        <Text style={styles.totalValue}>{formatCurrency((item?.price || 0) * quantity)}</Text>
      </View>

      <Pressable
        onPress={onAdd}
        disabled={isOutOfStock}
        style={[styles.addBtn, isOutOfStock && styles.addBtnDisabled]}
      >
        <Text style={styles.addBtnText}>
          {isOutOfStock ? "Unavailable" : "Add to Cart"}
        </Text>
      </Pressable>
    </ScrollView>
    </View>
  );
}

const createStyles = ({ colors, isDark }: { colors: any, isDark: boolean }) => StyleSheet.create({
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
    fontSize: fontScale(16),
    fontWeight: "700",
    color: colors.text
  },
  content: {
    padding: moderateScale(16),
    gap: moderateScale(12),
    paddingBottom: verticalScale(24)
  },
  loadingWrap: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: moderateScale(16)
  },
  loadingText: {
    color: colors.textSecondary,
    fontWeight: "600"
  },
  heroCard: {
    borderRadius: moderateScale(16),
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    overflow: "hidden",
    shadowColor: colors.text,
    shadowOpacity: 0.04,
    shadowRadius: moderateScale(8),
    shadowOffset: { width: 0, height: 3 },
    elevation: 1
  },
  heroContent: {
    padding: moderateScale(12),
    gap: moderateScale(8)
  },
  itemName: {
    color: colors.text,
    fontWeight: "800",
    fontSize: fontScale(23)
  },
  heartBtn: {
    padding: moderateScale(4),
    backgroundColor: colors.surfaceAlt,
    borderRadius: moderateScale(20)
  },
  badgeRow: {
    flexDirection: "row",
    gap: moderateScale(8),
    alignItems: "center",
    flexWrap: "wrap"
  },
  priceBadge: {
    borderRadius: moderateScale(999),
    paddingHorizontal: moderateScale(10),
    paddingVertical: moderateScale(5),
    borderWidth: 1,
    borderColor: isDark ? "rgba(194, 65, 12, 0.4)" : "#FED7AA",
    backgroundColor: isDark ? "rgba(194, 65, 12, 0.2)" : "#FFF7ED"
  },
  priceBadgeText: {
    color: isDark ? "#FDBA74" : "#C2410C",
    fontWeight: "800"
  },
  stockBadge: {
    borderRadius: moderateScale(999),
    paddingHorizontal: moderateScale(10),
    paddingVertical: moderateScale(5),
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(4)
  },
  stockBadgeIn: {
    borderColor: isDark ? "rgba(4, 120, 87, 0.4)" : "#BBF7D0",
    backgroundColor: isDark ? "rgba(4, 120, 87, 0.2)" : "#ECFDF5"
  },
  stockBadgeOut: {
    borderColor: isDark ? "rgba(185, 28, 28, 0.4)" : "#FECACA",
    backgroundColor: isDark ? "rgba(185, 28, 28, 0.2)" : "#FEF2F2"
  },
  stockBadgeText: {
    fontWeight: "700",
    fontSize: fontScale(12)
  },
  itemPrice: {
    marginTop: verticalScale(2),
    color: colors.text,
    fontWeight: "800",
    fontSize: fontScale(18)
  },
  itemImage: {
    width: "100%",
    height: moderateScale(220),
    backgroundColor: colors.surfaceAlt
  },
  itemImageFallback: {
    width: "100%",
    height: moderateScale(220),
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center"
  },
  infoCard: {
    borderRadius: moderateScale(14),
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: moderateScale(12),
    gap: moderateScale(8)
  },
  configCard: {
    borderRadius: moderateScale(14),
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: moderateScale(12),
    gap: moderateScale(10)
  },
  cardTitle: {
    color: colors.text,
    fontSize: fontScale(18),
    fontWeight: "800"
  },
  itemDescription: {
    color: colors.textSecondary,
    lineHeight: 20
  },
  stockRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(6)
  },
  stockText: {
    fontWeight: "700"
  },
  stockIn: {
    color: isDark ? "#34D399" : "#047857"
  },
  stockOut: {
    color: isDark ? "#F87171" : "#B91C1C"
  },
  quantityRow: {
    gap: moderateScale(8)
  },
  fieldLabel: {
    color: colors.text,
    fontWeight: "700"
  },
  qtyControl: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(8)
  },
  qtyBtn: {
    width: moderateScale(42),
    height: moderateScale(42),
    borderRadius: moderateScale(12),
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center"
  },
  qtyBtnPlus: {
    borderColor: isDark ? colors.border : "#BFDBFE",
    backgroundColor: isDark ? colors.surfaceAlt : "#EFF6FF"
  },
  qtyBtnText: {
    color: colors.text,
    fontSize: fontScale(20),
    fontWeight: "800"
  },
  qtyInput: {
    width: moderateScale(72),
    borderRadius: moderateScale(12),
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    textAlign: "center",
    color: colors.text,
    fontWeight: "700",
    paddingVertical: moderateScale(10)
  },
  noteInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: moderateScale(12),
    backgroundColor: colors.background,
    paddingHorizontal: moderateScale(10),
    paddingVertical: moderateScale(10),
    color: colors.text,
    minHeight: moderateScale(84)
  },
  totalCard: {
    borderRadius: moderateScale(14),
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: moderateScale(12),
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  totalLabel: {
    color: colors.textSecondary,
    fontWeight: "700"
  },
  totalValue: {
    color: isDark ? "#10B981" : "#059669",
    fontSize: fontScale(22),
    fontWeight: "900"
  },
  addBtn: {
    backgroundColor: colors.accent,
    borderRadius: moderateScale(12),
    paddingVertical: moderateScale(13)
  },
  addBtnDisabled: {
    backgroundColor: colors.textMuted
  },
  addBtnText: {
    color: "white",
    textAlign: "center",
    fontWeight: "800",
    fontSize: fontScale(15)
  }
});
