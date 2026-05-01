import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useAuth } from "../../../hooks/useAuth";
import { menuService, type StockMovement } from "../../../services/menuService";

type Category = { id: string; name: string };
type StockItem = {
  id: string;
  categoryId?: string;
  name: string;
  price: number;
  stockQty: number;
  lowStockThreshold: number;
  isAvailable: boolean;
};

const thresholdFor = (item: StockItem): number => Math.max(0, Math.floor(item.lowStockThreshold ?? 10));
const isLowStockItem = (item: StockItem): boolean => item.stockQty <= thresholdFor(item);

export default function Screen() {
  const { user, accessToken } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<StockItem[]>([]);
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const [stockDrafts, setStockDrafts] = useState<Record<string, string>>({});
  const [thresholdDrafts, setThresholdDrafts] = useState<Record<string, string>>({});
  const [logs, setLogs] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const lowStockAlertSignatureRef = useRef("");

  const loadLogs = useCallback(async () => {
    if (!user?.tenantId || !accessToken) return;
    const response = await menuService.listStockMovements(accessToken, user.tenantId, { limit: 200 });
    setLogs(response.data);
  }, [accessToken, user?.tenantId]);

  const loadData = useCallback(async () => {
    if (!user?.tenantId || !accessToken) return;
    setLoading(true);
    try {
      const [categoryRes, itemRes] = await Promise.all([
        menuService.listCategories(accessToken, user.tenantId),
        menuService.listItems(accessToken, user.tenantId)
      ]);

      const nextItems = itemRes.data as StockItem[];
      setCategories(categoryRes.data);
      setItems(nextItems);
      setStockDrafts(
        nextItems.reduce<Record<string, string>>((acc, item) => {
          acc[item.id] = String(item.stockQty);
          return acc;
        }, {})
      );
      setThresholdDrafts(
        nextItems.reduce<Record<string, string>>((acc, item) => {
          acc[item.id] = String(thresholdFor(item));
          return acc;
        }, {})
      );

      await loadLogs();

      const lowItems = nextItems.filter(isLowStockItem);
      const signature = lowItems
        .map((item) => `${item.id}:${item.stockQty}/${thresholdFor(item)}`)
        .sort()
        .join("|");
      if (signature && signature !== lowStockAlertSignatureRef.current) {
        const preview = lowItems
          .slice(0, 5)
          .map((item) => `${item.name} (${item.stockQty}/${thresholdFor(item)})`)
          .join("\n");
        const more = lowItems.length > 5 ? `\n+${lowItems.length - 5} more` : "";
        Alert.alert("Low Stock Alert", `${lowItems.length} item(s) are low.\n${preview}${more}`);
      }
      lowStockAlertSignatureRef.current = signature;
    } finally {
      setLoading(false);
    }
  }, [accessToken, user?.tenantId, loadLogs]);

  useEffect(() => {
    loadData().catch((error: unknown) => {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to load stock");
    });
  }, [loadData]);

  const categoryMap = useMemo(() => {
    const map: Record<string, string> = {};
    categories.forEach((category) => {
      map[category.id] = category.name;
    });
    return map;
  }, [categories]);

  const itemById = useMemo(() => {
    const map: Record<string, StockItem> = {};
    items.forEach((item) => {
      map[item.id] = item;
    });
    return map;
  }, [items]);

  const filteredItems = useMemo(() => {
    const text = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchCategory = selectedCategory === "ALL" || item.categoryId === selectedCategory;
      const matchText = !text || item.name.toLowerCase().includes(text);
      const matchLow = !onlyLowStock || isLowStockItem(item);
      return matchCategory && matchText && matchLow;
    });
  }, [items, selectedCategory, query, onlyLowStock]);

  const filteredLogs = useMemo(() => {
    const text = query.trim().toLowerCase();
    return logs.filter((log) => {
      const item = itemById[log.menuItemId];
      const matchCategory =
        selectedCategory === "ALL" || (item?.categoryId ? item.categoryId === selectedCategory : false);
      const itemName = log.menuItem?.name ?? "";
      const actorName = log.actorUser?.name ?? "";
      const matchText =
        !text || itemName.toLowerCase().includes(text) || actorName.toLowerCase().includes(text);
      return matchCategory && matchText;
    });
  }, [logs, itemById, selectedCategory, query]);

  const summary = useMemo(() => {
    const low = items.filter(isLowStockItem).length;
    const out = items.filter((item) => item.stockQty === 0).length;
    const hidden = items.filter((item) => !item.isAvailable).length;
    return { total: items.length, low, out, hidden };
  }, [items]);

  const lowStockItems = useMemo(() => items.filter(isLowStockItem), [items]);

  const adjustStock = async (item: StockItem, delta: number) => {
    if (!user?.tenantId || !accessToken) return;
    const nextStock = Math.max(0, item.stockQty + delta);

    try {
      setSavingItemId(item.id);
      const response = await menuService.updateItem(accessToken, user.tenantId, item.id, {
        stockQty: nextStock,
        stockMovementType: "ADJUSTMENT",
        stockNote: `Quick adjustment ${delta > 0 ? `+${delta}` : delta}`
      });
      const next = response.data as StockItem;
      setItems((prev) => prev.map((entry) => (entry.id === item.id ? next : entry)));
      setStockDrafts((prev) => ({ ...prev, [item.id]: String(next.stockQty) }));
      await loadLogs();
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Could not update stock");
    } finally {
      setSavingItemId(null);
    }
  };

  const saveManualStock = async (item: StockItem) => {
    if (!user?.tenantId || !accessToken) return;
    const raw = stockDrafts[item.id] ?? "";
    const nextStock = Number(raw);
    if (!Number.isFinite(nextStock) || nextStock < 0) {
      Alert.alert("Invalid stock", "Stock must be a non-negative number.");
      return;
    }

    try {
      setSavingItemId(item.id);
      const response = await menuService.updateItem(accessToken, user.tenantId, item.id, {
        stockQty: Math.floor(nextStock),
        stockMovementType: "MANUAL",
        stockNote: `Manual set from ${item.stockQty} to ${Math.floor(nextStock)}`
      });
      const next = response.data as StockItem;
      setItems((prev) => prev.map((entry) => (entry.id === item.id ? next : entry)));
      setStockDrafts((prev) => ({ ...prev, [item.id]: String(next.stockQty) }));
      await loadLogs();
      Alert.alert("Saved", `${item.name} stock updated.`);
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Could not save stock");
    } finally {
      setSavingItemId(null);
    }
  };

  const saveThreshold = async (item: StockItem) => {
    if (!user?.tenantId || !accessToken) return;
    const raw = thresholdDrafts[item.id] ?? "";
    const nextThreshold = Number(raw);
    if (!Number.isFinite(nextThreshold) || nextThreshold < 0) {
      Alert.alert("Invalid threshold", "Threshold must be a non-negative number.");
      return;
    }

    try {
      setSavingItemId(item.id);
      const response = await menuService.updateItem(accessToken, user.tenantId, item.id, {
        lowStockThreshold: Math.floor(nextThreshold)
      });
      const next = response.data as StockItem;
      setItems((prev) => prev.map((entry) => (entry.id === item.id ? next : entry)));
      setThresholdDrafts((prev) => ({ ...prev, [item.id]: String(thresholdFor(next)) }));
      Alert.alert("Saved", `${item.name} threshold updated.`);
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Could not save threshold");
    } finally {
      setSavingItemId(null);
    }
  };

  const toggleItemAvailability = async (item: StockItem) => {
    if (!user?.tenantId || !accessToken) return;
    try {
      setSavingItemId(item.id);
      const response = await menuService.toggleItem(accessToken, user.tenantId, item.id);
      setItems((prev) => prev.map((entry) => (entry.id === item.id ? (response.data as StockItem) : entry)));
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Could not update availability");
    } finally {
      setSavingItemId(null);
    }
  };

  if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>Admin access required.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 10 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>Stock Management</Text>
      <Text style={{ color: "#6B7280" }}>Track inventory and stock movement history.</Text>

      {summary.low > 0 ? (
        <Pressable
          onPress={() => {
            setOnlyLowStock(true);
            setSelectedCategory("ALL");
            setQuery("");
          }}
          style={{ borderRadius: 10, backgroundColor: "#FEF3C7", borderWidth: 1, borderColor: "#F59E0B", padding: 10 }}
        >
          <Text style={{ color: "#92400E", fontWeight: "700" }}>
            Alert: {summary.low} item(s) are below threshold. Tap to view.
          </Text>
        </Pressable>
      ) : (
        <View style={{ borderRadius: 10, backgroundColor: "#DCFCE7", borderWidth: 1, borderColor: "#16A34A", padding: 10 }}>
          <Text style={{ color: "#065F46", fontWeight: "700" }}>All items are above threshold.</Text>
        </View>
      )}

      <View style={{ flexDirection: "row", gap: 8 }}>
        <Pressable
          onPress={() => {
            setOnlyLowStock(false);
            setQuery("");
          }}
          style={{ flex: 1, borderRadius: 10, backgroundColor: "#F3F4F6", padding: 10 }}
        >
          <Text style={{ color: "#6B7280" }}>Total Items</Text>
          <Text style={{ fontSize: 20, fontWeight: "700" }}>{summary.total}</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setOnlyLowStock(true);
            setSelectedCategory("ALL");
            setQuery("");
          }}
          style={{ flex: 1, borderRadius: 10, backgroundColor: "#FEF3C7", padding: 10 }}
        >
          <Text style={{ color: "#92400E" }}>Low Stock</Text>
          <Text style={{ fontSize: 20, fontWeight: "700", color: "#92400E" }}>{summary.low}</Text>
        </Pressable>
      </View>

      {onlyLowStock ? (
        <View style={{ borderWidth: 1, borderColor: "#FCD34D", backgroundColor: "#FFFBEB", borderRadius: 10, padding: 10 }}>
          <Text style={{ fontWeight: "700", color: "#92400E" }}>
            Low-stock items ({lowStockItems.length})
          </Text>
          {lowStockItems.length === 0 ? (
            <Text style={{ color: "#92400E", marginTop: 4 }}>No low-stock items right now.</Text>
          ) : (
            lowStockItems.map((item) => (
              <Text key={item.id} style={{ color: "#92400E", marginTop: 3 }}>
                - {item.name} (Stock {item.stockQty}, Threshold {thresholdFor(item)})
              </Text>
            ))
          )}
        </View>
      ) : null}

      <TextInput
        placeholder="Search item or user"
        value={query}
        onChangeText={setQuery}
        style={{ borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 10, padding: 10 }}
      />

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Pressable
          onPress={() => setSelectedCategory("ALL")}
          style={{
            borderRadius: 999,
            paddingVertical: 7,
            paddingHorizontal: 10,
            backgroundColor: selectedCategory === "ALL" ? "#111827" : "#F3F4F6"
          }}
        >
          <Text style={{ color: selectedCategory === "ALL" ? "white" : "#111827", fontWeight: "600" }}>All</Text>
        </Pressable>
        {categories.map((category) => (
          <Pressable
            key={category.id}
            onPress={() => setSelectedCategory(category.id)}
            style={{
              borderRadius: 999,
              paddingVertical: 7,
              paddingHorizontal: 10,
              backgroundColor: selectedCategory === category.id ? "#111827" : "#F3F4F6"
            }}
          >
            <Text style={{ color: selectedCategory === category.id ? "white" : "#111827", fontWeight: "600" }}>
              {category.name}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        onPress={() => setOnlyLowStock((prev) => !prev)}
        style={{
          borderRadius: 10,
          borderWidth: 1,
          borderColor: onlyLowStock ? "#92400E" : "#D1D5DB",
          backgroundColor: onlyLowStock ? "#FEF3C7" : "white",
          paddingVertical: 10
        }}
      >
        <Text style={{ textAlign: "center", fontWeight: "700", color: onlyLowStock ? "#92400E" : "#111827" }}>
          {onlyLowStock ? "Showing Low Stock Only" : "Show Low Stock Only"}
        </Text>
      </Pressable>

      <Pressable
        onPress={() => loadData().catch(() => Alert.alert("Error", "Failed to refresh stock"))}
        style={{ backgroundColor: "#111827", borderRadius: 10, padding: 12 }}
      >
        <Text style={{ color: "white", textAlign: "center", fontWeight: "700" }}>
          {loading ? "Refreshing..." : "Refresh"}
        </Text>
      </Pressable>

      <Text style={{ fontWeight: "700", marginTop: 6 }}>Items ({filteredItems.length})</Text>
      {filteredItems.length === 0 ? (
        <Text style={{ color: "#6B7280" }}>No items match current filters.</Text>
      ) : null}

      {filteredItems.map((item) => (
        <View
          key={item.id}
          style={{ borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, padding: 12, gap: 8 }}
        >
          <Text style={{ fontWeight: "700", fontSize: 16 }}>{item.name}</Text>
          <Text style={{ color: "#6B7280" }}>
            {categoryMap[item.categoryId ?? ""] ?? "Uncategorized"} | INR {item.price}
          </Text>
          <Text style={{ color: isLowStockItem(item) ? "#B45309" : "#111827" }}>
            Current Stock: {item.stockQty}
          </Text>
          <Text style={{ color: "#6B7280" }}>Threshold: {thresholdFor(item)}</Text>
          <Text style={{ color: item.isAvailable ? "#065F46" : "#991B1B" }}>
            {item.isAvailable ? "Visible to users" : "Hidden from users"}
          </Text>

          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              onPress={() => adjustStock(item, -10)}
              disabled={savingItemId === item.id}
              style={{ flex: 1, borderRadius: 8, paddingVertical: 9, backgroundColor: "#E5E7EB" }}
            >
              <Text style={{ textAlign: "center", fontWeight: "700" }}>-10</Text>
            </Pressable>
            <Pressable
              onPress={() => adjustStock(item, -1)}
              disabled={savingItemId === item.id}
              style={{ flex: 1, borderRadius: 8, paddingVertical: 9, backgroundColor: "#E5E7EB" }}
            >
              <Text style={{ textAlign: "center", fontWeight: "700" }}>-1</Text>
            </Pressable>
            <Pressable
              onPress={() => adjustStock(item, 1)}
              disabled={savingItemId === item.id}
              style={{ flex: 1, borderRadius: 8, paddingVertical: 9, backgroundColor: "#DCFCE7" }}
            >
              <Text style={{ textAlign: "center", fontWeight: "700", color: "#065F46" }}>+1</Text>
            </Pressable>
            <Pressable
              onPress={() => adjustStock(item, 10)}
              disabled={savingItemId === item.id}
              style={{ flex: 1, borderRadius: 8, paddingVertical: 9, backgroundColor: "#DCFCE7" }}
            >
              <Text style={{ textAlign: "center", fontWeight: "700", color: "#065F46" }}>+10</Text>
            </Pressable>
          </View>

          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <TextInput
              value={stockDrafts[item.id] ?? ""}
              onChangeText={(text) => setStockDrafts((prev) => ({ ...prev, [item.id]: text }))}
              keyboardType="numeric"
              placeholder="Manual stock qty"
              style={{ flex: 1, borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 8, padding: 9 }}
            />
            <Pressable
              onPress={() => saveManualStock(item)}
              disabled={savingItemId === item.id}
              style={{ borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: "#111827" }}
            >
              <Text style={{ color: "white", fontWeight: "700" }}>
                {savingItemId === item.id ? "Saving..." : "Save Stock"}
              </Text>
            </Pressable>
          </View>

          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <TextInput
              value={thresholdDrafts[item.id] ?? ""}
              onChangeText={(text) => setThresholdDrafts((prev) => ({ ...prev, [item.id]: text }))}
              keyboardType="numeric"
              placeholder="Low-stock threshold"
              style={{ flex: 1, borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 8, padding: 9 }}
            />
            <Pressable
              onPress={() => saveThreshold(item)}
              disabled={savingItemId === item.id}
              style={{ borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: "#7C3AED" }}
            >
              <Text style={{ color: "white", fontWeight: "700" }}>
                {savingItemId === item.id ? "Saving..." : "Save Threshold"}
              </Text>
            </Pressable>
          </View>

          <Pressable
            onPress={() => toggleItemAvailability(item)}
            disabled={savingItemId === item.id}
            style={{
              borderRadius: 8,
              paddingVertical: 10,
              backgroundColor: item.isAvailable ? "#B91C1C" : "#065F46"
            }}
          >
            <Text style={{ color: "white", textAlign: "center", fontWeight: "700" }}>
              {item.isAvailable ? "Hide Item" : "Show Item"}
            </Text>
          </Pressable>
        </View>
      ))}

      <Text style={{ fontWeight: "700", marginTop: 8 }}>Stock Movement Log ({filteredLogs.length})</Text>
      {filteredLogs.length === 0 ? (
        <Text style={{ color: "#6B7280" }}>No stock movement logs found.</Text>
      ) : null}
      {filteredLogs.slice(0, 60).map((log) => (
        <View
          key={log.id}
          style={{ borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10, padding: 10, gap: 2 }}
        >
          <Text style={{ fontWeight: "700" }}>
            {log.menuItem?.name ?? "Unknown Item"} | {log.changeType}
          </Text>
          <Text>
            Qty: {log.previousQty} {"->"} {log.newQty} ({log.delta > 0 ? `+${log.delta}` : log.delta})
          </Text>
          <Text>By: {log.actorUser?.name ?? "System"}</Text>
          <Text>At: {new Date(log.createdAt).toLocaleString()}</Text>
          {log.note ? <Text style={{ color: "#6B7280" }}>Note: {log.note}</Text> : null}
        </View>
      ))}
    </ScrollView>
  );
}
