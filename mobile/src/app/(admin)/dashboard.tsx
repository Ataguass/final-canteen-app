import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../hooks/useAuth";
import { menuService } from "../../services/menuService";
import { orderService, type Order } from "../../services/orderService";
import { userService, type ManagedUser } from "../../services/userService";
import { moderateScale, fontScale, verticalScale, scale, isTablet, gridColumns } from '../../utils/responsive';
import { useTheme } from '../../hooks/useTheme';

type MenuItem = {
  id: string;
  name: string;
  stockQty: number;
  lowStockThreshold: number;
  isAvailable: boolean;
};

type DaySales = {
  key: string;
  label: string;
  sales: number;
  orders: number;
};

type QuickAction = {
  label: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  path: string;
  tint: string;
  iconColor: string;
};

const formatCurrency = (value: number): string => `₹ ${value.toFixed(2)}`;

const sameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const sameMonth = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

const dayKey = (value: Date): string =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;

const dayLabel = (value: Date): string =>
  value.toLocaleDateString("en-IN", { weekday: "short" });

const statusColorMap: Record<string, string> = {
  PENDING: "#D97706",
  ACCEPTED: "#2563EB",
  PREPARING: "#7C3AED",
  READY: "#0891B2",
  COMPLETED: "#059669",
  CANCELLED: "#DC2626",
  REFUNDED: "#6B7280"
};

const quickActions: QuickAction[] = [
  { label: "Open POS", subtitle: "Counter order", icon: "storefront", path: "/(admin)/pos", tint: "#FFEDD5", iconColor: "#EA580C" },
  { label: "Orders", subtitle: "Live tracking", icon: "receipt", path: "/(admin)/orders", tint: "#DBEAFE", iconColor: "#2563EB" },
  { label: "Reports", subtitle: "Sales & KPIs", icon: "bar-chart", path: "/(admin)/profile/reports", tint: "#E0F2FE", iconColor: "#0284C7" },
  { label: "Menu", subtitle: "Manage items", icon: "restaurant", path: "/(admin)/profile/menu-manage", tint: "#DCFCE7", iconColor: "#16A34A" },
  { label: "Stock", subtitle: "Inventory", icon: "cube", path: "/(admin)/profile/stock", tint: "#FEF3C7", iconColor: "#D97706" },
  { label: "Users", subtitle: "Team access", icon: "people", path: "/(admin)/profile/users", tint: "#F3E8FF", iconColor: "#9333EA" },
  { label: "Community", subtitle: "Broadcasts", icon: "megaphone", path: "/(admin)/community", tint: "#FCE7F3", iconColor: "#DB2777" },
  { label: "Banners", subtitle: "Promotions", icon: "images", path: "/(admin)/profile/banners", tint: "#E0E7FF", iconColor: "#4F46E5" }
];

export default function Screen() {
  const theme = useTheme();
  const { colors, isDark } = theme;
  const styles = createStyles(theme);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, accessToken } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [chartWidth, setChartWidth] = useState(0);

  const loadDashboard = useCallback(async (isRefresh = false) => {
    if (!user?.tenantId || !accessToken) return;
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      
      const [ordersResponse, itemsResponse, usersResponse] = await Promise.all([
        orderService.listOrders(accessToken, user.tenantId),
        menuService.listItems(accessToken, user.tenantId),
        userService.listUsers(accessToken, user.tenantId)
      ]);

      setOrders(ordersResponse.data);
      setItems(itemsResponse.data);
      setUsers(usersResponse.data);
      setLastUpdated(new Date());
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Could not load dashboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken, user?.tenantId]);

  useEffect(() => {
    loadDashboard().catch(() => undefined);
  }, [loadDashboard]);

  const dashboardData = useMemo(() => {
    const now = new Date();
    const todaySales = orders
      .filter((order) => sameDay(new Date(order.createdAt), now))
      .reduce((sum, order) => sum + order.totalAmount, 0);

    const monthSales = orders
      .filter((order) => sameMonth(new Date(order.createdAt), now))
      .reduce((sum, order) => sum + order.totalAmount, 0);

    const activeStatuses = new Set(["PENDING", "ACCEPTED", "PREPARING", "READY"]);
    const pendingOrderCount = orders.filter((order) => activeStatuses.has(order.status)).length;

    const lowStockItems = items.filter(
      (item) => item.isAvailable && item.stockQty > 0 && item.stockQty <= item.lowStockThreshold
    );
    const outOfStockItems = items.filter((item) => item.isAvailable && item.stockQty <= 0);
    const hiddenItems = items.filter((item) => !item.isAvailable);

    const totalSales = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    const avgTicket = orders.length > 0 ? totalSales / orders.length : 0;

    const recentOrders = [...orders]
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .slice(0, 5);

    const sevenDays: DaySales[] = [];
    for (let offset = 6; offset >= 0; offset -= 1) {
      const date = new Date(now);
      date.setHours(0, 0, 0, 0);
      date.setDate(now.getDate() - offset);
      const key = dayKey(date);
      const selected = orders.filter((order) => dayKey(new Date(order.createdAt)) === key);
      sevenDays.push({
        key,
        label: dayLabel(date),
        sales: selected.reduce((sum, order) => sum + order.totalAmount, 0),
        orders: selected.length
      });
    }

    const statusGroups = ["PENDING", "ACCEPTED", "PREPARING", "READY", "COMPLETED", "CANCELLED", "REFUNDED"];
    const orderStatusData = statusGroups
      .map((status) => ({
        status,
        count: orders.filter((order) => order.status === status).length
      }))
      .filter((entry) => entry.count > 0);

    return {
      todaySales,
      monthSales,
      totalSales,
      avgTicket,
      pendingOrderCount,
      totalOrders: orders.length,
      lowStockItems,
      outOfStockItems,
      hiddenItems,
      recentOrders,
      sevenDays,
      orderStatusData,
      teamData: {
        total: users.length,
        teachers: users.filter((item) => item.role === "TEACHER").length,
        staff: users.filter((item) => item.role === "STAFF").length,
        pendingApprovals: users.filter((item) => !item.isApproved).length
      }
    };
  }, [orders, items, users]);

  const maxSevenDaySales = useMemo(
    () => Math.max(1, ...dashboardData.sevenDays.map((day) => day.sales)),
    [dashboardData.sevenDays]
  );

  const maxStatusCount = useMemo(
    () => Math.max(1, ...dashboardData.orderStatusData.map((entry) => entry.count)),
    [dashboardData.orderStatusData]
  );

  const chartHeight = 180;
  const chartPaddingX = 20;
  const chartPaddingY = 16;

  const chartPoints = useMemo(() => {
    if (chartWidth <= 0 || dashboardData.sevenDays.length === 0) return [];
    const usableWidth = Math.max(1, chartWidth - chartPaddingX * 2);
    const usableHeight = Math.max(1, chartHeight - chartPaddingY * 2);
    const lastIndex = Math.max(1, dashboardData.sevenDays.length - 1);

    return dashboardData.sevenDays.map((day, index) => {
      const normalizedSales = day.sales / maxSevenDaySales;
      return {
        ...day,
        x: chartPaddingX + (index / lastIndex) * usableWidth,
        y: chartPaddingY + (1 - normalizedSales) * usableHeight
      };
    });
  }, [chartWidth, dashboardData.sevenDays, maxSevenDaySales]);

  const chartSegments = useMemo(
    () =>
      chartPoints.slice(1).map((point, index) => {
        const prev = chartPoints[index];
        const dx = point.x - prev.x;
        const dy = point.y - prev.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        return {
          key: `${prev.key}-${point.key}`,
          left: prev.x,
          top: prev.y - 2, // Center of 4px line
          width: Math.max(1, length),
          angle
        };
      }),
    [chartPoints]
  );

  const topKpis = [
    {
      title: "Today Sales",
      value: formatCurrency(dashboardData.todaySales),
      note: "Live collection",
      icon: "trending-up" as const,
      color: "#2563EB",
      tint: "#DBEAFE"
    },
    {
      title: "Month Sales",
      value: formatCurrency(dashboardData.monthSales),
      note: "This month",
      icon: "calendar" as const,
      color: "#7C3AED",
      tint: "#EDE9FE"
    },
    {
      title: "Active Orders",
      value: `${dashboardData.pendingOrderCount}`,
      note: "Pending/Ready",
      icon: "timer" as const,
      color: "#D97706",
      tint: "#FEF3C7"
    },
    {
      title: "Low Stock",
      value: `${dashboardData.lowStockItems.length}`,
      note: "Needs refill",
      icon: "warning" as const,
      color: "#DC2626",
      tint: "#FEE2E2"
    }
  ];

  return (
    <View key={isDark ? "dark" : "light"} style={styles.screen}>
      <ScrollView 
        contentContainerStyle={[styles.content, { paddingTop: 16 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadDashboard(true)} colors={[isDark ? colors.text : "#0F172A"]} />
        }
      >
        {/* Overview Header */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: verticalScale(12), paddingHorizontal: moderateScale(4) }}>
          <Text style={{ fontSize: fontScale(18), fontWeight: "900", color: colors.text }}>Overview</Text>
          <Text style={{ fontSize: fontScale(13), fontWeight: "600", color: colors.textSecondary, marginBottom: verticalScale(2) }}>
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
          </Text>
        </View>

        {/* Top KPIs */}
        <View style={styles.kpiGrid}>
          {topKpis.map((kpi) => (
            <View key={kpi.title} style={styles.kpiCard}>
              <View style={[styles.kpiIconWrap, { backgroundColor: kpi.tint }]}>
                <Ionicons name={kpi.icon} size={20} color={kpi.color} />
              </View>
              <Text style={styles.kpiTitle}>{kpi.title}</Text>
              <Text style={styles.kpiValue} numberOfLines={1} adjustsFontSizeToFit>{kpi.value}</Text>
              <Text style={styles.kpiNote}>{kpi.note}</Text>
            </View>
          ))}
        </View>

        {/* Quick Actions */}
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickGrid}>
            {quickActions.map((action) => (
              <Pressable
                key={`${action.path}-${isDark}`}
                onPress={() => router.push(action.path as never)}
                style={styles.quickCard}
                android_ripple={{ color: isDark ? colors.surfaceAlt : "#E2E8F0" }}
              >
                <View style={[styles.quickIconWrap, { backgroundColor: action.tint }]}>
                  <Ionicons name={action.icon} size={22} color={action.iconColor} />
                </View>
                <Text style={styles.quickLabel}>{action.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Chart */}
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>Revenue Trend</Text>
          <View style={[styles.card, { padding: 0, overflow: "hidden" }]}>
            <View style={styles.chartHeader}>
              <View>
                <Text style={styles.chartTitle}>Last 7 Days</Text>
                <Text style={styles.chartSubtitle}>Sales and order volume</Text>
              </View>
              <View style={styles.chartPill}>
                <Text style={styles.chartPillText}>{formatCurrency(dashboardData.totalSales)}</Text>
              </View>
            </View>

            <View style={styles.chartSummaryRow}>
              <View style={styles.chartSummaryBox}>
                <Text style={styles.chartSummaryLabel}>Today</Text>
                <Text style={styles.chartSummaryValue}>{formatCurrency(dashboardData.todaySales)}</Text>
              </View>
              <View style={styles.chartSummaryBox}>
                <Text style={styles.chartSummaryLabel}>Month</Text>
                <Text style={styles.chartSummaryValue}>{formatCurrency(dashboardData.monthSales)}</Text>
              </View>
              <View style={styles.chartSummaryBox}>
                <Text style={styles.chartSummaryLabel}>Avg Ticket</Text>
                <Text style={styles.chartSummaryValue}>{formatCurrency(dashboardData.avgTicket)}</Text>
              </View>
            </View>

            <View
              onLayout={(event) => setChartWidth(event.nativeEvent.layout.width)}
              style={styles.chartArea}
            >
              {[0, 1, 2, 3].map((line) => (
                <View
                  key={`grid-${line}`}
                  style={[styles.chartGridLine, { top: chartPaddingY + (line * (chartHeight - chartPaddingY * 2)) / 3 }]}
                />
              ))}

              {chartSegments.map((segment) => (
                <View
                  key={segment.key}
                  style={[
                    styles.chartSegment,
                    {
                      left: segment.left,
                      top: segment.top,
                      width: segment.width,
                      transform: [{ rotate: `${segment.angle}deg` }]
                    }
                  ]}
                />
              ))}

              {chartPoints.map((point) => (
                <View key={`point-${point.key}`} style={[styles.chartPointWrap, { left: point.x - 6, top: point.y - 6 }]}>
                  <View style={styles.chartPoint} />
                  <View style={styles.chartPointTooltip}>
                    <Text style={styles.chartPointText}>{point.orders}</Text>
                  </View>
                </View>
              ))}

              <View style={styles.chartXAxis}>
                {dashboardData.sevenDays.map((day) => (
                  <Text key={`label-${day.key}`} style={styles.chartXLabel}>
                    {day.label}
                  </Text>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Multi-Section Row */}
        <View style={styles.multiCardRow}>
          {/* Status Mix */}
          <View style={[styles.card, styles.flexCard]}>
            <Text style={styles.cardHeader}>Order Status</Text>
            {dashboardData.orderStatusData.length === 0 ? (
              <Text style={styles.emptyText}>No active orders.</Text>
            ) : (
              <View style={styles.statusList}>
                {dashboardData.orderStatusData.map((entry) => {
                  const tint = statusColorMap[entry.status] ?? "#3B82F6";
                  return (
                    <View key={entry.status} style={styles.statusRow}>
                      <View style={styles.statusRowTop}>
                        <Text style={styles.statusRowLabel}>{entry.status.charAt(0) + entry.status.slice(1).toLowerCase()}</Text>
                        <Text style={styles.statusRowValue}>{entry.count}</Text>
                      </View>
                      <View style={styles.statusBarTrack}>
                        <View
                          style={[styles.statusBarFill, { backgroundColor: tint, width: `${Math.max(8, Math.round((entry.count / maxStatusCount) * 100))}%` }]}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* Team Snapshot */}
          <View style={[styles.card, styles.flexCard]}>
            <Text style={styles.cardHeader}>Team Alerts</Text>
            <View style={styles.teamGrid}>
              <View style={[styles.teamBox, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : "#ECFDF5" }]}>
                <Text style={[styles.teamBoxLabel, { color: isDark ? '#34D399' : "#047857" }]}>Teachers</Text>
                <Text style={[styles.teamBoxValue, { color: isDark ? '#10B981' : "#064E3B" }]}>{dashboardData.teamData.teachers}</Text>
              </View>
              <View style={[styles.teamBox, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : "#EFF6FF" }]}>
                <Text style={[styles.teamBoxLabel, { color: isDark ? '#60A5FA' : "#1D4ED8" }]}>Staff</Text>
                <Text style={[styles.teamBoxValue, { color: isDark ? '#3B82F6' : "#1E3A8A" }]}>{dashboardData.teamData.staff}</Text>
              </View>
              <View style={[styles.teamBox, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : "#FEF2F2" }]}>
                <Text style={[styles.teamBoxLabel, { color: isDark ? '#F87171' : "#DC2626" }]}>Pending</Text>
                <Text style={[styles.teamBoxValue, { color: isDark ? '#EF4444' : "#7F1D1D" }]}>{dashboardData.teamData.pendingApprovals}</Text>
              </View>
            </View>
            <Pressable
              onPress={() => router.push("/(admin)/profile/users")}
              style={styles.actionBtn}
            >
              <Text style={styles.actionBtnText}>Manage Users</Text>
            </Pressable>
          </View>
        </View>

        {/* Inventory Alerts */}
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>Inventory Alerts</Text>
          <View style={styles.card}>
            <View style={styles.inventoryGrid}>
              <View style={[styles.inventoryBox, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : "#FEF2F2" }]}>
                <Text style={[styles.inventoryLabel, { color: isDark ? '#F87171' : "#B91C1C" }]}>Out of Stock</Text>
                <Text style={[styles.inventoryValue, { color: isDark ? '#EF4444' : "#7F1D1D" }]}>{dashboardData.outOfStockItems.length}</Text>
              </View>
              <View style={[styles.inventoryBox, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : "#FFFBEB" }]}>
                <Text style={[styles.inventoryLabel, { color: isDark ? '#FBBF24' : "#B45309" }]}>Low Stock</Text>
                <Text style={[styles.inventoryValue, { color: isDark ? '#F59E0B' : "#78350F" }]}>{dashboardData.lowStockItems.length}</Text>
              </View>
              <View style={[styles.inventoryBox, { backgroundColor: colors.surfaceAlt }]}>
                <Text style={[styles.inventoryLabel, { color: colors.textSecondary }]}>Hidden</Text>
                <Text style={[styles.inventoryValue, { color: colors.text }]}>{dashboardData.hiddenItems.length}</Text>
              </View>
            </View>
            {dashboardData.lowStockItems.length > 0 && (
              <View style={styles.inventoryList}>
                {dashboardData.lowStockItems.slice(0, 3).map((item) => (
                  <View key={item.id} style={styles.inventoryListItem}>
                    <Ionicons name="warning" size={14} color="#D97706" />
                    <Text style={styles.inventoryListText}>{item.name} ({item.stockQty} left)</Text>
                  </View>
                ))}
              </View>
            )}
            <Pressable
              onPress={() => router.push("/(admin)/profile/stock")}
              style={[styles.actionBtn, { marginTop: 12 }]}
            >
              <Text style={styles.actionBtnText}>Open Stock Management</Text>
            </Pressable>
          </View>
        </View>

        {/* Recent Orders */}
        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Recent Orders</Text>
            <Pressable onPress={() => router.push("/(admin)/orders")} style={styles.viewAllBtn}>
              <Text style={styles.viewAllText}>View All</Text>
            </Pressable>
          </View>

          {dashboardData.recentOrders.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.emptyText}>No orders yet.</Text>
            </View>
          ) : (
            <View style={styles.orderList}>
              {dashboardData.recentOrders.map((order) => {
                const statusTint = statusColorMap[order.status] ?? "#64748B";
                return (
                  <Pressable
                    key={`${order.id}-${isDark}`}
                    onPress={() => router.push({ pathname: "/(admin)/orders/[id]", params: { id: order.id } })}
                    style={styles.orderCard}
                    android_ripple={{ color: isDark ? colors.surfaceAlt : "#F1F5F9" }}
                  >
                    <View style={styles.orderTopRow}>
                      <Text style={styles.orderNumber}>{order.orderNumber}</Text>
                      <View style={[styles.orderStatusPill, { backgroundColor: `${statusTint}15` }]}>
                        <View style={[styles.orderStatusDot, { backgroundColor: statusTint }]} />
                        <Text style={[styles.orderStatusText, { color: statusTint }]}>{order.status}</Text>
                      </View>
                    </View>
                    <Text style={styles.orderDate}>{new Date(order.createdAt).toLocaleString(undefined, { 
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                    })}</Text>
                    <View style={styles.orderDivider} />
                    <View style={styles.orderBottomRow}>
                      <Text style={styles.orderMeta}>{order.items.length} items • {order.paymentMethod}</Text>
                      <Text style={styles.orderTotal}>{formatCurrency(order.totalAmount)}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

      </ScrollView>
    </View>
  );
}

const createStyles = ({ colors, isDark }: { colors: any, isDark: boolean }) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    padding: moderateScale(16),
    gap: moderateScale(24),
    paddingBottom: verticalScale(40)
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: moderateScale(12)
  },
  kpiCard: {
    width: "48%",
    borderRadius: moderateScale(16),
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: moderateScale(14),
    shadowColor: "#0F172A",
    shadowOpacity: 0.03,
    shadowRadius: moderateScale(8),
    shadowOffset: { width: 0, height: 2 },
    elevation: 2
  },
  kpiIconWrap: {
    width: moderateScale(38),
    height: moderateScale(38),
    borderRadius: moderateScale(12),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: verticalScale(10)
  },
  kpiTitle: {
    color: colors.textSecondary,
    fontSize: fontScale(12),
    fontWeight: "700"
  },
  kpiValue: {
    color: colors.text,
    fontSize: fontScale(22),
    fontWeight: "900",
    marginVertical: moderateScale(2)
  },
  kpiNote: {
    color: colors.textMuted,
    fontSize: fontScale(11),
    fontWeight: "500"
  },
  sectionWrap: {
    gap: moderateScale(12)
  },
  sectionTitle: {
    fontSize: fontScale(18),
    fontWeight: "800",
    color: colors.text
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  viewAllBtn: {
    paddingHorizontal: moderateScale(8),
    paddingVertical: moderateScale(4)
  },
  viewAllText: {
    color: isDark ? colors.primary : "#2563EB",
    fontWeight: "700",
    fontSize: fontScale(14)
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: moderateScale(12)
  },
  quickCard: {
    width: "23%",
    backgroundColor: colors.card,
    borderRadius: moderateScale(16),
    paddingVertical: moderateScale(14),
    paddingHorizontal: moderateScale(6),
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#0F172A",
    shadowOpacity: 0.02,
    shadowRadius: moderateScale(6),
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
    gap: moderateScale(8)
  },
  quickIconWrap: {
    width: moderateScale(44),
    height: moderateScale(44),
    borderRadius: moderateScale(22),
    alignItems: "center",
    justifyContent: "center"
  },
  quickLabel: {
    color: colors.text,
    fontSize: fontScale(11),
    fontWeight: "700",
    textAlign: "center"
  },
  card: {
    borderRadius: moderateScale(16),
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: moderateScale(16),
    shadowColor: "#0F172A",
    shadowOpacity: 0.03,
    shadowRadius: moderateScale(8),
    shadowOffset: { width: 0, height: 2 },
    elevation: 2
  },
  cardHeader: {
    fontSize: fontScale(16),
    fontWeight: "800",
    color: colors.text,
    marginBottom: verticalScale(12)
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: moderateScale(16),
    paddingBottom: verticalScale(8)
  },
  chartTitle: {
    fontSize: fontScale(16),
    fontWeight: "800",
    color: colors.text
  },
  chartSubtitle: {
    color: colors.textSecondary,
    fontSize: fontScale(13),
    fontWeight: "500",
    marginTop: verticalScale(2)
  },
  chartPill: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: moderateScale(999),
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(6)
  },
  chartPillText: {
    color: colors.text,
    fontWeight: "800",
    fontSize: fontScale(14)
  },
  chartSummaryRow: {
    flexDirection: "row",
    gap: moderateScale(8),
    paddingHorizontal: moderateScale(16),
    paddingBottom: verticalScale(16)
  },
  chartSummaryBox: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: moderateScale(12),
    padding: moderateScale(10),
    borderWidth: 1,
    borderColor: isDark ? colors.border : "#F1F5F9"
  },
  chartSummaryLabel: {
    color: colors.textSecondary,
    fontSize: fontScale(11),
    fontWeight: "600"
  },
  chartSummaryValue: {
    color: colors.text,
    fontSize: fontScale(15),
    fontWeight: "800",
    marginTop: verticalScale(2)
  },
  chartArea: {
    height: moderateScale(180),
    backgroundColor: isDark ? colors.background : "#FAFAFA",
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  chartGridLine: {
    position: "absolute",
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed"
  },
  chartSegment: {
    position: "absolute",
    height: moderateScale(4),
    borderRadius: moderateScale(2),
    backgroundColor: isDark ? colors.primary : "#3B82F6",
    transformOrigin: "left center" as any // React native 0.73+ supports this
  },
  chartPointWrap: {
    position: "absolute",
    alignItems: "center"
  },
  chartPoint: {
    width: moderateScale(12),
    height: moderateScale(12),
    borderRadius: moderateScale(6),
    backgroundColor: colors.card,
    borderWidth: 3,
    borderColor: isDark ? colors.primary : "#2563EB",
    zIndex: 2
  },
  chartPointTooltip: {
    position: "absolute",
    top: verticalScale(-24),
    backgroundColor: isDark ? colors.surfaceAlt : "#0F172A",
    borderRadius: moderateScale(6),
    paddingHorizontal: moderateScale(6),
    paddingVertical: moderateScale(2)
  },
  chartPointText: {
    color: "white",
    fontSize: fontScale(10),
    fontWeight: "800"
  },
  chartXAxis: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: verticalScale(8),
    flexDirection: "row",
    justifyContent: "space-around"
  },
  chartXLabel: {
    color: colors.textMuted,
    fontSize: fontScale(10),
    fontWeight: "600"
  },
  multiCardRow: {
    flexDirection: "row",
    gap: moderateScale(12)
  },
  flexCard: {
    flex: 1
  },
  statusList: {
    gap: moderateScale(12)
  },
  statusRow: {
    gap: moderateScale(6)
  },
  statusRowTop: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  statusRowLabel: {
    color: colors.textSecondary,
    fontWeight: "600",
    fontSize: fontScale(12)
  },
  statusRowValue: {
    color: colors.text,
    fontWeight: "800",
    fontSize: fontScale(13)
  },
  statusBarTrack: {
    height: moderateScale(6),
    backgroundColor: colors.surfaceAlt,
    borderRadius: moderateScale(3),
    overflow: "hidden"
  },
  statusBarFill: {
    height: moderateScale(6),
    borderRadius: moderateScale(3)
  },
  teamGrid: {
    gap: moderateScale(8)
  },
  teamBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(10),
    borderRadius: moderateScale(10)
  },
  teamBoxLabel: {
    fontWeight: "700",
    fontSize: fontScale(13)
  },
  teamBoxValue: {
    fontWeight: "800",
    fontSize: fontScale(16)
  },
  actionBtn: {
    backgroundColor: isDark ? colors.primary : "#0F172A",
    borderRadius: moderateScale(10),
    paddingVertical: moderateScale(10),
    alignItems: "center",
    marginTop: verticalScale(12)
  },
  actionBtnText: {
    color: "white",
    fontWeight: "800",
    fontSize: fontScale(13)
  },
  inventoryGrid: {
    flexDirection: "row",
    gap: moderateScale(8)
  },
  inventoryBox: {
    flex: 1,
    borderRadius: moderateScale(12),
    padding: moderateScale(12),
    alignItems: "center"
  },
  inventoryLabel: {
    fontSize: fontScale(11),
    fontWeight: "700"
  },
  inventoryValue: {
    fontSize: fontScale(24),
    fontWeight: "900",
    marginTop: verticalScale(4)
  },
  inventoryList: {
    marginTop: verticalScale(12),
    backgroundColor: isDark ? 'rgba(245, 158, 11, 0.05)' : "#FFFBEB",
    borderRadius: moderateScale(10),
    padding: moderateScale(10),
    gap: moderateScale(6)
  },
  inventoryListItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(6)
  },
  inventoryListText: {
    color: isDark ? '#FBBF24' : "#92400E",
    fontSize: fontScale(13),
    fontWeight: "600"
  },
  orderList: {
    gap: moderateScale(12)
  },
  orderCard: {
    borderRadius: moderateScale(16),
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: moderateScale(16),
    gap: moderateScale(10),
    shadowColor: "#0F172A",
    shadowOpacity: 0.02,
    shadowRadius: moderateScale(8),
    shadowOffset: { width: 0, height: 2 },
    elevation: 1
  },
  orderTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  orderNumber: {
    color: colors.text,
    fontSize: fontScale(16),
    fontWeight: "800"
  },
  orderStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: moderateScale(999),
    paddingHorizontal: moderateScale(8),
    paddingVertical: moderateScale(4),
    gap: moderateScale(4)
  },
  orderStatusDot: {
    width: moderateScale(6),
    height: moderateScale(6),
    borderRadius: moderateScale(3)
  },
  orderStatusText: {
    fontWeight: "800",
    fontSize: fontScale(11),
    textTransform: "uppercase"
  },
  orderDate: {
    color: colors.textSecondary,
    fontSize: fontScale(13),
    fontWeight: "600"
  },
  orderDivider: {
    height: 1,
    backgroundColor: colors.surfaceAlt,
    marginVertical: moderateScale(2)
  },
  orderBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  orderMeta: {
    color: colors.textSecondary,
    fontSize: fontScale(13),
    fontWeight: "600"
  },
  orderTotal: {
    color: colors.text,
    fontSize: fontScale(16),
    fontWeight: "800"
  },
  emptyText: {
    color: colors.textSecondary,
    textAlign: "center",
    padding: moderateScale(16)
  }
});
