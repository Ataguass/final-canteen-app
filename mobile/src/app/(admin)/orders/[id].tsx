import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAuthStore } from '../../../stores/useAuthStore';
import { useOrderSocket } from "../../../hooks/useOrderSocket";
import { Order } from "../../../types";
import {  orderService } from "../../../services/orderService";
import { moderateScale, fontScale, verticalScale, scale, isTablet, gridColumns } from '../../../utils/responsive';
import { useTheme } from '../../../hooks/useTheme';

const statusActions = ["ACCEPTED", "PREPARING", "READY", "COMPLETED", "CANCELLED"] as const;

const statusColorMap: Record<string, string> = {
  PENDING: "#D97706",
  ACCEPTED: "#2563EB",
  PREPARING: "#7C3AED",
  READY: "#0891B2",
  COMPLETED: "#059669",
  CANCELLED: "#DC2626",
  REFUNDED: "#6B7280"
};

const statusBgMap: Record<string, string> = {
  PENDING: "#FEF3C7",
  ACCEPTED: "#DBEAFE",
  PREPARING: "#EDE9FE",
  READY: "#CFFAFE",
  COMPLETED: "#D1FAE5",
  CANCELLED: "#FEE2E2",
  REFUNDED: "#F3F4F6"
};

const formatCurrency = (value: number): string => `₹ ${value.toFixed(2)}`;

export default function Screen() {
  const theme = useTheme();
  const { colors, isDark } = theme;
  const styles = createStyles(theme);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, accessToken } = useAuthStore();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);

  const load = useCallback(async () => {
    if (!user?.tenantId || !accessToken || !id) return;
    try {
      setLoading(true);
      const response = await orderService.getOrder(accessToken, user.tenantId, id);
      setOrder(response.data);
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Could not load order");
    } finally {
      setLoading(false);
    }
  }, [id, user?.tenantId, accessToken]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  useOrderSocket({
    tenantId: user?.tenantId,
    onOrderStatusChanged: (incoming) => {
      if (incoming.id === id) setOrder(incoming);
    }
  });

  const setStatus = async (status: string) => {
    if (!user?.tenantId || !accessToken || !id) return;
    try {
      setUpdating(true);
      const response = await orderService.updateOrderStatus(accessToken, user.tenantId, id, status);
      setOrder(response.data);
      Alert.alert("Updated", `Order marked as ${status}`);
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Could not update order status");
    } finally {
      setUpdating(false);
    }
  };

  const totals = useMemo(() => {
    if (!order) {
      return { qty: 0, subtotal: 0 };
    }
    return {
      qty: order.items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: order.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
    };
  }, [order]);

  if (loading && !order) {
    return (
      <View style={styles.centerScreen}>
        <Text style={styles.loadingText}>Loading order...</Text>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.centerScreen}>
        <Text style={styles.errorText}>Order not found</Text>
      </View>
    );
  }

  const statusColor = isDark 
    ? (order.status === 'PENDING' ? '#FBBF24' :
       order.status === 'ACCEPTED' ? '#60A5FA' :
       order.status === 'PREPARING' ? '#A78BFA' :
       order.status === 'READY' ? '#22D3EE' :
       order.status === 'COMPLETED' ? '#34D399' :
       order.status === 'CANCELLED' ? '#F87171' :
       order.status === 'REFUNDED' ? '#9CA3AF' : colors.text)
    : (statusColorMap[order.status] ?? "#334155");
    
  const statusBg = isDark 
    ? (order.status === 'PENDING' ? 'rgba(217, 119, 6, 0.15)' :
       order.status === 'ACCEPTED' ? 'rgba(37, 99, 235, 0.15)' :
       order.status === 'PREPARING' ? 'rgba(124, 58, 237, 0.15)' :
       order.status === 'READY' ? 'rgba(8, 145, 178, 0.15)' :
       order.status === 'COMPLETED' ? 'rgba(5, 150, 105, 0.15)' :
       order.status === 'CANCELLED' ? 'rgba(220, 38, 38, 0.15)' :
       order.status === 'REFUNDED' ? 'rgba(107, 114, 128, 0.15)' : 'rgba(255,255,255,0.05)')
    : (statusBgMap[order.status] ?? "#F8FAFC");

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      
      {/* Top Header Card */}
      <View style={styles.headerCard}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.headerLabel}>Order Number</Text>
            <Text style={styles.headerNumber}>{order.orderNumber}</Text>
          </View>
          <View style={[styles.largeStatusPill, { backgroundColor: statusBg }]}>
            <Text style={[styles.largeStatusText, { color: statusColor }]}>{order.status}</Text>
          </View>
        </View>

        {/* 2x2 Info Grid */}
        <View style={styles.infoGridRow}>
          <View style={[styles.infoGridBox, { backgroundColor: isDark ? 'rgba(67, 56, 202, 0.15)' : "#EEF2FF" }]}>
            <Text style={[styles.infoGridLabel, { color: isDark ? '#818CF8' : "#4338CA" }]}>Created</Text>
            <Text style={styles.infoGridValue}>{new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
            <Text style={styles.infoGridSubValue}>{new Date(order.createdAt).toLocaleDateString()}</Text>
          </View>
          <View style={[styles.infoGridBox, { backgroundColor: isDark ? 'rgba(14, 116, 144, 0.15)' : "#ECFEFF" }]}>
            <Text style={[styles.infoGridLabel, { color: isDark ? '#22D3EE' : "#0E7490" }]}>Payment</Text>
            <Text style={styles.infoGridValue}>{order.paymentMethod}</Text>
            <Text style={styles.infoGridSubValue}>{order.paymentStatus ?? "UNPAID"}</Text>
          </View>
        </View>

        {(order.laneToken || order.isPreOrder) ? (
          <View style={styles.infoGridRow}>
            <View style={[styles.infoGridBox, { backgroundColor: colors.background }]}>
              <Text style={[styles.infoGridLabel, { color: colors.textSecondary }]}>Queue Lane</Text>
              <Text style={styles.infoGridValue}>
                {order.serviceLane === "TEACHER_PRIORITY" ? "Teacher Priority" : "Regular"}
              </Text>
              {order.laneToken ? (
                <Text style={styles.infoGridSubValue}>Token: {order.laneToken}</Text>
              ) : null}
            </View>
            <View style={[styles.infoGridBox, { backgroundColor: isDark ? 'rgba(22, 101, 52, 0.15)' : "#F0FDF4" }]}>
              <Text style={[styles.infoGridLabel, { color: isDark ? '#4ADE80' : "#166534" }]}>Pickup</Text>
              <Text style={styles.infoGridValue}>
                {order.isPreOrder ? "Scheduled" : "Immediate"}
              </Text>
              {order.isPreOrder && order.pickupSlotLabel ? (
                <Text style={styles.infoGridSubValue}>{order.pickupSlotLabel}</Text>
              ) : null}
            </View>
          </View>
        ) : null}
      </View>

      {/* Status Actions */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Update Status</Text>
        <View style={styles.statusActionGrid}>
          {statusActions.map((status) => {
            const selected = order.status === status;
            return (
              <Pressable
                key={status}
                onPress={() => setStatus(status)}
                disabled={updating}
                style={({ pressed }) => [
                  styles.statusActionButton,
                  selected ? styles.statusActionButtonSelected : styles.statusActionButtonUnselected,
                  pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }
                ]}
              >
                <Text style={[styles.statusActionText, selected ? styles.statusActionTextSelected : styles.statusActionTextUnselected]}>
                  {status}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable
          onPress={() => load().catch(() => undefined)}
          style={({ pressed }) => [
            styles.refreshButtonLarge,
            pressed && { opacity: 0.7 }
          ]}
        >
          <Ionicons name="refresh-outline" size={18} color={isDark ? colors.textSecondary : "#475569"} />
          <Text style={styles.refreshButtonLargeText}>{loading ? "Refreshing..." : "Refresh Order"}</Text>
        </Pressable>
      </View>

      {/* Items Receipt */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Order Items</Text>
        <View style={styles.itemsList}>
          {order.items.map((item, index) => (
            <View key={item.id} style={[styles.itemRow, index !== order.items.length - 1 && styles.itemRowBorder]}>
              <View style={styles.itemRowLeft}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemMeta}>
                  {formatCurrency(item.price)} x {item.quantity}
                </Text>
                {item.note ? <Text style={styles.itemNote}>Note: {item.note}</Text> : null}
              </View>
              <Text style={styles.itemRowTotal}>{formatCurrency(item.price * item.quantity)}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Bill Summary */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Bill Summary</Text>
        <View style={styles.billRow}>
          <Text style={styles.billLabel}>Sub Total</Text>
          <Text style={styles.billValue}>{formatCurrency(order.subtotal || totals.subtotal)}</Text>
        </View>
        <View style={styles.billRow}>
          <Text style={styles.billLabel}>Tax</Text>
          <Text style={styles.billValue}>{formatCurrency(order.taxAmount)}</Text>
        </View>
        <View style={styles.grandTotalRow}>
          <Text style={styles.grandTotalLabel}>Grand Total</Text>
          <Text style={styles.grandTotalValue}>{formatCurrency(order.totalAmount)}</Text>
        </View>
      </View>

    </ScrollView>
  );
}

const createStyles = ({ colors, isDark }: { colors: any, isDark: boolean }) => StyleSheet.create({
  centerScreen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background
  },
  loadingText: {
    color: colors.textSecondary,
    fontWeight: "600",
    fontSize: fontScale(16)
  },
  errorText: {
    color: colors.text,
    fontWeight: "800",
    fontSize: fontScale(18)
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    padding: moderateScale(16),
    gap: moderateScale(16),
    paddingBottom: verticalScale(40)
  },
  headerCard: {
    backgroundColor: colors.card,
    borderRadius: moderateScale(20),
    padding: moderateScale(16),
    gap: moderateScale(16),
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: moderateScale(10),
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start"
  },
  headerLabel: {
    color: colors.textSecondary,
    fontWeight: "700",
    fontSize: fontScale(12)
  },
  headerNumber: {
    color: colors.text,
    fontSize: fontScale(28),
    fontWeight: "900",
    marginTop: verticalScale(2)
  },
  largeStatusPill: {
    paddingHorizontal: moderateScale(14),
    paddingVertical: moderateScale(8),
    borderRadius: moderateScale(999)
  },
  largeStatusText: {
    fontWeight: "900",
    fontSize: fontScale(13),
    letterSpacing: 0.5
  },
  infoGridRow: {
    flexDirection: "row",
    gap: moderateScale(10)
  },
  infoGridBox: {
    flex: 1,
    borderRadius: moderateScale(16),
    padding: moderateScale(14)
  },
  infoGridLabel: {
    fontSize: fontScale(12),
    fontWeight: "800"
  },
  infoGridValue: {
    color: colors.text,
    fontWeight: "900",
    fontSize: fontScale(16),
    marginTop: verticalScale(4)
  },
  infoGridSubValue: {
    color: colors.textSecondary,
    fontWeight: "600",
    fontSize: fontScale(12),
    marginTop: verticalScale(2)
  },
  sectionCard: {
    backgroundColor: colors.card,
    borderRadius: moderateScale(20),
    padding: moderateScale(16),
    gap: moderateScale(16),
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: moderateScale(10),
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  sectionTitle: {
    fontSize: fontScale(18),
    fontWeight: "900",
    color: colors.text
  },
  statusActionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: moderateScale(10)
  },
  statusActionButton: {
    borderRadius: moderateScale(12),
    paddingVertical: moderateScale(12),
    paddingHorizontal: moderateScale(16),
    borderWidth: 1
  },
  statusActionButtonSelected: {
    backgroundColor: isDark ? colors.primary : "#0F172A",
    borderColor: isDark ? colors.primary : "#0F172A"
  },
  statusActionButtonUnselected: {
    backgroundColor: colors.card,
    borderColor: colors.border
  },
  statusActionText: {
    fontWeight: "800",
    fontSize: fontScale(13)
  },
  statusActionTextSelected: {
    color: "white"
  },
  statusActionTextUnselected: {
    color: colors.textSecondary
  },
  refreshButtonLarge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: moderateScale(8),
    borderRadius: moderateScale(14),
    paddingVertical: moderateScale(14),
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: verticalScale(4)
  },
  refreshButtonLargeText: {
    color: colors.textSecondary,
    fontWeight: "800",
    fontSize: fontScale(14)
  },
  itemsList: {
    gap: 0
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: moderateScale(12)
  },
  itemRowBorder: {
    borderBottomWidth: 1,
    borderColor: isDark ? colors.border : "#F1F5F9"
  },
  itemRowLeft: {
    flex: 1,
    paddingRight: moderateScale(16),
    gap: moderateScale(4)
  },
  itemName: {
    color: colors.text,
    fontWeight: "800",
    fontSize: fontScale(16)
  },
  itemMeta: {
    color: colors.textSecondary,
    fontWeight: "600",
    fontSize: fontScale(13)
  },
  itemNote: {
    color: isDark ? '#FBBF24' : "#D97706",
    fontWeight: "600",
    fontSize: fontScale(12),
    marginTop: verticalScale(2)
  },
  itemRowTotal: {
    color: colors.text,
    fontWeight: "900",
    fontSize: fontScale(16)
  },
  billRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  billLabel: {
    color: colors.textSecondary,
    fontWeight: "600",
    fontSize: fontScale(14)
  },
  billValue: {
    color: colors.text,
    fontWeight: "800",
    fontSize: fontScale(15)
  },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: verticalScale(16),
    borderTopWidth: 1,
    borderColor: colors.border,
    marginTop: verticalScale(4)
  },
  grandTotalLabel: {
    color: colors.text,
    fontWeight: "900",
    fontSize: fontScale(18)
  },
  grandTotalValue: {
    color: isDark ? colors.primary : "#1D4ED8",
    fontWeight: "900",
    fontSize: fontScale(22)
  }
});
