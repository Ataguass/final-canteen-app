import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions
} from "react-native";
import * as Print from "expo-print";
import { Audio } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { ConnectionBadge } from "../../components/ui/ConnectionBadge";
import { useAuth } from "../../hooks/useAuth";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";
import { menuService } from "../../services/menuService";
import { offlineOrderQueue } from "../../services/offlineOrderQueue";
import { orderService, type Order } from "../../services/orderService";
import { tenantService, type InvoiceSettings } from "../../services/tenantService";
import { PaymentMethod, PaymentStatus } from "../../services/types";

type MenuItem = {
  id: string;
  categoryId?: string;
  name: string;
  price: number;
  stockQty: number;
  description?: string | null;
  image?: string | null;
};
type Category = { id: string; name: string };
type DiscountType = "FIXED" | "PERCENTAGE";
type HeldDraft = {
  cart: Record<string, number>;
  selectedCategoryId: string;
  taxPercent: string;
  discountType: DiscountType;
  discountValue: string;
  shipping: string;
};

const formatCurrency = (value: number): string => `INR ${value.toFixed(2)}`;
const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const defaultInvoiceSettings: InvoiceSettings = {
  id: "",
  name: "Canteen",
  logo: null,
  invoiceLogoUrl: null,
  invoiceShowLogo: true,
  invoiceShowSchoolName: true,
  invoiceShowOrderNumber: true,
  invoiceShowDate: true,
  invoiceShowCashier: true,
  invoiceShowPaymentDetails: true,
  invoiceShowTaxBreakup: true,
  invoiceShowNotes: true,
  invoiceFooterNote: null
};

const paymentMethodIcons: Record<PaymentMethod, keyof typeof Ionicons.glyphMap> = {
  CASH: "cash-outline",
  UPI: "qr-code-outline",
  CARD: "card-outline",
  WALLET: "wallet-outline",
  CREDIT: "card-outline",
  OTHER: "ellipsis-horizontal-circle-outline"
};

const paymentStatusIcons: Record<PaymentStatus, keyof typeof Ionicons.glyphMap> = {
  PAID: "checkmark-circle-outline",
  UNPAID: "alert-circle-outline",
  PARTIAL: "time-outline"
};

const itemSelectSoundSource = require("../../assets/sounds/item-select.wav");

export default function Screen() {
  const { width: screenWidth } = useWindowDimensions();
  const { user, accessToken } = useAuth();
  const { isConnected } = useNetworkStatus();
  const [categories, setCategories] = useState<Category[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("ALL");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [taxPercent, setTaxPercent] = useState("0");
  const [discountType, setDiscountType] = useState<DiscountType>("FIXED");
  const [discountValue, setDiscountValue] = useState("0");
  const [shipping, setShipping] = useState("0");
  const [heldDrafts, setHeldDrafts] = useState<HeldDraft[]>([]);
  const [cartSummaryVisible, setCartSummaryVisible] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("PAID");
  const [paymentNote, setPaymentNote] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("0");
  const [loading, setLoading] = useState(false);
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [invoiceSettings, setInvoiceSettings] = useState<InvoiceSettings>(defaultInvoiceSettings);
  const [queuedCount, setQueuedCount] = useState(0);
  const [syncingQueued, setSyncingQueued] = useState(false);
  const itemSelectSoundRef = useRef<Audio.Sound | null>(null);
  const itemGridColumns = screenWidth >= 700 ? 3 : 2;
  const itemCardWidth = itemGridColumns === 3 ? "32%" : "48.5%";
  const itemImageHeight = itemGridColumns === 3 ? 86 : 104;

  const playItemSelectSound = useCallback(async () => {
    try {
      if (!itemSelectSoundRef.current) {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false
        });

        const { sound } = await Audio.Sound.createAsync(itemSelectSoundSource, {
          shouldPlay: false,
          volume: 0.45
        });
        itemSelectSoundRef.current = sound;
      }

      await itemSelectSoundRef.current.replayAsync();
    } catch {
      // Keep POS stable even if sound fails on some devices.
    }
  }, []);

  useEffect(
    () => () => {
      const sound = itemSelectSoundRef.current;
      itemSelectSoundRef.current = null;
      if (sound) {
        sound.unloadAsync().catch(() => undefined);
      }
    },
    []
  );

  const loadQueuedCount = useCallback(async () => {
    if (!user?.tenantId || !user.id) return;
    const queued = await offlineOrderQueue.get(user.tenantId, user.id);
    setQueuedCount(queued.length);
  }, [user?.tenantId, user?.id]);

  const loadPosMenu = useCallback(async () => {
    if (!user?.tenantId || !accessToken) return;
    setLoadingMenu(true);
    setMenuError(null);
    try {
      const [categoryResult, menuResult] = await Promise.all([
        menuService.listCategories(accessToken, user.tenantId),
        menuService.listItems(accessToken, user.tenantId)
      ]);
      setCategories(categoryResult.data);
      setMenu(menuResult.data);
      await offlineOrderQueue.setPosMenuCache(user.tenantId, {
        categories: categoryResult.data,
        menu: menuResult.data,
        updatedAt: new Date().toISOString()
      });
    } catch (error: unknown) {
      const cached = await offlineOrderQueue.getPosMenuCache(user.tenantId);
      if (cached) {
        setCategories(cached.categories);
        setMenu(cached.menu);
        setMenuError(
          `Offline mode: using cached menu from ${new Date(cached.updatedAt).toLocaleString()}.`
        );
      } else {
        const message = error instanceof Error ? error.message : "Failed to load POS menu";
        setMenuError(message);
        setCategories([]);
        setMenu([]);
      }
    } finally {
      setLoadingMenu(false);
    }
  }, [accessToken, user?.tenantId]);

  useEffect(() => {
    loadPosMenu();
  }, [loadPosMenu]);

  useEffect(() => {
    loadQueuedCount().catch(() => undefined);
  }, [loadQueuedCount, isConnected]);

  useEffect(() => {
    const loadInvoiceSettings = async () => {
      if (!user?.tenantId || !accessToken) return;
      try {
        const response = await tenantService.getInvoiceSettings(accessToken, user.tenantId);
        setInvoiceSettings(response.data);
      } catch {
        setInvoiceSettings(defaultInvoiceSettings);
      }
    };
    loadInvoiceSettings();
  }, [accessToken, user?.tenantId]);

  const filteredMenu = useMemo(
    () =>
      selectedCategoryId === "ALL"
        ? menu
        : menu.filter((item) => item.categoryId === selectedCategoryId),
    [menu, selectedCategoryId]
  );

  const cartLines = useMemo(
    () =>
      menu
        .filter((item) => (cart[item.id] ?? 0) > 0)
        .map((item) => {
          const quantity = cart[item.id] ?? 0;
          return { ...item, quantity, lineTotal: item.price * quantity };
        }),
    [menu, cart]
  );

  const currentOrderItems = useMemo(
    () => cartLines.map((line) => ({ menuItemId: line.id, quantity: line.quantity })),
    [cartLines]
  );

  const subtotal = useMemo(() => cartLines.reduce((sum, line) => sum + line.lineTotal, 0), [cartLines]);
  const totalQty = useMemo(() => cartLines.reduce((sum, line) => sum + line.quantity, 0), [cartLines]);
  const taxAmount = useMemo(() => subtotal * ((Number(taxPercent) || 0) / 100), [subtotal, taxPercent]);
  const discountAmount = useMemo(() => {
    const value = Number(discountValue) || 0;
    if (discountType === "PERCENTAGE") {
      return subtotal * (value / 100);
    }
    return value;
  }, [discountType, discountValue, subtotal]);
  const shippingAmount = useMemo(() => Number(shipping) || 0, [shipping]);
  const grandTotal = useMemo(
    () => Math.max(subtotal + taxAmount + shippingAmount - discountAmount, 0),
    [subtotal, taxAmount, shippingAmount, discountAmount]
  );
  const isCartEmpty = currentOrderItems.length === 0;

  const resetCart = () => {
    setCart({});
    setTaxPercent("0");
    setDiscountType("FIXED");
    setDiscountValue("0");
    setShipping("0");
    setPaymentNote("");
    setPaymentAmount("0");
    setPaymentMethod("CASH");
    setPaymentStatus("PAID");
  };

  const holdOrder = () => {
    if (currentOrderItems.length === 0) {
      Alert.alert("Nothing to hold", "Add at least one item first.");
      return;
    }
    setHeldDrafts((prev) => [
      ...prev,
      {
        cart: { ...cart },
        selectedCategoryId,
        taxPercent,
        discountType,
        discountValue,
        shipping
      }
    ]);
    resetCart();
    Alert.alert("Held", "Current POS cart has been held.");
  };

  const restoreLastHeld = () => {
    if (heldDrafts.length === 0) {
      Alert.alert("No held orders", "You do not have any held carts.");
      return;
    }
    const last = heldDrafts[heldDrafts.length - 1];
    setCart(last.cart);
    setSelectedCategoryId(last.selectedCategoryId);
    setTaxPercent(last.taxPercent);
    setDiscountType(last.discountType);
    setDiscountValue(last.discountValue);
    setShipping(last.shipping);
    setHeldDrafts((prev) => prev.slice(0, -1));
    Alert.alert("Restored", "Last held order has been restored.");
  };

  const cancelOrder = () => {
    if (currentOrderItems.length === 0) {
      Alert.alert("Cart empty", "There is no active POS cart.");
      return;
    }
    resetCart();
    Alert.alert("Cancelled", "Current POS cart has been cancelled.");
  };

  const openPayment = () => {
    if (currentOrderItems.length === 0) {
      Alert.alert("Cart empty", "Add at least one item");
      return;
    }
    setCartSummaryVisible(false);
    setPaymentAmount(grandTotal.toFixed(2));
    setPaymentModalVisible(true);
  };

  const addItemToCart = useCallback(
    (itemId: string) => {
      setCart((prev) => ({ ...prev, [itemId]: (prev[itemId] ?? 0) + 1 }));
      playItemSelectSound().catch(() => undefined);
    },
    [playItemSelectSound]
  );

  const syncQueuedPosOrders = useCallback(async () => {
    if (!user?.tenantId || !user?.id || !accessToken) return;
    const queued = await offlineOrderQueue.get(user.tenantId, user.id);
    if (queued.length === 0) {
      Alert.alert("No queued POS orders", "Everything is already synced.");
      return;
    }
    try {
      setSyncingQueued(true);
      await orderService.syncOrders(
        accessToken,
        user.tenantId,
        queued.map((entry) => ({
          items: entry.items,
          paymentMethod: entry.paymentMethod,
          paymentStatus: entry.paymentStatus
        }))
      );
      await offlineOrderQueue.clear(user.tenantId, user.id);
      setQueuedCount(0);
      Alert.alert("Synced", `${queued.length} queued POS orders synced.`);
      await loadPosMenu();
    } catch (error) {
      Alert.alert("Sync failed", error instanceof Error ? error.message : "Could not sync queued POS orders.");
    } finally {
      setSyncingQueued(false);
    }
  }, [accessToken, loadPosMenu, user?.id, user?.tenantId]);

  const buildReceiptHtml = useCallback(
    (order: Order) => {
      const settings = invoiceSettings ?? defaultInvoiceSettings;
      const logoUrl = settings.invoiceLogoUrl || settings.logo || "";
      const rows = order.items
        .map(
          (item) => `
          <tr>
            <td>${escapeHtml(item.name)}</td>
            <td style="text-align:center;">${item.quantity}</td>
            <td style="text-align:right;">${item.price.toFixed(2)}</td>
            <td style="text-align:right;">${(item.price * item.quantity).toFixed(2)}</td>
          </tr>`
        )
        .join("");

      return `
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: Arial, sans-serif; padding: 18px; color: #111827; }
            h1 { margin: 0 0 6px 0; font-size: 22px; }
            .muted { color: #6B7280; margin: 2px 0; }
            .box { border: 1px solid #E5E7EB; border-radius: 8px; padding: 10px; margin-top: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            th, td { border-bottom: 1px solid #E5E7EB; padding: 6px; font-size: 12px; }
            th { background: #F9FAFB; text-align: left; }
            .right { text-align: right; }
            .totals td { border: none; padding: 3px 0; font-size: 13px; }
            .grand { font-size: 16px; font-weight: 700; color: #065F46; }
          </style>
        </head>
        <body>
          ${
            settings.invoiceShowLogo && logoUrl
              ? `<div style="margin-bottom:10px;"><img src="${escapeHtml(
                  logoUrl
                )}" alt="Logo" style="max-height:56px; max-width:220px; object-fit:contain;" /></div>`
              : ""
          }
          <h1>${settings.invoiceShowSchoolName ? escapeHtml(settings.name) : "Canteen Invoice"}</h1>
          ${
            settings.invoiceShowOrderNumber
              ? `<p class="muted">Order: ${escapeHtml(order.orderNumber)}</p>`
              : ""
          }
          ${
            settings.invoiceShowDate
              ? `<p class="muted">Date: ${escapeHtml(new Date(order.createdAt).toLocaleString())}</p>`
              : ""
          }
          ${
            settings.invoiceShowCashier
              ? `<p class="muted">Cashier: ${escapeHtml(user?.name ?? "Admin")}</p>`
              : ""
          }
          ${
            settings.invoiceShowPaymentDetails
              ? `<p class="muted">Payment: ${escapeHtml(order.paymentMethod)} (${escapeHtml(
                  order.paymentStatus ?? "UNPAID"
                )})</p>`
              : ""
          }
          <div class="box">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th style="text-align:center;">Qty</th>
                  <th class="right">Price</th>
                  <th class="right">Subtotal</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
            <table style="margin-top: 10px;">
              ${
                settings.invoiceShowTaxBreakup
                  ? `<tr class="totals"><td>Subtotal</td><td class="right">${order.subtotal.toFixed(
                      2
                    )}</td></tr>
              <tr class="totals"><td>Tax</td><td class="right">${order.taxAmount.toFixed(2)}</td></tr>`
                  : ""
              }
              <tr class="totals grand"><td>Grand Total</td><td class="right">${order.totalAmount.toFixed(2)}</td></tr>
            </table>
            ${
              settings.invoiceShowNotes
                ? `<p class="muted">POS Note: ${escapeHtml(paymentNote || "-")}</p>`
                : ""
            }
            ${settings.invoiceFooterNote ? `<p class="muted">${escapeHtml(settings.invoiceFooterNote)}</p>` : ""}
          </div>
        </body>
      </html>`;
    },
    [invoiceSettings, paymentNote, user?.name]
  );

  const printInvoice = useCallback(
    async (order: Order) => {
      const html = buildReceiptHtml(order);
      try {
        await Print.printAsync({ html });
        Alert.alert("Printed", `Invoice ready for order ${order.orderNumber}.`);
      } catch (error) {
        const settings = invoiceSettings ?? defaultInvoiceSettings;
        const fallbackText =
          `${settings.invoiceShowSchoolName ? `${settings.name}\n` : ""}` +
          `${settings.invoiceShowOrderNumber ? `Invoice ${order.orderNumber}\n` : ""}` +
          `${settings.invoiceShowDate ? `Date: ${new Date(order.createdAt).toLocaleString()}\n` : ""}` +
          `${
            settings.invoiceShowPaymentDetails
              ? `Payment: ${order.paymentMethod} (${order.paymentStatus ?? "UNPAID"})\n`
              : ""
          }` +
          `${
            settings.invoiceShowTaxBreakup
              ? `Subtotal: ${formatCurrency(order.subtotal)}\nTax: ${formatCurrency(order.taxAmount)}\n`
              : ""
          }` +
          `Total: ${formatCurrency(order.totalAmount)}\n` +
          `${settings.invoiceShowNotes ? `Note: ${paymentNote || "-"}\n` : ""}` +
          `Items:\n${order.items
            .map((item) => `- ${item.name} x${item.quantity} = ${formatCurrency(item.price * item.quantity)}`)
            .join("\n")}` +
          `${settings.invoiceFooterNote ? `\n${settings.invoiceFooterNote}` : ""}`;

        await Share.share({
          title: `Invoice ${order.orderNumber}`,
          message: fallbackText
        });
        Alert.alert(
          "Print not available",
          error instanceof Error
            ? `${error.message}\nShared invoice text instead.`
            : "Shared invoice text instead."
        );
      }
    },
    [buildReceiptHtml, invoiceSettings, paymentNote]
  );

  const submitOrder = async (mode: "submit" | "print") => {
    if (!user?.tenantId || !user?.id || !accessToken) return;
    if (currentOrderItems.length === 0) {
      Alert.alert("Cart empty", "Add at least one item");
      return;
    }

    try {
      setLoading(true);
      const order = await orderService.placeOrder(accessToken, user.tenantId, {
        items: currentOrderItems,
        paymentMethod,
        paymentStatus
      });
      const placedOrder = order.data;
      setPaymentModalVisible(false);
      if (mode === "print") {
        await printInvoice(placedOrder);
        Alert.alert("Success", "Payment submitted and POS order created.");
      } else {
        Alert.alert("Success", "Payment submitted and POS order created.");
      }
      resetCart();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not place order";
      const isNetworkFailure = !isConnected || message.toLowerCase().includes("network request failed");
      if (isNetworkFailure) {
        try {
          await offlineOrderQueue.add(user.tenantId, user.id, {
            items: currentOrderItems,
            paymentMethod,
            paymentStatus,
            source: "POS"
          });
          setPaymentModalVisible(false);
          resetCart();
          await loadQueuedCount();
          Alert.alert(
            "Saved offline",
            "No internet/server connection. POS order queued and will sync when network is back."
          );
        } catch {
          Alert.alert("Error", "Could not save POS order offline.");
        }
      } else {
        Alert.alert("Error", message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.headerCard}>
          <View style={styles.headerIconWrap}>
            <Ionicons name="storefront" size={22} color="#0F172A" />
          </View>
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>POS Counter</Text>
            <Text style={styles.headerSubtitle}>Fast billing with online/offline sync</Text>
          </View>
        </View>

        <View style={styles.statusCard}>
          <ConnectionBadge isConnected={isConnected} />
          <View style={styles.statsRow}>
            <View style={[styles.statPill, styles.statPillBlue]}>
              <Text style={styles.statLabel}>Held</Text>
              <Text style={styles.statValue}>{heldDrafts.length}</Text>
            </View>
            <View style={[styles.statPill, styles.statPillAmber]}>
              <Text style={styles.statLabel}>Queued</Text>
              <Text style={styles.statValue}>{queuedCount}</Text>
            </View>
          </View>
          <View style={styles.topActionsRow}>
            <Pressable
              onPress={syncQueuedPosOrders}
              disabled={syncingQueued || !isConnected}
              style={[
                styles.topActionButton,
                syncingQueued || !isConnected ? styles.topActionButtonDisabled : styles.topActionButtonPrimary
              ]}
            >
              <Ionicons name="cloud-upload-outline" size={16} color="white" />
              <Text style={styles.topActionText}>{syncingQueued ? "Syncing..." : "Sync Queued"}</Text>
            </Pressable>
            <Pressable onPress={restoreLastHeld} style={[styles.topActionButton, styles.topActionButtonSecondary]}>
              <Ionicons name="refresh-outline" size={16} color="#0F172A" />
              <Text style={styles.topActionTextDark}>Restore Hold</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Categories</Text>
          {menuError ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>{menuError}</Text>
              <Pressable onPress={loadPosMenu} style={styles.retryButton}>
                <Text style={styles.retryButtonText}>Retry POS Menu</Text>
              </Pressable>
            </View>
          ) : null}
          {loadingMenu ? <Text style={styles.helperText}>Loading menu...</Text> : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
            <Pressable
              onPress={() => setSelectedCategoryId("ALL")}
              style={[styles.categoryChip, selectedCategoryId === "ALL" && styles.categoryChipActive]}
            >
              <Text style={[styles.categoryChipText, selectedCategoryId === "ALL" && styles.categoryChipTextActive]}>
                All
              </Text>
            </Pressable>
            {categories.map((category) => {
              const isActive = selectedCategoryId === category.id;
              return (
                <Pressable
                  key={category.id}
                  onPress={() => setSelectedCategoryId(category.id)}
                  style={[styles.categoryChip, isActive && styles.categoryChipActive]}
                >
                  <Text style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]}>
                    {category.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Items</Text>
            <Text style={styles.helperText}>{filteredMenu.length} shown</Text>
          </View>
          <View style={styles.itemGrid}>
            {filteredMenu.map((item) => {
              const qty = cart[item.id] ?? 0;
              const isLowStock = item.stockQty <= 10;
              return (
                <View key={item.id} style={[styles.itemCard, { width: itemCardWidth }]}>
                  {item.image ? (
                    <Image
                      source={{ uri: item.image }}
                      style={[styles.itemImage, { height: itemImageHeight }]}
                      resizeMode="cover"
                    />
                  ) : null}
                  <View style={styles.itemHeaderRow}>
                    <View style={styles.itemTextWrap}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      {item.description ? (
                        <Text numberOfLines={2} style={styles.itemDescription}>
                          {item.description}
                        </Text>
                      ) : null}
                      <Text style={styles.itemPrice}>₹ {item.price.toFixed(2)}</Text>
                    </View>
                    <View style={[styles.stockPill, isLowStock ? styles.stockPillLow : styles.stockPillNormal]}>
                      <Text style={[styles.stockText, isLowStock ? styles.stockTextLow : styles.stockTextNormal]}>
                        Stock {item.stockQty}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.qtyRow}>
                    <Pressable
                      onPress={() =>
                        setCart((prev) => ({ ...prev, [item.id]: Math.max((prev[item.id] ?? 0) - 1, 0) }))
                      }
                      style={styles.qtyButton}
                    >
                      <Ionicons name="remove" size={16} color="#0F172A" />
                    </Pressable>
                    <View style={styles.qtyValueWrap}>
                      <Text style={styles.qtyValue}>{qty}</Text>
                    </View>
                    <Pressable
                      onPress={() => addItemToCart(item.id)}
                      style={[styles.qtyButton, styles.qtyButtonPlus]}
                    >
                      <Ionicons name="add" size={16} color="#0F172A" />
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
          {!loadingMenu && filteredMenu.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="restaurant-outline" size={20} color="#64748B" />
              <Text style={styles.emptyStateText}>No items in selected category.</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.checkoutBar}>
        <Pressable onPress={() => setCartSummaryVisible(true)} style={styles.selectedProductsCard}>
          <View>
            <Text style={styles.selectedProductsTitle}>Selected Products ({totalQty})</Text>
            <Text style={styles.selectedProductsHint}>Tap to view table, tax, discount and shipping</Text>
          </View>
          <Ionicons name="chevron-up" size={18} color="#475569" />
        </Pressable>

        <View style={styles.checkoutTotals}>
          <Text style={styles.subtotalText}>Sub Total: ₹ {subtotal.toFixed(2)}</Text>
          <Text style={styles.totalText}>₹ {grandTotal.toFixed(2)}</Text>
        </View>

        <View style={styles.checkoutActions}>
          <Pressable
            onPress={holdOrder}
            disabled={isCartEmpty}
            style={[styles.actionButton, styles.holdButton, isCartEmpty && styles.disabledButton]}
          >
            <Text style={styles.actionButtonText}>Hold</Text>
          </Pressable>
          <Pressable onPress={resetCart} style={[styles.actionButton, styles.resetButton]}>
            <Text style={styles.actionButtonText}>Reset</Text>
          </Pressable>
          <Pressable
            onPress={openPayment}
            disabled={loading || isCartEmpty}
            style={[styles.actionButton, styles.payButton, (loading || isCartEmpty) && styles.disabledButton]}
          >
            <Text style={styles.actionButtonText}>{loading ? "Processing..." : "Pay Now"}</Text>
          </Pressable>
        </View>
      </View>

      <Modal
        visible={cartSummaryVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCartSummaryVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Order Summary</Text>
              <Pressable onPress={() => setCartSummaryVisible(false)} style={styles.modalCloseButton}>
                <Ionicons name="close" size={18} color="#0F172A" />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalScrollContent}>
              <View style={styles.orderSummaryHero}>
                <View style={styles.orderSummaryMetric}>
                  <Text style={styles.orderSummaryMetricLabel}>Items</Text>
                  <Text style={styles.orderSummaryMetricValue}>{totalQty}</Text>
                </View>
                <View style={styles.orderSummaryMetric}>
                  <Text style={styles.orderSummaryMetricLabel}>Subtotal</Text>
                  <Text style={styles.orderSummaryMetricValue}>₹ {subtotal.toFixed(2)}</Text>
                </View>
                <View style={styles.orderSummaryMetric}>
                  <Text style={styles.orderSummaryMetricLabel}>Grand Total</Text>
                  <Text style={styles.orderSummaryMetricValue}>₹ {grandTotal.toFixed(2)}</Text>
                </View>
              </View>

              <View style={styles.tableWrap}>
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.tableHeaderText, { flex: 2 }]}>PRODUCT</Text>
                  <Text style={[styles.tableHeaderText, { flex: 1, textAlign: "center" }]}>QTY</Text>
                  <Text style={[styles.tableHeaderText, { flex: 1, textAlign: "right" }]}>PRICE</Text>
                  <Text style={[styles.tableHeaderText, { flex: 1.3, textAlign: "right" }]}>SUB TOTAL</Text>
                </View>
                {cartLines.length === 0 ? (
                  <Text style={styles.emptyTableText}>No Data Available</Text>
                ) : (
                  cartLines.map((line) => (
                    <View key={line.id} style={styles.tableBodyRow}>
                      <Text style={{ flex: 2 }}>{line.name}</Text>
                      <Text style={{ flex: 1, textAlign: "center" }}>{line.quantity}</Text>
                      <Text style={{ flex: 1, textAlign: "right" }}>{line.price.toFixed(2)}</Text>
                      <Text style={{ flex: 1.3, textAlign: "right" }}>{line.lineTotal.toFixed(2)}</Text>
                    </View>
                  ))
                )}
              </View>

              <View style={styles.adjustmentsCard}>
                <Text style={styles.adjustmentsTitle}>Tax, Discount & Shipping</Text>
                <TextInput
                  value={taxPercent}
                  onChangeText={setTaxPercent}
                  keyboardType="numeric"
                  placeholder="Tax %"
                  style={styles.input}
                />

                <View style={styles.discountRow}>
                  <Text style={styles.inputLabel}>Discount</Text>
                  {(["FIXED", "PERCENTAGE"] as DiscountType[]).map((type) => {
                    const active = discountType === type;
                    return (
                      <Pressable
                        key={type}
                        onPress={() => setDiscountType(type)}
                        style={[styles.segmentButton, active && styles.segmentButtonActive]}
                      >
                        <Text style={[styles.segmentButtonText, active && styles.segmentButtonTextActive]}>
                          {type === "FIXED" ? "Fixed" : "Percentage"}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <TextInput
                  value={discountValue}
                  onChangeText={setDiscountValue}
                  keyboardType="numeric"
                  placeholder={discountType === "FIXED" ? "Discount ₹" : "Discount %"}
                  style={styles.input}
                />

                <TextInput
                  value={shipping}
                  onChangeText={setShipping}
                  keyboardType="numeric"
                  placeholder="Shipping ₹"
                  style={styles.input}
                />
              </View>

              <View style={styles.summaryTotalsWrap}>
                <Text style={styles.summaryMetaText}>Total QTY: {totalQty}</Text>
                <Text style={styles.summarySubTotal}>Sub Total: ₹ {subtotal.toFixed(2)}</Text>
                <Text style={styles.summaryGrandTotal}>Total: ₹ {grandTotal.toFixed(2)}</Text>
              </View>
            </ScrollView>

            <Pressable onPress={() => setCartSummaryVisible(false)} style={styles.doneButton}>
              <Text style={styles.doneButtonText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={paymentModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPaymentModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.paymentModalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Make Payment</Text>
              <Pressable onPress={() => setPaymentModalVisible(false)} style={styles.modalCloseButton}>
                <Ionicons name="close" size={18} color="#0F172A" />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalScrollContent}>
              <View style={styles.paymentAmountBanner}>
                <Text style={styles.paymentAmountLabel}>Payable Amount</Text>
                <Text style={styles.paymentAmountValue}>₹ {grandTotal.toFixed(2)}</Text>
              </View>

              <Text style={styles.inputLabel}>Amount</Text>
              <TextInput
                value={paymentAmount}
                onChangeText={setPaymentAmount}
                keyboardType="numeric"
                placeholder="Amount"
                style={styles.input}
              />

              <Text style={styles.inputLabel}>Payment Type</Text>
              <View style={styles.chipRow}>
                {(["CASH", "UPI", "CARD", "OTHER"] as PaymentMethod[]).map((method) => {
                  const active = paymentMethod === method;
                  return (
                    <Pressable
                      key={method}
                      onPress={() => setPaymentMethod(method)}
                      style={[styles.segmentButton, active && styles.segmentButtonActive]}
                    >
                      <Ionicons
                        name={paymentMethodIcons[method]}
                        size={14}
                        color={active ? "white" : "#334155"}
                      />
                      <Text style={[styles.segmentButtonText, active && styles.segmentButtonTextActive]}>
                        {method}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.inputLabel}>Note</Text>
              <TextInput
                value={paymentNote}
                onChangeText={setPaymentNote}
                placeholder="Note"
                multiline
                style={[styles.input, styles.noteInput]}
              />

              <Text style={styles.inputLabel}>Payment Status</Text>
              <View style={styles.chipRow}>
                {(["PAID", "UNPAID", "PARTIAL"] as PaymentStatus[]).map((status) => {
                  const active = paymentStatus === status;
                  return (
                    <Pressable
                      key={status}
                      onPress={() => setPaymentStatus(status)}
                      style={[styles.segmentButton, active && styles.segmentButtonActive]}
                    >
                      <Ionicons
                        name={paymentStatusIcons[status]}
                        size={14}
                        color={active ? "white" : "#334155"}
                      />
                      <Text style={[styles.segmentButtonText, active && styles.segmentButtonTextActive]}>
                        {status}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.paymentSummaryCard}>
                <Text style={styles.paymentSummaryTitle}>Payment Summary</Text>
                {[
                  ["Total Products", totalQty.toString()],
                  ["Total Amount", `₹ ${subtotal.toFixed(2)}`],
                  ["Order Tax", `₹ ${taxAmount.toFixed(2)} (${taxPercent || 0}%)`],
                  ["Discount", `₹ ${discountAmount.toFixed(2)}`],
                  ["Shipping", `₹ ${shippingAmount.toFixed(2)}`],
                  ["Grand Total", `₹ ${grandTotal.toFixed(2)}`]
                ].map(([label, value], index) => (
                  <View
                    key={label}
                    style={[styles.paymentSummaryRow, index > 0 && styles.paymentSummaryRowBorder]}
                  >
                    <Text style={styles.paymentSummaryLabel}>{label}</Text>
                    <Text style={styles.paymentSummaryValue}>{value}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>

            <View style={styles.paymentActionsPrimaryRow}>
              <Pressable
                onPress={() => submitOrder("submit")}
                disabled={loading}
                style={[styles.paymentActionButton, styles.submitButton, loading && styles.disabledButton]}
              >
                <Text style={styles.actionButtonText}>{loading ? "Processing..." : "Submit"}</Text>
              </Pressable>
              <Pressable
                onPress={() => submitOrder("print")}
                disabled={loading}
                style={[styles.paymentActionButton, styles.printButton, loading && styles.disabledButton]}
              >
                <Text style={styles.actionButtonText}>Submit & Print</Text>
              </Pressable>
            </View>
            <Pressable onPress={() => setPaymentModalVisible(false)} style={styles.cancelButton}>
              <Text style={styles.actionButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#EEF2F7"
  },
  scroll: {
    flex: 1
  },
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 212
  },
  headerCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#0F172A",
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3
  },
  headerIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center"
  },
  headerTextWrap: {
    flex: 1,
    gap: 2
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0F172A"
  },
  headerSubtitle: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "500"
  },
  statusCard: {
    backgroundColor: "white",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    gap: 10,
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  statsRow: {
    flexDirection: "row",
    gap: 8
  },
  statPill: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10
  },
  statPillBlue: {
    backgroundColor: "#EEF2FF"
  },
  statPillAmber: {
    backgroundColor: "#FEF3C7"
  },
  statLabel: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "700"
  },
  statValue: {
    color: "#0F172A",
    fontSize: 20,
    fontWeight: "800",
    marginTop: 2
  },
  topActionsRow: {
    flexDirection: "row",
    gap: 8
  },
  topActionButton: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    flex: 1
  },
  topActionButtonPrimary: {
    backgroundColor: "#0F172A"
  },
  topActionButtonSecondary: {
    backgroundColor: "#E2E8F0"
  },
  topActionButtonDisabled: {
    backgroundColor: "#94A3B8"
  },
  topActionText: {
    color: "white",
    fontWeight: "700"
  },
  topActionTextDark: {
    color: "#0F172A",
    fontWeight: "700"
  },
  sectionCard: {
    backgroundColor: "white",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    gap: 10,
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A"
  },
  helperText: {
    color: "#64748B",
    fontWeight: "600"
  },
  errorCard: {
    borderWidth: 1,
    borderColor: "#FCA5A5",
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    padding: 10,
    gap: 8
  },
  errorText: {
    color: "#991B1B",
    fontWeight: "700"
  },
  retryButton: {
    alignSelf: "flex-start",
    backgroundColor: "#0F172A",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  retryButtonText: {
    color: "white",
    fontWeight: "700"
  },
  categoryRow: {
    gap: 8,
    paddingRight: 8
  },
  categoryChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#E2E8F0"
  },
  categoryChipActive: {
    backgroundColor: "#0F172A"
  },
  categoryChipText: {
    color: "#0F172A",
    fontWeight: "700"
  },
  categoryChipTextActive: {
    color: "white"
  },
  itemGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "flex-start"
  },
  itemCard: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 12,
    gap: 10,
    backgroundColor: "#F8FAFC",
    marginBottom: 10
  },
  itemImage: {
    width: "100%",
    height: 110,
    borderRadius: 10,
    backgroundColor: "#E2E8F0"
  },
  itemHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  itemTextWrap: {
    flex: 1,
    gap: 2
  },
  itemName: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A"
  },
  itemDescription: {
    color: "#64748B",
    fontWeight: "500"
  },
  itemPrice: {
    color: "#334155",
    fontWeight: "700"
  },
  stockPill: {
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 10
  },
  stockPillNormal: {
    backgroundColor: "#ECFDF5"
  },
  stockPillLow: {
    backgroundColor: "#FEF2F2"
  },
  stockText: {
    fontSize: 12,
    fontWeight: "700"
  },
  stockTextNormal: {
    color: "#047857"
  },
  stockTextLow: {
    color: "#B91C1C"
  },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  qtyButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center"
  },
  qtyButtonPlus: {
    backgroundColor: "#BFDBFE"
  },
  qtyValueWrap: {
    minWidth: 52,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    alignItems: "center"
  },
  qtyValue: {
    fontWeight: "800",
    color: "#0F172A",
    fontSize: 15
  },
  emptyState: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
    padding: 16,
    alignItems: "center",
    gap: 6
  },
  emptyStateText: {
    color: "#475569",
    fontWeight: "600"
  },
  checkoutBar: {
    borderTopWidth: 1,
    borderTopColor: "#D1D5DB",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 14,
    gap: 9,
    shadowColor: "#020617",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: -2 },
    elevation: 4
  },
  selectedProductsCard: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    padding: 11,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  selectedProductsTitle: {
    fontWeight: "800",
    color: "#0F172A",
    fontSize: 18
  },
  selectedProductsHint: {
    color: "#64748B",
    marginTop: 2,
    fontWeight: "500"
  },
  checkoutTotals: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  subtotalText: {
    color: "#4F46E5",
    fontWeight: "700",
    fontSize: 17
  },
  totalText: {
    color: "#059669",
    fontSize: 35,
    fontWeight: "900"
  },
  checkoutActions: {
    flexDirection: "row",
    gap: 8
  },
  actionButton: {
    borderRadius: 12,
    padding: 12,
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  holdButton: {
    backgroundColor: "#DB2777"
  },
  resetButton: {
    backgroundColor: "#E11D48"
  },
  payButton: {
    backgroundColor: "#10B981"
  },
  actionButtonText: {
    color: "white",
    textAlign: "center",
    fontWeight: "800"
  },
  disabledButton: {
    opacity: 0.5
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.5)",
    justifyContent: "center",
    padding: 12
  },
  modalCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 14,
    gap: 10,
    maxHeight: "88%"
  },
  paymentModalCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 14,
    gap: 10,
    maxHeight: "92%"
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  modalTitle: {
    fontSize: 21,
    fontWeight: "800",
    color: "#0F172A"
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center"
  },
  modalScrollContent: {
    gap: 10
  },
  orderSummaryHero: {
    borderWidth: 1,
    borderColor: "#DBEAFE",
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    padding: 10,
    flexDirection: "row",
    gap: 8
  },
  orderSummaryMetric: {
    flex: 1,
    backgroundColor: "white",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 8
  },
  orderSummaryMetricLabel: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "700"
  },
  orderSummaryMetricValue: {
    marginTop: 2,
    color: "#0F172A",
    fontWeight: "800",
    fontSize: 14
  },
  tableWrap: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    overflow: "hidden"
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#E2E8F0",
    padding: 10
  },
  tableHeaderText: {
    fontWeight: "800",
    color: "#0F172A"
  },
  tableBodyRow: {
    flexDirection: "row",
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0"
  },
  emptyTableText: {
    padding: 16,
    textAlign: "center",
    color: "#64748B",
    fontWeight: "600"
  },
  inputLabel: {
    fontWeight: "700",
    color: "#334155"
  },
  input: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    padding: 11,
    backgroundColor: "#FFFFFF"
  },
  adjustmentsCard: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    padding: 10,
    gap: 10
  },
  adjustmentsTitle: {
    color: "#334155",
    fontWeight: "700"
  },
  noteInput: {
    minHeight: 76,
    textAlignVertical: "top"
  },
  paymentAmountBanner: {
    borderWidth: 1,
    borderColor: "#BBF7D0",
    backgroundColor: "#ECFDF5",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  paymentAmountLabel: {
    color: "#065F46",
    fontWeight: "700"
  },
  paymentAmountValue: {
    color: "#047857",
    fontWeight: "900",
    fontSize: 22
  },
  discountRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center"
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  segmentButton: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  segmentButtonActive: {
    backgroundColor: "#1D4ED8",
    borderColor: "#1D4ED8"
  },
  segmentButtonText: {
    color: "#334155",
    fontWeight: "700"
  },
  segmentButtonTextActive: {
    color: "white"
  },
  summaryTotalsWrap: {
    alignItems: "flex-end",
    gap: 4,
    paddingTop: 2
  },
  summaryMetaText: {
    color: "#334155",
    fontWeight: "600"
  },
  summarySubTotal: {
    color: "#4F46E5",
    fontWeight: "700"
  },
  summaryGrandTotal: {
    color: "#059669",
    fontSize: 23,
    fontWeight: "900"
  },
  doneButton: {
    backgroundColor: "#0F172A",
    borderRadius: 12,
    padding: 12
  },
  doneButtonText: {
    color: "white",
    textAlign: "center",
    fontWeight: "800"
  },
  paymentSummaryCard: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    overflow: "hidden"
  },
  paymentSummaryTitle: {
    color: "#0F172A",
    fontWeight: "800",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 2
  },
  paymentSummaryRow: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 12,
    justifyContent: "space-between",
    alignItems: "center"
  },
  paymentSummaryRowBorder: {
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0"
  },
  paymentSummaryLabel: {
    color: "#475569",
    fontWeight: "600"
  },
  paymentSummaryValue: {
    color: "#0F172A",
    fontWeight: "700"
  },
  paymentActionsPrimaryRow: {
    flexDirection: "row",
    gap: 8
  },
  paymentActionButton: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: "center"
  },
  submitButton: {
    backgroundColor: "#4F46E5"
  },
  printButton: {
    backgroundColor: "#6366F1"
  },
  cancelButton: {
    backgroundColor: "#6B7280",
    borderRadius: 12,
    padding: 12,
    alignItems: "center"
  }
});
