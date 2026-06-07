import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useAuth } from "../../../hooks/useAuth";
import { useOrderSocket } from "../../../hooks/useOrderSocket";
import { Order, orderService } from "../../../services/orderService";

type OrderFilter = "ALL" | "PENDING" | "PREPARING" | "READY" | "COMPLETED" | "CANCELLED";

const ORDER_FILTERS: OrderFilter[] = [
  "ALL",
  "PENDING",
  "PREPARING",
  "READY",
  "COMPLETED",
  "CANCELLED"
];

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
  const router = useRouter();
  const { user, accessToken } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<OrderFilter>("ALL");

  const load = useCallback(async () => {
    if (!user?.tenantId || !accessToken) return;
    try {
      setLoading(true);
      const response = await orderService.listOrders(accessToken, user.tenantId);
      const sorted = [...response.data].sort(
        (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)
      );
      setOrders(sorted);
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "Could not load orders"
      );
    } finally {
      setLoading(false);
    }
  }, [user?.tenantId, accessToken]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  useOrderSocket({
    tenantId: user?.tenantId,
    userId: user?.id,
    onOrderNew: (incoming) => {
      if (incoming.userId && incoming.userId !== user?.id) return;
      setOrders((prev) => [incoming, ...prev.filter((x) => x.id !== incoming.id)]);
    },
    onOrderStatusChanged: (incoming) => {
      setOrders((prev) =>
        prev.map((order) => (order.id === incoming.id ? incoming : order))
      );
    }
  });

  const stats = useMemo(() => {
    const activeStatuses = new Set(["PENDING", "ACCEPTED", "PREPARING", "READY"]);
    return {
      total: orders.length,
      active: orders.filter((order) => activeStatuses.has(order.status)).length,
      completed: orders.filter((order) => order.status === "COMPLETED").length
    };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return orders.filter((order) => {
      if (filter !== "ALL" && order.status !== filter) return false;
      if (!normalized) return true;
      return (
        order.orderNumber.toLowerCase().includes(normalized) ||
        order.status.toLowerCase().includes(normalized) ||
        order.paymentMethod.toLowerCase().includes(normalized) ||
        (order.laneToken ?? "").toLowerCase().includes(normalized) ||
        (order.pickupSlotLabel ?? "").toLowerCase().includes(normalized)
      );
    });
  }, [orders, query, filter]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerCard}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>My Orders</Text>
            <Text style={styles.headerSubtitle}>Track live and past orders</Text>
          </View>
          <Pressable onPress={load} style={styles.refreshBtn} disabled={loading}>
            <Text style={styles.refreshBtnText}>
              {loading ? "Refreshing..." : "Refresh"}
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, styles.statBlue]}>
          <Text style={styles.statLabel}>Total</Text>
          <Text style={styles.statValue}>{stats.total}</Text>
        </View>
        <View style={[styles.statCard, styles.statAmber]}>
          <Text style={styles.statLabel}>Active</Text>
          <Text style={styles.statValue}>{stats.active}</Text>
        </View>
        <View style={[styles.statCard, styles.statGreen]}>
          <Text style={styles.statLabel}>Completed</Text>
          <Text style={styles.statValue}>{stats.completed}</Text>
        </View>
      </View>

      <View style={styles.searchCard}>
        <View style={styles.searchRow}>
          <Ionicons name="search-outline" size={17} color="#64748B" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search order number, status, payment"
            placeholderTextColor="#94A3B8"
            style={styles.searchInput}
          />
          {query ? (
            <Pressable onPress={() => setQuery("")}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </Pressable>
          ) : null}
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {ORDER_FILTERS.map((item) => {
            const active = filter === item;
            return (
              <Pressable
                key={item}
                onPress={() => setFilter(item)}
                style={[styles.filterChip, active && styles.filterChipActive]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    active && styles.filterChipTextActive
                  ]}
                >
                  {item}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Orders</Text>
        <Text style={styles.sectionMeta}>{filteredOrders.length} found</Text>
      </View>

      {filteredOrders.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No orders found</Text>
          <Text style={styles.emptySub}>
            Try changing search or filters. Your latest orders will appear here.
          </Text>
        </View>
      ) : (
        filteredOrders.map((order) => {
          const statusColor = statusColorMap[order.status] ?? "#334155";
          return (
            <Link
              key={order.id}
              href={{ pathname: "/(student)/orders/[id]", params: { id: order.id } }}
              asChild
            >
              <Pressable style={styles.orderCard}>
                <View style={styles.orderTopRow}>
                  <Text style={styles.orderNumber}>{order.orderNumber}</Text>
                  <View
                    style={[
                      styles.statusPill,
                      { backgroundColor: `${statusColor}1A` }
                    ]}
                  >
                    <Text style={[styles.statusText, { color: statusColor }]}>
                      {order.status}
                    </Text>
                  </View>
                </View>
                <Text style={styles.orderMeta}>
                  {new Date(order.createdAt).toLocaleString()}
                </Text>
                {order.laneToken || order.isPreOrder ? (
                  <View style={styles.orderTagRow}>
                    {order.serviceLane === "TEACHER_PRIORITY" ? (
                      <View style={[styles.orderTagPill, styles.orderTagPriority]}>
                        <Text style={[styles.orderTagText, styles.orderTagPriorityText]}>Teacher Priority</Text>
                      </View>
                    ) : null}
                    {order.laneToken ? (
                      <View style={styles.orderTagPill}>
                        <Text style={styles.orderTagText}>Token: {order.laneToken}</Text>
                      </View>
                    ) : null}
                    {order.isPreOrder && order.pickupSlotLabel ? (
                      <View style={[styles.orderTagPill, styles.orderTagPreOrder]}>
                        <Text style={[styles.orderTagText, styles.orderTagPreOrderText]}>{order.pickupSlotLabel}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
                <View style={styles.orderBottomRow}>
                  <Text style={styles.orderMeta}>
                    {order.items.length} item{order.items.length > 1 ? "s" : ""} ·{" "}
                    {order.paymentMethod}
                  </Text>
                  <Text style={styles.orderTotal}>
                    {formatCurrency(order.totalAmount)}
                  </Text>
                </View>
              </Pressable>
            </Link>
          );
        })
      )}

      <Pressable
        onPress={() => router.push("/(student)/search")}
        style={styles.browseBtn}
      >
        <Text style={styles.browseBtnText}>Browse Menu</Text>
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
    paddingBottom: 28
  },
  headerCard: {
    backgroundColor: "white",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    gap: 8
  },
  headerRow: {
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
    fontWeight: "600",
    marginTop: 1
  },
  refreshBtn: {
    backgroundColor: "#0F172A",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  refreshBtnText: {
    color: "white",
    fontWeight: "700"
  },
  statsRow: {
    flexDirection: "row",
    gap: 8
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10
  },
  statBlue: {
    backgroundColor: "#DBEAFE",
    borderColor: "#BFDBFE"
  },
  statAmber: {
    backgroundColor: "#FEF3C7",
    borderColor: "#FDE68A"
  },
  statGreen: {
    backgroundColor: "#DCFCE7",
    borderColor: "#BBF7D0"
  },
  statLabel: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "700"
  },
  statValue: {
    color: "#0F172A",
    fontWeight: "800",
    fontSize: 22,
    marginTop: 3
  },
  searchCard: {
    backgroundColor: "white",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 10,
    gap: 10
  },
  searchRow: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center"
  },
  searchInput: {
    flex: 1,
    color: "#0F172A",
    paddingVertical: 10,
    paddingHorizontal: 8
  },
  filterRow: {
    gap: 8,
    paddingRight: 8
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC"
  },
  filterChipActive: {
    backgroundColor: "#0F172A",
    borderColor: "#0F172A"
  },
  filterChipText: {
    color: "#334155",
    fontWeight: "700"
  },
  filterChipTextActive: {
    color: "white"
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  sectionTitle: {
    color: "#0F172A",
    fontSize: 19,
    fontWeight: "800"
  },
  sectionMeta: {
    color: "#64748B",
    fontWeight: "700"
  },
  emptyCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
    padding: 14,
    gap: 4
  },
  emptyTitle: {
    color: "#0F172A",
    fontWeight: "800"
  },
  emptySub: {
    color: "#64748B"
  },
  orderCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "white",
    padding: 12,
    gap: 6
  },
  orderTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  orderNumber: {
    color: "#0F172A",
    fontWeight: "800",
    fontSize: 16
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  statusText: {
    fontSize: 12,
    fontWeight: "800"
  },
  orderMeta: {
    color: "#64748B",
    fontWeight: "600"
  },
  orderBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  orderTagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  orderTagPill: {
    borderRadius: 999,
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  orderTagText: {
    color: "#334155",
    fontWeight: "700",
    fontSize: 11
  },
  orderTagPriority: {
    backgroundColor: "#DBEAFE"
  },
  orderTagPriorityText: {
    color: "#1E40AF"
  },
  orderTagPreOrder: {
    backgroundColor: "#DCFCE7"
  },
  orderTagPreOrderText: {
    color: "#166534"
  },
  orderTotal: {
    color: "#0F172A",
    fontWeight: "800"
  },
  browseBtn: {
    backgroundColor: "#0F172A",
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 4
  },
  browseBtnText: {
    color: "white",
    textAlign: "center",
    fontWeight: "800"
  }
});
