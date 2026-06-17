import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCart } from "../../hooks/useCart";
import { CanteenHeader } from "../../components/CanteenHeader";

const formatCurrency = (value: number): string => `₹ ${value.toFixed(2)}`;

export default function Screen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items, itemCount, subtotal, updateQuantity, updateNote, removeItem } = useCart();
  const taxAmount = subtotal * 0.05;
  const estimatedTotal = subtotal + taxAmount;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      showsVerticalScrollIndicator={false}
    >
      <CanteenHeader showBackButton title="Your Cart" subtitle={`${itemCount} items`} />

      {items.length === 0 ? (
        <View style={styles.emptyStateContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="cart-outline" size={40} color="#94A3B8" />
          </View>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySub}>Looks like you haven't added anything to your cart yet.</Text>
          <Pressable
            onPress={() => router.push("/(student)/search")}
            style={styles.browseMenuBtn}
          >
            <Text style={styles.browseMenuBtnText}>Browse Menu</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          {items.map((item) => (
            <View key={item.menuItemId} style={styles.itemCard}>
              <View style={styles.itemTopRow}>
                <View style={styles.itemDetails}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemPrice}>{formatCurrency(item.price)}</Text>
                </View>
                <Pressable onPress={() => removeItem(item.menuItemId)} style={styles.removeBtn}>
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </Pressable>
              </View>

              <View style={styles.itemControlsRow}>
                <View style={styles.qtyControl}>
                  <Pressable
                    onPress={() => updateQuantity(item.menuItemId, item.quantity - 1)}
                    style={styles.qtyBtn}
                  >
                    <Ionicons name="remove" size={16} color="#0F172A" />
                  </Pressable>
                  <Text style={styles.qtyText}>{item.quantity}</Text>
                  <Pressable
                    onPress={() => updateQuantity(item.menuItemId, item.quantity + 1)}
                    style={styles.qtyBtn}
                  >
                    <Ionicons name="add" size={16} color="#0F172A" />
                  </Pressable>
                </View>
                <Text style={styles.lineTotal}>{formatCurrency(item.price * item.quantity)}</Text>
              </View>

              <View style={styles.noteInputWrapper}>
                <Ionicons name="create-outline" size={16} color="#94A3B8" />
                <TextInput
                  value={item.note ?? ""}
                  onChangeText={(txt) => updateNote(item.menuItemId, txt)}
                  placeholder="Add a note (e.g. less spicy)"
                  placeholderTextColor="#94A3B8"
                  style={styles.noteInput}
                />
              </View>
            </View>
          ))}

          <Pressable
            onPress={() => router.push("/(student)/search")}
            style={styles.addMoreBtn}
          >
            <Ionicons name="add-circle-outline" size={18} color="#2563EB" />
            <Text style={styles.addMoreBtnText}>Add More Items</Text>
          </Pressable>

          <View style={styles.invoiceCard}>
            <Text style={styles.invoiceTitle}>Order Summary</Text>
            
            <View style={styles.invoiceRow}>
              <Text style={styles.invoiceLabel}>Subtotal</Text>
              <Text style={styles.invoiceValue}>{formatCurrency(subtotal)}</Text>
            </View>
            <View style={styles.invoiceRow}>
              <Text style={styles.invoiceLabel}>Estimated Tax (5%)</Text>
              <Text style={styles.invoiceValue}>{formatCurrency(taxAmount)}</Text>
            </View>
            
            <View style={styles.invoiceDivider} />
            
            <View style={styles.invoiceTotalRow}>
              <Text style={styles.invoiceTotalLabel}>Total</Text>
              <Text style={styles.invoiceTotalValue}>{formatCurrency(estimatedTotal)}</Text>
            </View>
          </View>

          <Link href="/cart/checkout" asChild>
            <Pressable style={styles.checkoutBtn}>
              <Text style={styles.checkoutBtnText}>Proceed to Checkout</Text>
              <Ionicons name="arrow-forward" size={20} color="white" />
            </Pressable>
          </Link>
        </View>
      )}
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
  emptyStateContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 20
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 8
  },
  emptySub: {
    fontSize: 15,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22
  },
  browseMenuBtn: {
    backgroundColor: "#0F172A",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12
  },
  browseMenuBtnText: {
    color: "white",
    fontWeight: "700",
    fontSize: 16
  },
  itemCard: {
    backgroundColor: "white",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    gap: 12
  },
  itemTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start"
  },
  itemDetails: {
    flex: 1,
    paddingRight: 10
  },
  itemName: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 4
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748B"
  },
  removeBtn: {
    padding: 6,
    backgroundColor: "#FEF2F2",
    borderRadius: 8
  },
  itemControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4
  },
  qtyControl: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    padding: 4
  },
  qtyBtn: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "white",
    borderRadius: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1
  },
  qtyText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
    width: 32,
    textAlign: "center"
  },
  lineTotal: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A"
  },
  noteInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 10,
    marginTop: 4
  },
  noteInput: {
    flex: 1,
    paddingVertical: 10,
    paddingLeft: 8,
    color: "#0F172A",
    fontSize: 14
  },
  addMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BFDBFE"
  },
  addMoreBtnText: {
    color: "#2563EB",
    fontWeight: "700",
    fontSize: 15
  },
  invoiceCard: {
    backgroundColor: "white",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    marginTop: 8
  },
  invoiceTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 12
  },
  invoiceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10
  },
  invoiceLabel: {
    fontSize: 14,
    color: "#64748B",
    fontWeight: "500"
  },
  invoiceValue: {
    fontSize: 14,
    color: "#0F172A",
    fontWeight: "600"
  },
  invoiceDivider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    borderStyle: "dashed",
    marginVertical: 12
  },
  invoiceTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  invoiceTotalLabel: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A"
  },
  invoiceTotalValue: {
    fontSize: 18,
    fontWeight: "900",
    color: "#2563EB"
  },
  checkoutBtn: {
    backgroundColor: "#0F172A",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 12,
    gap: 8,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4
  },
  checkoutBtnText: {
    color: "white",
    fontSize: 16,
    fontWeight: "800"
  }
});
