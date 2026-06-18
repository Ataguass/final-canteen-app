import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAuthStore } from '../../stores/useAuthStore';
import { useCartStore } from '../../stores/useCartStore';
import { orderService } from "../../services/orderService";
import { PaymentMethod } from "../../types";
import { walletService } from "../../services/walletService";
import { moderateScale, fontScale, verticalScale, scale, isTablet, gridColumns } from '../../utils/responsive';
import { useTheme } from '../../hooks/useTheme';

const PAYMENT_METHODS: PaymentMethod[] = ["CASH", "UPI", "WALLET", "CREDIT"];
const formatCurrency = (value: number): string => `₹ ${value.toFixed(2)}`;

type PickupSlot = {
  label: string;
  startIso: string;
  endIso: string;
};

const roundToNextHalfHour = (value: Date): Date => {
  const rounded = new Date(value);
  const minutes = rounded.getMinutes();
  const remainder = minutes % 30;
  const addMinutes = remainder === 0 ? 30 : 30 - remainder;
  rounded.setMinutes(minutes + addMinutes, 0, 0);
  return rounded;
};

const generatePickupSlots = (count = 8): PickupSlot[] => {
  const slots: PickupSlot[] = [];
  const base = roundToNextHalfHour(new Date());
  const now = new Date();

  for (let i = 0; i < count; i += 1) {
    const start = new Date(base.getTime() + i * 30 * 60 * 1000);
    const end = new Date(start.getTime() + 30 * 60 * 1000);

    if (start.getTime() <= now.getTime()) continue;

    const dayLabel =
      start.toDateString() === now.toDateString()
        ? "Today"
        : start.toDateString() === new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString()
          ? "Tomorrow"
          : start.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });

    const timeLabel = `${start.toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    })} - ${end.toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    })}`;

    slots.push({
      label: `${dayLabel} · ${timeLabel}`,
      startIso: start.toISOString(),
      endIso: end.toISOString()
    });
  }

  return slots;
};

export default function Screen() {
  const theme = useTheme();
  const { colors, isDark } = theme;
  const styles = createStyles(theme);
  const router = useRouter();
  const { user, accessToken } = useAuthStore();
  const { items, clearCart } = useCartStore();
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [preOrderEnabled, setPreOrderEnabled] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<PickupSlot | null>(null);
  const [loading, setLoading] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  const isTeacher = user?.role === "TEACHER";
  const pickupSlots = useMemo(() => generatePickupSlots(10), []);
  const taxAmount = useMemo(() => subtotal * 0.05, [subtotal]);
  const total = subtotal + taxAmount;

  useEffect(() => {
    const loadWallet = async () => {
      if (!user?.tenantId || !accessToken) return;
      try {
        const response = await walletService.getMe(accessToken, user.tenantId);
        setWalletBalance(response.data.balance);
      } catch {
        setWalletBalance(null);
      }
    };
    loadWallet().catch(() => undefined);
  }, [accessToken, user?.tenantId]);

  const placeOrder = async () => {
    if (!user?.tenantId || !accessToken) return;
    if (!items.length) {
      Alert.alert("Cart empty", "Add items before checkout.");
      return;
    }
    if (isTeacher && preOrderEnabled && !selectedSlot) {
      Alert.alert("Choose pickup slot", "Select a pickup time slot for your pre-order.");
      return;
    }
    if (
      paymentMethod === "WALLET" &&
      walletBalance !== null &&
      total > walletBalance
    ) {
      Alert.alert(
        "Insufficient wallet balance",
        `Available: ${formatCurrency(walletBalance)}. Please top up from Profile.`
      );
      return;
    }

    try {
      setLoading(true);
      const payload = {
        paymentMethod,
        ...(isTeacher && preOrderEnabled && selectedSlot
          ? {
              isPreOrder: true,
              pickupSlotLabel: selectedSlot.label,
              pickupSlotStart: selectedSlot.startIso,
              pickupSlotEnd: selectedSlot.endIso
            }
          : {}),
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
        {paymentMethod === "WALLET" ? (
          <View style={styles.walletHint}>
            <Text style={styles.walletHintText}>
              Wallet Balance: {walletBalance === null ? "Unavailable" : formatCurrency(walletBalance)}
            </Text>
          </View>
        ) : null}
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

      {isTeacher ? (
        <>
          <View style={styles.laneCard}>
            <View style={styles.laneTopRow}>
              <Text style={styles.sectionTitle}>Teacher Priority Lane</Text>
              <View style={styles.laneBadge}>
                <Text style={styles.laneBadgeText}>FAST LANE</Text>
              </View>
            </View>
            <Text style={styles.laneHint}>
              Your orders are automatically placed in the teacher queue for faster handling.
            </Text>
          </View>

          <View style={styles.slotCard}>
            <Text style={styles.sectionTitle}>Pickup Time</Text>
            <View style={styles.slotModeRow}>
              <Pressable
                onPress={() => {
                  setPreOrderEnabled(false);
                  setSelectedSlot(null);
                }}
                style={[styles.slotModeChip, !preOrderEnabled && styles.slotModeChipActive]}
              >
                <Text style={[styles.slotModeText, !preOrderEnabled && styles.slotModeTextActive]}>Order Now</Text>
              </Pressable>
              <Pressable
                onPress={() => setPreOrderEnabled(true)}
                style={[styles.slotModeChip, preOrderEnabled && styles.slotModeChipActive]}
              >
                <Text style={[styles.slotModeText, preOrderEnabled && styles.slotModeTextActive]}>Pre-order</Text>
              </Pressable>
            </View>
            {preOrderEnabled ? (
              <View style={{ gap: moderateScale(8) }}>
                <Text style={styles.slotHint}>Choose your pickup slot</Text>
                <View style={styles.slotList}>
                  {pickupSlots.map((slot) => {
                    const active = selectedSlot?.startIso === slot.startIso;
                    return (
                      <Pressable
                        key={slot.startIso}
                        onPress={() => setSelectedSlot(slot)}
                        style={[styles.slotChip, active && styles.slotChipActive]}
                      >
                        <Text style={[styles.slotChipText, active && styles.slotChipTextActive]}>{slot.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : (
              <Text style={styles.slotHint}>Your order will be sent to kitchen immediately.</Text>
            )}
          </View>
        </>
      ) : null}

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

const createStyles = ({ colors, isDark }: { colors: any, isDark: boolean }) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    padding: moderateScale(16),
    gap: moderateScale(12),
    paddingBottom: verticalScale(24)
  },
  headerCard: {
    borderRadius: moderateScale(16),
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: moderateScale(12)
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(10)
  },
  iconWrap: {
    width: moderateScale(38),
    height: moderateScale(38),
    borderRadius: moderateScale(10),
    backgroundColor: isDark ? "rgba(37, 99, 235, 0.2)" : "#DBEAFE",
    alignItems: "center",
    justifyContent: "center"
  },
  headerTitle: {
    color: colors.text,
    fontSize: fontScale(23),
    fontWeight: "800"
  },
  headerSubtitle: {
    color: colors.textSecondary,
    marginTop: verticalScale(2),
    fontWeight: "600"
  },
  summaryCard: {
    borderRadius: moderateScale(14),
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: moderateScale(12),
    gap: moderateScale(8)
  },
  sectionTitle: {
    color: colors.text,
    fontSize: fontScale(18),
    fontWeight: "800"
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  summaryLabel: {
    color: colors.textSecondary,
    fontWeight: "600"
  },
  summaryValue: {
    color: colors.text,
    fontWeight: "700"
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: verticalScale(8)
  },
  totalLabel: {
    color: colors.text,
    fontWeight: "800"
  },
  totalValue: {
    color: isDark ? "#10B981" : "#059669",
    fontWeight: "900",
    fontSize: fontScale(20)
  },
  paymentCard: {
    borderRadius: moderateScale(14),
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: moderateScale(12),
    gap: moderateScale(10)
  },
  walletHint: {
    borderWidth: 1,
    borderColor: isDark ? colors.border : "#BFDBFE",
    backgroundColor: isDark ? colors.surfaceAlt : "#EFF6FF",
    borderRadius: moderateScale(10),
    paddingHorizontal: moderateScale(10),
    paddingVertical: moderateScale(8)
  },
  walletHintText: {
    color: isDark ? "#60A5FA" : "#1E40AF",
    fontWeight: "700"
  },
  laneCard: {
    borderRadius: moderateScale(14),
    borderWidth: 1,
    borderColor: isDark ? colors.border : "#BFDBFE",
    backgroundColor: isDark ? colors.surfaceAlt : "#EFF6FF",
    padding: moderateScale(12),
    gap: moderateScale(8)
  },
  laneTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: moderateScale(8)
  },
  laneBadge: {
    borderRadius: moderateScale(999),
    backgroundColor: colors.accent,
    paddingHorizontal: moderateScale(10),
    paddingVertical: moderateScale(4)
  },
  laneBadgeText: {
    color: "white",
    fontSize: fontScale(11),
    fontWeight: "800"
  },
  laneHint: {
    color: isDark ? "#93C5FD" : "#1E40AF",
    fontWeight: "600"
  },
  slotCard: {
    borderRadius: moderateScale(14),
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: moderateScale(12),
    gap: moderateScale(10)
  },
  slotModeRow: {
    flexDirection: "row",
    gap: moderateScale(8)
  },
  slotModeChip: {
    flex: 1,
    borderRadius: moderateScale(999),
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingVertical: moderateScale(9),
    alignItems: "center"
  },
  slotModeChipActive: {
    backgroundColor: colors.text,
    borderColor: colors.text
  },
  slotModeText: {
    color: colors.text,
    fontWeight: "700"
  },
  slotModeTextActive: {
    color: colors.background
  },
  slotHint: {
    color: colors.textSecondary,
    fontWeight: "600"
  },
  slotList: {
    gap: moderateScale(8)
  },
  slotChip: {
    borderRadius: moderateScale(10),
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: moderateScale(10),
    paddingVertical: moderateScale(10)
  },
  slotChipActive: {
    backgroundColor: isDark ? "rgba(59, 130, 246, 0.2)" : "#DBEAFE",
    borderColor: colors.accent
  },
  slotChipText: {
    color: colors.text,
    fontWeight: "700"
  },
  slotChipTextActive: {
    color: isDark ? "#93C5FD" : "#1E3A8A"
  },
  methodRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: moderateScale(8)
  },
  methodChip: {
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(8),
    borderRadius: moderateScale(999),
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background
  },
  methodChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent
  },
  methodChipText: {
    color: colors.text,
    fontWeight: "700"
  },
  methodChipTextActive: {
    color: "white"
  },
  placeBtn: {
    backgroundColor: colors.text,
    borderRadius: moderateScale(12),
    paddingVertical: moderateScale(12)
  },
  placeBtnDisabled: {
    backgroundColor: colors.textMuted
  },
  placeBtnText: {
    textAlign: "center",
    color: colors.background,
    fontWeight: "800",
    fontSize: fontScale(15)
  },
  backBtn: {
    backgroundColor: isDark ? colors.surfaceAlt : "#E2E8F0",
    borderRadius: moderateScale(12),
    paddingVertical: moderateScale(12)
  },
  backBtnText: {
    color: colors.text,
    textAlign: "center",
    fontWeight: "700"
  }
});
