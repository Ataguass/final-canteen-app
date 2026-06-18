import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Share, Text, TextInput, View, RefreshControl } from "react-native";
import { useAuthStore } from '../../../stores/useAuthStore';
import { Order } from "../../../types";
import { orderService} from "../../../services/orderService";
import { PaymentMethod, PaymentStatus } from "../../../types";
import { useTheme } from '../../../hooks/useTheme';

type RangeKey = "TODAY" | "WEEK" | "MONTH" | "ALL" | "CUSTOM";

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const inLastDays = (date: Date, days: number) => {
  const now = new Date();
  const since = new Date(now);
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (days - 1));
  return date >= since;
};

const isSameMonth = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

const formatDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseDateInput = (value: string, endOfDay: boolean): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  const parsed = new Date(
    year,
    month - 1,
    day,
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0
  );
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
};

const formatCurrency = (value: number) => `₹ ${value.toFixed(2)}`;


const statusColorMap: Record<string, string> = {
  PAID: "#059669",
  UNPAID: "#DC2626",
  PARTIAL: "#D97706"
};

export default function Screen() {
  const theme = useTheme();
  const { colors, isDark } = theme;
  const { user, accessToken } = useAuthStore();

  const cardShadow = {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.card,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  } as const;
  
  const now = useMemo(() => new Date(), []);
  const monthStart = useMemo(() => new Date(now.getFullYear(), now.getMonth(), 1), [now]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [range, setRange] = useState<RangeKey>("TODAY");
  const [fromDate, setFromDate] = useState(formatDateInput(monthStart));
  const [toDate, setToDate] = useState(formatDateInput(now));
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadOrders = useCallback(async () => {
    if (!user?.tenantId || !accessToken) return;
    setLoading(true);
    try {
      const response = await orderService.listOrders(accessToken, user.tenantId);
      const sorted = [...response.data].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
      setOrders(sorted);
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  }, [accessToken, user?.tenantId]);

  useEffect(() => {
    loadOrders().catch((error: unknown) => {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to load reports");
    });
  }, [loadOrders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const created = new Date(order.createdAt);
      if (range === "TODAY") {
        return isSameDay(created, new Date());
      }
      if (range === "WEEK") {
        return inLastDays(created, 7);
      }
      if (range === "MONTH") {
        return inLastDays(created, 30);
      }
      if (range === "CUSTOM") {
        const from = parseDateInput(fromDate, false);
        const to = parseDateInput(toDate, true);
        if (!from || !to || from > to) {
          return false;
        }
        return created >= from && created <= to;
      }
      return true;
    });
  }, [orders, range, fromDate, toDate]);

  const customDateError = useMemo(() => {
    if (range !== "CUSTOM") return "";
    const from = parseDateInput(fromDate, false);
    const to = parseDateInput(toDate, true);
    if (!from || !to) return "Enter valid dates in YYYY-MM-DD format.";
    if (from > to) return "From date cannot be later than To date.";
    return "";
  }, [range, fromDate, toDate]);

  const summary = useMemo(() => {
    const totalOrders = filteredOrders.length;
    const grossSales = filteredOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    const paidSales = filteredOrders
      .filter((order) => order.paymentStatus === "PAID")
      .reduce((sum, order) => sum + order.totalAmount, 0);
    const unpaidCount = filteredOrders.filter((order) => order.paymentStatus === "UNPAID").length;
    const partialCount = filteredOrders.filter((order) => order.paymentStatus === "PARTIAL").length;
    const pendingOrders = filteredOrders.filter((order) => order.status === "PENDING").length;
    const completedOrders = filteredOrders.filter((order) => order.status === "COMPLETED").length;
    const avgTicket = totalOrders ? grossSales / totalOrders : 0;
    return {
      totalOrders,
      grossSales,
      paidSales,
      unpaidCount,
      partialCount,
      pendingOrders,
      completedOrders,
      avgTicket
    };
  }, [filteredOrders]);

  const fixedSales = useMemo(() => {
    const current = new Date();
    const todaySales = orders
      .filter((order) => isSameDay(new Date(order.createdAt), current))
      .reduce((sum, order) => sum + order.totalAmount, 0);
    const monthSales = orders
      .filter((order) => isSameMonth(new Date(order.createdAt), current))
      .reduce((sum, order) => sum + order.totalAmount, 0);
    return { todaySales, monthSales };
  }, [orders]);

  const paymentBreakdown = useMemo(() => {
    const methods: PaymentMethod[] = ["CASH", "UPI", "CARD", "WALLET", "CREDIT", "OTHER"];
    return methods.map((method) => {
      const selected = filteredOrders.filter((order) => order.paymentMethod === method);
      const amount = selected.reduce((sum, order) => sum + order.totalAmount, 0);
      return { method, count: selected.length, amount };
    });
  }, [filteredOrders]);

  const maxPaymentAmount = useMemo(
    () => Math.max(1, ...paymentBreakdown.map((entry) => entry.amount)),
    [paymentBreakdown]
  );

  const paymentStatusBreakdown = useMemo(() => {
    const statuses: PaymentStatus[] = ["PAID", "UNPAID", "PARTIAL"];
    return statuses.map((status) => ({
      status,
      count: filteredOrders.filter((order) => order.paymentStatus === status).length
    }));
  }, [filteredOrders]);

  const topItems = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; amount: number }>();
    filteredOrders.forEach((order) => {
      order.items.forEach((item) => {
        const current = map.get(item.menuItemId) ?? { name: item.name, qty: 0, amount: 0 };
        current.qty += item.quantity;
        current.amount += item.price * item.quantity;
        map.set(item.menuItemId, current);
      });
    });
    return [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, 8);
  }, [filteredOrders]);

  const recentOrders = useMemo(() => filteredOrders.slice(0, 10), [filteredOrders]);

  const exportCsv = useCallback(async () => {
    if (customDateError) {
      Alert.alert("Invalid date range", customDateError);
      return;
    }
    if (filteredOrders.length === 0) {
      Alert.alert("No data", "No orders in selected range to export.");
      return;
    }

    const escapeCsv = (value: string | number) => `"${String(value).replace(/"/g, "\"\"")}"`;
    const header = [
      "Order Number",
      "Created At",
      "Status",
      "Payment Method",
      "Payment Status",
      "Items",
      "Subtotal",
      "Tax",
      "Total"
    ];
    const rows = filteredOrders.map((order) => [
      order.orderNumber,
      new Date(order.createdAt).toLocaleString(),
      order.status,
      order.paymentMethod,
      order.paymentStatus ?? "UNPAID",
      order.items.length,
      order.subtotal.toFixed(2),
      order.taxAmount.toFixed(2),
      order.totalAmount.toFixed(2)
    ]);

    const csv = [header, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
    const rangeLabel = range === "CUSTOM" ? `custom_${fromDate}_to_${toDate}` : range.toLowerCase();

    try {
      await Share.share({
        title: `canteen_report_${rangeLabel}.csv`,
        message: csv
      });
    } catch (error) {
      Alert.alert("Export failed", error instanceof Error ? error.message : "Could not export CSV");
    }
  }, [filteredOrders, range, fromDate, toDate, customDateError]);

  if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}>
        <Text style={{ color: colors.text }}>Admin access required.</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={{ flex: 1, backgroundColor: colors.background }} 
      contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => loadOrders().catch(() => undefined)} colors={[colors.primary]} tintColor={colors.primary} />}
    >
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>Date Range</Text>
          <Pressable
            onPress={exportCsv}
            style={{
              backgroundColor: "#065F46",
              borderRadius: 999,
              paddingVertical: 8,
              paddingHorizontal: 14,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              shadowColor: "#065F46",
              shadowOpacity: 0.2,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 2 },
              elevation: 2
            }}
          >
            <Ionicons name="download-outline" size={16} color="white" />
            <Text style={{ color: "white", fontWeight: "800", fontSize: 12 }}>Export CSV</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {[
            ["TODAY", "Today"],
            ["WEEK", "7 Days"],
            ["MONTH", "30 Days"],
            ["CUSTOM", "Custom"],
            ["ALL", "All Time"]
          ].map(([key, label]) => {
            const active = range === key;
            return (
              <Pressable
                key={key}
                onPress={() => setRange(key as RangeKey)}
                style={{
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: active ? (isDark ? colors.text : "#0F172A") : colors.border,
                  backgroundColor: active ? (isDark ? colors.text : "#0F172A") : colors.card,
                  paddingVertical: 8,
                  paddingHorizontal: 16
                }}
              >
                <Text style={{ color: active ? (isDark ? colors.background : "white") : colors.textSecondary, fontWeight: "700", fontSize: 13 }}>{label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {range === "CUSTOM" ? (
          <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
            <TextInput
              value={fromDate}
              onChangeText={setFromDate}
              placeholder="From (YYYY-MM-DD)"
              autoCapitalize="none"
              autoCorrect={false}
              style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, backgroundColor: colors.card, color: colors.text, fontSize: 14, fontWeight: "600" }}
              placeholderTextColor="#94A3B8"
            />
            <TextInput
              value={toDate}
              onChangeText={setToDate}
              placeholder="To (YYYY-MM-DD)"
              autoCapitalize="none"
              autoCorrect={false}
              style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, backgroundColor: colors.card, color: colors.text, fontSize: 14, fontWeight: "600" }}
              placeholderTextColor="#94A3B8"
            />
          </View>
        ) : null}
        {customDateError ? <Text style={{ color: "#B91C1C", fontSize: 12, marginTop: -4, fontWeight: "600" }}>{customDateError}</Text> : null}
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <View style={{ width: "31%", ...cardShadow, padding: 12, alignItems: "center" }}>
          <Text style={{ color: colors.textSecondary, fontWeight: "700", fontSize: 10, textTransform: "uppercase" }}>Orders</Text>
          <Text style={{ fontSize: 20, fontWeight: "800", color: colors.text, marginTop: 2 }}>{summary.totalOrders}</Text>
        </View>
        <View style={{ width: "31%", ...cardShadow, padding: 12, alignItems: "center" }}>
          <Text style={{ color: colors.textSecondary, fontWeight: "700", fontSize: 10, textTransform: "uppercase" }}>Paid</Text>
          <Text style={{ fontSize: 20, fontWeight: "800", color: isDark ? '#60A5FA' : "#4338CA", marginTop: 2 }}>{formatCurrency(summary.paidSales)}</Text>
        </View>
        <View style={{ width: "31%", ...cardShadow, padding: 12, alignItems: "center" }}>
          <Text style={{ color: colors.textSecondary, fontWeight: "700", fontSize: 10, textTransform: "uppercase" }}>Avg</Text>
          <Text style={{ fontSize: 20, fontWeight: "800", color: isDark ? '#FBBF24' : "#92400E", marginTop: 2 }}>{formatCurrency(summary.avgTicket)}</Text>
        </View>

        <View style={{ width: "100%", ...cardShadow, padding: 16, backgroundColor: "#065F46" }}>
          <Text style={{ color: "#A7F3D0", fontWeight: "700", fontSize: 12, textTransform: "uppercase" }}>Gross Sales</Text>
          <Text style={{ fontSize: 32, fontWeight: "900", color: "white", marginTop: 4 }}>{formatCurrency(summary.grossSales)}</Text>
        </View>

        <View style={{ width: "48%", ...cardShadow, padding: 14 }}>
          <Text style={{ color: colors.textSecondary, fontWeight: "700", fontSize: 11, textTransform: "uppercase" }}>Today Sales</Text>
          <Text style={{ fontSize: 18, fontWeight: "800", color: isDark ? '#3B82F6' : "#1D4ED8", marginTop: 2 }}>{formatCurrency(fixedSales.todaySales)}</Text>
        </View>
        <View style={{ width: "48%", ...cardShadow, padding: 14 }}>
          <Text style={{ color: colors.textSecondary, fontWeight: "700", fontSize: 11, textTransform: "uppercase" }}>Monthly Sales</Text>
          <Text style={{ fontSize: 18, fontWeight: "800", color: isDark ? '#8B5CF6' : "#5B21B6", marginTop: 2 }}>{formatCurrency(fixedSales.monthSales)}</Text>
        </View>
      </View>

      <View style={{ ...cardShadow, padding: 16, gap: 12 }}>
        <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>Order & Payment Status</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          <View style={{ width: "48%", borderRadius: 12, backgroundColor: isDark ? 'rgba(217, 119, 6, 0.1)' : "#FEF3C7", padding: 12, borderWidth: 1, borderColor: isDark ? '#F59E0B' : "#FDE68A" }}>
            <Text style={{ color: isDark ? '#FCD34D' : "#92400E", fontSize: 11, fontWeight: "800", textTransform: "uppercase" }}>Pending</Text>
            <Text style={{ color: isDark ? '#FDE68A' : "#78350F", fontSize: 22, fontWeight: "800", marginTop: 2 }}>{summary.pendingOrders}</Text>
          </View>
          <View style={{ width: "48%", borderRadius: 12, backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : "#ECFDF5", padding: 12, borderWidth: 1, borderColor: isDark ? '#10B981' : "#A7F3D0" }}>
            <Text style={{ color: isDark ? '#6EE7B7' : "#047857", fontSize: 11, fontWeight: "800", textTransform: "uppercase" }}>Completed</Text>
            <Text style={{ color: isDark ? '#A7F3D0' : "#065F46", fontSize: 22, fontWeight: "800", marginTop: 2 }}>{summary.completedOrders}</Text>
          </View>
          <View style={{ width: "48%", borderRadius: 12, backgroundColor: isDark ? 'rgba(79, 70, 229, 0.1)' : "#EEF2FF", padding: 12, borderWidth: 1, borderColor: isDark ? '#6366F1' : "#C7D2FE" }}>
            <Text style={{ color: isDark ? '#A5B4FC' : "#3730A3", fontSize: 11, fontWeight: "800", textTransform: "uppercase" }}>Paid</Text>
            <Text style={{ color: isDark ? '#C7D2FE' : "#312E81", fontSize: 22, fontWeight: "800", marginTop: 2 }}>{paymentStatusBreakdown.find(s => s.status === 'PAID')?.count || 0}</Text>
          </View>
          <View style={{ width: "48%", borderRadius: 12, backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : "#FEF2F2", padding: 12, borderWidth: 1, borderColor: isDark ? '#EF4444' : "#FECACA" }}>
            <Text style={{ color: isDark ? '#FCA5A5' : "#991B1B", fontSize: 11, fontWeight: "800", textTransform: "uppercase" }}>Unpaid</Text>
            <Text style={{ color: isDark ? '#FECACA' : "#7F1D1D", fontSize: 22, fontWeight: "800", marginTop: 2 }}>{paymentStatusBreakdown.find(s => s.status === 'UNPAID')?.count || 0}</Text>
          </View>
        </View>
      </View>

      <View style={{ ...cardShadow, padding: 16, gap: 12 }}>
        <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>Payment Methods</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {paymentBreakdown.filter(e => e.count > 0).length === 0 ? (
            <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "500" }}>No payment data available.</Text>
          ) : (
            paymentBreakdown.filter(e => e.count > 0).map((entry) => (
              <View key={entry.method} style={{ width: "48%", padding: 12, backgroundColor: colors.surfaceAlt, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ color: colors.textSecondary, fontWeight: "700", fontSize: 11, textTransform: "uppercase" }}>{entry.method} ({entry.count})</Text>
                <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text, marginTop: 4 }}>{formatCurrency(entry.amount)}</Text>
              </View>
            ))
          )}
        </View>
      </View>

      <View style={{ ...cardShadow, padding: 16, gap: 12 }}>
        <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>Top Items</Text>
        {topItems.length === 0 ? <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "500" }}>No item sales in selected range.</Text> : null}
        {topItems.map((item, index) => (
          <View key={`${item.name}-${index}`} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: index === topItems.length - 1 ? 0 : 1, borderBottomColor: colors.border }}>
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: "800" }}>{index + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: "800", fontSize: 14 }} numberOfLines={1}>{item.name}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "500", marginTop: 2 }}>{item.qty} sold</Text>
              </View>
            </View>
            <Text style={{ color: isDark ? '#34D399' : "#065F46", fontWeight: "800", fontSize: 15 }}>{formatCurrency(item.amount)}</Text>
          </View>
        ))}
      </View>

      <View style={{ ...cardShadow, padding: 16, gap: 12 }}>
        <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>Recent Orders</Text>
        {recentOrders.length === 0 ? <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "500" }}>No orders in selected range.</Text> : null}
        {recentOrders.map((order, index) => (
          <View key={order.id} style={{ paddingVertical: 10, borderBottomWidth: index === recentOrders.length - 1 ? 0 : 1, borderBottomColor: colors.border, gap: 4 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontWeight: "800", color: colors.text, fontSize: 14 }}>{order.orderNumber}</Text>
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15 }}>{formatCurrency(order.totalAmount)}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "600" }}>
                {order.status} • {order.paymentMethod}
              </Text>
              <Text style={{ color: isDark ? colors.textSecondary : "#94A3B8", fontSize: 11, fontWeight: "500" }}>{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
