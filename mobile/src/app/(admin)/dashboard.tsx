import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useAuth } from "../../hooks/useAuth";
import { menuService } from "../../services/menuService";
import { orderService, type Order } from "../../services/orderService";
import { userService, type ManagedUser } from "../../services/userService";

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

const cardShadow = {
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 18,
  backgroundColor: "white",
  shadowColor: "#0F172A",
  shadowOpacity: 0.07,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2
} as const;

const statusColorMap: Record<string, string> = {
  PENDING: "#F59E0B",
  ACCEPTED: "#2563EB",
  PREPARING: "#7C3AED",
  READY: "#0891B2",
  COMPLETED: "#059669",
  CANCELLED: "#DC2626",
  REFUNDED: "#6B7280"
};

const quickActions: QuickAction[] = [
  { label: "Open POS", subtitle: "Create counter order", icon: "storefront-outline", path: "/(admin)/pos", tint: "#FFF1EC" },
  {
    label: "Manage Orders",
    subtitle: "Track and update status",
    icon: "receipt-outline",
    path: "/(admin)/orders",
    tint: "#EEF2FF"
  },
  {
    label: "Reports",
    subtitle: "Sales and performance",
    icon: "bar-chart-outline",
    path: "/(admin)/profile/reports",
    tint: "#ECFEFF"
  },
  {
    label: "Menu",
    subtitle: "Categories and items",
    icon: "restaurant-outline",
    path: "/(admin)/profile/menu-manage",
    tint: "#ECFDF5"
  },
  {
    label: "Stock",
    subtitle: "Inventory controls",
    icon: "cube-outline",
    path: "/(admin)/profile/stock",
    tint: "#FEF3C7"
  },
  {
    label: "Users",
    subtitle: "Teacher and staff",
    icon: "people-outline",
    path: "/(admin)/profile/users",
    tint: "#F5F3FF"
  },
  {
    label: "Community",
    subtitle: "Posts and updates",
    icon: "megaphone-outline",
    path: "/(admin)/community",
    tint: "#F3E8FF"
  },
  {
    label: "Banners",
    subtitle: "Top promotions",
    icon: "images-outline",
    path: "/(admin)/profile/banners",
    tint: "#DBEAFE"
  }
];

export default function Screen() {
  const router = useRouter();
  const { user, accessToken } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [chartWidth, setChartWidth] = useState(0);

  const loadDashboard = useCallback(async () => {
    if (!user?.tenantId || !accessToken) return;
    try {
      setLoading(true);
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

  const chartHeight = 186;
  const chartPaddingX = 14;
  const chartPaddingY = 14;

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
          top: prev.y - 2,
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
      icon: "trending-up-outline" as const,
      color: "#1D4ED8",
      tint: "#DBEAFE"
    },
    {
      title: "Month Sales",
      value: formatCurrency(dashboardData.monthSales),
      note: "This month",
      icon: "calendar-outline" as const,
      color: "#7C3AED",
      tint: "#EDE9FE"
    },
    {
      title: "Active Orders",
      value: `${dashboardData.pendingOrderCount}`,
      note: "Pending/Preparing/Ready",
      icon: "timer-outline" as const,
      color: "#B45309",
      tint: "#FEF3C7"
    },
    {
      title: "Low Stock",
      value: `${dashboardData.lowStockItems.length}`,
      note: "Needs refill",
      icon: "warning-outline" as const,
      color: "#B91C1C",
      tint: "#FEE2E2"
    }
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#F8FAFC" }} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 26 }}>
      <View style={{ gap: 5 }}>
        <Text style={{ fontSize: 30, fontWeight: "800", letterSpacing: 0.3, color: "#0F172A" }}>Admin Dashboard</Text>
        <Text style={{ color: "#64748B", fontSize: 13 }}>
          Last updated: {lastUpdated ? lastUpdated.toLocaleString() : "Not loaded yet"}
        </Text>
      </View>

      <Pressable
        onPress={() => loadDashboard().catch(() => undefined)}
        style={{
          borderRadius: 14,
          paddingVertical: 13,
          backgroundColor: "#0F172A",
          alignItems: "center",
          flexDirection: "row",
          justifyContent: "center",
          gap: 8
        }}
      >
        <Ionicons name="refresh-outline" size={17} color="white" />
        <Text style={{ color: "white", textAlign: "center", fontWeight: "800", fontSize: 14 }}>
          {loading ? "Refreshing..." : "Refresh Dashboard"}
        </Text>
      </Pressable>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {topKpis.map((kpi) => (
          <View key={kpi.title} style={{ width: "48%", ...cardShadow, padding: 12, gap: 7 }}>
            <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: kpi.tint, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name={kpi.icon} size={18} color={kpi.color} />
            </View>
            <Text style={{ color: "#334155", fontWeight: "700", fontSize: 12 }}>{kpi.title}</Text>
            <Text style={{ color: "#0F172A", fontWeight: "800", fontSize: 21 }}>{kpi.value}</Text>
            <Text style={{ color: "#64748B", fontSize: 12 }}>{kpi.note}</Text>
          </View>
        ))}
      </View>

      <View style={{ ...cardShadow, padding: 14, overflow: "hidden", gap: 10 }}>
        <View
          style={{
            position: "absolute",
            right: -32,
            top: -25,
            width: 130,
            height: 130,
            borderRadius: 999,
            backgroundColor: "rgba(59,130,246,0.12)"
          }}
        />
        <View
          style={{
            position: "absolute",
            right: 20,
            top: 18,
            width: 72,
            height: 72,
            borderRadius: 999,
            backgroundColor: "rgba(16,185,129,0.12)"
          }}
        />

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <Text style={{ fontSize: 18, fontWeight: "800", color: "#0F172A" }}>Revenue Trend</Text>
            <Text style={{ color: "#64748B", marginTop: 2 }}>Last 7 days sales and order activity</Text>
          </View>
          <View style={{ borderRadius: 12, backgroundColor: "#EFF6FF", paddingHorizontal: 10, paddingVertical: 6 }}>
            <Text style={{ color: "#2563EB", fontWeight: "700", fontSize: 12 }}>{formatCurrency(dashboardData.totalSales)}</Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1, borderRadius: 12, backgroundColor: "#F8FAFC", padding: 8 }}>
            <Text style={{ color: "#64748B", fontSize: 11 }}>Today</Text>
            <Text style={{ color: "#0F172A", fontWeight: "800", fontSize: 15 }}>{formatCurrency(dashboardData.todaySales)}</Text>
          </View>
          <View style={{ flex: 1, borderRadius: 12, backgroundColor: "#F8FAFC", padding: 8 }}>
            <Text style={{ color: "#64748B", fontSize: 11 }}>Month</Text>
            <Text style={{ color: "#0F172A", fontWeight: "800", fontSize: 15 }}>{formatCurrency(dashboardData.monthSales)}</Text>
          </View>
          <View style={{ flex: 1, borderRadius: 12, backgroundColor: "#F8FAFC", padding: 8 }}>
            <Text style={{ color: "#64748B", fontSize: 11 }}>Avg Ticket</Text>
            <Text style={{ color: "#0F172A", fontWeight: "800", fontSize: 15 }}>{formatCurrency(dashboardData.avgTicket)}</Text>
          </View>
        </View>

        <View
          onLayout={(event) => setChartWidth(event.nativeEvent.layout.width)}
          style={{ height: chartHeight, borderRadius: 16, backgroundColor: "#F8FAFC", overflow: "hidden", borderWidth: 1, borderColor: "#E2E8F0" }}
        >
          {[0, 1, 2, 3].map((line) => (
            <View
              key={`grid-${line}`}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: chartPaddingY + (line * (chartHeight - chartPaddingY * 2)) / 3,
                borderTopWidth: 1,
                borderColor: "#E2E8F0"
              }}
            />
          ))}

          {chartPoints.map((point) => (
            <View
              key={`fill-${point.key}`}
              style={{
                position: "absolute",
                left: point.x - 9,
                top: point.y,
                width: 18,
                height: chartHeight - point.y,
                borderTopLeftRadius: 10,
                borderTopRightRadius: 10,
                backgroundColor: "rgba(37,99,235,0.14)"
              }}
            />
          ))}

          {chartSegments.map((segment) => (
            <View
              key={segment.key}
              style={{
                position: "absolute",
                left: segment.left,
                top: segment.top,
                width: segment.width,
                height: 4,
                borderRadius: 999,
                backgroundColor: "#1D4ED8",
                transform: [{ rotate: `${segment.angle}deg` }],
                transformOrigin: "left center"
              }}
            />
          ))}

          {chartPoints.map((point) => (
            <View key={`point-${point.key}`} style={{ position: "absolute", left: point.x - 5, top: point.y - 5 }}>
              <View style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: "#1D4ED8" }} />
              <View style={{ position: "absolute", top: 15, left: -9, minWidth: 28 }}>
                <Text style={{ color: "#0F172A", fontWeight: "700", fontSize: 11, textAlign: "center" }}>{point.orders}</Text>
              </View>
            </View>
          ))}

          <View style={{ position: "absolute", left: 0, right: 0, bottom: 8, flexDirection: "row", justifyContent: "space-around" }}>
            {dashboardData.sevenDays.map((day) => (
              <Text key={`label-${day.key}`} style={{ color: "#64748B", fontSize: 11 }}>
                {day.label}
              </Text>
            ))}
          </View>
        </View>
      </View>

      <View style={{ ...cardShadow, padding: 14, gap: 10 }}>
        <Text style={{ fontSize: 18, fontWeight: "800", color: "#0F172A" }}>Order Status Mix</Text>
        {dashboardData.orderStatusData.length === 0 ? (
          <Text style={{ color: "#64748B" }}>No orders yet.</Text>
        ) : (
          dashboardData.orderStatusData.map((entry) => {
            const tint = statusColorMap[entry.status] ?? "#1D4ED8";
            return (
              <View key={entry.status} style={{ gap: 5 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ color: "#334155", fontWeight: "700" }}>{entry.status}</Text>
                  <Text style={{ color: "#0F172A", fontWeight: "800" }}>{entry.count}</Text>
                </View>
                <View style={{ height: 10, borderRadius: 999, backgroundColor: "#E2E8F0", overflow: "hidden" }}>
                  <View
                    style={{
                      width: `${Math.max(8, Math.round((entry.count / maxStatusCount) * 100))}%`,
                      height: 10,
                      borderRadius: 999,
                      backgroundColor: tint
                    }}
                  />
                </View>
              </View>
            );
          })
        )}
      </View>

      <View style={{ ...cardShadow, padding: 14, gap: 9 }}>
        <Text style={{ fontSize: 18, fontWeight: "800", color: "#0F172A" }}>Inventory Alerts</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1, borderRadius: 12, backgroundColor: "#FEF3C7", padding: 10 }}>
            <Text style={{ color: "#92400E", fontSize: 12, fontWeight: "700" }}>Low Stock</Text>
            <Text style={{ color: "#78350F", fontSize: 22, fontWeight: "800" }}>{dashboardData.lowStockItems.length}</Text>
          </View>
          <View style={{ flex: 1, borderRadius: 12, backgroundColor: "#FEE2E2", padding: 10 }}>
            <Text style={{ color: "#B91C1C", fontSize: 12, fontWeight: "700" }}>Out of Stock</Text>
            <Text style={{ color: "#991B1B", fontSize: 22, fontWeight: "800" }}>{dashboardData.outOfStockItems.length}</Text>
          </View>
          <View style={{ flex: 1, borderRadius: 12, backgroundColor: "#F1F5F9", padding: 10 }}>
            <Text style={{ color: "#334155", fontSize: 12, fontWeight: "700" }}>Hidden</Text>
            <Text style={{ color: "#0F172A", fontSize: 22, fontWeight: "800" }}>{dashboardData.hiddenItems.length}</Text>
          </View>
        </View>
        {dashboardData.lowStockItems.slice(0, 3).map((item) => (
          <Text key={item.id} style={{ color: "#B91C1C", fontWeight: "700" }}>
            {item.name}: {item.stockQty} left
          </Text>
        ))}
        <Pressable
          onPress={() => router.push("/(admin)/profile/stock")}
          style={{ marginTop: 2, backgroundColor: "#0F172A", borderRadius: 12, padding: 11, alignItems: "center" }}
        >
          <Text style={{ color: "white", fontWeight: "800" }}>Open Stock Management</Text>
        </Pressable>
      </View>

      <View style={{ ...cardShadow, padding: 14, gap: 8 }}>
        <Text style={{ fontSize: 18, fontWeight: "800", color: "#0F172A" }}>Team Snapshot</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1, borderRadius: 10, backgroundColor: "#ECFDF5", padding: 10 }}>
            <Text style={{ color: "#047857", fontSize: 12, fontWeight: "700" }}>Teachers</Text>
            <Text style={{ fontSize: 20, fontWeight: "800", color: "#065F46" }}>{dashboardData.teamData.teachers}</Text>
          </View>
          <View style={{ flex: 1, borderRadius: 10, backgroundColor: "#E0F2FE", padding: 10 }}>
            <Text style={{ color: "#0369A1", fontSize: 12, fontWeight: "700" }}>Staff</Text>
            <Text style={{ fontSize: 20, fontWeight: "800", color: "#075985" }}>{dashboardData.teamData.staff}</Text>
          </View>
          <View style={{ flex: 1, borderRadius: 10, backgroundColor: "#FEF2F2", padding: 10 }}>
            <Text style={{ color: "#B91C1C", fontSize: 12, fontWeight: "700" }}>Pending</Text>
            <Text style={{ fontSize: 20, fontWeight: "800", color: "#991B1B" }}>{dashboardData.teamData.pendingApprovals}</Text>
          </View>
        </View>
        <Pressable
          onPress={() => router.push("/(admin)/profile/users")}
          style={{ marginTop: 2, backgroundColor: "#4F46E5", borderRadius: 12, padding: 11, alignItems: "center" }}
        >
          <Text style={{ color: "white", fontWeight: "800" }}>Open User Management</Text>
        </Pressable>
      </View>

      <View style={{ gap: 9 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontSize: 21, fontWeight: "800", color: "#0F172A" }}>Recent Orders</Text>
          <Pressable onPress={() => router.push("/(admin)/orders")} style={{ paddingVertical: 4, paddingHorizontal: 8 }}>
            <Text style={{ color: "#1D4ED8", fontWeight: "800" }}>View All</Text>
          </Pressable>
        </View>
        {dashboardData.recentOrders.length === 0 ? (
          <View style={{ ...cardShadow, padding: 12 }}>
            <Text style={{ color: "#64748B" }}>No orders yet.</Text>
          </View>
        ) : (
          dashboardData.recentOrders.map((order) => {
            const statusTint = statusColorMap[order.status] ?? "#334155";
            return (
              <Pressable
                key={order.id}
                onPress={() => router.push({ pathname: "/(admin)/orders/[id]", params: { id: order.id } })}
                style={{ ...cardShadow, padding: 12, gap: 6 }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ color: "#0F172A", fontWeight: "800", fontSize: 15 }}>{order.orderNumber}</Text>
                  <View style={{ borderRadius: 999, backgroundColor: `${statusTint}1A`, paddingHorizontal: 8, paddingVertical: 4 }}>
                    <Text style={{ color: statusTint, fontWeight: "800", fontSize: 12 }}>{order.status}</Text>
                  </View>
                </View>
                <Text style={{ color: "#64748B", fontSize: 12 }}>{new Date(order.createdAt).toLocaleString()}</Text>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ color: "#334155", fontWeight: "600" }}>Payment: {order.paymentMethod}</Text>
                  <Text style={{ color: "#0F172A", fontWeight: "800" }}>{formatCurrency(order.totalAmount)}</Text>
                </View>
              </Pressable>
            );
          })
        )}
      </View>

      <View style={{ gap: 10 }}>
        <Text style={{ fontSize: 21, fontWeight: "800", color: "#0F172A" }}>Quick Actions</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 10 }}>
          {quickActions.map((action) => (
            <Pressable
              key={action.path}
              onPress={() => router.push(action.path as never)}
              style={{
                width: "48%",
                ...cardShadow,
                borderColor: "#E2E8F0",
                padding: 12,
                gap: 8,
                backgroundColor: action.tint
              }}
            >
              <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: "white", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name={action.icon} size={18} color="#0F172A" />
              </View>
              <Text style={{ color: "#0F172A", fontWeight: "800", fontSize: 14 }}>{action.label}</Text>
              <Text style={{ color: "#475569", fontSize: 12 }}>{action.subtitle}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
