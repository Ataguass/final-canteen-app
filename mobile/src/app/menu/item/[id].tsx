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
import { useAuth } from "../../../hooks/useAuth";
import { useCart } from "../../../hooks/useCart";
import { menuService } from "../../../services/menuService";

const formatCurrency = (value: number): string => `₹ ${value.toFixed(2)}`;

export default function Screen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, accessToken } = useAuth();
  const { addItem } = useCart();
  const [item, setItem] = useState<{
    id: string;
    name: string;
    price: number;
    description?: string | null;
    image?: string | null;
    stockQty: number;
  } | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!user?.tenantId || !accessToken || !id) return;
      const response = await menuService.getItem(accessToken, user.tenantId, id);
      setItem(response.data);
    };
    load().catch(() => undefined);
  }, [id, user?.tenantId, accessToken]);

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
    addItem({ menuItemId: item.id, name: item.name, price: item.price, note }, quantity);
    Alert.alert("Added to cart", `${item.name} added to cart.`);
    router.push("/cart");
  };

  if (!item) {
    return (
      <View style={styles.loadingWrap}>
        <Text style={styles.loadingText}>Loading item...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top > 0 ? insets.top + 10 : 20 }]}>
      <View style={styles.topNav}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#0F172A" />
        </Pressable>
        <Text style={styles.topNavTitle}>Item Details</Text>
        <View style={{ width: 40 }} />
      </View>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heroCard}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.itemImage} resizeMode="cover" />
        ) : (
          <View style={styles.itemImageFallback}>
            <Ionicons name="fast-food-outline" size={32} color="#94A3B8" />
          </View>
        )}
        <View style={styles.heroContent}>
          <Text style={styles.itemName}>{item.name}</Text>
          <View style={styles.badgeRow}>
            <View style={styles.priceBadge}>
              <Text style={styles.priceBadgeText}>{formatCurrency(item.price)}</Text>
            </View>
            <View style={[styles.stockBadge, isOutOfStock ? styles.stockBadgeOut : styles.stockBadgeIn]}>
              <Ionicons
                name={isOutOfStock ? "alert-circle-outline" : "checkmark-circle-outline"}
                size={14}
                color={isOutOfStock ? "#B91C1C" : "#047857"}
              />
              <Text style={[styles.stockBadgeText, isOutOfStock ? styles.stockOut : styles.stockIn]}>
                {isOutOfStock ? "Out of stock" : `${item.stockQty} available`}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {item.description ? (
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
                  if (item.stockQty <= 0) return 1;
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
          placeholderTextColor="#94A3B8"
          style={styles.noteInput}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>

      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Line Total</Text>
        <Text style={styles.totalValue}>{formatCurrency(item.price * quantity)}</Text>
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
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A"
  },
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 24
  },
  loadingWrap: {
    flex: 1,
    backgroundColor: "#EEF2F7",
    alignItems: "center",
    justifyContent: "center",
    padding: 16
  },
  loadingText: {
    color: "#475569",
    fontWeight: "600"
  },
  heroCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "white",
    overflow: "hidden",
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1
  },
  heroContent: {
    padding: 12,
    gap: 8
  },
  itemName: {
    color: "#0F172A",
    fontWeight: "800",
    fontSize: 23
  },
  badgeRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap"
  },
  priceBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "#FED7AA",
    backgroundColor: "#FFF7ED"
  },
  priceBadgeText: {
    color: "#C2410C",
    fontWeight: "800"
  },
  stockBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  stockBadgeIn: {
    borderColor: "#BBF7D0",
    backgroundColor: "#ECFDF5"
  },
  stockBadgeOut: {
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2"
  },
  stockBadgeText: {
    fontWeight: "700",
    fontSize: 12
  },
  itemPrice: {
    marginTop: 2,
    color: "#0F172A",
    fontWeight: "800",
    fontSize: 18
  },
  itemImage: {
    width: "100%",
    height: 220,
    backgroundColor: "#F1F5F9"
  },
  itemImageFallback: {
    width: "100%",
    height: 220,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center"
  },
  infoCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "white",
    padding: 12,
    gap: 8
  },
  configCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "white",
    padding: 12,
    gap: 10
  },
  cardTitle: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "800"
  },
  itemDescription: {
    color: "#475569",
    lineHeight: 20
  },
  stockRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  stockText: {
    fontWeight: "700"
  },
  stockIn: {
    color: "#047857"
  },
  stockOut: {
    color: "#B91C1C"
  },
  quantityRow: {
    gap: 8
  },
  fieldLabel: {
    color: "#334155",
    fontWeight: "700"
  },
  qtyControl: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  qtyBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center"
  },
  qtyBtnPlus: {
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF"
  },
  qtyBtnText: {
    color: "#0F172A",
    fontSize: 20,
    fontWeight: "800"
  },
  qtyInput: {
    width: 72,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
    textAlign: "center",
    color: "#0F172A",
    fontWeight: "700",
    paddingVertical: 10
  },
  noteInput: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: "#0F172A",
    minHeight: 84
  },
  totalCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "white",
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  totalLabel: {
    color: "#64748B",
    fontWeight: "700"
  },
  totalValue: {
    color: "#059669",
    fontSize: 22,
    fontWeight: "900"
  },
  addBtn: {
    backgroundColor: "#FF6B35",
    borderRadius: 12,
    paddingVertical: 13
  },
  addBtnDisabled: {
    backgroundColor: "#94A3B8"
  },
  addBtnText: {
    color: "white",
    textAlign: "center",
    fontWeight: "800",
    fontSize: 15
  }
});
