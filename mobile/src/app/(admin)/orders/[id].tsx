import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useAuth } from "../../../hooks/useAuth";
import { useOrderSocket } from "../../../hooks/useOrderSocket";
import { Order, orderService } from "../../../services/orderService";

const statusActions = ["ACCEPTED", "PREPARING", "READY", "COMPLETED", "CANCELLED"] as const;

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

export default function Screen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, accessToken } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);

  const load = useCallback(async () => {
    if (!user?.tenantId || !accessToken || !id) return;
    try {
      setLoading(true);
      const response = await orderService.getOrder(accessToken, user.tenantId, id);
      setOrder(response.data);
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Could not load order");
    } finally {
      setLoading(false);
    }
  }, [id, user?.tenantId, accessToken]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  useOrderSocket({
    tenantId: user?.tenantId,
    onOrderStatusChanged: (incoming) => {
      if (incoming.id === id) setOrder(incoming);
    }
  });

  const setStatus = async (status: string) => {
    if (!user?.tenantId || !accessToken || !id) return;
    try {
      setUpdating(true);
      const response = await orderService.updateOrderStatus(accessToken, user.tenantId, id, status);
      setOrder(response.data);
      Alert.alert("Updated", `Order marked as ${status}`);
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Could not update order status");
    } finally {
      setUpdating(false);
    }
  };

  const totals = useMemo(() => {
    if (!order) {
      return { qty: 0, subtotal: 0 };
    }
    return {
      qty: order.items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: order.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
    };
  }, [order]);

  if (loading && !order) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F8FAFC" }}>
        <Text style={{ color: "#64748B" }}>Loading order...</Text>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F8FAFC", padding: 16 }}>
        <Text style={{ color: "#0F172A", fontWeight: "700" }}>Order not found</Text>
      </View>
    );
  }

  const statusColor = statusColorMap[order.status] ?? "#334155";

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#F8FAFC" }} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}>
      <View style={{ ...cardShadow, padding: 14, gap: 10 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#64748B", fontWeight: "700", fontSize: 12 }}>Order Number</Text>
            <Text style={{ color: "#0F172A", fontSize: 23, fontWeight: "800" }}>{order.orderNumber}</Text>
          </View>
          <View style={{ borderRadius: 999, backgroundColor: `${statusColor}1A`, paddingHorizontal: 10, paddingVertical: 6 }}>
            <Text style={{ color: statusColor, fontWeight: "800", fontSize: 12 }}>{order.status}</Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1, borderRadius: 12, backgroundColor: "#EEF2FF", padding: 10 }}>
            <Text style={{ color: "#4338CA", fontSize: 12, fontWeight: "700" }}>Created</Text>
            <Text style={{ color: "#1F2937", fontWeight: "700", marginTop: 3 }}>{new Date(order.createdAt).toLocaleString()}</Text>
          </View>
          <View style={{ flex: 1, borderRadius: 12, backgroundColor: "#ECFEFF", padding: 10 }}>
            <Text style={{ color: "#0E7490", fontSize: 12, fontWeight: "700" }}>Payment</Text>
            <Text style={{ color: "#1F2937", fontWeight: "700", marginTop: 3 }}>{order.paymentMethod}</Text>
            <Text style={{ color: "#475569", marginTop: 1 }}>{order.paymentStatus ?? "UNPAID"}</Text>
          </View>
        </View>

        {(order.laneToken || order.isPreOrder) ? (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1, borderRadius: 12, backgroundColor: "#F8FAFC", padding: 10 }}>
              <Text style={{ color: "#64748B", fontSize: 12 }}>Queue Lane</Text>
              <Text style={{ color: "#0F172A", fontWeight: "800", marginTop: 3 }}>
                {order.serviceLane === "TEACHER_PRIORITY" ? "Teacher Priority" : "Regular"}
              </Text>
              {order.laneToken ? (
                <Text style={{ color: "#334155", marginTop: 1, fontWeight: "700" }}>Token: {order.laneToken}</Text>
              ) : null}
            </View>
            <View style={{ flex: 1, borderRadius: 12, backgroundColor: "#F0FDF4", padding: 10 }}>
              <Text style={{ color: "#166534", fontSize: 12, fontWeight: "700" }}>Pickup</Text>
              <Text style={{ color: "#14532D", fontWeight: "800", marginTop: 3 }}>
                {order.isPreOrder ? "Scheduled" : "Immediate"}
              </Text>
              {order.isPreOrder && order.pickupSlotLabel ? (
                <Text style={{ color: "#166534", marginTop: 1 }}>{order.pickupSlotLabel}</Text>
              ) : null}
            </View>
          </View>
        ) : null}

        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1, borderRadius: 12, backgroundColor: "#F8FAFC", padding: 10 }}>
            <Text style={{ color: "#64748B", fontSize: 12 }}>Items</Text>
            <Text style={{ color: "#0F172A", fontSize: 21, fontWeight: "800", marginTop: 2 }}>{totals.qty}</Text>
          </View>
          <View style={{ flex: 1, borderRadius: 12, backgroundColor: "#F8FAFC", padding: 10 }}>
            <Text style={{ color: "#64748B", fontSize: 12 }}>Total</Text>
            <Text style={{ color: "#0F172A", fontSize: 21, fontWeight: "800", marginTop: 2 }}>{formatCurrency(order.totalAmount)}</Text>
          </View>
        </View>
      </View>

      <View style={{ ...cardShadow, padding: 14, gap: 10 }}>
        <Text style={{ fontSize: 18, fontWeight: "800", color: "#0F172A" }}>Status Actions</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {statusActions.map((status) => {
            const selected = order.status === status;
            return (
              <Pressable
                key={status}
                onPress={() => setStatus(status)}
                disabled={updating}
                style={{
                  borderRadius: 999,
                  paddingVertical: 9,
                  paddingHorizontal: 14,
                  backgroundColor: selected ? "#0F172A" : "white",
                  borderWidth: 1,
                  borderColor: selected ? "#0F172A" : "#CBD5E1"
                }}
              >
                <Text style={{ color: selected ? "white" : "#0F172A", fontWeight: "800", fontSize: 12 }}>{status}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={() => load().catch(() => undefined)}
          style={{
            borderRadius: 12,
            paddingVertical: 10,
            borderWidth: 1,
            borderColor: "#CBD5E1",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: 6
          }}
        >
          <Ionicons name="refresh-outline" size={16} color="#334155" />
          <Text style={{ color: "#334155", fontWeight: "800" }}>{loading ? "Refreshing..." : "Refresh Order"}</Text>
        </Pressable>
      </View>

      <View style={{ ...cardShadow, padding: 14, gap: 10 }}>
        <Text style={{ fontSize: 18, fontWeight: "800", color: "#0F172A" }}>Items</Text>
        {order.items.map((item) => (
          <View key={item.id} style={{ borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, padding: 11, gap: 4 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: "#0F172A", fontWeight: "800", fontSize: 15, flex: 1 }}>{item.name}</Text>
              <Text style={{ color: "#0F172A", fontWeight: "800" }}>{formatCurrency(item.price * item.quantity)}</Text>
            </View>
            <Text style={{ color: "#475569", fontWeight: "600" }}>
              {formatCurrency(item.price)} x {item.quantity}
            </Text>
            {item.note ? <Text style={{ color: "#64748B" }}>Note: {item.note}</Text> : null}
          </View>
        ))}
      </View>

      <View style={{ ...cardShadow, padding: 14, gap: 8 }}>
        <Text style={{ fontSize: 18, fontWeight: "800", color: "#0F172A" }}>Bill Summary</Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: "#475569" }}>Sub Total</Text>
          <Text style={{ color: "#0F172A", fontWeight: "700" }}>{formatCurrency(order.subtotal || totals.subtotal)}</Text>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: "#475569" }}>Tax</Text>
          <Text style={{ color: "#0F172A", fontWeight: "700" }}>{formatCurrency(order.taxAmount)}</Text>
        </View>
        <View style={{ borderTopWidth: 1, borderColor: "#E2E8F0", paddingTop: 8, flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: "#0F172A", fontWeight: "800", fontSize: 16 }}>Grand Total</Text>
          <Text style={{ color: "#0F172A", fontWeight: "800", fontSize: 16 }}>{formatCurrency(order.totalAmount)}</Text>
        </View>
      </View>
    </ScrollView>
  );
}
