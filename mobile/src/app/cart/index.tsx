import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCartStore } from '../../stores/useCartStore';
import { useTheme } from "../../hooks/useTheme";
import { CanteenHeader } from "../../components/CanteenHeader";
import { Button } from "../../components/ui/Button";
import { moderateScale, fontScale, verticalScale, scale, isTablet, gridColumns } from '../../utils/responsive';

const formatCurrency = (value: number): string => `₹ ${value.toFixed(2)}`;

export default function Screen() {
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items, updateQuantity, updateNote, removeItem } = useCartStore();
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const taxAmount = subtotal * 0.05;
  const estimatedTotal = subtotal + taxAmount;

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
        showsVerticalScrollIndicator={false}
      >
      <CanteenHeader showBackButton title="Your Cart" subtitle={`${itemCount} items`} />

      {items.length === 0 ? (
        <View style={styles.emptyStateContainer}>
          <View style={[styles.emptyIconCircle, { backgroundColor: isDark ? colors.surfaceAlt : "#F1F5F9" }]}>
            <Ionicons name="cart-outline" size={40} color={colors.textSecondary} />
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
                <Pressable onPress={() => removeItem(item.menuItemId)} style={[styles.removeBtn, { backgroundColor: isDark ? "rgba(239, 68, 68, 0.15)" : "#FEF2F2" }]}>
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                </Pressable>
              </View>

              <View style={styles.itemControlsRow}>
                <View style={styles.qtyControl}>
                  <Pressable
                    onPress={() => updateQuantity(item.menuItemId, item.quantity - 1)}
                    style={[styles.qtyBtn, { backgroundColor: colors.card, shadowColor: colors.text }]}
                  >
                    <Ionicons name="remove" size={16} color={colors.text} />
                  </Pressable>
                  <Text style={styles.qtyText}>{item.quantity}</Text>
                  <Pressable
                    onPress={() => updateQuantity(item.menuItemId, item.quantity + 1)}
                    style={[styles.qtyBtn, { backgroundColor: colors.card, shadowColor: colors.text }]}
                  >
                    <Ionicons name="add" size={16} color={colors.text} />
                  </Pressable>
                </View>
                <Text style={styles.lineTotal}>{formatCurrency(item.price * item.quantity)}</Text>
              </View>

              <View style={[styles.noteInputWrapper, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                <Ionicons name="create-outline" size={16} color={colors.textMuted} />
                <TextInput
                  value={item.note ?? ""}
                  onChangeText={(txt) => updateNote(item.menuItemId, txt)}
                  placeholder="Add a note (e.g. less spicy)"
                  placeholderTextColor={colors.textMuted}
                  style={styles.noteInput}
                />
              </View>
            </View>
          ))}

          <Pressable
            onPress={() => router.push("/(student)/search")}
            style={[styles.addMoreBtn, { backgroundColor: isDark ? colors.surfaceAlt : "#EFF6FF", borderColor: isDark ? colors.border : "#BFDBFE" }]}
          >
            <Ionicons name="add-circle-outline" size={18} color={colors.accent} />
            <Text style={[styles.addMoreBtnText, { color: colors.accent }]}>Add More Items</Text>
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

        </View>
      )}
      </ScrollView>

      {items.length > 0 && (
        <View style={[styles.checkoutBar, { paddingBottom: Math.max(insets.bottom, moderateScale(16)), backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <Button
            onPress={() => router.push("/cart/checkout")}
            title="Proceed to Checkout"
            icon={<Ionicons name="arrow-forward" size={20} color="white" />}
            style={{
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: moderateScale(8),
              elevation: 4,
            }}
          />
        </View>
      )}
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    padding: moderateScale(16),
    gap: moderateScale(12),
    paddingBottom: verticalScale(120) // Add padding so content isn't hidden behind the floating bar
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
    alignItems: "center",
    justifyContent: "center",
    marginBottom: verticalScale(16)
  },
  emptyTitle: {
    fontSize: fontScale(20),
    fontWeight: "800",
    color: colors.text,
    marginBottom: verticalScale(8)
  },
  emptySub: {
    fontSize: fontScale(15),
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: verticalScale(24),
    lineHeight: 22
  },
  browseMenuBtn: {
    backgroundColor: colors.text,
    paddingHorizontal: moderateScale(24),
    paddingVertical: moderateScale(14),
    borderRadius: moderateScale(12)
  },
  browseMenuBtnText: {
    color: colors.background,
    fontWeight: "700",
    fontSize: fontScale(16)
  },
  itemCard: {
    backgroundColor: colors.card,
    borderRadius: moderateScale(16),
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.text,
    marginBottom: verticalScale(4)
  },
  itemPrice: {
    fontSize: fontScale(14),
    fontWeight: "600",
    color: colors.textSecondary
  },
  removeBtn: {
    padding: moderateScale(6),
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
    backgroundColor: colors.surfaceAlt,
    borderRadius: moderateScale(8),
    padding: moderateScale(4)
  },
  qtyBtn: {
    width: moderateScale(30),
    height: moderateScale(30),
    alignItems: "center",
    justifyContent: "center",
    borderRadius: moderateScale(6),
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1
  },
  qtyText: {
    fontSize: fontScale(15),
    fontWeight: "700",
    color: colors.text,
    width: moderateScale(32),
    textAlign: "center"
  },
  lineTotal: {
    fontSize: fontScale(16),
    fontWeight: "800",
    color: colors.text
  },
  noteInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: moderateScale(8),
    borderWidth: 1,
    paddingHorizontal: moderateScale(10),
    marginTop: verticalScale(4)
  },
  noteInput: {
    flex: 1,
    paddingVertical: moderateScale(10),
    paddingLeft: moderateScale(8),
    color: colors.text,
    fontSize: fontScale(14)
  },
  addMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: moderateScale(8),
    paddingVertical: moderateScale(14),
    borderRadius: moderateScale(12),
    borderWidth: 1
  },
  addMoreBtnText: {
    fontWeight: "700",
    fontSize: fontScale(15)
  },
  invoiceCard: {
    backgroundColor: colors.card,
    borderRadius: moderateScale(16),
    borderWidth: 1,
    borderColor: colors.border,
    padding: moderateScale(16),
    marginTop: verticalScale(8)
  },
  invoiceTitle: {
    fontSize: fontScale(16),
    fontWeight: "800",
    color: colors.text,
    marginBottom: verticalScale(12)
  },
  invoiceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: verticalScale(10)
  },
  invoiceLabel: {
    fontSize: fontScale(14),
    color: colors.textSecondary,
    fontWeight: "500"
  },
  invoiceValue: {
    fontSize: fontScale(14),
    color: colors.text,
    fontWeight: "600"
  },
  invoiceDivider: {
    height: 1,
    backgroundColor: colors.border,
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
    color: colors.text
  },
  invoiceTotalValue: {
    fontSize: fontScale(18),
    fontWeight: "900",
    color: colors.accent
  },
  checkoutBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: moderateScale(16),
    paddingTop: moderateScale(16),
    borderTopWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -4 },
    elevation: 10
  }
});
