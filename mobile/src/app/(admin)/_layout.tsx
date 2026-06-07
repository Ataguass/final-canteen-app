import { Ionicons } from "@expo/vector-icons";
import { Tabs, usePathname, useRouter } from "expo-router";
import { Audio } from "expo-av";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
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

  if (pathname.startsWith("/(admin)/dashboard")) {
    return { title: "Dashboard", subtitle: `Welcome back, ${firstName} · ${dateLabel}` };
  }
  if (pathname.startsWith("/(admin)/pos")) {
    return { title: "POS", subtitle: "Counter billing and checkout" };
  }
  if (pathname.startsWith("/(admin)/orders")) {
    return { title: "Orders", subtitle: "Track and manage live orders" };
  }
  if (pathname.startsWith("/(admin)/community")) {
    return { title: "Community", subtitle: "Announcements and updates" };
  }
  if (pathname.startsWith("/(admin)/profile/menu-manage")) {
    return { title: "Menu Management", subtitle: "Categories and food items" };
  }
  if (pathname.startsWith("/(admin)/profile/stock")) {
    return { title: "Stock", subtitle: "Inventory and low stock control" };
  }
  if (pathname.startsWith("/(admin)/profile/users")) {
    return { title: "Users", subtitle: "Teacher and staff management" };
  }
  if (pathname.startsWith("/(admin)/profile/reports")) {
    return { title: "Reports", subtitle: "Sales analytics and summaries" };
  }
  if (pathname.startsWith("/(admin)/profile/invoice-settings")) {
    return { title: "Invoice Settings", subtitle: "Receipt customization controls" };
  }
  if (pathname.startsWith("/(admin)/profile/backups")) {
    return { title: "Data Backup", subtitle: "Backup and restore tenant data" };
  }
  if (pathname.startsWith("/(admin)/profile/banners")) {
    return { title: "Banners", subtitle: "Home banner media and visibility" };
  }
  return { title: "Dashboard", subtitle: `Welcome back, ${firstName}` };
};

export default function AdminLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();

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
        screenOptions={{
          headerShown: true,
          tabBarActiveTintColor: "#1D4ED8",
          tabBarInactiveTintColor: "#64748B",
          headerStyle: {
            backgroundColor: "#F8FAFC"
          },
          headerShadowVisible: true,
          headerTitle: () => (
            <View style={{ alignItems: "flex-start" }}>
              <Text style={{ color: "#0F172A", fontSize: 20, fontWeight: "800" }}>{headerMeta.title}</Text>
              <Text style={{ color: "#64748B", fontSize: 12, marginTop: 1 }}>{headerMeta.subtitle}</Text>
            </View>
          ),
          headerLeft: () => (
            <Pressable
              onPress={openDrawer}
              android_ripple={{ color: "#E2E8F0", borderless: true }}
              style={{
                marginLeft: 10,
                width: 40,
                height: 40,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: "#E2E8F0",
                backgroundColor: "white",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Ionicons name="menu-outline" size={22} color="#0F172A" />
            </Pressable>
          ),
          headerRight: () => (
            <View style={{ marginRight: 10, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Pressable
                onPress={openOrderNotifications}
                android_ripple={{ color: "#E2E8F0", borderless: true }}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: "#E2E8F0",
                  backgroundColor: "white",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <Ionicons name="notifications-outline" size={20} color="#0F172A" />
                {newOrderCount > 0 ? (
                  <View
                    style={{
                      position: "absolute",
                      top: -4,
                      right: -4,
                      minWidth: 18,
                      height: 18,
                      borderRadius: 999,
                      backgroundColor: "#DC2626",
                      paddingHorizontal: 4,
                      alignItems: "center",
                      justifyContent: "center"
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
                android_ripple={{ color: "#E2E8F0", borderless: true }}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: "#0F172A",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <Text style={{ color: "white", fontWeight: "800", fontSize: 13 }}>{avatarText}</Text>
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
                backgroundColor: "#0F172A",
                opacity: Animated.multiply(backdropOpacity, 0.45)
              }}
            />
          </Pressable>

          <Animated.View
            style={{
              width: drawerWidth,
              height: "100%",
              backgroundColor: "#F8FAFC",
              borderTopRightRadius: 24,
              borderBottomRightRadius: 24,
              overflow: "hidden",
              transform: [{ translateX: drawerTranslateX }],
              shadowColor: "#0F172A",
              shadowOpacity: 0.18,
              shadowRadius: 18,
              shadowOffset: { width: 4, height: 0 },
              elevation: 12
            }}
          >
            <View style={{ paddingHorizontal: 16, paddingTop: 54, paddingBottom: 14, backgroundColor: "#0F172A" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    backgroundColor: "#1E293B",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <Text style={{ color: "white", fontWeight: "800", fontSize: 16 }}>{avatarText}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "white", fontWeight: "800", fontSize: 18 }}>{user?.name ?? "Admin"}</Text>
                  <Text style={{ color: "#CBD5E1", marginTop: 1 }}>{user?.email ?? user?.phone ?? "admin@canteen"}</Text>
                </View>
              </View>
            </View>

            <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: 24, gap: 12 }}>
              {drawerSections.map((section) => (
                <View key={section.title} style={{ gap: 7 }}>
                  <Text style={{ color: "#64748B", fontWeight: "800", fontSize: 11, letterSpacing: 1 }}>
                    {section.title}
                  </Text>

                  {section.items.map((item) => {
                    const active = isPathActive(pathname, item.path);
                    return (
                      <Pressable
                        key={item.path}
                        onPress={() => navigateFromDrawer(item.path)}
                        android_ripple={{ color: "#E2E8F0" }}
                        style={{
                          borderRadius: 12,
                          backgroundColor: active ? "#E0E7FF" : "white",
                          borderWidth: 1,
                          borderColor: active ? "#C7D2FE" : "#E2E8F0",
                          paddingVertical: 11,
                          paddingHorizontal: 12,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 10
                        }}
                      >
                        <View
                          style={{
                            width: 3,
                            height: 24,
                            borderRadius: 999,
                            backgroundColor: active ? "#1D4ED8" : "transparent"
                          }}
                        />
                        <Ionicons name={item.icon} size={18} color={active ? "#1D4ED8" : "#334155"} />
                        <Text style={{ color: active ? "#1E3A8A" : "#0F172A", fontWeight: active ? "800" : "700", fontSize: 14 }}>
                          {item.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
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
              borderColor: "#E2E8F0",
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
                  backgroundColor: "#DBEAFE"
                }}
              >
                <Ionicons name="notifications" size={20} color="#1D4ED8" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 19, fontWeight: "800", color: "#0F172A" }}>
                  {popupBatchCount > 1 ? "New Orders Received" : "New Order Received"}
                </Text>
                <Text style={{ color: "#64748B", marginTop: 1 }}>
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
                borderColor: "#E2E8F0",
                backgroundColor: "#F8FAFC",
                padding: 11,
                gap: 4
              }}
            >
              <Text style={{ color: "#0F172A", fontWeight: "800", fontSize: 16 }}>
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
                <Text style={{ color: "#1D4ED8", fontWeight: "700" }}>
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
                  backgroundColor: "#F8FAFC",
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
                  backgroundColor: "#0F172A",
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
