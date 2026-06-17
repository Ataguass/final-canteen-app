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
import { moderateScale, fontScale, verticalScale, scale, isTablet, gridColumns } from '../../utils/responsive';
import { useTheme } from '../../hooks/useTheme';

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
  const theme = useTheme();
  const { colors, isDark } = theme;
  const styles = createStyles(theme);
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
  const [walletCustomerPhone, setWalletCustomerPhone] = useState("");
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
    setWalletCustomerPhone("");
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
          paymentStatus: entry.paymentStatus,
          customerPhone: entry.customerPhone
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
    if (paymentMethod === "WALLET" && !/^\d{10}$/.test(walletCustomerPhone.trim())) {
      Alert.alert("Customer phone required", "Enter 10-digit teacher/staff phone for wallet payment.");
      return;
    }

    try {
      setLoading(true);
      const order = await orderService.placeOrder(accessToken, user.tenantId, {
        items: currentOrderItems,
        paymentMethod,
        paymentStatus,
        customerPhone: paymentMethod === "WALLET" ? walletCustomerPhone.trim() : undefined
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
            customerPhone: paymentMethod === "WALLET" ? walletCustomerPhone.trim() : undefined,
            source: "POS"
          });
          setPaymentModalVisible(false);
          await loadQueuedCount();

          // Print offline receipt if user requested printing
          if (mode === "print") {
            const offlineOrder: Order = {
              id: `offline-${Date.now()}`,
              tenantId: user.tenantId,
              userId: user.id,
              orderNumber: `OFF-${Date.now().toString(36).toUpperCase()}`,
              status: "PENDING",
              paymentMethod,
              paymentStatus: paymentStatus ?? "UNPAID",
              subtotal,
              taxAmount,
              totalAmount: grandTotal,
              items: cartLines.map((line) => ({
                id: line.id,
                menuItemId: line.id,
                name: line.name,
                price: line.price,
                quantity: line.quantity
              })),
              createdAt: new Date().toISOString()
            };
            await printInvoice(offlineOrder);
          }

          resetCart();
          Alert.alert(
            "Saved offline",
            `No internet/server connection. POS order queued and will sync when network is back.${mode === "print" ? " Receipt printed." : ""}`
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
        <View style={styles.statusCard}>
          <View style={styles.statsRow}>
            <View style={[styles.statPill, styles.statPillBlue]}>
              <Text style={styles.statLabel}>Held Drafts</Text>
              <Text style={styles.statValue}>{heldDrafts.length}</Text>
            </View>
            <View style={[styles.statPill, styles.statPillAmber]}>
              <Text style={styles.statLabel}>Queued Offline</Text>
              <Text style={styles.statValue}>{queuedCount}</Text>
            </View>
          </View>
          <View style={styles.topActionsRow}>
            <ConnectionBadge isConnected={isConnected} />
            <Pressable
              onPress={syncQueuedPosOrders}
              disabled={syncingQueued || !isConnected}
              style={[
                styles.topActionButton,
                syncingQueued || !isConnected ? styles.topActionButtonDisabled : styles.topActionButtonPrimary
              ]}
            >
              <Ionicons name="cloud-upload" size={18} color="white" />
              <Text style={styles.topActionText}>{syncingQueued ? "Syncing..." : "Sync Queued"}</Text>
            </Pressable>
            <Pressable onPress={restoreLastHeld} style={[styles.topActionButton, styles.topActionButtonSecondary]}>
              <Ionicons name="refresh" size={18} color={isDark ? colors.text : "#0F172A"} />
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
                All Items
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
            <Text style={styles.sectionTitle}>Menu Items</Text>
            <Text style={styles.helperText}>{filteredMenu.length} shown</Text>
          </View>
          <View style={styles.itemGrid}>
            {filteredMenu.map((item) => {
              const qty = cart[item.id] ?? 0;
              const isLowStock = item.stockQty <= 10;
              return (
                <Pressable 
                  key={item.id} 
                  onPress={() => addItemToCart(item.id)}
                  style={({ pressed }) => [
                    styles.itemCard, 
                    { width: itemCardWidth },
                    pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }
                  ]}
                >
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
                        <Text numberOfLines={1} style={styles.itemDescription}>
                          {item.description}
                        </Text>
                      ) : null}
                      <Text style={styles.itemPrice}>₹ {item.price.toFixed(2)}</Text>
                    </View>
                  </View>
                  <View style={styles.itemFooterRow}>
                    <View style={[styles.stockPill, isLowStock ? styles.stockPillLow : styles.stockPillNormal]}>
                      <Text style={[styles.stockText, isLowStock ? styles.stockTextLow : styles.stockTextNormal]}>
                        {item.stockQty} left
                      </Text>
                    </View>
                    <View style={styles.stepperWrap}>
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation();
                          setCart((prev) => ({ ...prev, [item.id]: Math.max((prev[item.id] ?? 0) - 1, 0) }));
                        }}
                        style={styles.stepperButton}
                      >
                        <Ionicons name="remove" size={16} color={isDark ? colors.text : "#0F172A"} />
                      </Pressable>
                      <Text style={styles.stepperValue}>{qty}</Text>
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation();
                          addItemToCart(item.id);
                        }}
                        style={styles.stepperButton}
                      >
                        <Ionicons name="add" size={16} color={isDark ? colors.text : "#0F172A"} />
                      </Pressable>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
          {!loadingMenu && filteredMenu.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="restaurant-outline" size={24} color="#94A3B8" />
              <Text style={styles.emptyStateText}>No items in selected category.</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Floating Checkout Bar */}
      <View style={styles.checkoutBar}>
        <Pressable onPress={() => setCartSummaryVisible(true)} style={styles.selectedProductsCard}>
          <View style={styles.selectedProductsRow}>
            <View style={styles.cartIconBadge}>
              <Ionicons name="cart" size={20} color="white" />
              <View style={styles.cartCountCircle}>
                <Text style={styles.cartCountText}>{totalQty}</Text>
              </View>
            </View>
            <View>
              <Text style={styles.selectedProductsTitle}>Cart Summary</Text>
              <Text style={styles.selectedProductsHint}>Tap to edit details</Text>
            </View>
          </View>
          <View style={styles.checkoutTotals}>
            <Text style={styles.totalText}>₹ {grandTotal.toFixed(2)}</Text>
          </View>
        </Pressable>

        <View style={styles.checkoutActions}>
          <Pressable
            onPress={holdOrder}
            disabled={isCartEmpty}
            style={[styles.actionButton, styles.holdButton, isCartEmpty && styles.disabledButton]}
          >
            <Ionicons name="pause" size={18} color="#475569" />
            <Text style={styles.actionButtonTextDark}>Hold</Text>
          </Pressable>
          <Pressable onPress={resetCart} style={[styles.actionButton, styles.resetButton]}>
            <Ionicons name="trash" size={18} color="#EF4444" />
          </Pressable>
          <Pressable
            onPress={openPayment}
            disabled={loading || isCartEmpty}
            style={[styles.payButton, (loading || isCartEmpty) && styles.disabledButton]}
          >
            <Text style={styles.payButtonText}>{loading ? "Processing..." : "Pay Now"}</Text>
            <Ionicons name="arrow-forward" size={20} color="white" />
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
                <Ionicons name="close" size={20} color={isDark ? colors.text : "#0F172A"} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
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
                  <Text style={[styles.orderSummaryMetricValue, { color: isDark ? colors.primary : "#FF6B35" }]}>₹ {grandTotal.toFixed(2)}</Text>
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
                      <Text style={{ flex: 2, fontWeight: "600", color: colors.text }}>{line.name}</Text>
                      <Text style={{ flex: 1, textAlign: "center", color: colors.textSecondary }}>{line.quantity}</Text>
                      <Text style={{ flex: 1, textAlign: "right", color: colors.textSecondary }}>{line.price.toFixed(2)}</Text>
                      <Text style={{ flex: 1.3, textAlign: "right", fontWeight: "700", color: colors.text }}>{line.lineTotal.toFixed(2)}</Text>
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
                  placeholderTextColor="#94A3B8"
                />

                <View style={styles.discountRow}>
                  <Text style={styles.inputLabel}>Discount Type</Text>
                  {(["FIXED", "PERCENTAGE"] as DiscountType[]).map((type) => {
                    const active = discountType === type;
                    return (
                      <Pressable
                        key={type}
                        onPress={() => setDiscountType(type)}
                        style={[styles.segmentButton, active && styles.segmentButtonActive]}
                      >
                        <Text style={[styles.segmentButtonText, active && styles.segmentButtonTextActive]}>
                          {type === "FIXED" ? "Fixed Amount" : "Percentage"}
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
                  placeholderTextColor="#94A3B8"
                />

                <TextInput
                  value={shipping}
                  onChangeText={setShipping}
                  keyboardType="numeric"
                  placeholder="Shipping ₹"
                  style={styles.input}
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </ScrollView>
            <View style={styles.modalFooter}>
              <Pressable onPress={() => setCartSummaryVisible(false)} style={styles.doneButton}>
                <Text style={styles.doneButtonText}>Done</Text>
              </Pressable>
            </View>
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
              <Text style={styles.modalTitle}>Complete Payment</Text>
              <Pressable onPress={() => setPaymentModalVisible(false)} style={styles.modalCloseButton}>
                <Ionicons name="close" size={20} color={isDark ? colors.text : "#0F172A"} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
              <View style={styles.paymentAmountBanner}>
                <Text style={styles.paymentAmountLabel}>Total Payable Amount</Text>
                <Text style={styles.paymentAmountValue}>₹ {grandTotal.toFixed(2)}</Text>
              </View>

              <Text style={styles.inputLabel}>Received Amount</Text>
              <TextInput
                value={paymentAmount}
                onChangeText={setPaymentAmount}
                keyboardType="numeric"
                placeholder="Amount"
                style={styles.input}
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.inputLabel}>Payment Method</Text>
              <View style={styles.chipGrid}>
                {(["CASH", "UPI", "WALLET", "CARD", "OTHER"] as PaymentMethod[]).map((method) => {
                  const active = paymentMethod === method;
                  return (
                    <Pressable
                      key={method}
                      onPress={() => setPaymentMethod(method)}
                      style={[styles.gridSegmentButton, active && styles.segmentButtonActive]}
                    >
                      <Ionicons
                        name={paymentMethodIcons[method]}
                        size={20}
                        color={active ? "white" : "#475569"}
                      />
                      <Text style={[styles.segmentButtonText, active && styles.segmentButtonTextActive]}>
                        {method}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {paymentMethod === "WALLET" ? (
                <>
                  <Text style={styles.inputLabel}>Teacher/Staff Phone</Text>
                  <TextInput
                    value={walletCustomerPhone}
                    onChangeText={setWalletCustomerPhone}
                    keyboardType="phone-pad"
                    placeholder="Enter 10-digit customer phone"
                    maxLength={10}
                    style={styles.input}
                    placeholderTextColor="#94A3B8"
                  />
                </>
              ) : null}

              <Text style={styles.inputLabel}>Note (Optional)</Text>
              <TextInput
                value={paymentNote}
                onChangeText={setPaymentNote}
                placeholder="Add an internal note..."
                multiline
                style={[styles.input, styles.noteInput]}
                placeholderTextColor="#94A3B8"
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
                        size={16}
                        color={active ? "white" : "#475569"}
                      />
                      <Text style={[styles.segmentButtonText, active && styles.segmentButtonTextActive]}>
                        {status}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.paymentSummaryCard}>
                <Text style={styles.paymentSummaryTitle}>Order Details</Text>
                {[
                  ["Total Items", totalQty.toString()],
                  ["Subtotal", `₹ ${subtotal.toFixed(2)}`],
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
                <Text style={styles.paymentActionTextSecondary}>{loading ? "Processing..." : "Submit Only"}</Text>
              </Pressable>
              <Pressable
                onPress={() => submitOrder("print")}
                disabled={loading}
                style={[styles.paymentActionButton, styles.printButton, loading && styles.disabledButton]}
              >
                <Text style={styles.paymentActionText}>Submit & Print</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = ({ colors, isDark }: { colors: any, isDark: boolean }) => ({
  screen: {
    flex: 1,
    backgroundColor: colors.background
  },
  scroll: {
    flex: 1
  },
  content: {
    padding: moderateScale(16),
    gap: moderateScale(16),
    paddingBottom: verticalScale(200)
  },
  statusCard: {
    backgroundColor: colors.card,
    borderRadius: moderateScale(20),
    padding: moderateScale(16),
    gap: moderateScale(16),
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: moderateScale(10),
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  statsRow: {
    flexDirection: "row",
    gap: moderateScale(10)
  },
  statPill: {
    flex: 1,
    borderRadius: moderateScale(16),
    paddingVertical: moderateScale(12),
    paddingHorizontal: moderateScale(14),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  statPillBlue: {
    backgroundColor: colors.surfaceAlt
  },
  statPillAmber: {
    backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : "#FFFBEB"
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: fontScale(13),
    fontWeight: "700"
  },
  statValue: {
    color: colors.text,
    fontSize: fontScale(22),
    fontWeight: "900"
  },
  topActionsRow: {
    flexDirection: "row",
    gap: moderateScale(12),
    alignItems: "center"
  },
  topActionButton: {
    borderRadius: moderateScale(14),
    paddingVertical: moderateScale(12),
    paddingHorizontal: moderateScale(16),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: moderateScale(8),
    flex: 1
  },
  topActionButtonPrimary: {
    backgroundColor: isDark ? colors.primary : "#FF6B35"
  },
  topActionButtonSecondary: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: isDark ? colors.border : "#F1F5F9"
  },
  topActionButtonDisabled: {
    backgroundColor: "#94A3B8"
  },
  topActionText: {
    color: "white",
    fontWeight: "700",
    fontSize: fontScale(15)
  },
  topActionTextDark: {
    color: colors.text,
    fontWeight: "700",
    fontSize: fontScale(15)
  },
  sectionCard: {
    backgroundColor: "transparent",
    gap: moderateScale(12)
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  sectionTitle: {
    fontSize: fontScale(20),
    fontWeight: "800",
    color: colors.text,
    marginLeft: moderateScale(4)
  },
  helperText: {
    color: colors.textSecondary,
    fontWeight: "600",
    marginRight: moderateScale(4)
  },
  errorCard: {
    borderWidth: 1,
    borderColor: isDark ? '#B91C1C' : "#FCA5A5",
    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : "#FEF2F2",
    borderRadius: moderateScale(16),
    padding: moderateScale(14),
    gap: moderateScale(10)
  },
  errorText: {
    color: isDark ? '#F87171' : "#991B1B",
    fontWeight: "700"
  },
  retryButton: {
    alignSelf: "flex-start",
    backgroundColor: isDark ? '#DC2626' : "#991B1B",
    borderRadius: moderateScale(10),
    paddingHorizontal: moderateScale(14),
    paddingVertical: moderateScale(8)
  },
  retryButtonText: {
    color: "white",
    fontWeight: "800"
  },
  categoryRow: {
    gap: moderateScale(8),
    paddingRight: moderateScale(16)
  },
  categoryChip: {
    paddingVertical: moderateScale(10),
    paddingHorizontal: moderateScale(20),
    borderRadius: moderateScale(999),
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border
  },
  categoryChipActive: {
    backgroundColor: isDark ? colors.primary : "#FF6B35",
    borderColor: isDark ? colors.primary : "#FF6B35"
  },
  categoryChipText: {
    color: colors.textSecondary,
    fontWeight: "700",
    fontSize: fontScale(15)
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
    backgroundColor: colors.card,
    borderRadius: moderateScale(20),
    padding: moderateScale(12),
    gap: moderateScale(10),
    marginBottom: verticalScale(12),
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: moderateScale(10),
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  itemImage: {
    width: "100%",
    height: moderateScale(110),
    borderRadius: moderateScale(14),
    backgroundColor: colors.surfaceAlt
  },
  itemHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between"
  },
  itemTextWrap: {
    flex: 1,
    gap: moderateScale(4)
  },
  itemName: {
    fontSize: fontScale(16),
    fontWeight: "800",
    color: colors.text
  },
  itemDescription: {
    color: colors.textSecondary,
    fontWeight: "500",
    fontSize: fontScale(13)
  },
  itemPrice: {
    color: isDark ? colors.primary : "#FF6B35",
    fontWeight: "800",
    fontSize: fontScale(16)
  },
  itemFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: verticalScale(4)
  },
  stockPill: {
    borderRadius: moderateScale(999),
    paddingVertical: moderateScale(4),
    paddingHorizontal: moderateScale(8)
  },
  stockPillNormal: {
    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : "#ECFDF5"
  },
  stockPillLow: {
    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : "#FEF2F2"
  },
  stockText: {
    fontSize: fontScale(11),
    fontWeight: "800"
  },
  stockTextNormal: {
    color: isDark ? '#34D399' : "#059669"
  },
  stockTextLow: {
    color: isDark ? '#F87171' : "#DC2626"
  },
  stepperWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceAlt,
    borderRadius: moderateScale(999),
    padding: moderateScale(4),
    gap: moderateScale(8)
  },
  stepperButton: {
    width: moderateScale(28),
    height: moderateScale(28),
    borderRadius: moderateScale(14),
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: moderateScale(2),
    shadowOffset: { width: 0, height: 1 },
    elevation: 1
  },
  stepperValue: {
    fontWeight: "800",
    color: colors.text,
    fontSize: fontScale(14),
    minWidth: moderateScale(16),
    textAlign: "center"
  },
  emptyState: {
    borderRadius: moderateScale(20),
    backgroundColor: colors.card,
    padding: moderateScale(32),
    alignItems: "center",
    gap: moderateScale(12),
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: moderateScale(8),
    shadowOffset: { width: 0, height: 2 },
    elevation: 1
  },
  emptyStateText: {
    color: colors.textSecondary,
    fontWeight: "600",
    fontSize: fontScale(16)
  },
  checkoutBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.card,
    borderTopLeftRadius: moderateScale(32),
    borderTopRightRadius: moderateScale(32),
    paddingTop: verticalScale(20),
    paddingBottom: verticalScale(28),
    paddingHorizontal: moderateScale(20),
    gap: moderateScale(16),
    shadowColor: "#0F172A",
    shadowOpacity: 0.15,
    shadowRadius: moderateScale(20),
    shadowOffset: { width: 0, height: -10 },
    elevation: 20
  },
  selectedProductsCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  selectedProductsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(12)
  },
  cartIconBadge: {
    width: moderateScale(44),
    height: moderateScale(44),
    borderRadius: moderateScale(22),
    backgroundColor: isDark ? colors.primary : "#FF6B35",
    alignItems: "center",
    justifyContent: "center"
  },
  cartCountCircle: {
    position: "absolute",
    top: verticalScale(-4),
    right: moderateScale(-4),
    backgroundColor: "#EF4444",
    width: moderateScale(20),
    height: moderateScale(20),
    borderRadius: moderateScale(10),
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: isDark ? colors.card : "white"
  },
  cartCountText: {
    color: "white",
    fontSize: fontScale(10),
    fontWeight: "900"
  },
  selectedProductsTitle: {
    fontWeight: "800",
    color: colors.text,
    fontSize: fontScale(17)
  },
  selectedProductsHint: {
    color: colors.textSecondary,
    marginTop: verticalScale(2),
    fontWeight: "600",
    fontSize: fontScale(12)
  },
  checkoutTotals: {
    alignItems: "flex-end"
  },
  totalText: {
    color: colors.text,
    fontSize: fontScale(26),
    fontWeight: "900"
  },
  checkoutActions: {
    flexDirection: "row",
    gap: moderateScale(12)
  },
  actionButton: {
    borderRadius: moderateScale(16),
    padding: moderateScale(14),
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: moderateScale(8),
    backgroundColor: colors.surfaceAlt
  },
  holdButton: {
    flex: 1
  },
  resetButton: {
    width: moderateScale(56),
    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : "#FEF2F2"
  },
  payButton: {
    flex: 2,
    backgroundColor: isDark ? '#059669' : "#10B981",
    borderRadius: moderateScale(16),
    padding: moderateScale(14),
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: moderateScale(10)
  },
  payButtonText: {
    color: "white",
    fontSize: fontScale(18),
    fontWeight: "900"
  },
  actionButtonTextDark: {
    color: colors.text,
    fontWeight: "800",
    fontSize: fontScale(15)
  },
  disabledButton: {
    opacity: 0.5
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.6)",
    justifyContent: "center",
    padding: moderateScale(16)
  },
  modalCard: {
    backgroundColor: colors.card,
    borderRadius: moderateScale(24),
    padding: moderateScale(20),
    gap: moderateScale(16),
    maxHeight: "85%",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: moderateScale(24),
    shadowOffset: { width: 0, height: 10 },
    elevation: 10
  },
  paymentModalCard: {
    backgroundColor: colors.card,
    borderRadius: moderateScale(24),
    padding: moderateScale(20),
    gap: moderateScale(16),
    maxHeight: "92%",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: moderateScale(24),
    shadowOffset: { width: 0, height: 10 },
    elevation: 10
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  modalTitle: {
    fontSize: fontScale(22),
    fontWeight: "900",
    color: colors.text
  },
  modalCloseButton: {
    width: moderateScale(36),
    height: moderateScale(36),
    borderRadius: moderateScale(18),
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center"
  },
  modalScrollContent: {
    gap: moderateScale(16),
    paddingBottom: verticalScale(20)
  },
  modalFooter: {
    paddingTop: verticalScale(10)
  },
  orderSummaryHero: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: moderateScale(16),
    padding: moderateScale(12),
    flexDirection: "row",
    gap: moderateScale(10)
  },
  orderSummaryMetric: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: moderateScale(12),
    paddingVertical: moderateScale(10),
    paddingHorizontal: moderateScale(12),
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: moderateScale(4),
    shadowOffset: { width: 0, height: 2 },
    elevation: 1
  },
  orderSummaryMetricLabel: {
    fontSize: fontScale(12),
    color: colors.textSecondary,
    fontWeight: "700"
  },
  orderSummaryMetricValue: {
    marginTop: verticalScale(4),
    color: colors.text,
    fontWeight: "900",
    fontSize: fontScale(16)
  },
  tableWrap: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: moderateScale(16),
    overflow: "hidden"
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: colors.background,
    paddingVertical: moderateScale(12),
    paddingHorizontal: moderateScale(14),
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  tableHeaderText: {
    fontWeight: "800",
    color: colors.textSecondary,
    fontSize: fontScale(12)
  },
  tableBodyRow: {
    flexDirection: "row",
    paddingVertical: moderateScale(14),
    paddingHorizontal: moderateScale(14),
    borderBottomWidth: 1,
    borderBottomColor: isDark ? colors.border : "#F1F5F9"
  },
  emptyTableText: {
    padding: moderateScale(20),
    textAlign: "center",
    color: colors.textMuted,
    fontWeight: "700"
  },
  inputLabel: {
    fontWeight: "800",
    color: colors.text,
    fontSize: fontScale(14),
    marginBottom: verticalScale(-4)
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: moderateScale(14),
    padding: moderateScale(14),
    backgroundColor: colors.background,
    fontSize: fontScale(15),
    fontWeight: "600",
    color: colors.text
  },
  adjustmentsCard: {
    backgroundColor: colors.card,
    borderRadius: moderateScale(16),
    borderWidth: 1,
    borderColor: colors.border,
    padding: moderateScale(16),
    gap: moderateScale(16)
  },
  adjustmentsTitle: {
    color: colors.text,
    fontWeight: "800",
    fontSize: fontScale(16)
  },
  noteInput: {
    minHeight: moderateScale(80),
    textAlignVertical: "top"
  },
  paymentAmountBanner: {
    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : "#ECFDF5",
    borderRadius: moderateScale(16),
    paddingVertical: moderateScale(16),
    paddingHorizontal: moderateScale(16),
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  paymentAmountLabel: {
    color: isDark ? '#34D399' : "#065F46",
    fontWeight: "800",
    fontSize: fontScale(15)
  },
  paymentAmountValue: {
    color: isDark ? '#10B981' : "#059669",
    fontWeight: "900",
    fontSize: fontScale(26)
  },
  discountRow: {
    gap: moderateScale(10)
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: moderateScale(10)
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: moderateScale(10)
  },
  segmentButton: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: moderateScale(999),
    paddingVertical: moderateScale(10),
    paddingHorizontal: moderateScale(16),
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(8)
  },
  gridSegmentButton: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: moderateScale(16),
    paddingVertical: moderateScale(14),
    paddingHorizontal: moderateScale(16),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: moderateScale(8),
    flexBasis: "48%"
  },
  segmentButtonActive: {
    backgroundColor: isDark ? colors.primary : "#FF6B35",
    borderColor: isDark ? colors.primary : "#FF6B35"
  },
  segmentButtonText: {
    color: colors.textSecondary,
    fontWeight: "700",
    fontSize: fontScale(14)
  },
  segmentButtonTextActive: {
    color: "white"
  },
  doneButton: {
    flexDirection: "row",
    backgroundColor: isDark ? colors.primary : "#FF6B35",
    borderRadius: moderateScale(12),
    padding: moderateScale(16),
    alignItems: "center"
  },
  doneButtonText: {
    color: "white",
    fontSize: fontScale(16),
    fontWeight: "900"
  },
  paymentSummaryCard: {
    backgroundColor: colors.background,
    borderRadius: moderateScale(16),
    padding: moderateScale(16),
    gap: moderateScale(12)
  },
  paymentSummaryTitle: {
    color: colors.text,
    fontWeight: "900",
    fontSize: fontScale(16),
    marginBottom: verticalScale(4)
  },
  paymentSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  paymentSummaryRowBorder: {
    paddingTop: verticalScale(12),
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  paymentSummaryLabel: {
    color: colors.textSecondary,
    fontWeight: "700",
    fontSize: fontScale(14)
  },
  paymentSummaryValue: {
    color: colors.text,
    fontWeight: "800",
    fontSize: fontScale(14)
  },
  paymentActionsPrimaryRow: {
    flexDirection: "row",
    gap: moderateScale(12),
    paddingTop: verticalScale(8)
  },
  paymentActionButton: {
    flex: 1,
    borderRadius: moderateScale(16),
    paddingVertical: moderateScale(16),
    alignItems: "center",
    justifyContent: "center"
  },
  submitButton: {
    backgroundColor: colors.surfaceAlt
  },
  printButton: {
    backgroundColor: isDark ? colors.primary : "#FF6B35"
  },
  paymentActionText: {
    color: "white",
    fontWeight: "900",
    fontSize: fontScale(15)
  },
  paymentActionTextSecondary: {
    color: colors.text,
    fontWeight: "900",
    fontSize: fontScale(15)
  }
});
