import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View, RefreshControl } from "react-native";
import { useAuth } from "../../../hooks/useAuth";
import { useOrderSocket } from "../../../hooks/useOrderSocket";
import { Order, orderService } from "../../../services/orderService";

type StatusFilter =
  | "ALL"
  | "PENDING"
  | "ACCEPTED"
  | "PREPARING"
  | "READY"
  | "COMPLETED"
  | "CANCELLED"
  | "REFUNDED";

const filters: StatusFilter[] = ["ALL", "PENDING", "PREPARING", "READY", "COMPLETED", "CANCELLED"];

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

const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export default function Screen() {
  const router = useRouter();
  const { user, accessToken } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    if (!user?.tenantId || !accessToken) return;
    try {
      setLoading(true);
      const response = await orderService.listOrders(accessToken, user.tenantId);
      const sorted = [...response.data].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
      setOrders(sorted);
      setLastUpdated(new Date());
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Could not load orders");
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
      setOrders((prev) => [incoming, ...prev.filter((x) => x.id !== incoming.id)]);
    },
    onOrderStatusChanged: (incoming) => {
      setOrders((prev) => prev.map((order) => (order.id === incoming.id ? incoming : order)));
    }
  });

  const filteredOrders = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return orders.filter((order) => {
      if (statusFilter !== "ALL" && order.status !== statusFilter) return false;
      if (!normalized) return true;
      return (
        order.orderNumber.toLowerCase().includes(normalized) ||
        order.status.toLowerCase().includes(normalized) ||
        order.paymentMethod.toLowerCase().includes(normalized) ||
        (order.laneToken ?? "").toLowerCase().includes(normalized) ||
        (order.pickupSlotLabel ?? "").toLowerCase().includes(normalized)
      );
    });
  }, [orders, query, statusFilter]);

  return (
    <View style={styles.screen}>
      <ScrollView 
        style={styles.scroll} 
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={["#1D4ED8"]} />}
      >
        
        {/* Top Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.pageTitle}>Live Orders</Text>
            <Text style={styles.lastUpdatedText}>
              {loading ? "Updating..." : `Last updated: ${lastUpdated ? lastUpdated.toLocaleTimeString() : "--"}`}
            </Text>
          </View>
        </View>

        {/* Search & Filters */}
        <View style={styles.filterSection}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color="#64748B" />
            <TextInput
              placeholder="Search ID, status, payment..."
              placeholderTextColor="#94A3B8"
              value={query}
              onChangeText={setQuery}
              style={styles.searchInput}
            />
            {query ? (
              <Pressable onPress={() => setQuery("")} style={{ padding: 4 }}>
                <Ionicons name="close-circle" size={18} color="#94A3B8" />
              </Pressable>
            ) : null}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            {filters.map((item) => {
              const active = statusFilter === item;
              return (
                <Pressable
                  key={item}
                  onPress={() => setStatusFilter(item)}
                  style={[
                    styles.filterChip,
                    active ? styles.filterChipActive : styles.filterChipInactive
                  ]}
                >
                  <Text style={[styles.filterChipText, active ? styles.filterChipTextActive : styles.filterChipTextInactive]}>
                    {item}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Orders List */}
        <View style={styles.listHeader}>
          <View>
            <Text style={styles.listTitle}>Results</Text>
            <Text style={styles.listSubtitle}>{filteredOrders.length} found</Text>
          </View>
        </View>

        {filteredOrders.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="receipt-outline" size={32} color="#94A3B8" />
            <Text style={styles.emptyText}>No orders match your search.</Text>
          </View>
        ) : (
          <View style={styles.orderList}>
            {filteredOrders.map((order) => {
              const statusColor = statusColorMap[order.status] ?? "#334155";
              const statusBg = statusBgMap[order.status] ?? "#F8FAFC";
              return (
                <Pressable
                  key={order.id}
                  onPress={() => router.push({ pathname: "/(admin)/orders/[id]", params: { id: order.id } })}
                  style={({ pressed }) => [
                    styles.orderCard,
                    pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }
                  ]}
                >
                  <View style={styles.orderCardTop}>
                    <View>
                      <Text style={styles.orderNumber}>{order.orderNumber}</Text>
                      <Text style={styles.orderDate}>{new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} • {new Date(order.createdAt).toLocaleDateString()}</Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: statusBg }]}>
                      <Text style={[styles.statusText, { color: statusColor }]}>{order.status}</Text>
                    </View>
                  </View>

                  {(order.laneToken || order.isPreOrder) ? (
                    <View style={styles.laneTagsRow}>
                      {order.serviceLane === "TEACHER_PRIORITY" ? (
                        <View style={[styles.tagPill, { backgroundColor: "#DBEAFE" }]}>
                          <Text style={[styles.tagText, { color: "#1E40AF" }]}>Priority</Text>
                        </View>
                      ) : null}
                      {order.laneToken ? (
                        <View style={[styles.tagPill, { backgroundColor: "#F1F5F9" }]}>
                          <Text style={[styles.tagText, { color: "#334155" }]}>Token: {order.laneToken}</Text>
                        </View>
                      ) : null}
                      {order.isPreOrder && order.pickupSlotLabel ? (
                        <View style={[styles.tagPill, { backgroundColor: "#DCFCE7" }]}>
                          <Text style={[styles.tagText, { color: "#166534" }]}>{order.pickupSlotLabel}</Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}

                  <View style={styles.orderCardBottom}>
                    <Text style={styles.orderItemsText}>
                      {order.items.length} item{order.items.length > 1 ? "s" : ""} • {order.paymentMethod}
                    </Text>
                    <Text style={styles.orderTotalText}>{formatCurrency(order.totalAmount)}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC"
  },
  scroll: {
    flex: 1
  },
  content: {
    padding: 16,
    gap: 20,
    paddingBottom: 40
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#0F172A"
  },
  lastUpdatedText: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "500",
    marginTop: 2
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  statCard: {
    width: "48%",
    backgroundColor: "white",
    borderRadius: 16,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  statLabel: {
    color: "#64748B",
    fontWeight: "700",
    fontSize: 12
  },
  statValue: {
    fontWeight: "900",
    fontSize: 24,
    marginTop: 6
  },
  filterSection: {
    gap: 12
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 50,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1
  },
  searchInput: {
    flex: 1,
    height: "100%",
    marginLeft: 10,
    fontSize: 15,
    fontWeight: "500",
    color: "#0F172A"
  },
  filterScroll: {
    gap: 8
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center"
  },
  filterChipActive: {
    backgroundColor: "#0F172A",
    borderColor: "#0F172A"
  },
  filterChipInactive: {
    backgroundColor: "white",
    borderColor: "#E2E8F0"
  },
  filterChipText: {
    fontWeight: "800",
    fontSize: 13
  },
  filterChipTextActive: {
    color: "white"
  },
  filterChipTextInactive: {
    color: "#475569"
  },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4
  },
  listTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0F172A"
  },
  listSubtitle: {
    color: "#64748B",
    fontWeight: "700",
    fontSize: 13
  },
  emptyCard: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderStyle: "dashed"
  },
  emptyText: {
    color: "#64748B",
    fontWeight: "600",
    fontSize: 15
  },
  orderList: {
    gap: 12
  },
  orderCard: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 16,
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  orderCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start"
  },
  orderNumber: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0F172A"
  },
  orderDate: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999
  },
  statusText: {
    fontWeight: "800",
    fontSize: 11,
    letterSpacing: 0.5
  },
  laneTagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 2
  },
  tagPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  tagText: {
    fontSize: 11,
    fontWeight: "800"
  },
  orderCardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: "#F1F5F9"
  },
  orderItemsText: {
    color: "#475569",
    fontWeight: "600",
    fontSize: 13
  },
  orderTotalText: {
    color: "#0F172A",
    fontWeight: "900",
    fontSize: 18
  }
});
