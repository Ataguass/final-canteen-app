import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useAuth } from "../../../hooks/useAuth";
import { menuService, type StockMovement } from "../../../services/menuService";
import { useTheme } from '../../../hooks/useTheme';


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
  const theme = useTheme();
  const { colors, isDark } = theme;
  const { user, accessToken } = useAuth();
  
  const card = {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.card,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  } as const;
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
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}>
        <Text style={{ color: colors.text }}>Admin access required.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 24 }}>
      <View style={{ ...card, padding: 16, gap: 12 }}>
        <View>
          <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>Stock Overview</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>Monitor inventory and threshold alerts</Text>
        </View>

        {summary.low > 0 ? (
          <Pressable
            onPress={() => {
              setOnlyLowStock(true);
              setSelectedCategory("ALL");
              setQuery("");
            }}
            style={{ borderRadius: 12, backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : "#FEF2F2", borderWidth: 1, borderColor: isDark ? '#F87171' : "#FCA5A5", padding: 12, flexDirection: "row", alignItems: "center", gap: 8 }}
          >
            <Ionicons name="warning" size={20} color={isDark ? '#FCA5A5' : "#DC2626"} />
            <Text style={{ color: isDark ? '#FECACA' : "#991B1B", fontWeight: "700", fontSize: 13, flex: 1 }}>
              Alert: {summary.low} item(s) are running low! Tap to view.
            </Text>
          </Pressable>
        ) : (
          <View style={{ borderRadius: 12, backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : "#F0FDF4", borderWidth: 1, borderColor: isDark ? '#34D399' : "#86EFAC", padding: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="checkmark-circle" size={20} color={isDark ? '#34D399' : "#16A34A"} />
            <Text style={{ color: isDark ? '#6EE7B7' : "#166534", fontWeight: "700", fontSize: 13, flex: 1 }}>All items are sufficiently stocked.</Text>
          </View>
        )}

        <View style={{ flexDirection: "row", gap: 12 }}>
          <Pressable
            onPress={() => {
              setOnlyLowStock(false);
              setQuery("");
            }}
            style={{ flex: 1, borderRadius: 12, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, padding: 12, alignItems: "center" }}
          >
            <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "600" }}>Total Items</Text>
            <Text style={{ fontSize: 24, fontWeight: "800", color: colors.text, marginTop: 4 }}>{summary.total}</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setOnlyLowStock(true);
              setSelectedCategory("ALL");
              setQuery("");
            }}
            style={{ flex: 1, borderRadius: 12, backgroundColor: isDark ? 'rgba(234, 88, 12, 0.15)' : "#FFF7ED", borderWidth: 1, borderColor: isDark ? '#F97316' : "#FED7AA", padding: 12, alignItems: "center" }}
          >
            <Text style={{ color: isDark ? '#FDBA74' : "#C2410C", fontSize: 12, fontWeight: "600" }}>Low Stock</Text>
            <Text style={{ fontSize: 24, fontWeight: "800", color: isDark ? '#FDBA74' : "#C2410C", marginTop: 4 }}>{summary.low}</Text>
          </Pressable>
        </View>
      </View>

      {onlyLowStock ? (
        <View style={{ borderWidth: 1, borderColor: isDark ? '#F59E0B' : "#FCD34D", backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : "#FFFBEB", borderRadius: 10, padding: 10 }}>
          <Text style={{ fontWeight: "700", color: isDark ? '#FCD34D' : "#92400E" }}>
            Low-stock items ({lowStockItems.length})
          </Text>
          {lowStockItems.length === 0 ? (
            <Text style={{ color: isDark ? '#FCD34D' : "#92400E", marginTop: 4 }}>No low-stock items right now.</Text>
          ) : (
            lowStockItems.map((item) => (
              <Text key={item.id} style={{ color: isDark ? '#FDE68A' : "#92400E", marginTop: 3 }}>
                - {item.name} (Stock {item.stockQty}, Threshold {thresholdFor(item)})
              </Text>
            ))
          )}
        </View>
      ) : null}

      <View style={{ ...card, padding: 16, gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceAlt, borderRadius: 10, paddingHorizontal: 12 }}>
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <TextInput
            placeholder="Search items..."
            value={query}
            onChangeText={setQuery}
            style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 8, fontSize: 14, color: colors.text }}
            placeholderTextColor={colors.textSecondary}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
          <Pressable
            onPress={() => setSelectedCategory("ALL")}
            style={{ borderRadius: 999, paddingVertical: 8, paddingHorizontal: 16, backgroundColor: selectedCategory === "ALL" ? colors.primary : colors.surfaceAlt }}
          >
            <Text style={{ color: selectedCategory === "ALL" ? "white" : colors.textSecondary, fontWeight: "700", fontSize: 13 }}>All</Text>
          </Pressable>
          {categories.map((category) => (
            <Pressable
              key={category.id}
              onPress={() => setSelectedCategory(category.id)}
              style={{ borderRadius: 999, paddingVertical: 8, paddingHorizontal: 16, backgroundColor: selectedCategory === category.id ? colors.primary : colors.surfaceAlt }}
            >
              <Text style={{ color: selectedCategory === category.id ? "white" : colors.textSecondary, fontWeight: "700", fontSize: 13 }}>
                {category.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={{ flexDirection: "row", gap: 12 }}>
          <Pressable
            onPress={() => setOnlyLowStock((prev) => !prev)}
            style={{ flex: 1, borderRadius: 10, borderWidth: 1, borderColor: onlyLowStock ? (isDark ? '#F87171' : "#FCA5A5") : colors.border, backgroundColor: onlyLowStock ? (isDark ? 'rgba(239, 68, 68, 0.15)' : "#FEF2F2") : colors.surfaceAlt, paddingVertical: 10, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 }}
          >
            <Ionicons name="alert-circle-outline" size={16} color={onlyLowStock ? (isDark ? '#FCA5A5' : "#DC2626") : colors.textSecondary} />
            <Text style={{ fontWeight: "700", fontSize: 13, color: onlyLowStock ? (isDark ? '#FECACA' : "#991B1B") : colors.textSecondary }}>
              Low Stock Only
            </Text>
          </Pressable>

          <Pressable
            onPress={() => loadData().catch(() => Alert.alert("Error", "Failed to refresh stock"))}
            style={{ backgroundColor: isDark ? colors.text : "#0F172A", borderRadius: 10, paddingHorizontal: 16, justifyContent: "center", alignItems: "center", flexDirection: "row", gap: 6 }}
          >
            <Ionicons name="refresh" size={16} color={isDark ? colors.background : "white"} />
            <Text style={{ color: isDark ? colors.background : "white", fontWeight: "700", fontSize: 13 }}>
              {loading ? "..." : "Refresh"}
            </Text>
          </Pressable>
        </View>
      </View>

      <Text style={{ fontWeight: "700", marginTop: 6, color: colors.text }}>Items ({filteredItems.length})</Text>
      {filteredItems.length === 0 ? (
        <Text style={{ color: colors.textSecondary }}>No items match current filters.</Text>
      ) : null}

      {filteredItems.map((item) => (
        <View key={item.id} style={{ ...card, padding: 16, gap: 12 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontWeight: "800", fontSize: 16, color: colors.text }}>{item.name}</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{categoryMap[item.categoryId ?? ""] ?? "Uncategorized"} | ₹ {item.price}</Text>
            </View>
            <View style={{ alignItems: "flex-end", gap: 2 }}>
              <Text style={{ color: isLowStockItem(item) ? (isDark ? '#FCA5A5' : "#DC2626") : colors.text, fontWeight: "800", fontSize: 16 }}>{item.stockQty} left</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Threshold: {thresholdFor(item)}</Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
            <Pressable onPress={() => adjustStock(item, -10)} disabled={savingItemId === item.id} style={{ flex: 1, borderRadius: 8, paddingVertical: 10, backgroundColor: colors.surfaceAlt, alignItems: "center" }}>
              <Text style={{ fontWeight: "700", color: colors.textSecondary }}>-10</Text>
            </Pressable>
            <Pressable onPress={() => adjustStock(item, -1)} disabled={savingItemId === item.id} style={{ flex: 1, borderRadius: 8, paddingVertical: 10, backgroundColor: colors.surfaceAlt, alignItems: "center" }}>
              <Text style={{ fontWeight: "700", color: colors.textSecondary }}>-1</Text>
            </Pressable>
            <Pressable onPress={() => adjustStock(item, 1)} disabled={savingItemId === item.id} style={{ flex: 1, borderRadius: 8, paddingVertical: 10, backgroundColor: isDark ? 'rgba(34, 197, 94, 0.2)' : "#DCFCE7", alignItems: "center" }}>
              <Text style={{ fontWeight: "700", color: isDark ? '#4ADE80' : "#16A34A" }}>+1</Text>
            </Pressable>
            <Pressable onPress={() => adjustStock(item, 10)} disabled={savingItemId === item.id} style={{ flex: 1, borderRadius: 8, paddingVertical: 10, backgroundColor: isDark ? 'rgba(34, 197, 94, 0.2)' : "#DCFCE7", alignItems: "center" }}>
              <Text style={{ fontWeight: "700", color: isDark ? '#4ADE80' : "#16A34A" }}>+10</Text>
            </Pressable>
          </View>

          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1, flexDirection: "row", borderWidth: 1, borderColor: colors.border, borderRadius: 8, overflow: "hidden" }}>
              <TextInput value={stockDrafts[item.id] ?? ""} onChangeText={(text) => setStockDrafts((prev) => ({ ...prev, [item.id]: text }))} keyboardType="numeric" placeholder="Set stock" placeholderTextColor={colors.textSecondary} style={{ flex: 1, paddingHorizontal: 12, fontSize: 13, backgroundColor: colors.surfaceAlt, color: colors.text }} />
              <Pressable onPress={() => saveManualStock(item)} disabled={savingItemId === item.id} style={{ backgroundColor: isDark ? colors.text : "#0F172A", paddingHorizontal: 12, justifyContent: "center" }}>
                <Ionicons name="save" size={14} color={isDark ? colors.background : "white"} />
              </Pressable>
            </View>
            <View style={{ flex: 1, flexDirection: "row", borderWidth: 1, borderColor: colors.border, borderRadius: 8, overflow: "hidden" }}>
              <TextInput value={thresholdDrafts[item.id] ?? ""} onChangeText={(text) => setThresholdDrafts((prev) => ({ ...prev, [item.id]: text }))} keyboardType="numeric" placeholder="Threshold" placeholderTextColor={colors.textSecondary} style={{ flex: 1, paddingHorizontal: 12, fontSize: 13, backgroundColor: colors.surfaceAlt, color: colors.text }} />
              <Pressable onPress={() => saveThreshold(item)} disabled={savingItemId === item.id} style={{ backgroundColor: colors.primary, paddingHorizontal: 12, justifyContent: "center" }}>
                <Ionicons name="save" size={14} color="white" />
              </Pressable>
            </View>
          </View>

          <Pressable
            onPress={() => toggleItemAvailability(item)}
            disabled={savingItemId === item.id}
            style={{ borderRadius: 8, paddingVertical: 10, backgroundColor: item.isAvailable ? (isDark ? 'rgba(239, 68, 68, 0.15)' : "#FEF2F2") : (isDark ? 'rgba(34, 197, 94, 0.15)' : "#F0FDF4"), borderWidth: 1, borderColor: item.isAvailable ? (isDark ? '#EF4444' : "#FEE2E2") : (isDark ? '#22C55E' : "#DCFCE7"), flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 4 }}
          >
            <Ionicons name={item.isAvailable ? "eye-off" : "eye"} size={16} color={item.isAvailable ? (isDark ? '#FCA5A5' : "#DC2626") : (isDark ? '#4ADE80' : "#16A34A")} />
            <Text style={{ color: item.isAvailable ? (isDark ? '#FCA5A5' : "#DC2626") : (isDark ? '#4ADE80' : "#16A34A"), fontWeight: "700", fontSize: 13 }}>
              {item.isAvailable ? "Hide Item from Menu" : "Show Item on Menu"}
            </Text>
          </Pressable>
        </View>
      ))}

      <View style={{ ...card, padding: 16, gap: 12 }}>
        <Text style={{ fontWeight: "800", fontSize: 16, color: colors.text }}>Stock Movement Log ({filteredLogs.length})</Text>
        {filteredLogs.length === 0 ? (
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>No stock movement logs found.</Text>
        ) : null}
        {filteredLogs.slice(0, 60).map((log) => (
          <View key={log.id} style={{ borderBottomWidth: 1, borderColor: colors.border, paddingBottom: 12, gap: 4 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <Text style={{ fontWeight: "700", color: colors.text, fontSize: 13, flex: 1 }}>{log.menuItem?.name ?? "Unknown Item"}</Text>
              <Text style={{ fontWeight: "800", color: log.delta > 0 ? (isDark ? '#4ADE80' : "#16A34A") : log.delta < 0 ? (isDark ? '#FCA5A5' : "#DC2626") : colors.textSecondary, fontSize: 13 }}>
                {log.delta > 0 ? `+${log.delta}` : log.delta}
              </Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{log.changeType} • {log.actorUser?.name ?? "System"}</Text>
              <Text style={{ color: isDark ? colors.textSecondary : "#94A3B8", fontSize: 11 }}>Qty: {log.previousQty} → {log.newQty}</Text>
            </View>
            {log.note ? <Text style={{ color: isDark ? colors.textSecondary : "#94A3B8", fontSize: 11, fontStyle: "italic" }}>{log.note}</Text> : null}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
