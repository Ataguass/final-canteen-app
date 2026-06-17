import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCart } from "../../hooks/useCart";
import { CanteenHeader } from "../../components/CanteenHeader";
import { moderateScale, fontScale, verticalScale, scale, isTablet, gridColumns } from '../../utils/responsive';

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
        <View style={{ gap: moderateScale(12) }}>
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
    padding: moderateScale(16),
    gap: moderateScale(12),
    paddingBottom: verticalScale(28)
  },
  emptyStateContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: moderateScale(60),
    paddingHorizontal: moderateScale(20)
  },
  emptyIconCircle: {
    width: moderateScale(80),
    height: moderateScale(80),
    borderRadius: moderateScale(40),
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: verticalScale(16)
  },
  emptyTitle: {
    fontSize: fontScale(20),
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: verticalScale(8)
  },
  emptySub: {
    fontSize: fontScale(15),
    color: "#64748B",
    textAlign: "center",
    marginBottom: verticalScale(24),
    lineHeight: 22
  },
  browseMenuBtn: {
    backgroundColor: "#0F172A",
    paddingHorizontal: moderateScale(24),
    paddingVertical: moderateScale(14),
    borderRadius: moderateScale(12)
  },
  browseMenuBtnText: {
    color: "white",
    fontWeight: "700",
    fontSize: fontScale(16)
  },
  itemCard: {
    backgroundColor: "white",
    borderRadius: moderateScale(16),
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: moderateScale(16),
    gap: moderateScale(12)
  },
  itemTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start"
  },
  itemDetails: {
    flex: 1,
    paddingRight: moderateScale(10)
  },
  itemName: {
    fontSize: fontScale(17),
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: verticalScale(4)
  },
  itemPrice: {
    fontSize: fontScale(14),
    fontWeight: "600",
    color: "#64748B"
  },
  removeBtn: {
    padding: moderateScale(6),
    backgroundColor: "#FEF2F2",
    borderRadius: moderateScale(8)
  },
  itemControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: verticalScale(4)
  },
  qtyControl: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: moderateScale(8),
    padding: moderateScale(4)
  },
  qtyBtn: {
    width: moderateScale(30),
    height: moderateScale(30),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "white",
    borderRadius: moderateScale(6),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1
  },
  qtyText: {
    fontSize: fontScale(15),
    fontWeight: "700",
    color: "#0F172A",
    width: moderateScale(32),
    textAlign: "center"
  },
  lineTotal: {
    fontSize: fontScale(16),
    fontWeight: "800",
    color: "#0F172A"
  },
  noteInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: moderateScale(8),
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: moderateScale(10),
    marginTop: verticalScale(4)
  },
  noteInput: {
    flex: 1,
    paddingVertical: moderateScale(10),
    paddingLeft: moderateScale(8),
    color: "#0F172A",
    fontSize: fontScale(14)
  },
  addMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: moderateScale(8),
    paddingVertical: moderateScale(14),
    backgroundColor: "#EFF6FF",
    borderRadius: moderateScale(12),
    borderWidth: 1,
    borderColor: "#BFDBFE"
  },
  addMoreBtnText: {
    color: "#2563EB",
    fontWeight: "700",
    fontSize: fontScale(15)
  },
  invoiceCard: {
    backgroundColor: "white",
    borderRadius: moderateScale(16),
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: moderateScale(16),
    marginTop: verticalScale(8)
  },
  invoiceTitle: {
    fontSize: fontScale(16),
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: verticalScale(12)
  },
  invoiceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: verticalScale(10)
  },
  invoiceLabel: {
    fontSize: fontScale(14),
    color: "#64748B",
    fontWeight: "500"
  },
  invoiceValue: {
    fontSize: fontScale(14),
    color: "#0F172A",
    fontWeight: "600"
  },
  invoiceDivider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    borderStyle: "dashed",
    marginVertical: moderateScale(12)
  },
  invoiceTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  invoiceTotalLabel: {
    fontSize: fontScale(16),
    fontWeight: "800",
    color: "#0F172A"
  },
  invoiceTotalValue: {
    fontSize: fontScale(18),
    fontWeight: "900",
    color: "#2563EB"
  },
  checkoutBtn: {
    backgroundColor: "#0F172A",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: moderateScale(16),
    borderRadius: moderateScale(16),
    marginTop: verticalScale(12),
    gap: moderateScale(8),
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: moderateScale(8),
    elevation: 4
  },
  checkoutBtnText: {
    color: "white",
    fontSize: fontScale(16),
    fontWeight: "800"
  }
});
