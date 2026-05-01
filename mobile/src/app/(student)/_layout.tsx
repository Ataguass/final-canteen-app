import { Ionicons } from "@expo/vector-icons";
import { Tabs, usePathname, useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
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
import { useCart } from "../../hooks/useCart";

type DrawerItem = {
  label: string;
  path: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const drawerItems: DrawerItem[] = [
  { label: "Dashboard", path: "/(student)/dashboard", icon: "home-outline" },
  { label: "Search Menu", path: "/(student)/search", icon: "search-outline" },
  { label: "Orders", path: "/(student)/orders", icon: "receipt-outline" },
  { label: "Community", path: "/(student)/community", icon: "chatbubbles-outline" },
  { label: "Profile", path: "/(student)/profile", icon: "person-outline" },
  { label: "Cart", path: "/cart", icon: "cart-outline" }
];

const windowWidth = Dimensions.get("window").width;
const drawerWidth = Math.min(350, Math.round(windowWidth * 0.8));

const isPathActive = (pathname: string, targetPath: string): boolean => {
  const normalizedTarget = targetPath.replace("/(student)", "");
  const normalizedPath = pathname.replace("/(student)", "");
  return normalizedPath === normalizedTarget || normalizedPath.startsWith(`${normalizedTarget}/`);
};

const getHeaderTitle = (pathname: string): string => {
  if (pathname.startsWith("/(student)/dashboard")) return "Dashboard";
  if (pathname.startsWith("/(student)/menu")) return "Menu";
  if (pathname.startsWith("/(student)/search")) return "Search";
  if (pathname.startsWith("/(student)/orders")) return "Orders";
  if (pathname.startsWith("/(student)/community")) return "Community";
  if (pathname.startsWith("/(student)/profile")) return "Profile";
  if (pathname.startsWith("/cart/checkout")) return "Checkout";
  if (pathname.startsWith("/cart")) return "Cart";
  if (pathname.startsWith("/menu/item/")) return "Item Details";
  if (pathname.startsWith("/menu/")) return "Category";
  return "Student App";
};

export default function StudentLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { itemCount } = useCart();

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [profileMenuVisible, setProfileMenuVisible] = useState(false);
  const drawerAnim = useRef(new Animated.Value(0)).current;

  const headerTitle = useMemo(() => getHeaderTitle(pathname), [pathname]);
  const avatarText = useMemo(
    () => (user?.name?.charAt(0) ?? "S").toUpperCase(),
    [user?.name]
  );

  const openDrawer = useCallback(() => {
    setProfileMenuVisible(false);
    setDrawerVisible(true);
    Animated.timing(drawerAnim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [drawerAnim]);

  const closeDrawer = useCallback(
    (afterClose?: () => void) => {
      Animated.timing(drawerAnim, {
        toValue: 0,
        duration: 170,
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

  const onLogout = useCallback(async () => {
    setProfileMenuVisible(false);
    try {
      await logout();
      router.replace("/(auth)/login");
    } catch (error) {
      Alert.alert("Logout failed", error instanceof Error ? error.message : "Please try again.");
    }
  }, [logout, router]);

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
          headerStyle: { backgroundColor: "#F8FAFC" },
          headerShadowVisible: true,
          headerTitleStyle: { color: "#0F172A", fontWeight: "800", fontSize: 20 },
          headerTitle: headerTitle,
          tabBarActiveTintColor: "#1D4ED8",
          tabBarInactiveTintColor: "#6B7280",
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
                onPress={() => router.push("/(student)/search")}
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
                <Ionicons name="search-outline" size={20} color="#0F172A" />
              </Pressable>

              <Pressable
                onPress={() => router.push("/cart")}
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
                <Ionicons name="cart-outline" size={20} color="#0F172A" />
                {itemCount > 0 ? (
                  <View
                    style={{
                      position: "absolute",
                      top: -4,
                      right: -4,
                      minWidth: 18,
                      height: 18,
                      borderRadius: 999,
                      paddingHorizontal: 4,
                      backgroundColor: "#F97316",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    <Text style={{ color: "white", fontSize: 10, fontWeight: "800" }}>
                      {itemCount > 9 ? "9+" : String(itemCount)}
                    </Text>
                  </View>
                ) : null}
              </Pressable>

              <Pressable
                onPress={() => setProfileMenuVisible((prev) => !prev)}
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
          name="menu/index"
          options={{
            title: "Menu",
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? "restaurant" : "restaurant-outline"} size={size} color={color} />
            )
          }}
        />
        <Tabs.Screen name="menu/[categoryId]" options={{ href: null }} />
        <Tabs.Screen name="search" options={{ href: null, headerShown: false }} />
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
          name="community"
          options={{
            title: "Community",
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? "people" : "people-outline"} size={size} color={color} />
            )
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? "person" : "person-outline"} size={size} color={color} />
            )
          }}
        />
        <Tabs.Screen name="orders/[id]" options={{ href: null }} />
      </Tabs>

      <Modal
        visible={profileMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setProfileMenuVisible(false)}
      >
        <Pressable
          onPress={() => setProfileMenuVisible(false)}
          style={{
            flex: 1,
            backgroundColor: "rgba(15,23,42,0.28)",
            justifyContent: "flex-start",
            alignItems: "flex-end",
            paddingTop: 86,
            paddingRight: 12
          }}
        >
          <View
            style={{
              width: 210,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "#E2E8F0",
              backgroundColor: "white",
              padding: 8,
              gap: 4
            }}
          >
            <Pressable
              onPress={() => {
                setProfileMenuVisible(false);
                router.push("/(student)/profile");
              }}
              style={{
                borderRadius: 8,
                paddingHorizontal: 10,
                paddingVertical: 10,
                flexDirection: "row",
                alignItems: "center",
                gap: 8
              }}
            >
              <Ionicons name="person-outline" size={16} color="#0F172A" />
              <Text style={{ color: "#0F172A", fontWeight: "700" }}>My Profile</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setProfileMenuVisible(false);
                router.push("/(student)/orders");
              }}
              style={{
                borderRadius: 8,
                paddingHorizontal: 10,
                paddingVertical: 10,
                flexDirection: "row",
                alignItems: "center",
                gap: 8
              }}
            >
              <Ionicons name="receipt-outline" size={16} color="#0F172A" />
              <Text style={{ color: "#0F172A", fontWeight: "700" }}>My Orders</Text>
            </Pressable>
            <Pressable
              onPress={onLogout}
              style={{
                borderRadius: 8,
                paddingHorizontal: 10,
                paddingVertical: 10,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                backgroundColor: "#FEF2F2"
              }}
            >
              <Ionicons name="log-out-outline" size={16} color="#B91C1C" />
              <Text style={{ color: "#B91C1C", fontWeight: "800" }}>Logout</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

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
                  <Text style={{ color: "white", fontWeight: "800", fontSize: 18 }}>{user?.name ?? "Student"}</Text>
                  <Text style={{ color: "#CBD5E1", marginTop: 1 }}>{user?.phone ?? user?.email ?? "student"}</Text>
                </View>
              </View>
            </View>

            <View style={{ flex: 1 }}>
              <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: 24, gap: 8 }}>
                {drawerItems.map((item) => {
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
              </ScrollView>

              <View
                style={{
                  borderTopWidth: 1,
                  borderTopColor: "#E2E8F0",
                  paddingHorizontal: 12,
                  paddingTop: 10,
                  paddingBottom: 14,
                  backgroundColor: "#F8FAFC"
                }}
              >
                <Pressable
                  onPress={() => closeDrawer(() => onLogout().catch(() => undefined))}
                  android_ripple={{ color: "#FECACA" }}
                  style={{
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: "#FECACA",
                    backgroundColor: "#FEF2F2",
                    paddingVertical: 11,
                    paddingHorizontal: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8
                  }}
                >
                  <Ionicons name="log-out-outline" size={18} color="#B91C1C" />
                  <Text style={{ color: "#B91C1C", fontWeight: "800", fontSize: 14 }}>Logout</Text>
                </Pressable>
              </View>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}
