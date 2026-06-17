import { useTheme } from '../../hooks/useTheme';
import { Ionicons } from "@expo/vector-icons";
import { Tabs, usePathname, useRouter } from "expo-router";
import { Audio } from "expo-av";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View
} from "react-native";
import { useAuth } from "../../hooks/useAuth";
import { useOrderSocket } from "../../hooks/useOrderSocket";
import type { Order } from "../../services/orderService";

type DrawerItem = {
  label: string;
  path: string;
  icon: keyof typeof Ionicons.glyphMap;
};

type DrawerSection = {
  title: string;
  items: DrawerItem[];
};

const windowWidth = Dimensions.get("window").width;
const drawerWidth = Math.min(380, Math.round(windowWidth * 0.8));
const orderAlertSoundSource = require("../../assets/sounds/item-select.wav");
const ORDER_ALERT_BATCH_MS = 700;
const ORDER_ALERT_SOUND_COOLDOWN_MS = 2200;

const drawerSections: DrawerSection[] = [
  {
    title: "MAIN",
    items: [
      { label: "Dashboard", path: "/(admin)/dashboard", icon: "home-outline" },
      { label: "POS", path: "/(admin)/pos", icon: "storefront-outline" },
      { label: "Orders", path: "/(admin)/orders", icon: "receipt-outline" }
    ]
  },
  {
    title: "MANAGEMENT",
    items: [
      { label: "Menu Management", path: "/(admin)/profile/menu-manage", icon: "restaurant-outline" },
      { label: "Stock", path: "/(admin)/profile/stock", icon: "cube-outline" },
      { label: "Users", path: "/(admin)/profile/users", icon: "people-outline" },
      { label: "Community", path: "/(admin)/community", icon: "megaphone-outline" }
    ]
  },
  {
    title: "ANALYTICS",
    items: [{ label: "Reports", path: "/(admin)/profile/reports", icon: "bar-chart-outline" }]
  },
  {
    title: "SETTINGS",
    items: [
      { label: "Profile", path: "/(admin)/profile", icon: "person-outline" },
      { label: "Invoice Settings", path: "/(admin)/profile/invoice-settings", icon: "document-text-outline" },
      { label: "Data Backup", path: "/(admin)/profile/backups", icon: "cloud-upload-outline" },
      { label: "Banners", path: "/(admin)/profile/banners", icon: "images-outline" }
    ]
  }
];

const isPathActive = (pathname: string, targetPath: string): boolean => {
  const normalizedTarget = targetPath.replace("/(admin)", "");
  const normalizedPath = pathname.replace("/(admin)", "");
  return normalizedPath === normalizedTarget || normalizedPath.startsWith(`${normalizedTarget}/`);
};

const getHeaderMeta = (pathname: string, firstName: string) => {
  const dateLabel = new Date().toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" });
  const normalizedPath = pathname.replace("/(admin)", "");

  if (normalizedPath === "/dashboard" || normalizedPath === "/") {
    return { title: "Dashboard", subtitle: `Welcome back, ${firstName}` };
  }
  if (normalizedPath.startsWith("/pos")) {
    return { title: "POS", subtitle: "Counter billing and checkout" };
  }
  if (normalizedPath === "/orders/all") {
    return { title: "All Orders", subtitle: "Full order history" };
  }
  if (normalizedPath.startsWith("/orders")) {
    return { title: "Orders", subtitle: "Track and manage live orders" };
  }
  if (normalizedPath.startsWith("/community")) {
    return { title: "Community", subtitle: "Announcements and updates" };
  }
  if (normalizedPath.startsWith("/profile/menu-manage")) {
    return { title: "Menu Management", subtitle: "Categories and food items" };
  }
  if (normalizedPath.startsWith("/profile/stock")) {
    return { title: "Stock", subtitle: "Inventory and low stock control" };
  }
  if (normalizedPath.startsWith("/profile/users")) {
    return { title: "Users", subtitle: "Teacher and staff management" };
  }
  if (normalizedPath.startsWith("/profile/reports")) {
    return { title: "Reports", subtitle: "Sales analytics and summaries" };
  }
  if (normalizedPath.startsWith("/profile/invoice-settings")) {
    return { title: "Invoice Settings", subtitle: "Receipt customization controls" };
  }
  if (normalizedPath.startsWith("/profile/backups")) {
    return { title: "Data Backup", subtitle: "Backup and restore tenant data" };
  }
  if (normalizedPath.startsWith("/profile/banners")) {
    return { title: "Banners", subtitle: "Home banner media and visibility" };
  }
  if (normalizedPath === "/profile" || normalizedPath === "/profile/index") {
    return { title: "Profile", subtitle: "Manage your account and settings" };
  }
  return { title: "Dashboard", subtitle: `Welcome back, ${firstName}` };
};

export default function AdminLayout() {
  const { colors, isDark, toggleTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [newOrderCount, setNewOrderCount] = useState(0);
  const [incomingOrder, setIncomingOrder] = useState<Order | null>(null);
  const [popupBatchCount, setPopupBatchCount] = useState(0);
  const [orderPopupVisible, setOrderPopupVisible] = useState(false);
  const drawerAnim = useRef(new Animated.Value(0)).current;
  const orderSoundRef = useRef<Audio.Sound | null>(null);
  const orderBatchCountRef = useRef(0);
  const orderBatchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSoundAtRef = useRef(0);
  const latestIncomingOrderRef = useRef<Order | null>(null);
  const popupVisibleRef = useRef(false);

  const firstName = useMemo(() => {
    const name = (user?.name ?? "Admin").trim();
    return name.split(" ")[0] || "Admin";
  }, [user?.name]);

  const avatarText = useMemo(() => (user?.name?.charAt(0) ?? "A").toUpperCase(), [user?.name]);
  const headerMeta = useMemo(() => getHeaderMeta(pathname, firstName), [pathname, firstName]);

  const handleLogout = async () => {
    try {
      await logout();
      setDrawerVisible(false);
    } catch (error) {
      Alert.alert("Logout failed", error instanceof Error ? error.message : "Please try again");
    }
  };

  useEffect(() => {
    popupVisibleRef.current = orderPopupVisible;
  }, [orderPopupVisible]);

  const playNewOrderSound = useCallback(async () => {
    try {
      const now = Date.now();
      if (now - lastSoundAtRef.current < ORDER_ALERT_SOUND_COOLDOWN_MS) {
        return;
      }
      lastSoundAtRef.current = now;

      if (!orderSoundRef.current) {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false
        });

        const { sound } = await Audio.Sound.createAsync(orderAlertSoundSource, {
          shouldPlay: false,
          volume: 0.65
        });
        orderSoundRef.current = sound;
      }
      await orderSoundRef.current.replayAsync();
    } catch {
      // Keep admin flow stable even if audio fails on some devices.
    }
  }, []);

  useEffect(
    () => () => {
      const sound = orderSoundRef.current;
      orderSoundRef.current = null;
      if (orderBatchTimerRef.current) {
        clearTimeout(orderBatchTimerRef.current);
        orderBatchTimerRef.current = null;
      }
      if (sound) {
        sound.unloadAsync().catch(() => undefined);
      }
    },
    []
  );

  const onOrderNew = useCallback(
    (order: Order) => {
      if (order.userId && order.userId === user?.id) {
        return;
      }

      setNewOrderCount((prev) => prev + 1);
      latestIncomingOrderRef.current = order;
      orderBatchCountRef.current += 1;

      if (orderBatchTimerRef.current) {
        return;
      }

      orderBatchTimerRef.current = setTimeout(() => {
        orderBatchTimerRef.current = null;
        const latestOrder = latestIncomingOrderRef.current;
        if (!latestOrder) return;

        const batchedCount = Math.max(orderBatchCountRef.current, 1);
        orderBatchCountRef.current = 0;

        setIncomingOrder(latestOrder);
        setPopupBatchCount((prev) => (popupVisibleRef.current ? prev + batchedCount : batchedCount));
        setOrderPopupVisible(true);
        playNewOrderSound().catch(() => undefined);
      }, ORDER_ALERT_BATCH_MS);
    },
    [playNewOrderSound, user?.id]
  );

  useOrderSocket({
    tenantId: user?.tenantId,
    userId: user?.id,
    onOrderNew
  });

  useEffect(() => {
    if (pathname.startsWith("/(admin)/orders")) {
      setNewOrderCount(0);
    }
  }, [pathname]);

  const openDrawer = useCallback(() => {
    setDrawerVisible(true);
    Animated.timing(drawerAnim, {
      toValue: 1,
      duration: 230,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [drawerAnim]);

  const closeDrawer = useCallback(
    (afterClose?: () => void) => {
      Animated.timing(drawerAnim, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true
      }).start(() => {
        setDrawerVisible(false);
        if (afterClose) afterClose();
      });
    },
    [drawerAnim]
  );

  const navigateFromDrawer = useCallback(
    (targetPath: string) => {
      if (isPathActive(pathname, targetPath)) {
        closeDrawer();
        return;
      }
      closeDrawer(() => router.push(targetPath as never));
    },
    [closeDrawer, pathname, router]
  );

  const openOrderNotifications = useCallback(() => {
    if (newOrderCount > 0) {
      setNewOrderCount(0);
      router.push("/(admin)/orders" as never);
      return;
    }
    Alert.alert("Notifications", "No new orders.");
  }, [newOrderCount, router]);

  const dismissOrderPopup = useCallback(() => {
    setOrderPopupVisible(false);
    setPopupBatchCount(0);
  }, []);

  const viewIncomingOrder = useCallback(() => {
    if (!incomingOrder) {
      setOrderPopupVisible(false);
      setPopupBatchCount(0);
      return;
    }
    setOrderPopupVisible(false);
    setPopupBatchCount(0);
    setNewOrderCount(0);
    if (popupBatchCount > 1) {
      router.push("/(admin)/orders" as never);
      return;
    }
    router.push({ pathname: "/(admin)/orders/[id]", params: { id: incomingOrder.id } } as never);
  }, [incomingOrder, popupBatchCount, router]);

  const drawerTranslateX = drawerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-drawerWidth, 0]
  });

  const backdropOpacity = drawerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1]
  });

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        backBehavior="history"
        screenOptions={{
          headerShown: true,
          tabBarActiveTintColor: "#FF6B35",
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarStyle: {
            backgroundColor: colors.tabBarBg,
            borderTopColor: colors.border,
          },
          headerStyle: {
            backgroundColor: colors.headerBg,
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: 0,
          },
          headerShadowVisible: false,
          headerTitleAlign: "left",
          headerTitle: () => (
            <View style={{ alignItems: "flex-start", marginLeft: 4 }}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>{headerMeta.title}</Text>
              <Text 
                numberOfLines={1}
                ellipsizeMode="tail"
                style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "500", marginTop: 2, maxWidth: 220 }}
              >
                {headerMeta.subtitle}
              </Text>
            </View>
          ),
          headerLeft: () => {
            const normalizedPath = pathname.replace("/(admin)", "");
            const isRootTab = ["/dashboard", "/", "/pos", "/orders", "/community", "/profile"].includes(normalizedPath);

            return (
              <View style={{ flexDirection: "row", alignItems: "center", marginLeft: 16 }}>
                {!isRootTab ? (
                  <Pressable
                    onPress={() => router.back()}
                    style={({ pressed }) => [
                      {
                        padding: 4,
                        opacity: pressed ? 0.7 : 1,
                        backgroundColor: colors.card,
                        borderRadius: 12,
                        shadowColor: "#000",
                        shadowOpacity: 0.05,
                        shadowRadius: 4,
                        shadowOffset: { width: 0, height: 2 },
                        elevation: 1
                      }
                    ]}
                  >
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={openDrawer}
                    style={({ pressed }) => [
                      {
                        padding: 4,
                        opacity: pressed ? 0.7 : 1,
                        backgroundColor: normalizedPath === "/dashboard" ? "transparent" : colors.card,
                        borderRadius: 12,
                        shadowColor: "#000",
                        shadowOpacity: normalizedPath === "/dashboard" ? 0 : 0.05,
                        shadowRadius: 4,
                        shadowOffset: { width: 0, height: 2 },
                        elevation: normalizedPath === "/dashboard" ? 0 : 1
                      }
                    ]}
                  >
                    <Ionicons name="menu" size={26} color={colors.text} />
                  </Pressable>
                )}
              </View>
            );
          },
          headerRight: () => (
            <View style={{ marginRight: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Pressable
                onPress={toggleTheme}
                style={({ pressed }) => [
                  { padding: 4, opacity: pressed ? 0.7 : 1 }
                ]}
              >
                <Ionicons name={isDark ? "sunny-outline" : "moon-outline"} size={24} color={colors.text} />
              </Pressable>

              <Pressable
                onPress={openOrderNotifications}
                style={({ pressed }) => [
                  { padding: 4, opacity: pressed ? 0.7 : 1 }
                ]}
              >
                <Ionicons name="notifications-outline" size={24} color={colors.text} />
                {newOrderCount > 0 ? (
                  <View
                    style={{
                      position: "absolute",
                      top: 0,
                      right: 0,
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      backgroundColor: "#EF4444",
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 2,
                      borderColor: colors.headerBg
                    }}
                  >
                    <Text style={{ color: "white", fontSize: 10, fontWeight: "800" }}>
                      {newOrderCount > 9 ? "9+" : String(newOrderCount)}
                    </Text>
                  </View>
                ) : null}
              </Pressable>

              <Pressable
                onPress={() => router.push("/(admin)/profile")}
                style={({ pressed }) => [
                  { padding: 2, opacity: pressed ? 0.7 : 1 }
                ]}
              >
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.border, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16 }}>{avatarText}</Text>
                </View>
              </Pressable>
            </View>
          )
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: "Dashboard",
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? "home" : "home-outline"} size={size} color={color} />
            )
          }}
        />
        <Tabs.Screen
          name="pos"
          options={{
            title: "POS",
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? "storefront" : "storefront-outline"} size={size} color={color} />
            )
          }}
        />
        <Tabs.Screen
          name="orders/index"
          options={{
            title: "Orders",
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? "receipt" : "receipt-outline"} size={size} color={color} />
            )
          }}
        />
        <Tabs.Screen
          name="profile/index"
          options={{
            title: "Profile",
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? "person" : "person-outline"} size={size} color={color} />
            )
          }}
        />

        <Tabs.Screen name="community/index" options={{ href: null }} />
        <Tabs.Screen name="community/create" options={{ href: null }} />
        <Tabs.Screen name="orders/[id]" options={{ href: null }} />
        <Tabs.Screen name="orders/all" options={{ href: null }} />
        <Tabs.Screen name="profile/menu-manage" options={{ href: null }} />
        <Tabs.Screen name="profile/users" options={{ href: null }} />
        <Tabs.Screen name="profile/stock" options={{ href: null }} />
        <Tabs.Screen name="profile/reports" options={{ href: null }} />
        <Tabs.Screen name="profile/invoice-settings" options={{ href: null }} />
        <Tabs.Screen name="profile/backups" options={{ href: null }} />
        <Tabs.Screen name="profile/banners" options={{ href: null }} />
      </Tabs>

      <Modal visible={drawerVisible} transparent animationType="none" onRequestClose={() => closeDrawer()}>
        <View style={{ flex: 1 }}>
          <Pressable onPress={() => closeDrawer()} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}>
            <Animated.View
              style={{
                flex: 1,
                backgroundColor: colors.text,
                opacity: Animated.multiply(backdropOpacity, 0.45)
              }}
            />
          </Pressable>

          <Animated.View
            style={{
              width: drawerWidth,
              height: "100%",
              backgroundColor: colors.background,
              borderTopRightRadius: 24,
              borderBottomRightRadius: 24,
              overflow: "hidden",
              transform: [{ translateX: drawerTranslateX }],
              shadowColor: colors.text,
              shadowOpacity: 0.18,
              shadowRadius: 18,
              shadowOffset: { width: 4, height: 0 },
              elevation: 12
            }}
          >
            <View style={{ paddingHorizontal: 24, paddingTop: 64, paddingBottom: 24, backgroundColor: colors.background, borderBottomWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 14 }}>
              <Image source={require("../../assets/images/canteen_logo_final.png")} style={{ width: 44, height: 44, borderRadius: 10 }} resizeMode="contain" />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: "900", fontSize: 20, letterSpacing: -0.5 }}>Canteen Admin</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "600" }}>Management Portal</Text>
              </View>
            </View>

            <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 32, gap: 20 }}>
              {drawerSections.map((section, index) => (
                <View key={section.title} style={{ gap: 6 }}>
                  <Text style={{ color: colors.textMuted, fontWeight: "800", fontSize: 11, letterSpacing: 1.2, paddingHorizontal: 12, marginBottom: 4 }}>
                    {section.title}
                  </Text>

                  {section.items.map((item) => {
                    const active = isPathActive(pathname, item.path);
                    return (
                      <Pressable
                        key={item.path}
                        onPress={() => navigateFromDrawer(item.path)}
                        android_ripple={{ color: "rgba(0,0,0,0.05)" }}
                        style={{
                          borderRadius: 14,
                          backgroundColor: active ? "#FF6B35" : "transparent",
                          paddingVertical: 14,
                          paddingHorizontal: 14,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 14
                        }}
                      >
                        <Ionicons name={item.icon} size={22} color={active ? "white" : colors.textSecondary} />
                        <Text style={{ color: active ? "white" : colors.text, fontWeight: active ? "800" : "600", fontSize: 15, flex: 1 }}>
                          {item.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </ScrollView>

            <View style={{ padding: 16, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.background }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12, paddingHorizontal: 8 }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.border, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: colors.text, fontWeight: "800", fontSize: 16 }}>{avatarText}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15 }}>{user?.name ?? "Admin"}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "500" }}>{user?.email ?? user?.phone ?? "admin@canteen"}</Text>
                </View>
              </View>

              <Pressable
                onPress={handleLogout}
                android_ripple={{ color: "rgba(0,0,0,0.05)" }}
                style={{
                  borderRadius: 12,
                  backgroundColor: isDark ? "rgba(239, 68, 68, 0.15)" : "#FEF2F2",
                  paddingVertical: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: 8,
                  borderWidth: 1,
                  borderColor: isDark ? "rgba(239, 68, 68, 0.3)" : "#FECACA"
                }}
              >
                <Ionicons name="log-out-outline" size={18} color="#DC2626" />
                <Text style={{ color: "#DC2626", fontWeight: "800", fontSize: 14 }}>Sign Out</Text>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </Modal>

      <Modal
        visible={orderPopupVisible && !!incomingOrder}
        transparent
        animationType="fade"
        onRequestClose={dismissOrderPopup}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            padding: 18,
            backgroundColor: "rgba(2,6,23,0.42)"
          }}
        >
          <View
            style={{
              backgroundColor: "white",
              borderRadius: 18,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 16,
              gap: 10
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.border
                }}
              >
                <Ionicons name="notifications" size={20} color={colors.text} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 19, fontWeight: "800", color: colors.text }}>
                  {popupBatchCount > 1 ? "New Orders Received" : "New Order Received"}
                </Text>
                <Text style={{ color: colors.textSecondary, marginTop: 1 }}>
                  {popupBatchCount > 1
                    ? `${popupBatchCount} new orders just arrived.`
                    : "You have received a new order."}
                </Text>
              </View>
            </View>

            <View
              style={{
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.background,
                padding: 11,
                gap: 4
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: 16 }}>
                {popupBatchCount > 1 ? `Latest: ${incomingOrder?.orderNumber ?? "Order"}` : incomingOrder?.orderNumber ?? "Order"}
              </Text>
              <Text style={{ color: "#475569" }}>
                Amount: ₹ {Number(incomingOrder?.totalAmount ?? 0).toFixed(2)}
              </Text>
              <Text style={{ color: "#475569" }}>
                Items: {incomingOrder?.items.length ?? 0} · {incomingOrder?.paymentMethod ?? "CASH"}
              </Text>
              {incomingOrder?.serviceLane === "TEACHER_PRIORITY" ? (
                <Text style={{ color: "#1E40AF", fontWeight: "800" }}>
                  Teacher Priority Lane{incomingOrder.laneToken ? ` · ${incomingOrder.laneToken}` : ""}
                </Text>
              ) : null}
              {incomingOrder?.isPreOrder && incomingOrder?.pickupSlotLabel ? (
                <Text style={{ color: "#166534", fontWeight: "700" }}>
                  Pickup Slot: {incomingOrder.pickupSlotLabel}
                </Text>
              ) : null}
              {popupBatchCount > 1 ? (
                <Text style={{ color: colors.text, fontWeight: "700" }}>
                  New orders in this alert: {popupBatchCount}
                </Text>
              ) : null}
            </View>

            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={dismissOrderPopup}
                style={{
                  flex: 1,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: "#CBD5E1",
                  backgroundColor: colors.background,
                  paddingVertical: 11,
                  alignItems: "center"
                }}
              >
                <Text style={{ color: "#334155", fontWeight: "800" }}>Dismiss</Text>
              </Pressable>
              <Pressable
                onPress={viewIncomingOrder}
                style={{
                  flex: 1,
                  borderRadius: 12,
                  backgroundColor: "#FF6B35",
                  paddingVertical: 11,
                  alignItems: "center"
                }}
              >
                <Text style={{ color: "white", fontWeight: "800" }}>View Order</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
