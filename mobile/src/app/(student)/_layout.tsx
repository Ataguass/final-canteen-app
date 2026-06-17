import { useTheme } from '../../hooks/useTheme';
import { Ionicons } from "@expo/vector-icons";
import { Tabs, usePathname, useRouter } from "expo-router";
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
  View,
  DeviceEventEmitter
} from "react-native";
import { useAuth } from "../../hooks/useAuth";
import { useCart } from "../../hooks/useCart";

type DrawerItem = {
  label: string;
  path: string;
  icon: keyof typeof Ionicons.glyphMap;
};

type DrawerSection = {
  title: string;
  items: DrawerItem[];
};

const drawerSections: DrawerSection[] = [
  {
    title: "MAIN",
    items: [
      { label: "Dashboard", path: "/(student)/dashboard", icon: "home-outline" },
      { label: "Search Menu", path: "/(student)/search", icon: "search-outline" },
      { label: "Orders", path: "/(student)/orders", icon: "receipt-outline" },
      { label: "Cart", path: "/cart", icon: "cart-outline" }
    ]
  },
  {
    title: "SOCIAL",
    items: [
      { label: "Community", path: "/(student)/community", icon: "chatbubbles-outline" }
    ]
  },
  {
    title: "ACCOUNT",
    items: [
      { label: "Profile", path: "/(student)/profile", icon: "person-outline" },
      { label: "Support", path: "/(student)/support", icon: "help-circle-outline" }
    ]
  }
];

const windowWidth = Dimensions.get("window").width;
const drawerWidth = Math.min(380, Math.round(windowWidth * 0.8));

const isPathActive = (pathname: string, targetPath: string): boolean => {
  const normalizedTarget = targetPath.replace("/(student)", "");
  const normalizedPath = pathname.replace("/(student)", "");
  return normalizedPath === normalizedTarget || normalizedPath.startsWith(`${normalizedTarget}/`);
};

const normalizePathname = (pathname: string): string => pathname.replace(/\/\([^)]+\)/g, "");

const getRoleAppTitle = (role?: string): string => {
  if (role === "TEACHER") return "Teacher App";
  if (role === "STAFF") return "Staff App";
  if (role === "GUEST") return "Guest App";
  return "Student App";
};

const getHeaderTitle = (pathname: string, role?: string): string => {
  const normalizedPath = normalizePathname(pathname);

  if (normalizedPath.startsWith("/dashboard")) return "Dashboard";
  if (normalizedPath.startsWith("/menu")) return "Menu";
  if (normalizedPath.startsWith("/search")) return "Search";
  if (normalizedPath.startsWith("/orders")) return "Orders";
  if (normalizedPath.startsWith("/community")) return "Community";
  if (normalizedPath.startsWith("/profile")) return "Profile";
  if (normalizedPath.startsWith("/cart/checkout")) return "Checkout";
  if (normalizedPath.startsWith("/cart")) return "Cart";
  if (normalizedPath.startsWith("/menu/item/")) return "Item Details";
  if (normalizedPath.startsWith("/menu/")) return "Category";
  return getRoleAppTitle(role);
};

export default function StudentLayout() {
  const { colors, isDark, toggleTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { itemCount } = useCart();

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [profileMenuVisible, setProfileMenuVisible] = useState(false);
  const drawerAnim = useRef(new Animated.Value(0)).current;

  const headerTitle = useMemo(() => getHeaderTitle(pathname, user?.role), [pathname, user?.role]);
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

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("openStudentDrawer", openDrawer);
    return () => sub.remove();
  }, [openDrawer]);

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
        backBehavior="history"
        screenOptions={{
          headerShown: false,
          headerStyle: { backgroundColor: colors.background },
          headerShadowVisible: true,
          headerTitleStyle: { color: colors.text, fontWeight: "800", fontSize: 20 },
          headerTitle: headerTitle,
          tabBarActiveTintColor: "#FF6B35",
          tabBarInactiveTintColor: "#6B7280",
          headerLeft: () => (
            <Pressable
              onPress={openDrawer}
              android_ripple={{ color: colors.border, borderless: true }}
              style={{
                marginLeft: 10,
                width: 40,
                height: 40,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Ionicons name="menu-outline" size={22} color={colors.text} />
            </Pressable>
          ),
          headerRight: () => (
            <View style={{ marginRight: 10, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Pressable
                onPress={() => router.push("/(student)/search")}
                android_ripple={{ color: colors.border, borderless: true }}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <Ionicons name="search-outline" size={20} color={colors.text} />
              </Pressable>

              <Pressable
                onPress={() => router.push("/cart")}
                android_ripple={{ color: colors.border, borderless: true }}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <Ionicons name="cart-outline" size={20} color={colors.text} />
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
                android_ripple={{ color: colors.border, borderless: true }}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: colors.text,
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
            headerShown: false,
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
        <Tabs.Screen name="settings" options={{ href: null, headerShown: false }} />
        <Tabs.Screen name="support" options={{ href: null, headerShown: false }} />
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
              borderColor: colors.border,
              backgroundColor: colors.card,
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
              <Ionicons name="person-outline" size={16} color={colors.text} />
              <Text style={{ color: colors.text, fontWeight: "700" }}>My Profile</Text>
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
              <Ionicons name="receipt-outline" size={16} color={colors.text} />
              <Text style={{ color: colors.text, fontWeight: "700" }}>My Orders</Text>
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
                <Text style={{ color: colors.text, fontWeight: "900", fontSize: 20, letterSpacing: -0.5 }}>College Canteen</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "600" }}>Student Portal</Text>
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
                  <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15 }}>{user?.name ?? "Student"}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "500" }}>{user?.email ?? user?.phone ?? "student@canteen"}</Text>
                </View>
              </View>
              <Pressable
                onPress={() => closeDrawer(() => onLogout().catch(() => undefined))}
                android_ripple={{ color: colors.surfaceAlt }}
                style={{
                  borderRadius: 12,
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingVertical: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8
                }}
              >
                <Ionicons name="log-out-outline" size={20} color="#EF4444" />
                <Text style={{ color: "#EF4444", fontWeight: "700", fontSize: 14 }}>Log Out</Text>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}
