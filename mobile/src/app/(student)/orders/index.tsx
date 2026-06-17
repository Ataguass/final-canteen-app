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
  View,
  RefreshControl
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../../hooks/useAuth";
import { CanteenHeader } from "../../../components/CanteenHeader";
import { useOrderSocket } from "../../../hooks/useOrderSocket";
import { Order, orderService } from "../../../services/orderService";
import { moderateScale, fontScale, verticalScale, scale, isTablet, gridColumns } from '../../../utils/responsive';

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
  ACCEPTED: "#FF6B35",
  PREPARING: "#7C3AED",
  READY: "#0891B2",
  COMPLETED: "#059669",
  CANCELLED: "#DC2626",
  REFUNDED: "#6B7280"
};

const formatCurrency = (value: number): string => `₹ ${value.toFixed(2)}`;

export default function Screen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, accessToken } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<OrderFilter>("ALL");

  const load = useCallback(async (isRefresh = false) => {
    if (!user?.tenantId || !accessToken) return;
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      
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
      setRefreshing(false);
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
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={["#0F172A"]} />
      }
    >
      <CanteenHeader showBackButton title="My Orders" subtitle="Track live and past orders" />

      {/* Modern Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <View style={[styles.statIconWrap, { backgroundColor: "#F1F5F9" }]}>
            <Ionicons name="receipt" size={16} color="#FF6B35" />
          </View>
          <View>
            <Text style={styles.statValue}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
        </View>
        <View style={styles.statCard}>
          <View style={[styles.statIconWrap, { backgroundColor: "#FEF3C7" }]}>
            <Ionicons name="time" size={16} color="#D97706" />
          </View>
          <View>
            <Text style={styles.statValue}>{stats.active}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
        </View>
        <View style={styles.statCard}>
          <View style={[styles.statIconWrap, { backgroundColor: "#DCFCE7" }]}>
            <Ionicons name="checkmark-circle" size={16} color="#059669" />
          </View>
          <View>
            <Text style={styles.statValue}>{stats.completed}</Text>
            <Text style={styles.statLabel}>Done</Text>
          </View>
        </View>
      </View>

      {/* Floating Search Bar */}
      <View style={styles.searchBarCard}>
        <Ionicons name="search-outline" size={20} color="#64748B" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search orders..."
          placeholderTextColor="#94A3B8"
          style={styles.searchInput}
        />
        {query ? (
          <Pressable onPress={() => setQuery("")} style={styles.clearBtn}>
            <Ionicons name="close-circle" size={18} color="#94A3B8" />
          </Pressable>
        ) : null}
      </View>

      {/* Free-flowing Filter Chips */}
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
              android_ripple={{ color: "#CBD5E1" }}
            >
              <Text
                style={[
                  styles.filterChipText,
                  active && styles.filterChipTextActive
                ]}
              >
                {item === "ALL" ? "All Orders" : item.charAt(0) + item.slice(1).toLowerCase()}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Section Header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {filter === "ALL" ? "Recent Orders" : `${filter.charAt(0)}${filter.slice(1).toLowerCase()} Orders`}
        </Text>
        <Text style={styles.sectionMeta}>{filteredOrders.length} orders</Text>
      </View>

      {loading && !refreshing && orders.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="hourglass-outline" size={24} color="#94A3B8" />
          <Text style={styles.emptyTitle}>Loading orders...</Text>
        </View>
      ) : filteredOrders.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="receipt-outline" size={32} color="#94A3B8" />
          </View>
          <Text style={styles.emptyTitle}>No orders found</Text>
          <Text style={styles.emptySub}>
            {query || filter !== "ALL" 
              ? "Try changing your search or filters."
              : "Looks like you haven't ordered anything yet!"}
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
              <Pressable style={styles.orderCard} android_ripple={{ color: "#F1F5F9" }}>
                <View style={styles.orderHeader}>
                  <View style={styles.orderHeaderLeft}>
                    <Text style={styles.orderNumber}>{order.orderNumber}</Text>
                    <Text style={styles.orderDate}>
                      {new Date(order.createdAt).toLocaleDateString(undefined, { 
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                      })}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      { backgroundColor: `${statusColor}15` }
                    ]}
                  >
                    <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                    <Text style={[styles.statusText, { color: statusColor }]}>
                      {order.status}
                    </Text>
                  </View>
                </View>

                {order.laneToken || order.isPreOrder ? (
                  <View style={styles.orderTagRow}>
                    {order.serviceLane === "TEACHER_PRIORITY" ? (
                      <View style={[styles.orderTagPill, styles.orderTagPriority]}>
                        <Ionicons name="star" size={12} color="#1E40AF" />
                        <Text style={[styles.orderTagText, styles.orderTagPriorityText]}>Priority</Text>
                      </View>
                    ) : null}
                    {order.laneToken ? (
                      <View style={styles.orderTagPill}>
                        <Ionicons name="ticket" size={12} color="#475569" />
                        <Text style={styles.orderTagText}>Token {order.laneToken}</Text>
                      </View>
                    ) : null}
                    {order.isPreOrder && order.pickupSlotLabel ? (
                      <View style={[styles.orderTagPill, styles.orderTagPreOrder]}>
                        <Ionicons name="time" size={12} color="#166534" />
                        <Text style={[styles.orderTagText, styles.orderTagPreOrderText]}>{order.pickupSlotLabel}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                <View style={styles.divider} />

                <View style={styles.orderFooter}>
                  <Text style={styles.orderItems}>
                    {order.items.length} item{order.items.length !== 1 ? "s" : ""} • {order.paymentMethod}
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

      {orders.length === 0 && !loading ? (
        <Pressable
          onPress={() => router.push("/(student)/search")}
          style={styles.browseBtn}
        >
          <Text style={styles.browseBtnText}>Browse Menu</Text>
        </Pressable>
      ) : null}
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
    gap: moderateScale(16),
    paddingBottom: verticalScale(28)
  },
  statsRow: {
    flexDirection: "row",
    gap: moderateScale(12)
  },
  statCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: moderateScale(16),
    padding: moderateScale(12),
    gap: moderateScale(10),
    shadowColor: "#0F172A",
    shadowOpacity: 0.03,
    shadowRadius: moderateScale(8),
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
    borderWidth: 1,
    borderColor: "#E2E8F0"
  },
  statIconWrap: {
    width: moderateScale(32),
    height: moderateScale(32),
    borderRadius: moderateScale(10),
    alignItems: "center",
    justifyContent: "center"
  },
  statLabel: {
    color: "#64748B",
    fontSize: fontScale(11),
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  statValue: {
    color: "#0F172A",
    fontWeight: "800",
    fontSize: fontScale(18),
    lineHeight: 22
  },
  searchBarCard: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    borderRadius: moderateScale(16),
    minHeight: moderateScale(52),
    paddingHorizontal: moderateScale(16),
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(10),
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowRadius: moderateScale(8),
    shadowOffset: { width: 0, height: 3 },
    elevation: 2
  },
  searchInput: {
    flex: 1,
    color: "#0F172A",
    paddingVertical: moderateScale(12),
    fontWeight: "600",
    fontSize: fontScale(15)
  },
  clearBtn: {
    padding: moderateScale(4)
  },
  filterRow: {
    gap: moderateScale(8),
    paddingRight: moderateScale(16)
  },
  filterChip: {
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(10),
    borderRadius: moderateScale(999),
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC"
  },
  filterChipActive: {
    backgroundColor: "#0F172A",
    borderColor: "#0F172A"
  },
  filterChipText: {
    color: "#475569",
    fontWeight: "700",
    fontSize: fontScale(14)
  },
  filterChipTextActive: {
    color: "white"
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: verticalScale(4),
    marginBottom: verticalScale(4)
  },
  sectionTitle: {
    color: "#0F172A",
    fontSize: fontScale(20),
    fontWeight: "800"
  },
  sectionMeta: {
    color: "#64748B",
    fontWeight: "700",
    fontSize: fontScale(14),
    marginBottom: verticalScale(2)
  },
  emptyCard: {
    borderRadius: moderateScale(16),
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "white",
    padding: moderateScale(32),
    alignItems: "center",
    justifyContent: "center",
    gap: moderateScale(8),
    marginTop: verticalScale(16)
  },
  emptyIconWrap: {
    width: moderateScale(64),
    height: moderateScale(64),
    borderRadius: moderateScale(32),
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: verticalScale(8)
  },
  emptyTitle: {
    color: "#0F172A",
    fontWeight: "800",
    fontSize: fontScale(18)
  },
  emptySub: {
    color: "#64748B",
    textAlign: "center",
    fontSize: fontScale(14),
    lineHeight: 20
  },
  orderCard: {
    borderRadius: moderateScale(16),
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "white",
    padding: moderateScale(16),
    gap: moderateScale(12),
    shadowColor: "#0F172A",
    shadowOpacity: 0.03,
    shadowRadius: moderateScale(8),
    shadowOffset: { width: 0, height: 2 },
    elevation: 2
  },
  orderHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: moderateScale(12)
  },
  orderHeaderLeft: {
    flex: 1,
    gap: moderateScale(2)
  },
  orderNumber: {
    color: "#0F172A",
    fontWeight: "800",
    fontSize: fontScale(17)
  },
  orderDate: {
    color: "#64748B",
    fontSize: fontScale(13),
    fontWeight: "600"
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: moderateScale(999),
    paddingHorizontal: moderateScale(10),
    paddingVertical: moderateScale(6),
    gap: moderateScale(6)
  },
  statusDot: {
    width: moderateScale(6),
    height: moderateScale(6),
    borderRadius: moderateScale(3)
  },
  statusText: {
    fontSize: fontScale(12),
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  orderTagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: moderateScale(8),
    marginTop: verticalScale(2)
  },
  orderTagPill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: moderateScale(8),
    backgroundColor: "#F1F5F9",
    paddingHorizontal: moderateScale(8),
    paddingVertical: moderateScale(5),
    gap: moderateScale(4)
  },
  orderTagText: {
    color: "#475569",
    fontWeight: "700",
    fontSize: fontScale(12)
  },
  orderTagPriority: {
    backgroundColor: "#F1F5F9"
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
  divider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: moderateScale(2)
  },
  orderFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  orderItems: {
    color: "#64748B",
    fontWeight: "600",
    fontSize: fontScale(14)
  },
  orderTotal: {
    color: "#0F172A",
    fontWeight: "800",
    fontSize: fontScale(18)
  },
  browseBtn: {
    backgroundColor: "#0F172A",
    borderRadius: moderateScale(16),
    paddingVertical: moderateScale(16),
    marginTop: verticalScale(8),
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0F172A",
    shadowOpacity: 0.2,
    shadowRadius: moderateScale(8),
    shadowOffset: { width: 0, height: 4 },
    elevation: 4
  },
  browseBtnText: {
    color: "white",
    fontSize: fontScale(16),
    fontWeight: "800"
  }
});
