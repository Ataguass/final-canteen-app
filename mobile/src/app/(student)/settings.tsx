import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [notifications, setNotifications] = useState(true);

  return (
    <View style={[styles.screen, { paddingTop: insets.top > 0 ? insets.top + 10 : 48 }]}>
      <View style={styles.topNav}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#0F172A" />
        </Pressable>
        <Text style={styles.topNavTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <View style={styles.card}>

            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconWrap, { backgroundColor: "#FFF7ED" }]}>
                  <Ionicons name="notifications" size={20} color="#EA580C" />
                </View>
                <View>
                  <Text style={styles.rowTitle}>Push Notifications</Text>
                  <Text style={styles.rowSubtitle}>Order status & updates</Text>
                </View>
              </View>
              <Switch
                value={notifications}
                onValueChange={setNotifications}
                trackColor={{ false: "#E2E8F0", true: "#FF6B35" }}
                thumbColor={"#FFFFFF"}
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.card}>
            <Pressable style={styles.actionRow} android_ripple={{ color: "#F1F5F9" }}>
              <Text style={styles.actionText}>Edit Profile</Text>
              <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
            </Pressable>
            <View style={styles.divider} />
            <Pressable style={styles.actionRow} android_ripple={{ color: "#F1F5F9" }}>
              <Text style={styles.actionText}>Change Password</Text>
              <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Danger Zone</Text>
          <View style={[styles.card, { borderColor: "#FECACA" }]}>
            <Pressable style={styles.actionRow} android_ripple={{ color: "#FEF2F2" }}>
              <Text style={styles.dangerText}>Delete Account</Text>
              <Ionicons name="trash-outline" size={20} color="#DC2626" />
            </Pressable>
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC"
  },
  topNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  topNavTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0F172A"
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 24
  },
  section: {
    gap: 12
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginLeft: 4
  },
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
    overflow: "hidden"
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A"
  },
  rowSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2
  },
  divider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginLeft: 64
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16
  },
  actionText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A"
  },
  dangerText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#DC2626"
  }
});
