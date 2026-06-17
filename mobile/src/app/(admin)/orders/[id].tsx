import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../../../hooks/useAuth";
import { useOrderSocket } from "../../../hooks/useOrderSocket";
import { Order, orderService } from "../../../services/orderService";

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
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, accessToken } = useAuth();
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

  const statusColor = statusColorMap[order.status] ?? "#334155";
  const statusBg = statusBgMap[order.status] ?? "#F8FAFC";

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
          <View style={[styles.infoGridBox, { backgroundColor: "#EEF2FF" }]}>
            <Text style={[styles.infoGridLabel, { color: "#4338CA" }]}>Created</Text>
            <Text style={styles.infoGridValue}>{new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
            <Text style={styles.infoGridSubValue}>{new Date(order.createdAt).toLocaleDateString()}</Text>
          </View>
          <View style={[styles.infoGridBox, { backgroundColor: "#ECFEFF" }]}>
            <Text style={[styles.infoGridLabel, { color: "#0E7490" }]}>Payment</Text>
            <Text style={styles.infoGridValue}>{order.paymentMethod}</Text>
            <Text style={styles.infoGridSubValue}>{order.paymentStatus ?? "UNPAID"}</Text>
          </View>
        </View>

        {(order.laneToken || order.isPreOrder) ? (
          <View style={styles.infoGridRow}>
            <View style={[styles.infoGridBox, { backgroundColor: "#F8FAFC" }]}>
              <Text style={[styles.infoGridLabel, { color: "#64748B" }]}>Queue Lane</Text>
              <Text style={styles.infoGridValue}>
                {order.serviceLane === "TEACHER_PRIORITY" ? "Teacher Priority" : "Regular"}
              </Text>
              {order.laneToken ? (
                <Text style={styles.infoGridSubValue}>Token: {order.laneToken}</Text>
              ) : null}
            </View>
            <View style={[styles.infoGridBox, { backgroundColor: "#F0FDF4" }]}>
              <Text style={[styles.infoGridLabel, { color: "#166534" }]}>Pickup</Text>
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
          <Ionicons name="refresh-outline" size={18} color="#475569" />
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

const styles = StyleSheet.create({
  centerScreen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC"
  },
  loadingText: {
    color: "#64748B",
    fontWeight: "600",
    fontSize: 16
  },
  errorText: {
    color: "#0F172A",
    fontWeight: "800",
    fontSize: 18
  },
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC"
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 40
  },
  headerCard: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 16,
    gap: 16,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start"
  },
  headerLabel: {
    color: "#64748B",
    fontWeight: "700",
    fontSize: 12
  },
  headerNumber: {
    color: "#0F172A",
    fontSize: 28,
    fontWeight: "900",
    marginTop: 2
  },
  largeStatusPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999
  },
  largeStatusText: {
    fontWeight: "900",
    fontSize: 13,
    letterSpacing: 0.5
  },
  infoGridRow: {
    flexDirection: "row",
    gap: 10
  },
  infoGridBox: {
    flex: 1,
    borderRadius: 16,
    padding: 14
  },
  infoGridLabel: {
    fontSize: 12,
    fontWeight: "800"
  },
  infoGridValue: {
    color: "#0F172A",
    fontWeight: "900",
    fontSize: 16,
    marginTop: 4
  },
  infoGridSubValue: {
    color: "#475569",
    fontWeight: "600",
    fontSize: 12,
    marginTop: 2
  },
  sectionCard: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 16,
    gap: 16,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0F172A"
  },
  statusActionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  statusActionButton: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1
  },
  statusActionButtonSelected: {
    backgroundColor: "#0F172A",
    borderColor: "#0F172A"
  },
  statusActionButtonUnselected: {
    backgroundColor: "white",
    borderColor: "#E2E8F0"
  },
  statusActionText: {
    fontWeight: "800",
    fontSize: 13
  },
  statusActionTextSelected: {
    color: "white"
  },
  statusActionTextUnselected: {
    color: "#475569"
  },
  refreshButtonLarge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginTop: 4
  },
  refreshButtonLargeText: {
    color: "#475569",
    fontWeight: "800",
    fontSize: 14
  },
  itemsList: {
    gap: 0
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 12
  },
  itemRowBorder: {
    borderBottomWidth: 1,
    borderColor: "#F1F5F9"
  },
  itemRowLeft: {
    flex: 1,
    paddingRight: 16,
    gap: 4
  },
  itemName: {
    color: "#0F172A",
    fontWeight: "800",
    fontSize: 16
  },
  itemMeta: {
    color: "#64748B",
    fontWeight: "600",
    fontSize: 13
  },
  itemNote: {
    color: "#D97706",
    fontWeight: "600",
    fontSize: 12,
    marginTop: 2
  },
  itemRowTotal: {
    color: "#0F172A",
    fontWeight: "900",
    fontSize: 16
  },
  billRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  billLabel: {
    color: "#64748B",
    fontWeight: "600",
    fontSize: 14
  },
  billValue: {
    color: "#0F172A",
    fontWeight: "800",
    fontSize: 15
  },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 16,
    borderTopWidth: 1,
    borderColor: "#E2E8F0",
    marginTop: 4
  },
  grandTotalLabel: {
    color: "#0F172A",
    fontWeight: "900",
    fontSize: 18
  },
  grandTotalValue: {
    color: "#1D4ED8",
    fontWeight: "900",
    fontSize: 22
  }
});
