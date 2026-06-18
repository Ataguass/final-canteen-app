import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View, RefreshControl } from "react-native";
import { useAuthStore } from '../../../stores/useAuthStore';
import { useOrderSocket } from "../../../hooks/useOrderSocket";
import { Order } from "../../../types";
import {  orderService } from "../../../services/orderService";
import { moderateScale, fontScale, verticalScale, scale, isTablet, gridColumns } from '../../../utils/responsive';
import { useTheme } from '../../../hooks/useTheme';

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
  const theme = useTheme();
  const { colors, isDark } = theme;
  const styles = createStyles(theme);
  const router = useRouter();
  const { user, accessToken } = useAuthStore();
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
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={[colors.primary]} tintColor={colors.primary} />}
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
            <Ionicons name="search" size={18} color={colors.textSecondary} />
            <TextInput
              placeholder="Search ID, status, payment..."
              placeholderTextColor="#94A3B8"
              value={query}
              onChangeText={setQuery}
              style={styles.searchInput}
            />
            {query ? (
              <Pressable onPress={() => setQuery("")} style={{ padding: moderateScale(4) }}>
                <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
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
            <Ionicons name="receipt-outline" size={32} color={colors.textSecondary} />
            <Text style={styles.emptyText}>No orders match your search.</Text>
          </View>
        ) : (
          <View style={styles.orderList}>
            {filteredOrders.map((order) => {
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
                        <View style={[styles.tagPill, { backgroundColor: isDark ? 'rgba(37, 99, 235, 0.15)' : "#DBEAFE" }]}>
                          <Text style={[styles.tagText, { color: isDark ? '#60A5FA' : "#1E40AF" }]}>Priority</Text>
                        </View>
                      ) : null}
                      {order.laneToken ? (
                        <View style={[styles.tagPill, { backgroundColor: isDark ? colors.surfaceAlt : "#F1F5F9" }]}>
                          <Text style={[styles.tagText, { color: isDark ? colors.textSecondary : "#334155" }]}>Token: {order.laneToken}</Text>
                        </View>
                      ) : null}
                      {order.isPreOrder && order.pickupSlotLabel ? (
                        <View style={[styles.tagPill, { backgroundColor: isDark ? 'rgba(5, 150, 105, 0.15)' : "#DCFCE7" }]}>
                          <Text style={[styles.tagText, { color: isDark ? '#34D399' : "#166534" }]}>{order.pickupSlotLabel}</Text>
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

const createStyles = ({ colors, isDark }: { colors: any, isDark: boolean }) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background
  },
  scroll: {
    flex: 1
  },
  content: {
    padding: moderateScale(16),
    gap: moderateScale(20),
    paddingBottom: verticalScale(40)
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  pageTitle: {
    fontSize: fontScale(24),
    fontWeight: "900",
    color: colors.text
  },
  lastUpdatedText: {
    color: colors.textSecondary,
    fontSize: fontScale(13),
    fontWeight: "500",
    marginTop: verticalScale(2)
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: moderateScale(12)
  },
  statCard: {
    width: "48%",
    backgroundColor: colors.card,
    borderRadius: moderateScale(16),
    padding: moderateScale(14),
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: moderateScale(10),
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  statLabel: {
    color: colors.textSecondary,
    fontWeight: "700",
    fontSize: fontScale(12)
  },
  statValue: {
    fontWeight: "900",
    fontSize: fontScale(24),
    marginTop: verticalScale(6)
  },
  filterSection: {
    gap: moderateScale(12)
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: moderateScale(16),
    paddingHorizontal: moderateScale(14),
    height: moderateScale(50),
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: moderateScale(8),
    shadowOffset: { width: 0, height: 2 },
    elevation: 1
  },
  searchInput: {
    flex: 1,
    height: "100%",
    marginLeft: moderateScale(10),
    fontSize: fontScale(15),
    fontWeight: "500",
    color: colors.text
  },
  filterScroll: {
    gap: moderateScale(8)
  },
  filterChip: {
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(10),
    borderRadius: moderateScale(999),
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center"
  },
  filterChipActive: {
    backgroundColor: isDark ? colors.text : "#0F172A",
    borderColor: isDark ? colors.text : "#0F172A"
  },
  filterChipInactive: {
    backgroundColor: colors.card,
    borderColor: isDark ? colors.border : "#E2E8F0"
  },
  filterChipText: {
    fontWeight: "800",
    fontSize: fontScale(13)
  },
  filterChipTextActive: {
    color: isDark ? colors.background : "white"
  },
  filterChipTextInactive: {
    color: colors.textSecondary
  },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: verticalScale(4)
  },
  listTitle: {
    fontSize: fontScale(18),
    fontWeight: "900",
    color: colors.text
  },
  listSubtitle: {
    color: colors.textSecondary,
    fontWeight: "700",
    fontSize: fontScale(13)
  },
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: moderateScale(20),
    padding: moderateScale(30),
    alignItems: "center",
    justifyContent: "center",
    gap: moderateScale(12),
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed"
  },
  emptyText: {
    color: colors.textSecondary,
    fontWeight: "600",
    fontSize: fontScale(15)
  },
  orderList: {
    gap: moderateScale(12)
  },
  orderCard: {
    backgroundColor: colors.card,
    borderRadius: moderateScale(20),
    padding: moderateScale(16),
    gap: moderateScale(12),
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: moderateScale(10),
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  orderCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start"
  },
  orderNumber: {
    fontSize: fontScale(18),
    fontWeight: "900",
    color: colors.text
  },
  orderDate: {
    color: colors.textSecondary,
    fontSize: fontScale(12),
    fontWeight: "500",
    marginTop: verticalScale(2)
  },
  statusPill: {
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(6),
    borderRadius: moderateScale(999)
  },
  statusText: {
    fontWeight: "800",
    fontSize: fontScale(11),
    letterSpacing: 0.5
  },
  laneTagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: moderateScale(6),
    marginTop: verticalScale(2)
  },
  tagPill: {
    paddingHorizontal: moderateScale(8),
    paddingVertical: moderateScale(4),
    borderRadius: moderateScale(6)
  },
  tagText: {
    fontSize: fontScale(11),
    fontWeight: "800"
  },
  orderCardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: verticalScale(12),
    borderTopWidth: 1,
    borderColor: isDark ? colors.border : "#F1F5F9"
  },
  orderItemsText: {
    color: colors.textSecondary,
    fontWeight: "600",
    fontSize: fontScale(13)
  },
  orderTotalText: {
    color: colors.text,
    fontWeight: "900",
    fontSize: fontScale(18)
  }
});
