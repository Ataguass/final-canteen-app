import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
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

  const stats = useMemo(() => {
    const now = new Date();
    const activeStatuses = new Set(["PENDING", "ACCEPTED", "PREPARING", "READY"]);
    const todayOrders = orders.filter((order) => isSameDay(new Date(order.createdAt), now));
    return {
      total: orders.length,
      active: orders.filter((order) => activeStatuses.has(order.status)).length,
      completed: orders.filter((order) => order.status === "COMPLETED").length,
      todaySales: todayOrders.reduce((sum, order) => sum + order.totalAmount, 0)
    };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return orders.filter((order) => {
      if (statusFilter !== "ALL" && order.status !== statusFilter) return false;
      if (!normalized) return true;
      return (
        order.orderNumber.toLowerCase().includes(normalized) ||
        order.status.toLowerCase().includes(normalized) ||
        order.paymentMethod.toLowerCase().includes(normalized)
      );
    });
  }, [orders, query, statusFilter]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#F8FAFC" }} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 22 }}>
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 28, fontWeight: "800", color: "#0F172A" }}>Orders</Text>
        <Text style={{ color: "#64748B", fontSize: 13 }}>
          Last updated: {lastUpdated ? lastUpdated.toLocaleString() : "Not loaded yet"}
        </Text>
      </View>

      <Pressable
        onPress={() => load().catch(() => undefined)}
        style={{
          borderRadius: 12,
          paddingVertical: 12,
          backgroundColor: "#0F172A",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 8
        }}
      >
        <Ionicons name="refresh-outline" size={16} color="white" />
        <Text style={{ color: "white", fontWeight: "800" }}>{loading ? "Refreshing..." : "Refresh Orders"}</Text>
      </Pressable>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <View style={{ width: "48%", ...cardShadow, padding: 12 }}>
          <Text style={{ color: "#475569", fontWeight: "700", fontSize: 12 }}>Total Orders</Text>
          <Text style={{ color: "#0F172A", fontWeight: "800", fontSize: 24, marginTop: 4 }}>{stats.total}</Text>
        </View>
        <View style={{ width: "48%", ...cardShadow, padding: 12 }}>
          <Text style={{ color: "#475569", fontWeight: "700", fontSize: 12 }}>Active Orders</Text>
          <Text style={{ color: "#D97706", fontWeight: "800", fontSize: 24, marginTop: 4 }}>{stats.active}</Text>
        </View>
        <View style={{ width: "48%", ...cardShadow, padding: 12 }}>
          <Text style={{ color: "#475569", fontWeight: "700", fontSize: 12 }}>Completed</Text>
          <Text style={{ color: "#059669", fontWeight: "800", fontSize: 24, marginTop: 4 }}>{stats.completed}</Text>
        </View>
        <View style={{ width: "48%", ...cardShadow, padding: 12 }}>
          <Text style={{ color: "#475569", fontWeight: "700", fontSize: 12 }}>Today Sales</Text>
          <Text style={{ color: "#1D4ED8", fontWeight: "800", fontSize: 21, marginTop: 5 }}>{formatCurrency(stats.todaySales)}</Text>
        </View>
      </View>

      <View style={{ ...cardShadow, padding: 12, gap: 10 }}>
        <Text style={{ fontSize: 16, fontWeight: "800", color: "#0F172A" }}>Search & Filter</Text>
        <View
          style={{
            borderWidth: 1,
            borderColor: "#E2E8F0",
            borderRadius: 12,
            backgroundColor: "#F8FAFC",
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 10
          }}
        >
          <Ionicons name="search-outline" size={16} color="#64748B" />
          <TextInput
            placeholder="Search by order number, status, payment"
            placeholderTextColor="#94A3B8"
            value={query}
            onChangeText={setQuery}
            style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 8, color: "#0F172A" }}
          />
          {query ? (
            <Pressable onPress={() => setQuery("")}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </Pressable>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {filters.map((item) => {
            const active = statusFilter === item;
            return (
              <Pressable
                key={item}
                onPress={() => setStatusFilter(item)}
                style={{
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: active ? "#0F172A" : "#E2E8F0",
                  backgroundColor: active ? "#0F172A" : "white",
                  paddingHorizontal: 14,
                  paddingVertical: 8
                }}
              >
                <Text style={{ color: active ? "white" : "#334155", fontWeight: "700" }}>{item}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontSize: 18, fontWeight: "800", color: "#0F172A" }}>Order List</Text>
        <Text style={{ color: "#64748B", fontWeight: "700" }}>{filteredOrders.length} found</Text>
      </View>

      {filteredOrders.length === 0 ? (
        <View style={{ ...cardShadow, padding: 14 }}>
          <Text style={{ color: "#64748B" }}>No orders match current filters.</Text>
        </View>
      ) : (
        filteredOrders.map((order) => {
          const statusColor = statusColorMap[order.status] ?? "#334155";
          return (
            <Pressable
              key={order.id}
              onPress={() => router.push({ pathname: "/(admin)/orders/[id]", params: { id: order.id } })}
              style={{ ...cardShadow, padding: 12, gap: 7 }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontWeight: "800", fontSize: 15, color: "#0F172A" }}>{order.orderNumber}</Text>
                <View style={{ borderRadius: 999, backgroundColor: `${statusColor}1A`, paddingHorizontal: 8, paddingVertical: 4 }}>
                  <Text style={{ color: statusColor, fontWeight: "800", fontSize: 12 }}>{order.status}</Text>
                </View>
              </View>
              <Text style={{ color: "#64748B", fontSize: 12 }}>{new Date(order.createdAt).toLocaleString()}</Text>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ color: "#334155", fontWeight: "600" }}>
                  {order.items.length} item{order.items.length > 1 ? "s" : ""} · {order.paymentMethod}
                </Text>
                <Text style={{ color: "#0F172A", fontWeight: "800" }}>{formatCurrency(order.totalAmount)}</Text>
              </View>
            </Pressable>
          );
        })
      )}
    </ScrollView>
  );
}
