import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useAuthStore } from '../../../stores/useAuthStore';
import { userService } from "../../../services/userService";
import { moderateScale, fontScale, verticalScale, scale, isTablet, gridColumns } from '../../../utils/responsive';

import { useTheme } from "../../../hooks/useTheme";

type ActionCard = {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  path: string;
  color: string;
  bg: string;
};

const managementCards: ActionCard[] = [
  {
    title: "Menu Management",
    subtitle: "Categories and items",
    icon: "restaurant-outline",
    path: "/(admin)/profile/menu-manage",
    color: "#059669",
    bg: "#ECFDF5"
  },
  {
    title: "Stock",
    subtitle: "Inventory updates",
    icon: "cube-outline",
    path: "/(admin)/profile/stock",
    color: "#D97706",
    bg: "#FEF3C7"
  },
  {
    title: "Users",
    subtitle: "Teachers and staff",
    icon: "people-outline",
    path: "/(admin)/profile/users",
    color: "#4F46E5",
    bg: "#EEF2FF"
  },
  {
    title: "Reports",
    subtitle: "Daily & monthly sales",
    icon: "bar-chart-outline",
    path: "/(admin)/profile/reports",
    color: "#0891B2",
    bg: "#ECFEFF"
  },
  {
    title: "Invoice Settings",
    subtitle: "Receipt controls",
    icon: "document-text-outline",
    path: "/(admin)/profile/invoice-settings",
    color: "#7C3AED",
    bg: "#F5F3FF"
  },
  {
    title: "Data Backup",
    subtitle: "Backup and restore",
    icon: "cloud-upload-outline",
    path: "/(admin)/profile/backups",
    color: "#0284C7",
    bg: "#E0F2FE"
  },
  {
    title: "Banners",
    subtitle: "Promo banner uploads",
    icon: "images-outline",
    path: "/(admin)/profile/banners",
    color: "#2563EB",
    bg: "#DBEAFE"
  }
];

const dailyCards: ActionCard[] = [
  {
    title: "Open POS",
    subtitle: "Create counter order",
    icon: "storefront-outline",
    path: "/(admin)/pos",
    color: "#EA580C",
    bg: "#FFF7ED"
  },
  {
    title: "Live Orders",
    subtitle: "Track active orders",
    icon: "receipt-outline",
    path: "/(admin)/orders",
    color: "#0F172A",
    bg: "#F1F5F9"
  }
];

const legalItems = [
  { title: "Change Password", icon: "lock-closed-outline", color: "#9333EA", bg: "#F3E8FF" },
  { title: "Help & Support", icon: "help-buoy-outline", color: "#2563EB", bg: "#DBEAFE" },
  { title: "Privacy Policy", icon: "shield-checkmark-outline", color: "#059669", bg: "#D1FAE5" },
  { title: "Terms of Service", icon: "document-text-outline", color: "#475569", bg: "#F1F5F9" }
] as const;

export default function Screen() {
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors);
  const router = useRouter();
  const { user, accessToken, logout, setSessionUser } = useAuthStore();
  
  // Change Password State
  const [modalVisible, setModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changing, setChanging] = useState(false);

  // Edit Profile State
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState(user?.name ?? "");
  const [editPhone, setEditPhone] = useState(user?.phone ?? "");
  const [editEmail, setEditEmail] = useState(user?.email ?? "");
  const [savingProfile, setSavingProfile] = useState(false);

  const handleUpdateProfile = async () => {
    if (!editName || !editPhone) {
      Alert.alert("Error", "Name and phone are required");
      return;
    }
    if (!accessToken || !user?.tenantId) return;

    try {
      setSavingProfile(true);
      const res = await userService.updateMe(accessToken, user.tenantId, {
        name: editName,
        phone: editPhone,
        email: editEmail
      });
      await setSessionUser(res.data);
      setEditModalVisible(false);
    } catch (error) {
      Alert.alert("Failed", error instanceof Error ? error.message : "Could not update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      Alert.alert("Error", "Please fill all fields");
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert("Error", "New password must be at least 6 characters");
      return;
    }
    if (!user?.tenantId || !accessToken) return;

    try {
      setChanging(true);
      await userService.changeMyPassword(accessToken, user.tenantId, { currentPassword, newPassword });
      Alert.alert("Success", "Your password has been changed successfully.");
      setModalVisible(false);
      setCurrentPassword("");
      setNewPassword("");
    } catch (error) {
      Alert.alert("Failed", error instanceof Error ? error.message : "Could not change password");
    } finally {
      setChanging(false);
    }
  };

  const onLogout = async () => {
    try {
      await logout();
    } catch (error) {
      Alert.alert("Logout failed", error instanceof Error ? error.message : "Please try again");
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      
      {/* Hero Avatar Card */}
      <View style={styles.heroCard}>
        <View style={styles.heroDecoCircle} />
        
        <Pressable 
          onPress={() => {
            setEditName(user?.name ?? "");
            setEditPhone(user?.phone ?? "");
            setEditEmail(user?.email ?? "");
            setEditModalVisible(true);
          }}
          style={{ position: "absolute", top: 16, right: 16, zIndex: 10, padding: moderateScale(4) }}
        >
          <Ionicons name="pencil-outline" size={20} color="#64748B" />
        </Pressable>

        <View style={styles.heroAvatarWrap}>
          <Text style={styles.heroAvatarText}>{(user?.name?.charAt(0) ?? "A").toUpperCase()}</Text>
        </View>
        <View style={styles.heroTextWrap}>
          <Text style={styles.heroName}>{user?.name ?? "Admin"}</Text>
          <Text style={styles.heroRole}>{user?.role ?? "Admin Role"}</Text>
          
          <View style={{ flexDirection: "row", alignItems: "center", gap: moderateScale(6), marginTop: verticalScale(4) }}>
             <Ionicons name="call-outline" size={14} color="#64748B" />
             <Text style={{ fontSize: fontScale(13), color: "#64748B", fontWeight: "500" }}>{user?.phone || "No phone added"}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: moderateScale(6), marginTop: verticalScale(2) }}>
             <Ionicons name="mail-outline" size={14} color="#64748B" />
             <Text style={{ fontSize: fontScale(13), color: "#64748B", fontWeight: "500" }}>{user?.email || "No email added"}</Text>
          </View>

          <View style={styles.tenantPill}>
            <Text style={styles.tenantPillText}>Tenant: {user?.tenantId ?? "-"}</Text>
          </View>
        </View>
      </View>

      {/* Daily Actions */}
      <View style={styles.sectionWrap}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.listWrap}>
          {dailyCards.map((card, index) => (
            <Pressable
              key={card.path}
              style={({ pressed }) => [
                styles.listItem,
                index !== dailyCards.length - 1 && styles.listItemBorder,
                pressed && { backgroundColor: isDark ? colors.surfaceAlt : "#F1F5F9" }
              ]}
              onPress={() => router.push(card.path as never)}
            >
              <View style={[styles.iconWrapSmall, { backgroundColor: card.bg }]}>
                <Ionicons name={card.icon} size={18} color={card.color} />
              </View>
              <View style={styles.listItemTextWrap}>
                <Text style={styles.listItemTitle}>{card.title}</Text>
                <Text style={styles.listItemSubtitle}>{card.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </Pressable>
          ))}
        </View>
      </View>

      {/* Super Admin Area */}
      {user?.role === "SUPER_ADMIN" && (
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>Super Admin</Text>
          <View style={styles.listWrap}>
            <Pressable
              style={({ pressed }) => [
                styles.listItem,
                pressed && { backgroundColor: isDark ? colors.surfaceAlt : "#F1F5F9" }
              ]}
              onPress={() => router.push("/(admin)/profile/schools" as never)}
            >
              <View style={[styles.iconWrapSmall, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : "#EFF6FF" }]}>
                <Ionicons name="business-outline" size={18} color={isDark ? '#60A5FA' : "#2563EB"} />
              </View>
              <View style={styles.listItemTextWrap}>
                <Text style={styles.listItemTitle}>Manage Schools</Text>
                <Text style={styles.listItemSubtitle}>Add and configure new tenants</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </Pressable>
          </View>
        </View>
      )}

      {/* Management List */}
      <View style={styles.sectionWrap}>
        <Text style={styles.sectionTitle}>Management</Text>
        <View style={styles.listWrap}>
          {managementCards.map((card, index) => (
            <Pressable
              key={card.path}
              style={({ pressed }) => [
                styles.listItem,
                index !== managementCards.length - 1 && styles.listItemBorder,
                pressed && { backgroundColor: "#F1F5F9" }
              ]}
              onPress={() => router.push(card.path as never)}
            >
              <View style={[styles.iconWrapSmall, { backgroundColor: card.bg }]}>
                <Ionicons name={card.icon} size={18} color={card.color} />
              </View>
              <View style={styles.listItemTextWrap}>
                <Text style={styles.listItemTitle}>{card.title}</Text>
                <Text style={styles.listItemSubtitle}>{card.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </Pressable>
          ))}
        </View>
      </View>

      {/* Legal & Support List */}
      <View style={styles.sectionWrap}>
        <Text style={styles.sectionTitle}>Legal & Support</Text>
        <View style={styles.listWrap}>
          {legalItems.map((item, index) => (
            <Pressable
              key={item.title}
              style={({ pressed }) => [
                styles.listItem,
                index !== legalItems.length - 1 && styles.listItemBorder,
                pressed && { backgroundColor: "#F1F5F9" }
              ]}
              onPress={() => {
                if (item.title === "Change Password") {
                  setModalVisible(true);
                } else {
                  Alert.alert(item.title, "This page will be available in production.");
                }
              }}
            >
              <View style={[styles.iconWrapSmall, { backgroundColor: item.bg }]}>
                <Ionicons name={item.icon as any} size={18} color={item.color} />
              </View>
              <View style={styles.listItemTextWrap}>
                <Text style={styles.listItemTitle}>{item.title}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </Pressable>
          ))}
        </View>
      </View>

      {/* Logout Button */}
      <Pressable
        onPress={onLogout}
        style={({ pressed }) => [
          styles.logoutButton,
          pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }
        ]}
      >
        <Ionicons name="log-out-outline" size={20} color="white" />
        <Text style={styles.logoutText}>Sign Out</Text>
      </Pressable>

      <Text style={styles.appVersion}>Collage Canteen v1.0.0 (Build 24)</Text>

      {/* Change Password Modal */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Password</Text>
              <Pressable onPress={() => setModalVisible(false)} style={{ padding: moderateScale(4) }}>
                <Ionicons name="close" size={24} color="#64748B" />
              </Pressable>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Current Password</Text>
              <TextInput
                style={styles.textInput}
                secureTextEntry
                placeholder="Enter current password"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholderTextColor="#94A3B8"
              />
              <Text style={styles.inputLabel}>New Password</Text>
              <TextInput
                style={styles.textInput}
                secureTextEntry
                placeholder="Enter new password (min 6 chars)"
                value={newPassword}
                onChangeText={setNewPassword}
                placeholderTextColor="#94A3B8"
              />
            </View>
            <Pressable
              onPress={handleChangePassword}
              disabled={changing}
              style={({ pressed }) => [
                styles.submitBtn,
                pressed && { opacity: 0.8 },
                changing && { opacity: 0.6 }
              ]}
            >
              {changing ? <ActivityIndicator color="white" /> : <Text style={styles.submitBtnText}>Update Password</Text>}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal visible={editModalVisible} transparent animationType="fade" onRequestClose={() => setEditModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <Pressable onPress={() => setEditModalVisible(false)} style={{ padding: moderateScale(4) }}>
                <Ionicons name="close" size={24} color="#64748B" />
              </Pressable>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter full name"
                value={editName}
                onChangeText={setEditName}
                placeholderTextColor="#94A3B8"
              />
              <Text style={styles.inputLabel}>Phone Number</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter phone number"
                keyboardType="phone-pad"
                value={editPhone}
                onChangeText={setEditPhone}
                placeholderTextColor="#94A3B8"
              />
              <Text style={styles.inputLabel}>Email Address</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter email address (optional)"
                keyboardType="email-address"
                autoCapitalize="none"
                value={editEmail}
                onChangeText={setEditEmail}
                placeholderTextColor="#94A3B8"
              />
            </View>
            <Pressable
              onPress={handleUpdateProfile}
              disabled={savingProfile}
              style={({ pressed }) => [
                styles.submitBtn,
                pressed && { opacity: 0.8 },
                savingProfile && { opacity: 0.6 }
              ]}
            >
              {savingProfile ? <ActivityIndicator color="white" /> : <Text style={styles.submitBtnText}>Save Changes</Text>}
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    padding: moderateScale(16),
    gap: moderateScale(24),
    paddingBottom: verticalScale(40)
  },
  heroCard: {
    backgroundColor: colors.card,
    borderRadius: moderateScale(24),
    padding: moderateScale(20),
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(16),
    overflow: "hidden",
    shadowColor: colors.text,
    shadowOpacity: 0.04,
    shadowRadius: moderateScale(10),
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  heroDecoCircle: {
    position: "absolute",
    right: moderateScale(-40),
    top: verticalScale(-40),
    width: moderateScale(140),
    height: moderateScale(140),
    borderRadius: moderateScale(70),
    backgroundColor: "rgba(37, 99, 235, 0.04)"
  },
  heroAvatarWrap: {
    width: moderateScale(64),
    height: moderateScale(64),
    borderRadius: moderateScale(20),
    backgroundColor: "#1D4ED8",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1D4ED8",
    shadowOpacity: 0.3,
    shadowRadius: moderateScale(8),
    shadowOffset: { width: 0, height: 4 },
    elevation: 4
  },
  heroAvatarText: {
    color: "white",
    fontSize: fontScale(28),
    fontWeight: "900"
  },
  heroTextWrap: {
    flex: 1,
    gap: moderateScale(4)
  },
  heroName: {
    fontSize: fontScale(22),
    fontWeight: "900",
    color: colors.text
  },
  heroRole: {
    fontSize: fontScale(14),
    fontWeight: "600",
    color: colors.textSecondary
  },
  tenantPill: {
    backgroundColor: colors.surfaceAlt,
    alignSelf: "flex-start",
    paddingHorizontal: moderateScale(8),
    paddingVertical: moderateScale(4),
    borderRadius: moderateScale(6),
    marginTop: verticalScale(2)
  },
  tenantPillText: {
    fontSize: fontScale(11),
    fontWeight: "700",
    color: colors.textSecondary
  },
  sectionWrap: {
    gap: moderateScale(12)
  },
  sectionTitle: {
    fontSize: fontScale(18),
    fontWeight: "900",
    color: colors.text,
    marginLeft: moderateScale(4)
  },
  logoutButton: {
    backgroundColor: "#DC2626",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: moderateScale(10),
    borderRadius: moderateScale(20),
    paddingVertical: moderateScale(18),
    marginTop: verticalScale(10),
    shadowColor: "#DC2626",
    shadowOpacity: 0.25,
    shadowRadius: moderateScale(10),
    shadowOffset: { width: 0, height: 4 },
    elevation: 4
  },
  logoutText: {
    color: "white",
    fontSize: fontScale(16),
    fontWeight: "900",
    letterSpacing: 0.5
  },
  listWrap: {
    backgroundColor: colors.card,
    borderRadius: moderateScale(20),
    overflow: "hidden",
    shadowColor: colors.text,
    shadowOpacity: 0.03,
    shadowRadius: moderateScale(8),
    shadowOffset: { width: 0, height: 4 },
    elevation: 1
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: moderateScale(16),
    gap: moderateScale(14)
  },
  listItemBorder: {
    borderBottomWidth: 1,
    borderColor: colors.border
  },
  iconWrapSmall: {
    width: moderateScale(36),
    height: moderateScale(36),
    borderRadius: moderateScale(10),
    alignItems: "center",
    justifyContent: "center"
  },
  listItemTextWrap: {
    flex: 1,
    gap: moderateScale(2)
  },
  listItemTitle: {
    fontSize: fontScale(15),
    fontWeight: "800",
    color: colors.text
  },
  listItemSubtitle: {
    fontSize: fontScale(12),
    fontWeight: "500",
    color: colors.textSecondary
  },
  appVersion: {
    textAlign: "center",
    color: "#94A3B8",
    fontSize: fontScale(12),
    fontWeight: "600",
    marginTop: verticalScale(4)
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: "center",
    padding: moderateScale(20)
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: moderateScale(24),
    padding: moderateScale(24),
    gap: moderateScale(20),
    shadowColor: colors.text,
    shadowOpacity: 0.1,
    shadowRadius: moderateScale(20),
    shadowOffset: { width: 0, height: 10 },
    elevation: 10
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  modalTitle: {
    fontSize: fontScale(20),
    fontWeight: "900",
    color: colors.text
  },
  modalBody: {
    gap: moderateScale(12)
  },
  inputLabel: {
    fontSize: fontScale(13),
    fontWeight: "700",
    color: colors.textSecondary,
    marginBottom: verticalScale(-4)
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: moderateScale(12),
    padding: moderateScale(14),
    fontSize: fontScale(15),
    color: colors.text,
    backgroundColor: colors.inputBg
  },
  submitBtn: {
    backgroundColor: "#1D4ED8",
    borderRadius: moderateScale(14),
    paddingVertical: moderateScale(16),
    alignItems: "center",
    justifyContent: "center"
  },
  submitBtnText: {
    color: "white",
    fontSize: fontScale(16),
    fontWeight: "800"
  }
});
