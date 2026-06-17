import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../../hooks/useAuth";
import { useOrderSocket } from "../../../hooks/useOrderSocket";
import { Order, orderService } from "../../../services/orderService";
import { CanteenHeader } from "../../../components/CanteenHeader";

const TIMELINE = ["PENDING", "ACCEPTED", "PREPARING", "READY", "COMPLETED"];

const statusColorMap: Record<string, string> = {
  PENDING: "#D97706",
  ACCEPTED: "#FF6B35",
  PREPARING: "#7C3AED",
  READY: "#0891B2",
  COMPLETED: "#059669",
  CANCELLED: "#DC2626",
  REFUNDED: "#6B7280"
};

const formatCurrency = (value: number): string => `₹ ${value.toFixed(2)}`;

export default function Screen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
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
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <CanteenHeader showBackButton title="Order Details" subtitle="Loading..." />
        <View style={styles.loadingWrap}>
          <Ionicons name="hourglass-outline" size={24} color="#94A3B8" />
          <Text style={styles.loadingText}>Loading order details...</Text>
        </View>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <CanteenHeader showBackButton title="Order Not Found" subtitle="" />
        <View style={styles.loadingWrap}>
          <Ionicons name="receipt-outline" size={32} color="#94A3B8" />
          <Text style={styles.emptyTitle}>Order not found</Text>
          <Text style={styles.emptySub}>The order you are looking for does not exist or has been deleted.</Text>
        </View>
      </View>
    );
  }

  const statusColor = statusColorMap[order.status] ?? "#334155";

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        <CanteenHeader showBackButton title={`Order #${order.orderNumber}`} subtitle="Live tracking & details" />

        <View style={styles.headerCard}>
          <View style={styles.headerTopRow}>
            <Text style={styles.orderNumberLabel}>Order ID</Text>
            <View style={[styles.statusPill, { backgroundColor: `${statusColor}15` }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusPillText, { color: statusColor }]}>{order.status}</Text>
            </View>
          </View>
          <Text style={styles.orderNumberText}>{order.orderNumber}</Text>
          <Text style={styles.headerMeta}>
            Placed on {new Date(order.createdAt).toLocaleDateString(undefined, { 
              weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
            })}
          </Text>

          {(order.laneToken || order.isPreOrder) ? (
            <View style={styles.headerTagRow}>
              {order.serviceLane === "TEACHER_PRIORITY" ? (
                <View style={[styles.headerTagPill, styles.headerTagPriority]}>
                  <Ionicons name="star" size={14} color="#1E40AF" />
                  <Text style={[styles.headerTagText, styles.headerTagPriorityText]}>Teacher Priority</Text>
                </View>
              ) : null}
              {order.laneToken ? (
                <View style={styles.headerTagPill}>
                  <Ionicons name="ticket" size={14} color="#475569" />
                  <Text style={styles.headerTagText}>Token {order.laneToken}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        {order.isPreOrder && (order.pickupSlotLabel || order.pickupSlotStart) ? (
          <View style={styles.slotCard}>
            <View style={styles.slotIconWrap}>
              <Ionicons name="time" size={24} color="#166534" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Scheduled Pickup</Text>
              <Text style={styles.slotLabel}>{order.pickupSlotLabel ?? "Scheduled pickup"}</Text>
              {order.pickupSlotStart ? (
                <Text style={styles.slotMeta}>
                  {new Date(order.pickupSlotStart).toLocaleString()}
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}

        <View style={styles.timelineCard}>
          <Text style={styles.cardTitle}>Status Timeline</Text>
          <View style={styles.timelineContainer}>
            {TIMELINE.map((status, index) => {
              const isPast = statusIndex >= index;
              const isCurrent = statusIndex === index;
              const isLast = index === TIMELINE.length - 1;

              return (
                <View key={status} style={styles.timelineRow}>
                  <View style={styles.timelineGraphic}>
                    <View
                      style={[
                        styles.timelineDot,
                        isPast && styles.timelineDotActive,
                        isCurrent && styles.timelineDotCurrent
                      ]}
                    />
                    {!isLast && (
                      <View
                        style={[
                          styles.timelineLine,
                          isPast && statusIndex > index && styles.timelineLineActive
                        ]}
                      />
                    )}
                  </View>
                  <View style={styles.timelineContent}>
                    <Text
                      style={[
                        styles.timelineText,
                        isPast && styles.timelineTextActive,
                        isCurrent && styles.timelineTextCurrent
                      ]}
                    >
                      {status.charAt(0) + status.slice(1).toLowerCase()}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.itemsCard}>
          <Text style={styles.cardTitle}>Items Ordered</Text>
          {order.items.map((item, index) => (
            <View key={item.id}>
              <View style={styles.itemRowCard}>
                <View style={styles.itemQuantityWrap}>
                  <Text style={styles.itemQuantityText}>{item.quantity}x</Text>
                </View>
                <View style={styles.itemDetails}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemMeta}>
                    {formatCurrency(item.price)} each
                  </Text>
                  {item.note ? (
                    <View style={styles.noteRow}>
                      <Ionicons name="chatbubble-ellipses-outline" size={14} color="#64748B" />
                      <Text style={styles.noteText}>{item.note}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.itemLineTotal}>
                  {formatCurrency(item.price * item.quantity)}
                </Text>
              </View>
              {index < order.items.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.cardTitle}>Payment Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Payment Method</Text>
            <Text style={styles.summaryValue}>{order.paymentMethod}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>{formatCurrency(order.subtotal)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tax</Text>
            <Text style={styles.summaryValue}>{formatCurrency(order.taxAmount)}</Text>
          </View>
          <View style={[styles.summaryRow, styles.summaryTotalRow]}>
            <Text style={styles.summaryTotalLabel}>Total Paid</Text>
            <Text style={styles.summaryTotalValue}>{formatCurrency(order.totalAmount)}</Text>
          </View>
        </View>
        
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#EEF2F7"
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 40
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    gap: 12
  },
  loadingText: {
    color: "#64748B",
    fontWeight: "600",
    fontSize: 16
  },
  emptyTitle: {
    color: "#0F172A",
    fontSize: 20,
    fontWeight: "800"
  },
  emptySub: {
    color: "#64748B",
    textAlign: "center",
    paddingHorizontal: 20
  },
  headerCard: {
    borderRadius: 16,
    backgroundColor: "white",
    padding: 20,
    shadowColor: "#0F172A",
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 1,
    borderColor: "#E2E8F0"
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4
  },
  orderNumberLabel: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  orderNumberText: {
    color: "#0F172A",
    fontSize: 28,
    fontWeight: "900",
    marginBottom: 4
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 6
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3
  },
  statusPillText: {
    fontWeight: "800",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  headerMeta: {
    color: "#475569",
    fontWeight: "600",
    fontSize: 14
  },
  headerTagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12
  },
  headerTagPill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6
  },
  headerTagText: {
    color: "#334155",
    fontWeight: "700",
    fontSize: 13
  },
  headerTagPriority: {
    backgroundColor: "#F1F5F9"
  },
  headerTagPriorityText: {
    color: "#1E40AF"
  },
  slotCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    backgroundColor: "#DCFCE7",
    padding: 16,
    gap: 12
  },
  slotIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#BBF7D0",
    alignItems: "center",
    justifyContent: "center"
  },
  slotLabel: {
    color: "#14532D",
    fontWeight: "800",
    fontSize: 16,
    marginTop: 2
  },
  slotMeta: {
    color: "#166534",
    fontWeight: "600",
    fontSize: 13,
    marginTop: 2
  },
  cardTitle: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 12
  },
  summaryCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "white",
    padding: 16,
    gap: 12,
    shadowColor: "#0F172A",
    shadowOpacity: 0.02,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  summaryLabel: {
    color: "#64748B",
    fontWeight: "600",
    fontSize: 15
  },
  summaryValue: {
    color: "#0F172A",
    fontWeight: "700",
    fontSize: 15
  },
  summaryTotalRow: {
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingTop: 12,
    marginTop: 4
  },
  summaryTotalLabel: {
    color: "#0F172A",
    fontWeight: "800",
    fontSize: 16
  },
  summaryTotalValue: {
    color: "#059669",
    fontWeight: "900",
    fontSize: 22
  },
  timelineCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "white",
    padding: 16,
    shadowColor: "#0F172A",
    shadowOpacity: 0.02,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1
  },
  timelineContainer: {
    marginTop: 4
  },
  timelineRow: {
    flexDirection: "row",
    alignItems: "stretch"
  },
  timelineGraphic: {
    width: 24,
    alignItems: "center",
    marginRight: 12
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#E2E8F0",
    borderWidth: 2,
    borderColor: "white",
    zIndex: 2
  },
  timelineDotActive: {
    backgroundColor: "#0F172A"
  },
  timelineDotCurrent: {
    backgroundColor: "#FF6B35",
    transform: [{ scale: 1.2 }]
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: "#E2E8F0",
    marginTop: -2,
    marginBottom: -2,
    zIndex: 1
  },
  timelineLineActive: {
    backgroundColor: "#0F172A"
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 20,
    justifyContent: "flex-start"
  },
  timelineText: {
    color: "#94A3B8",
    fontWeight: "600",
    fontSize: 15,
    lineHeight: 16
  },
  timelineTextActive: {
    color: "#334155"
  },
  timelineTextCurrent: {
    color: "#0F172A",
    fontWeight: "800",
    fontSize: 16
  },
  itemsCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "white",
    padding: 16,
    shadowColor: "#0F172A",
    shadowOpacity: 0.02,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1
  },
  itemRowCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 8
  },
  itemQuantityWrap: {
    backgroundColor: "#F1F5F9",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 36,
    alignItems: "center"
  },
  itemQuantityText: {
    color: "#0F172A",
    fontWeight: "800",
    fontSize: 14
  },
  itemDetails: {
    flex: 1,
    gap: 2
  },
  itemName: {
    color: "#0F172A",
    fontWeight: "700",
    fontSize: 15
  },
  itemLineTotal: {
    color: "#0F172A",
    fontWeight: "800",
    fontSize: 16
  },
  itemMeta: {
    color: "#64748B",
    fontWeight: "600",
    fontSize: 13
  },
  noteRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F8FAFC",
    padding: 8,
    borderRadius: 8,
    marginTop: 6,
    gap: 6
  },
  noteText: {
    color: "#475569",
    flex: 1,
    fontSize: 13,
    fontStyle: "italic"
  },
  divider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 4
  }
});
