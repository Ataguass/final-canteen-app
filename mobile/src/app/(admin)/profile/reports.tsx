import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Share, Text, TextInput, View } from "react-native";
import { useAuth } from "../../../hooks/useAuth";
import { orderService, type Order } from "../../../services/orderService";
import type { PaymentMethod, PaymentStatus } from "../../../services/types";

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

const cardShadow = {
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 16,
  backgroundColor: "white",
  shadowColor: "#0F172A",
  shadowOpacity: 0.06,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2
} as const;

const statusColorMap: Record<string, string> = {
  PAID: "#059669",
  UNPAID: "#DC2626",
  PARTIAL: "#D97706"
};

export default function Screen() {
  const { user, accessToken } = useAuth();
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
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>Admin access required.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#F8FAFC" }} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 22 }}>
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 28, fontWeight: "800", color: "#0F172A" }}>Reports</Text>
        <Text style={{ color: "#64748B", fontSize: 13 }}>
          Last updated: {lastUpdated ? lastUpdated.toLocaleString() : "Not loaded yet"}
        </Text>
      </View>

      <View style={{ ...cardShadow, padding: 12, gap: 10 }}>
        <Text style={{ fontSize: 16, fontWeight: "800", color: "#0F172A" }}>Range</Text>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
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
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  backgroundColor: active ? "#0F172A" : "#EEF2F7"
                }}
              >
                <Text style={{ color: active ? "white" : "#334155", fontWeight: "700" }}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        {range === "CUSTOM" ? (
          <View style={{ gap: 8, borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, padding: 10, backgroundColor: "#F8FAFC" }}>
            <Text style={{ color: "#334155", fontWeight: "700" }}>Custom Date Range</Text>
            <TextInput
              value={fromDate}
              onChangeText={setFromDate}
              placeholder="From (YYYY-MM-DD)"
              autoCapitalize="none"
              autoCorrect={false}
              style={{ borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 10, padding: 10, backgroundColor: "white" }}
            />
            <TextInput
              value={toDate}
              onChangeText={setToDate}
              placeholder="To (YYYY-MM-DD)"
              autoCapitalize="none"
              autoCorrect={false}
              style={{ borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 10, padding: 10, backgroundColor: "white" }}
            />
            {customDateError ? <Text style={{ color: "#B91C1C" }}>{customDateError}</Text> : null}
          </View>
        ) : null}

        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            onPress={() => loadOrders().catch(() => Alert.alert("Error", "Failed to refresh reports"))}
            style={{
              backgroundColor: "#0F172A",
              borderRadius: 12,
              paddingVertical: 11,
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 8
            }}
          >
            <Ionicons name="refresh-outline" size={16} color="white" />
            <Text style={{ color: "white", fontWeight: "800" }}>{loading ? "Refreshing..." : "Refresh"}</Text>
          </Pressable>
          <Pressable
            onPress={exportCsv}
            style={{
              backgroundColor: "#065F46",
              borderRadius: 12,
              paddingVertical: 11,
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 8
            }}
          >
            <Ionicons name="download-outline" size={16} color="white" />
            <Text style={{ color: "white", fontWeight: "800" }}>Export CSV</Text>
          </Pressable>
        </View>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <View style={{ width: "48%", ...cardShadow, padding: 12 }}>
          <Text style={{ color: "#475569", fontWeight: "700", fontSize: 12 }}>Orders</Text>
          <Text style={{ fontSize: 24, fontWeight: "800", color: "#0F172A", marginTop: 4 }}>{summary.totalOrders}</Text>
        </View>
        <View style={{ width: "48%", ...cardShadow, padding: 12 }}>
          <Text style={{ color: "#475569", fontWeight: "700", fontSize: 12 }}>Gross Sales</Text>
          <Text style={{ fontSize: 20, fontWeight: "800", color: "#065F46", marginTop: 4 }}>{formatCurrency(summary.grossSales)}</Text>
        </View>
        <View style={{ width: "48%", ...cardShadow, padding: 12 }}>
          <Text style={{ color: "#475569", fontWeight: "700", fontSize: 12 }}>Today Sales</Text>
          <Text style={{ fontSize: 20, fontWeight: "800", color: "#1D4ED8", marginTop: 4 }}>{formatCurrency(fixedSales.todaySales)}</Text>
        </View>
        <View style={{ width: "48%", ...cardShadow, padding: 12 }}>
          <Text style={{ color: "#475569", fontWeight: "700", fontSize: 12 }}>Monthly Sales</Text>
          <Text style={{ fontSize: 20, fontWeight: "800", color: "#5B21B6", marginTop: 4 }}>{formatCurrency(fixedSales.monthSales)}</Text>
        </View>
        <View style={{ width: "48%", ...cardShadow, padding: 12 }}>
          <Text style={{ color: "#475569", fontWeight: "700", fontSize: 12 }}>Paid Sales</Text>
          <Text style={{ fontSize: 20, fontWeight: "800", color: "#4338CA", marginTop: 4 }}>{formatCurrency(summary.paidSales)}</Text>
        </View>
        <View style={{ width: "48%", ...cardShadow, padding: 12 }}>
          <Text style={{ color: "#475569", fontWeight: "700", fontSize: 12 }}>Avg Ticket</Text>
          <Text style={{ fontSize: 20, fontWeight: "800", color: "#92400E", marginTop: 4 }}>{formatCurrency(summary.avgTicket)}</Text>
        </View>
      </View>

      <View style={{ ...cardShadow, padding: 12, gap: 8 }}>
        <Text style={{ fontSize: 17, fontWeight: "800", color: "#0F172A" }}>Order & Payment Status</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1, borderRadius: 12, backgroundColor: "#FEF3C7", padding: 10 }}>
            <Text style={{ color: "#92400E", fontSize: 12, fontWeight: "700" }}>Pending</Text>
            <Text style={{ color: "#78350F", fontSize: 22, fontWeight: "800" }}>{summary.pendingOrders}</Text>
          </View>
          <View style={{ flex: 1, borderRadius: 12, backgroundColor: "#ECFDF5", padding: 10 }}>
            <Text style={{ color: "#047857", fontSize: 12, fontWeight: "700" }}>Completed</Text>
            <Text style={{ color: "#065F46", fontSize: 22, fontWeight: "800" }}>{summary.completedOrders}</Text>
          </View>
        </View>

        {paymentStatusBreakdown.map((entry) => {
          const color = statusColorMap[entry.status] ?? "#334155";
          const max = Math.max(1, ...paymentStatusBreakdown.map((x) => x.count));
          const width = Math.max(8, Math.round((entry.count / max) * 100));
          return (
            <View key={entry.status} style={{ gap: 4 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: "#334155", fontWeight: "700" }}>{entry.status}</Text>
                <Text style={{ color: "#0F172A", fontWeight: "800" }}>{entry.count}</Text>
              </View>
              <View style={{ height: 9, borderRadius: 999, backgroundColor: "#E2E8F0", overflow: "hidden" }}>
                <View style={{ width: `${width}%`, height: 9, borderRadius: 999, backgroundColor: color }} />
              </View>
            </View>
          );
        })}
      </View>

      <View style={{ ...cardShadow, padding: 12, gap: 8 }}>
        <Text style={{ fontSize: 17, fontWeight: "800", color: "#0F172A" }}>Payment Methods</Text>
        {paymentBreakdown.map((entry) => {
          const width = Math.max(8, Math.round((entry.amount / maxPaymentAmount) * 100));
          return (
            <View key={entry.method} style={{ gap: 4 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: "#334155", fontWeight: "700" }}>
                  {entry.method} ({entry.count})
                </Text>
                <Text style={{ color: "#0F172A", fontWeight: "800" }}>{formatCurrency(entry.amount)}</Text>
              </View>
              <View style={{ height: 8, borderRadius: 999, backgroundColor: "#E2E8F0", overflow: "hidden" }}>
                <View style={{ width: `${width}%`, height: 8, borderRadius: 999, backgroundColor: "#1D4ED8" }} />
              </View>
            </View>
          );
        })}
      </View>

      <View style={{ ...cardShadow, padding: 12, gap: 8 }}>
        <Text style={{ fontSize: 17, fontWeight: "800", color: "#0F172A" }}>Top Items</Text>
        {topItems.length === 0 ? <Text style={{ color: "#64748B" }}>No item sales in selected range.</Text> : null}
        {topItems.map((item, index) => (
          <View key={`${item.name}-${index}`} style={{ borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, padding: 10, gap: 3 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: "#0F172A", fontWeight: "800", flex: 1 }}>
                {index + 1}. {item.name}
              </Text>
              <Text style={{ color: "#0F172A", fontWeight: "800" }}>{formatCurrency(item.amount)}</Text>
            </View>
            <Text style={{ color: "#64748B" }}>Quantity sold: {item.qty}</Text>
          </View>
        ))}
      </View>

      <View style={{ ...cardShadow, padding: 12, gap: 8 }}>
        <Text style={{ fontSize: 17, fontWeight: "800", color: "#0F172A" }}>Recent Orders</Text>
        {recentOrders.length === 0 ? <Text style={{ color: "#64748B" }}>No orders in selected range.</Text> : null}
        {recentOrders.map((order) => (
          <View key={order.id} style={{ borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, padding: 10, gap: 3, backgroundColor: "#F8FAFC" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontWeight: "800", color: "#0F172A" }}>{order.orderNumber}</Text>
              <Text style={{ color: "#334155", fontWeight: "700" }}>{formatCurrency(order.totalAmount)}</Text>
            </View>
            <Text style={{ color: "#64748B" }}>
              {order.status} · {order.paymentMethod} · {order.paymentStatus ?? "UNPAID"}
            </Text>
            <Text style={{ color: "#64748B" }}>{new Date(order.createdAt).toLocaleString()}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
