import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useCart } from "../../hooks/useCart";

const formatCurrency = (value: number): string => `₹ ${value.toFixed(2)}`;

export default function Screen() {
  const router = useRouter();
  const { items, itemCount, subtotal, updateQuantity, updateNote, removeItem } = useCart();
  const taxAmount = subtotal * 0.05;
  const estimatedTotal = subtotal + taxAmount;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerCard}>
        <View style={styles.headerTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Your Cart</Text>
            <Text style={styles.headerSubtitle}>Review items before checkout</Text>
          </View>
          <Pressable
            onPress={() => router.push("/(student)/search")}
            style={styles.browseBtn}
          >
            <Text style={styles.browseBtnText}>Add More</Text>
          </Pressable>
        </View>
        <View style={styles.metricRow}>
          <View style={[styles.metricCard, styles.metricBlue]}>
            <Text style={styles.metricLabel}>Items</Text>
            <Text style={styles.metricValue}>{itemCount}</Text>
          </View>
          <View style={[styles.metricCard, styles.metricAmber]}>
            <Text style={styles.metricLabel}>Subtotal</Text>
            <Text style={styles.metricValueSm}>{formatCurrency(subtotal)}</Text>
          </View>
        </View>
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="cart-outline" size={30} color="#94A3B8" />
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySub}>
            Add items from Search or Dashboard to place an order.
          </Text>
          <Pressable
            onPress={() => router.push("/(student)/search")}
            style={styles.emptyActionBtn}
          >
            <Text style={styles.emptyActionText}>Browse Menu</Text>
          </Pressable>
        </View>
      ) : (
        items.map((item) => (
          <View key={item.menuItemId} style={styles.itemCard}>
            <View style={styles.itemTopRow}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Pressable onPress={() => removeItem(item.menuItemId)}>
                <Ionicons name="trash-outline" size={18} color="#B91C1C" />
              </Pressable>
            </View>

            <Text style={styles.itemMeta}>{formatCurrency(item.price)} per item</Text>

            <View style={styles.qtyRow}>
              <Pressable
                onPress={() => updateQuantity(item.menuItemId, item.quantity - 1)}
                style={styles.qtyBtn}
              >
                <Text style={styles.qtyBtnText}>-</Text>
              </Pressable>
              <TextInput
                value={String(item.quantity)}
                onChangeText={(txt) => {
                  const parsed = Number.parseInt(txt, 10);
                  updateQuantity(item.menuItemId, Number.isNaN(parsed) ? 0 : parsed);
                }}
                keyboardType="numeric"
                style={styles.qtyInput}
              />
              <Pressable
                onPress={() => updateQuantity(item.menuItemId, item.quantity + 1)}
                style={[styles.qtyBtn, styles.qtyBtnPlus]}
              >
                <Text style={styles.qtyBtnText}>+</Text>
              </Pressable>
              <Text style={styles.lineTotal}>
                {formatCurrency(item.price * item.quantity)}
              </Text>
            </View>

            <TextInput
              value={item.note ?? ""}
              onChangeText={(txt) => updateNote(item.menuItemId, txt)}
              placeholder="Add note (no onion, less spicy, etc.)"
              placeholderTextColor="#94A3B8"
              style={styles.noteInput}
            />
          </View>
        ))
      )}

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Order Summary</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryValue}>{formatCurrency(subtotal)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Estimated Tax (5%)</Text>
          <Text style={styles.summaryValue}>{formatCurrency(taxAmount)}</Text>
        </View>
        <View style={[styles.summaryRow, styles.summaryTotalRow]}>
          <Text style={styles.summaryTotalLabel}>Estimated Total</Text>
          <Text style={styles.summaryTotalValue}>{formatCurrency(estimatedTotal)}</Text>
        </View>
      </View>

      <Link href="/cart/checkout" asChild>
        <Pressable
          disabled={items.length === 0}
          style={[
            styles.checkoutBtn,
            items.length === 0 && styles.checkoutBtnDisabled
          ]}
        >
          <Text style={styles.checkoutBtnText}>Proceed to Checkout</Text>
        </Pressable>
      </Link>
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
    gap: 12,
    paddingBottom: 28
  },
  headerCard: {
    backgroundColor: "white",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    gap: 10
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  headerTitle: {
    color: "#0F172A",
    fontSize: 24,
    fontWeight: "800"
  },
  headerSubtitle: {
    color: "#64748B",
    marginTop: 2,
    fontWeight: "600"
  },
  browseBtn: {
    backgroundColor: "#0F172A",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  browseBtnText: {
    color: "white",
    fontWeight: "700"
  },
  metricRow: {
    flexDirection: "row",
    gap: 8
  },
  metricCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10
  },
  metricBlue: {
    backgroundColor: "#DBEAFE",
    borderColor: "#BFDBFE"
  },
  metricAmber: {
    backgroundColor: "#FEF3C7",
    borderColor: "#FDE68A"
  },
  metricLabel: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "700"
  },
  metricValue: {
    marginTop: 3,
    color: "#0F172A",
    fontSize: 24,
    fontWeight: "800"
  },
  metricValueSm: {
    marginTop: 5,
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "800"
  },
  emptyCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
    padding: 18,
    alignItems: "center",
    gap: 7
  },
  emptyTitle: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "800"
  },
  emptySub: {
    color: "#64748B",
    textAlign: "center"
  },
  emptyActionBtn: {
    marginTop: 6,
    backgroundColor: "#1D4ED8",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  emptyActionText: {
    color: "white",
    fontWeight: "700"
  },
  itemCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "white",
    padding: 12,
    gap: 8
  },
  itemTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  itemName: {
    color: "#0F172A",
    fontWeight: "800",
    fontSize: 17,
    flex: 1
  },
  itemMeta: {
    color: "#64748B"
  },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  qtyBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center"
  },
  qtyBtnPlus: {
    backgroundColor: "#BFDBFE"
  },
  qtyBtnText: {
    color: "#0F172A",
    fontWeight: "800",
    fontSize: 20
  },
  qtyInput: {
    width: 56,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    textAlign: "center",
    color: "#0F172A",
    fontWeight: "700",
    paddingVertical: 8,
    paddingHorizontal: 6
  },
  lineTotal: {
    marginLeft: "auto",
    color: "#0F172A",
    fontWeight: "800"
  },
  noteInput: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    color: "#0F172A",
    paddingHorizontal: 10,
    paddingVertical: 9
  },
  summaryCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "white",
    padding: 12,
    gap: 8
  },
  summaryTitle: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "800"
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  summaryLabel: {
    color: "#64748B",
    fontWeight: "600"
  },
  summaryValue: {
    color: "#0F172A",
    fontWeight: "700"
  },
  summaryTotalRow: {
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingTop: 8
  },
  summaryTotalLabel: {
    color: "#0F172A",
    fontWeight: "800"
  },
  summaryTotalValue: {
    color: "#059669",
    fontWeight: "900",
    fontSize: 19
  },
  checkoutBtn: {
    backgroundColor: "#0F172A",
    borderRadius: 12,
    paddingVertical: 13
  },
  checkoutBtnDisabled: {
    backgroundColor: "#94A3B8"
  },
  checkoutBtnText: {
    color: "white",
    textAlign: "center",
    fontWeight: "800",
    fontSize: 15
  }
});
