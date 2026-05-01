import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useAuth } from "../../../hooks/useAuth";

type ActionCard = {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  path: string;
  tint: string;
};

const managementCards: ActionCard[] = [
  {
    title: "Menu Management",
    subtitle: "Categories and items",
    icon: "restaurant-outline",
    path: "/(admin)/profile/menu-manage",
    tint: "#ECFDF5"
  },
  {
    title: "Stock",
    subtitle: "Inventory updates",
    icon: "cube-outline",
    path: "/(admin)/profile/stock",
    tint: "#FEF3C7"
  },
  {
    title: "Users",
    subtitle: "Teachers and staff",
    icon: "people-outline",
    path: "/(admin)/profile/users",
    tint: "#EEF2FF"
  },
  {
    title: "Reports",
    subtitle: "Daily and monthly sales",
    icon: "bar-chart-outline",
    path: "/(admin)/profile/reports",
    tint: "#ECFEFF"
  },
  {
    title: "Invoice Settings",
    subtitle: "Receipt controls and logo",
    icon: "document-text-outline",
    path: "/(admin)/profile/invoice-settings",
    tint: "#F5F3FF"
  },
  {
    title: "Data Backup",
    subtitle: "Backup and restore",
    icon: "cloud-upload-outline",
    path: "/(admin)/profile/backups",
    tint: "#E0F2FE"
  },
  {
    title: "Banners",
    subtitle: "Promo banner uploads",
    icon: "images-outline",
    path: "/(admin)/profile/banners",
    tint: "#DBEAFE"
  }
];

const dailyCards: ActionCard[] = [
  {
    title: "Open POS",
    subtitle: "Create counter order",
    icon: "storefront-outline",
    path: "/(admin)/pos",
    tint: "#FFF1EC"
  },
  {
    title: "Open Orders",
    subtitle: "Track active orders",
    icon: "receipt-outline",
    path: "/(admin)/orders",
    tint: "#F1F5F9"
  }
];

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

export default function Screen() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const onLogout = async () => {
    try {
      await logout();
      router.replace("/(auth)/login");
    } catch (error) {
      Alert.alert("Logout failed", error instanceof Error ? error.message : "Please try again");
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#F8FAFC" }} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 22 }}>
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 28, fontWeight: "800", color: "#0F172A" }}>Admin Profile</Text>
        <Text style={{ color: "#64748B" }}>Control your canteen settings and management tools.</Text>
      </View>

      <View style={{ ...cardShadow, padding: 14, gap: 10, overflow: "hidden" }}>
        <View
          style={{
            position: "absolute",
            right: -28,
            top: -20,
            width: 120,
            height: 120,
            borderRadius: 999,
            backgroundColor: "rgba(59,130,246,0.12)"
          }}
        />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ width: 50, height: 50, borderRadius: 14, backgroundColor: "#0F172A", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="person-outline" size={24} color="white" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#0F172A", fontWeight: "800", fontSize: 19 }}>{user?.name ?? "Admin"}</Text>
            <Text style={{ color: "#64748B", marginTop: 1 }}>Role: {user?.role ?? "Unknown"}</Text>
            <Text style={{ color: "#64748B", marginTop: 1 }}>Tenant: {user?.tenantId ?? "-"}</Text>
          </View>
        </View>
      </View>

      <View style={{ gap: 9 }}>
        <Text style={{ fontSize: 18, fontWeight: "800", color: "#0F172A" }}>Management</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 10 }}>
          {managementCards.map((card) => (
            <Pressable
              key={card.path}
              onPress={() => router.push(card.path as never)}
              style={{
                width: "48%",
                ...cardShadow,
                borderColor: "#E2E8F0",
                backgroundColor: card.tint,
                padding: 12,
                gap: 8
              }}
            >
              <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: "white", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name={card.icon} size={18} color="#0F172A" />
              </View>
              <Text style={{ color: "#0F172A", fontWeight: "800", fontSize: 14 }}>{card.title}</Text>
              <Text style={{ color: "#475569", fontSize: 12 }}>{card.subtitle}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={{ gap: 9 }}>
        <Text style={{ fontSize: 18, fontWeight: "800", color: "#0F172A" }}>Daily Actions</Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {dailyCards.map((card) => (
            <Pressable
              key={card.path}
              onPress={() => router.push(card.path as never)}
              style={{
                flex: 1,
                ...cardShadow,
                backgroundColor: card.tint,
                padding: 12,
                gap: 8
              }}
            >
              <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: "white", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name={card.icon} size={18} color="#0F172A" />
              </View>
              <Text style={{ color: "#0F172A", fontWeight: "800", fontSize: 14 }}>{card.title}</Text>
              <Text style={{ color: "#475569", fontSize: 12 }}>{card.subtitle}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Pressable
        onPress={onLogout}
        style={{
          borderRadius: 12,
          paddingVertical: 12,
          backgroundColor: "#B91C1C",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 8
        }}
      >
        <Ionicons name="log-out-outline" size={18} color="white" />
        <Text style={{ color: "white", fontWeight: "800" }}>Logout</Text>
      </Pressable>
    </ScrollView>
  );
}
