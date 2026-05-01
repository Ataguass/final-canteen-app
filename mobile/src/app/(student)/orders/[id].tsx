import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../../../hooks/useAuth";
import { useOrderSocket } from "../../../hooks/useOrderSocket";
import { Order, orderService } from "../../../services/orderService";

const TIMELINE = ["PENDING", "ACCEPTED", "PREPARING", "READY", "COMPLETED"];

const statusColorMap: Record<string, string> = {
  PENDING: "#D97706",
  ACCEPTED: "#2563EB",
  PREPARING: "#7C3AED",
  READY: "#0891B2",
  COMPLETED: "#059669",
  CANCELLED: "#DC2626",
  REFUNDED: "#6B7280"
};

const formatCurrency = (value: number): string => `₹ ${value.toFixed(2)}`;

export default function Screen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, accessToken } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user?.tenantId || !accessToken || !id) return;
    try {
      setLoading(true);
      const response = await orderService.getOrder(accessToken, user.tenantId, id);
      setOrder(response.data);
    } finally {
      setLoading(false);
    }
  }, [id, user?.tenantId, accessToken]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  useOrderSocket({
    tenantId: user?.tenantId,
    userId: user?.id,
    onOrderStatusChanged: (incoming) => {
      if (incoming.id === id) {
        setOrder(incoming);
      }
    }
  });

  const statusIndex = useMemo(() => {
    if (!order) return -1;
    return TIMELINE.indexOf(order.status);
  }, [order]);

  if (loading && !order) {
    return (
      <View style={styles.loadingWrap}>
        <Text style={styles.loadingText}>Loading order...</Text>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.loadingWrap}>
        <Text style={styles.loadingText}>Order not found.</Text>
      </View>
    );
  }

  const statusColor = statusColorMap[order.status] ?? "#334155";

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerCard}>
        <View style={styles.headerTopRow}>
          <Text style={styles.orderNumber}>{order.orderNumber}</Text>
          <View style={[styles.statusPill, { backgroundColor: `${statusColor}1A` }]}>
            <Text style={[styles.statusPillText, { color: statusColor }]}>{order.status}</Text>
          </View>
        </View>
        <Text style={styles.headerMeta}>
          {new Date(order.createdAt).toLocaleString()} • {order.paymentMethod}
        </Text>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.cardTitle}>Order Summary</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryValue}>{formatCurrency(order.subtotal)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Tax</Text>
          <Text style={styles.summaryValue}>{formatCurrency(order.taxAmount)}</Text>
        </View>
        <View style={[styles.summaryRow, styles.summaryTotalRow]}>
          <Text style={styles.summaryTotalLabel}>Total</Text>
          <Text style={styles.summaryTotalValue}>{formatCurrency(order.totalAmount)}</Text>
        </View>
      </View>

      <View style={styles.timelineCard}>
        <Text style={styles.cardTitle}>Status Timeline</Text>
        <View style={{ gap: 8 }}>
          {TIMELINE.map((status, index) => {
            const active = statusIndex >= 0 && index <= statusIndex;
            return (
              <View key={status} style={styles.timelineRow}>
                <View
                  style={[
                    styles.timelineDot,
                    active && styles.timelineDotActive
                  ]}
                />
                <Text style={[styles.timelineText, active && styles.timelineTextActive]}>
                  {status}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.itemsCard}>
        <Text style={styles.cardTitle}>Items</Text>
        {order.items.map((item) => (
          <View key={item.id} style={styles.itemRowCard}>
            <View style={styles.itemTopRow}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemLineTotal}>
                {formatCurrency(item.price * item.quantity)}
              </Text>
            </View>
            <Text style={styles.itemMeta}>
              {formatCurrency(item.price)} × {item.quantity}
            </Text>
            {item.note ? (
              <View style={styles.noteRow}>
                <Ionicons name="create-outline" size={14} color="#64748B" />
                <Text style={styles.noteText}>{item.note}</Text>
              </View>
            ) : null}
          </View>
        ))}
      </View>
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
  headerCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "white",
    padding: 12,
    gap: 4
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  orderNumber: {
    color: "#0F172A",
    fontSize: 22,
    fontWeight: "800",
    flex: 1
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  statusPillText: {
    fontWeight: "800",
    fontSize: 12
  },
  headerMeta: {
    color: "#64748B",
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
  cardTitle: {
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
  timelineCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "white",
    padding: 12
  },
  timelineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#CBD5E1"
  },
  timelineDotActive: {
    backgroundColor: "#0F172A"
  },
  timelineText: {
    color: "#94A3B8",
    fontWeight: "600"
  },
  timelineTextActive: {
    color: "#0F172A",
    fontWeight: "700"
  },
  itemsCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "white",
    padding: 12,
    gap: 8
  },
  itemRowCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    padding: 10,
    gap: 4
  },
  itemTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8
  },
  itemName: {
    color: "#0F172A",
    fontWeight: "700",
    flex: 1
  },
  itemLineTotal: {
    color: "#0F172A",
    fontWeight: "800"
  },
  itemMeta: {
    color: "#64748B",
    fontWeight: "600"
  },
  noteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  noteText: {
    color: "#475569"
  }
});
