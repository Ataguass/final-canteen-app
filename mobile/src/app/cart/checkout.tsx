import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../../hooks/useAuth";
import { useCart } from "../../hooks/useCart";
import { orderService } from "../../services/orderService";
import { PaymentMethod } from "../../services/types";

const PAYMENT_METHODS: PaymentMethod[] = ["CASH", "UPI", "WALLET", "CREDIT"];
const formatCurrency = (value: number): string => `₹ ${value.toFixed(2)}`;

export default function Screen() {
  const router = useRouter();
  const { user, accessToken } = useAuth();
  const { items, subtotal, clearCart } = useCart();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [loading, setLoading] = useState(false);

  const taxAmount = useMemo(() => subtotal * 0.05, [subtotal]);
  const total = subtotal + taxAmount;

  const placeOrder = async () => {
    if (!user?.tenantId || !accessToken) return;
    if (!items.length) {
      Alert.alert("Cart empty", "Add items before checkout.");
      return;
    }

    try {
      setLoading(true);
      const payload = {
        paymentMethod,
        items: items.map((item) => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          note: item.note
        }))
      };
      const response = await orderService.placeOrder(accessToken, user.tenantId, payload);
      clearCart();
      router.replace({
        pathname: "/(student)/orders/[id]",
        params: { id: response.data.id }
      });
    } catch (error) {
      Alert.alert(
        "Order failed",
        error instanceof Error
          ? error.message
          : "Could not place order. Please check internet and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerCard}>
        <View style={styles.headerRow}>
          <View style={styles.iconWrap}>
            <Ionicons name="card-outline" size={20} color="#1D4ED8" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Checkout</Text>
            <Text style={styles.headerSubtitle}>Confirm payment and place your order</Text>
          </View>
        </View>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.sectionTitle}>Order Summary</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Items</Text>
          <Text style={styles.summaryValue}>{items.length}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryValue}>{formatCurrency(subtotal)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Tax (5%)</Text>
          <Text style={styles.summaryValue}>{formatCurrency(taxAmount)}</Text>
        </View>
        <View style={[styles.summaryRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
        </View>
      </View>

      <View style={styles.paymentCard}>
        <Text style={styles.sectionTitle}>Payment Method</Text>
        <View style={styles.methodRow}>
          {PAYMENT_METHODS.map((method) => {
            const active = paymentMethod === method;
            return (
              <Pressable
                key={method}
                onPress={() => setPaymentMethod(method)}
                style={[styles.methodChip, active && styles.methodChipActive]}
              >
                <Text style={[styles.methodChipText, active && styles.methodChipTextActive]}>
                  {method}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Pressable
        onPress={placeOrder}
        disabled={loading || items.length === 0}
        style={[
          styles.placeBtn,
          (loading || items.length === 0) && styles.placeBtnDisabled
        ]}
      >
        <Text style={styles.placeBtnText}>
          {loading ? "Placing Order..." : "Place Order"}
        </Text>
      </Pressable>

      <Pressable
        onPress={() => router.back()}
        style={styles.backBtn}
      >
        <Text style={styles.backBtnText}>Back to Cart</Text>
      </Pressable>
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
    paddingBottom: 24
  },
  headerCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "white",
    padding: 12
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center"
  },
  headerTitle: {
    color: "#0F172A",
    fontSize: 23,
    fontWeight: "800"
  },
  headerSubtitle: {
    color: "#64748B",
    marginTop: 2,
    fontWeight: "600"
  },
  summaryCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "white",
    padding: 12,
    gap: 8
  },
  sectionTitle: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "800"
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  summaryLabel: {
    color: "#64748B",
    fontWeight: "600"
  },
  summaryValue: {
    color: "#0F172A",
    fontWeight: "700"
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingTop: 8
  },
  totalLabel: {
    color: "#0F172A",
    fontWeight: "800"
  },
  totalValue: {
    color: "#059669",
    fontWeight: "900",
    fontSize: 20
  },
  paymentCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "white",
    padding: 12,
    gap: 10
  },
  methodRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  methodChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC"
  },
  methodChipActive: {
    backgroundColor: "#1D4ED8",
    borderColor: "#1D4ED8"
  },
  methodChipText: {
    color: "#334155",
    fontWeight: "700"
  },
  methodChipTextActive: {
    color: "white"
  },
  placeBtn: {
    backgroundColor: "#0F172A",
    borderRadius: 12,
    paddingVertical: 12
  },
  placeBtnDisabled: {
    backgroundColor: "#94A3B8"
  },
  placeBtnText: {
    textAlign: "center",
    color: "white",
    fontWeight: "800",
    fontSize: 15
  },
  backBtn: {
    backgroundColor: "#E2E8F0",
    borderRadius: 12,
    paddingVertical: 12
  },
  backBtnText: {
    color: "#0F172A",
    textAlign: "center",
    fontWeight: "700"
  }
});
