import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Switch
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from '../../stores/useAuthStore';
import { CanteenHeader } from "../../components/CanteenHeader";
import { Card } from "../../components/ui/Card";
import { Avatar } from "../../components/ui/Avatar";
import { InputField } from "../../components/ui/InputField";
import { Button } from "../../components/ui/Button";
import { Order } from "../../types";
import {  orderService } from "../../services/orderService";
import { MyProfile } from "../../types";
import {  userService } from "../../services/userService";
import { WalletTransaction } from "../../types";
import {  walletService } from "../../services/walletService";
import { moderateScale, fontScale, verticalScale, scale, isTablet, gridColumns } from '../../utils/responsive';
import { useTheme } from '../../hooks/useTheme';

const activeStatuses = new Set(["PENDING", "ACCEPTED", "PREPARING", "READY"]);
const formatCurrency = (value: number): string => `₹ ${value.toFixed(2)}`;
const formatDate = (value?: string): string => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
};

const statusColorMap: Record<string, string> = {
  PENDING: "#D97706",
  ACCEPTED: "#FF6B35",
  PREPARING: "#7C3AED",
  READY: "#0891B2",
  COMPLETED: "#059669",
  CANCELLED: "#DC2626",
  REFUNDED: "#6B7280"
};

const roleLabelMap: Record<MyProfile["role"], string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  TEACHER: "Teacher",
  STUDENT: "Student",
  STAFF: "Staff",
  GUEST: "Guest"
};

export default function Screen() {
  const theme = useTheme();
  const { colors, isDark } = theme;
  const styles = createStyles(theme);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, accessToken, logout, setSessionUser } = useAuthStore();

  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(false);

  const [editVisible, setEditVisible] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRollNumber, setEditRollNumber] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [passwordVisible, setPasswordVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [walletModalVisible, setWalletModalVisible] = useState(false);
  const [topupAmount, setTopupAmount] = useState("");
  const [topupReference, setTopupReference] = useState("");
  const [savingTopup, setSavingTopup] = useState(false);

  const load = useCallback(async () => {
    if (!user?.tenantId || !user?.id || !accessToken) return;
    try {
      setLoading(true);
      const [meRes, ordersRes] = await Promise.all([
        userService.getMe(accessToken, user.tenantId),
        orderService.listOrders(accessToken, user.tenantId)
      ]);

      setProfile(meRes.data);
      setOrders(ordersRes.data);

      await setSessionUser({
        id: meRes.data.id,
        name: meRes.data.name,
        role: meRes.data.role,
        tenantId: meRes.data.tenantId,
        phone: meRes.data.phone ?? null,
        email: meRes.data.email ?? null,
        rollNumber: meRes.data.rollNumber ?? null,
        isActive: meRes.data.isActive,
        isApproved: meRes.data.isApproved
      });

      try {
        const walletRes = await walletService.getMe(accessToken, user.tenantId);
        setWalletBalance(walletRes.data.balance);
        setWalletTransactions(walletRes.data.transactions);
      } catch {
        setWalletBalance(null);
        setWalletTransactions([]);
      }
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "Failed to load profile"
      );
    } finally {
      setLoading(false);
    }
  }, [accessToken, setSessionUser, user?.id, user?.tenantId]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const stats = useMemo(() => {
    const totalOrders = orders.length;
    const activeOrders = orders.filter((order) => activeStatuses.has(order.status)).length;
    const completedOrders = orders.filter((order) => order.status === "COMPLETED").length;
    const totalSpend = orders.reduce((sum, order) => sum + order.totalAmount, 0);

    const now = new Date();
    const monthlySpend = orders
      .filter((order) => {
        const created = new Date(order.createdAt);
        return (
          created.getFullYear() === now.getFullYear() &&
          created.getMonth() === now.getMonth()
        );
      })
      .reduce((sum, order) => sum + order.totalAmount, 0);

    return { totalOrders, activeOrders, completedOrders, totalSpend, monthlySpend };
  }, [orders]);


  const recentWalletTransactions = useMemo(
    () => walletTransactions.slice(0, 3),
    [walletTransactions]
  );

  const profileView = useMemo(() => {
    if (profile) return profile;
    return {
      id: user?.id ?? "",
      tenantId: user?.tenantId ?? "",
      name: user?.name ?? "Student",
      email: user?.email ?? null,
      phone: user?.phone ?? null,
      role: user?.role ?? "STUDENT",
      rollNumber: user?.rollNumber ?? null,
      isActive: user?.isActive ?? true,
      isApproved: user?.isApproved ?? true,
      createdAt: "",
      updatedAt: ""
    } as MyProfile;
  }, [profile, user]);

  const isStudentRole = profileView.role === "STUDENT";
  const profileIdLabel = isStudentRole ? "Roll Number" : "Employee ID";

  const onOpenEdit = () => {
    const source = profileView;
    setEditName(source.name ?? "");
    setEditPhone(source.phone ?? "");
    setEditEmail(source.email ?? "");
    setEditRollNumber(source.rollNumber ?? "");
    setEditVisible(true);
  };

  const onSaveEdit = async () => {
    if (!user?.tenantId || !accessToken) return;
    if (!editName.trim() || !editPhone.trim()) {
      Alert.alert("Missing fields", "Name and phone are required.");
      return;
    }
    if (!/^\d{10}$/.test(editPhone.trim())) {
      Alert.alert("Invalid phone", "Phone must be exactly 10 digits.");
      return;
    }
    if (editEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editEmail.trim())) {
      Alert.alert("Invalid email", "Please enter a valid email address.");
      return;
    }

    try {
      setSavingEdit(true);
      const response = await userService.updateMe(accessToken, user.tenantId, {
        name: editName.trim(),
        phone: editPhone.trim(),
        email: editEmail.trim(),
        rollNumber: editRollNumber.trim()
      });
      setProfile(response.data);
      await setSessionUser({
        id: response.data.id,
        name: response.data.name,
        role: response.data.role,
        tenantId: response.data.tenantId,
        phone: response.data.phone ?? null,
        email: response.data.email ?? null,
        rollNumber: response.data.rollNumber ?? null,
        isActive: response.data.isActive,
        isApproved: response.data.isApproved
      });
      setEditVisible(false);
      Alert.alert("Success", "Profile updated.");
    } catch (error) {
      Alert.alert(
        "Update failed",
        error instanceof Error ? error.message : "Could not update profile"
      );
    } finally {
      setSavingEdit(false);
    }
  };

  const onChangePassword = async () => {
    if (!user?.tenantId || !accessToken) return;
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert("Missing fields", "Please fill all password fields.");
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert("Weak password", "New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Mismatch", "New password and confirm password do not match.");
      return;
    }

    try {
      setSavingPassword(true);
      await userService.changeMyPassword(accessToken, user.tenantId, {
        currentPassword,
        newPassword
      });
      setPasswordVisible(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      Alert.alert("Success", "Password changed successfully.");
    } catch (error) {
      Alert.alert(
        "Password change failed",
        error instanceof Error ? error.message : "Could not change password"
      );
    } finally {
      setSavingPassword(false);
    }
  };

  const onLogout = async () => {
    try {
      await logout();
    } catch (error) {
      Alert.alert(
        "Logout failed",
        error instanceof Error ? error.message : "Please try again"
      );
    }
  };

  const onTopupWallet = async () => {
    if (!user?.tenantId || !accessToken) return;
    const amount = Number(topupAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert("Invalid amount", "Enter a valid top-up amount.");
      return;
    }
    if (amount > 50000) {
      Alert.alert("Limit reached", "Maximum top-up is ₹ 50,000 per transaction.");
      return;
    }

    try {
      setSavingTopup(true);
      const response = await walletService.topUp(accessToken, user.tenantId, {
        amount,
        upiReference: topupReference.trim() || undefined
      });
      setWalletBalance(response.data.balance);
      setWalletTransactions((prev) => [response.data.transaction, ...prev].slice(0, 20));
      setWalletModalVisible(false);
      setTopupAmount("");
      setTopupReference("");
      Alert.alert("Top-up successful", `New balance: ${formatCurrency(response.data.balance)}`);
    } catch (error) {
      Alert.alert(
        "Top-up failed",
        error instanceof Error ? error.message : "Could not top up wallet"
      );
    } finally {
      setSavingTopup(false);
    }
  };

  const avatarLetter = useMemo(
    () => (profileView.name?.charAt(0) ?? "S").toUpperCase(),
    [profileView.name]
  );

  return (
    <>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor="#FF6B35" />}
      >
        <CanteenHeader showBackButton title="My Profile" subtitle="Manage your account" />
          <Card variant="flat" style={[styles.heroCard, { backgroundColor: isDark ? colors.surfaceAlt : "#0F172A" }]}>
            <View style={styles.heroTopRow}>
              <Avatar name={profileView.name ?? "S"} size="large" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.heroName, isDark && { color: colors.text }]}>{profileView.name}</Text>
                <Text style={styles.heroRole}>
                  {roleLabelMap[profileView.role]} • {profileView.phone ?? "No phone"}
                </Text>
              </View>
            </View>
          </Card>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <View style={[styles.statIconWrap, { backgroundColor: colors.surfaceAlt }]}>
              <Ionicons name="fast-food-outline" size={20} color="#FF6B35" />
            </View>
            <View>
              <Text style={styles.statLabel}>Total Orders</Text>
              <Text style={styles.statValue}>{stats.totalOrders}</Text>
            </View>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <View style={[styles.statIconWrap, { backgroundColor: "#DCFCE7" }]}>
              <Ionicons name="wallet-outline" size={20} color="#059669" />
            </View>
            <View>
              <Text style={styles.statLabel}>Total Spent</Text>
              <Text style={styles.statValue}>{formatCurrency(stats.totalSpend)}</Text>
            </View>
          </View>
        </View>

        {!isStudentRole && (
          <Card style={styles.walletCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Wallet</Text>
              <Text style={styles.walletBalanceText}>
                {walletBalance === null ? "Not available" : formatCurrency(walletBalance)}
              </Text>
            </View>
            <Text style={styles.helperText}>Use wallet for faster checkout in class or at canteen.</Text>
            <Button
              onPress={() => setWalletModalVisible(true)}
              title="Top Up via UPI"
              icon={<Ionicons name="add-circle-outline" size={16} color="white" />}
              style={styles.walletTopupBtn}
            />
            {recentWalletTransactions.length > 0 ? (
              <View style={styles.walletTxnList}>
                {recentWalletTransactions.map((txn) => {
                  const isCredit = txn.amount > 0;
                  return (
                    <View key={txn.id} style={styles.walletTxnRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.walletTxnType}>{txn.type.replaceAll("_", " ")}</Text>
                        <Text style={styles.walletTxnDate}>
                          {new Date(txn.createdAt).toLocaleString()}
                        </Text>
                      </View>
                      <Text style={[styles.walletTxnAmount, isCredit ? styles.walletTxnCredit : styles.walletTxnDebit]}>
                        {isCredit ? "+" : ""}{formatCurrency(txn.amount)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : null}
          </Card>
        )}

        <View style={styles.menuSection}>
          <Text style={styles.sectionLabel}>ACCOUNT SETTINGS</Text>
          <Card padding="none" style={styles.menuCard}>
            <Pressable onPress={onOpenEdit} style={styles.menuItem} android_ripple={{ color: colors.surfaceAlt }}>
              <View style={[styles.menuIcon, { backgroundColor: isDark ? "rgba(75, 85, 99, 0.2)" : "#F3F4F6" }]}>
                <Ionicons name="person-outline" size={18} color={colors.textSecondary} />
              </View>
              <Text style={styles.menuText}>Edit Profile</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
            
            <View style={styles.menuDivider} />
            
            <Pressable onPress={() => setPasswordVisible(true)} style={styles.menuItem} android_ripple={{ color: colors.surfaceAlt }}>
              <View style={[styles.menuIcon, { backgroundColor: isDark ? "rgba(75, 85, 99, 0.2)" : "#F3F4F6" }]}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.textSecondary} />
              </View>
              <Text style={styles.menuText}>Change Password</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>

            <View style={styles.menuDivider} />
            
            <Pressable onPress={() => Alert.alert("Coming Soon", "Notifications settings will be available soon.")} style={styles.menuItem} android_ripple={{ color: colors.surfaceAlt }}>
              <View style={[styles.menuIcon, { backgroundColor: isDark ? "rgba(75, 85, 99, 0.2)" : "#F3F4F6" }]}>
                <Ionicons name="notifications-outline" size={18} color={colors.textSecondary} />
              </View>
              <Text style={styles.menuText}>Notifications</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>

            <Pressable onPress={() => router.push("/(student)/settings" as never)} style={styles.menuItem} android_ripple={{ color: colors.surfaceAlt }}>
              <View style={[styles.menuIcon, { backgroundColor: isDark ? "rgba(75, 85, 99, 0.2)" : "#F3F4F6" }]}>
                <Ionicons name="settings-outline" size={18} color={colors.textSecondary} />
              </View>
              <Text style={styles.menuText}>Settings</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>

            <View style={styles.menuDivider} />
            
            <Pressable onPress={theme.toggleTheme} style={styles.menuItem} android_ripple={{ color: colors.surfaceAlt }}>
              <View style={[styles.menuIcon, { backgroundColor: isDark ? "rgba(75, 85, 99, 0.2)" : "#F3F4F6" }]}>
                <Ionicons name={isDark ? "moon" : "sunny-outline"} size={18} color={colors.textSecondary} />
              </View>
              <Text style={styles.menuText}>Dark Theme</Text>
              <Switch value={isDark} onValueChange={theme.toggleTheme} thumbColor={isDark ? "#FFF" : "#FF6B35"} trackColor={{ false: "#E2E8F0", true: "#FF6B35" }} />
            </Pressable>
          </Card>
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.sectionLabel}>SUPPORT & MORE</Text>
          <Card padding="none" style={styles.menuCard}>
            <Pressable onPress={() => Alert.alert("Help Center", "Support contact: support@collegecanteen.com")} style={styles.menuItem} android_ripple={{ color: colors.surfaceAlt }}>
              <View style={[styles.menuIcon, { backgroundColor: isDark ? "rgba(75, 85, 99, 0.2)" : "#F3F4F6" }]}>
                <Ionicons name="help-circle-outline" size={18} color={colors.textSecondary} />
              </View>
              <Text style={styles.menuText}>Help Center</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
            
            <View style={styles.menuDivider} />
            
            <Pressable onPress={() => Alert.alert("About", "Canteen App v1.0.0")} style={styles.menuItem} android_ripple={{ color: colors.surfaceAlt }}>
              <View style={[styles.menuIcon, { backgroundColor: isDark ? "rgba(75, 85, 99, 0.2)" : "#F3F4F6" }]}>
                <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
              </View>
              <Text style={styles.menuText}>About</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          </Card>
        </View>

        <Button
          onPress={onLogout}
          title="Log Out"
          variant="secondary"
          icon={<Ionicons name="log-out-outline" size={18} color={isDark ? "#F87171" : "#DC2626"} />}
          style={[styles.logoutBtn, { backgroundColor: isDark ? "rgba(220, 38, 38, 0.1)" : "#FFF1F2" }]}
          textStyle={{ color: isDark ? "#F87171" : "#DC2626" }}
        />
      </ScrollView>

      <Modal
        visible={editVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditVisible(false)}
      >
        <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <Card style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <InputField
              value={editName}
              onChangeText={setEditName}
              placeholder="Full name"
            />
            <InputField
              value={editPhone}
              onChangeText={setEditPhone}
              keyboardType="phone-pad"
              placeholder="Phone (10 digits)"
            />
            <InputField
              value={editEmail}
              onChangeText={setEditEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="Email (optional)"
            />
            <InputField
              value={editRollNumber}
              onChangeText={setEditRollNumber}
              placeholder={`${profileIdLabel} (optional)`}
            />
            <View style={styles.modalActions}>
              <Button
                onPress={onSaveEdit}
                loading={savingEdit}
                title="Save"
                style={{ flex: 1 }}
              />
              <Button
                onPress={() => setEditVisible(false)}
                title="Cancel"
                variant="outline"
                style={{ flex: 1 }}
              />
            </View>
          </Card>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={passwordVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPasswordVisible(false)}
      >
        <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <Card style={styles.modalCard}>
            <Text style={styles.modalTitle}>Change Password</Text>
            <InputField
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Current password"
              secureTextEntry
            />
            <InputField
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="New password"
              secureTextEntry
            />
            <InputField
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm new password"
              secureTextEntry
            />
            <View style={styles.modalActions}>
              <Button
                onPress={onChangePassword}
                loading={savingPassword}
                title="Update"
                style={{ flex: 1 }}
              />
              <Button
                onPress={() => setPasswordVisible(false)}
                title="Cancel"
                variant="outline"
                style={{ flex: 1 }}
              />
            </View>
          </Card>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={walletModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setWalletModalVisible(false)}
      >
        <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <Card style={styles.modalCard}>
            <Text style={styles.modalTitle}>Top Up Wallet (UPI)</Text>
            <InputField
              value={topupAmount}
              onChangeText={setTopupAmount}
              keyboardType="numeric"
              placeholder="Amount"
            />
            <InputField
              value={topupReference}
              onChangeText={setTopupReference}
              placeholder="UPI Reference (optional)"
            />
            <View style={styles.modalActions}>
              <Button
                onPress={onTopupWallet}
                loading={savingTopup}
                title="Top Up"
                style={{ flex: 1 }}
              />
              <Button
                onPress={() => setWalletModalVisible(false)}
                title="Cancel"
                variant="outline"
                style={{ flex: 1 }}
              />
            </View>
          </Card>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const createStyles = ({ colors, isDark }: { colors: any, isDark: boolean }) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    padding: moderateScale(16),
    gap: moderateScale(12),
    paddingBottom: verticalScale(28)
  },
  heroCard: {
    borderRadius: moderateScale(20),
    backgroundColor: "#0F172A",
    padding: moderateScale(20),
    gap: moderateScale(10),
    shadowColor: colors.text,
    shadowOpacity: 0.2,
    shadowRadius: moderateScale(15),
    shadowOffset: { width: 0, height: 8 },
    elevation: 8
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(16)
  },
  avatarCircle: {
    width: moderateScale(56),
    height: moderateScale(56),
    borderRadius: moderateScale(28),
    backgroundColor: "#FF6B35",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FF6B35",
    shadowOpacity: 0.3,
    shadowRadius: moderateScale(8),
    shadowOffset: { width: 0, height: 4 },
    elevation: 4
  },
  avatarText: {
    color: "white",
    fontWeight: "900",
    fontSize: fontScale(22)
  },
  heroName: {
    color: "white",
    fontSize: fontScale(24),
    fontWeight: "900",
    marginBottom: verticalScale(2)
  },
  heroRole: {
    color: colors.textMuted,
    fontWeight: "600",
    fontSize: fontScale(14)
  },
  heroStatusRow: {
    flexDirection: "row",
    gap: moderateScale(8),
    flexWrap: "wrap"
  },
  statusChip: {
    borderRadius: moderateScale(999),
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(6)
  },
  statusChipText: {
    fontWeight: "700",
    fontSize: fontScale(12)
  },
  statusChipGreen: {
    backgroundColor: "#DCFCE7"
  },
  statusChipBlue: {
    backgroundColor: colors.surfaceAlt
  },
  statusChipAmber: {
    backgroundColor: "#FEF3C7"
  },
  statusChipRed: {
    backgroundColor: "#FEE2E2"
  },
  completionCard: {
    borderRadius: moderateScale(14),
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: moderateScale(12),
    gap: moderateScale(8)
  },
  progressTrack: {
    width: "100%",
    height: moderateScale(10),
    borderRadius: moderateScale(999),
    backgroundColor: "#E2E8F0",
    overflow: "hidden"
  },
  progressFill: {
    height: "100%",
    borderRadius: moderateScale(999),
    backgroundColor: "#FF6B35"
  },
  helperText: {
    color: colors.textSecondary
  },
  infoCard: {
    borderRadius: moderateScale(14),
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: moderateScale(12),
    gap: moderateScale(6)
  },
  walletCard: {
    borderRadius: moderateScale(20),
    backgroundColor: colors.card,
    padding: moderateScale(16),
    gap: moderateScale(12),
    shadowColor: colors.text,
    shadowOpacity: 0.05,
    shadowRadius: moderateScale(10),
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  walletBalanceText: {
    color: "#059669",
    fontWeight: "900",
    fontSize: fontScale(18)
  },
  walletTopupBtn: {
    backgroundColor: "#FF6B35",
    borderRadius: moderateScale(14),
    paddingVertical: moderateScale(14),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: moderateScale(8),
    shadowColor: "#FF6B35",
    shadowOpacity: 0.2,
    shadowRadius: moderateScale(8),
    shadowOffset: { width: 0, height: 4 },
    elevation: 4
  },
  walletTopupBtnText: {
    color: "white",
    fontWeight: "700"
  },
  walletTxnList: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: moderateScale(10),
    overflow: "hidden"
  },
  walletTxnRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: moderateScale(10),
    paddingVertical: moderateScale(9),
    borderTopWidth: 1,
    borderTopColor: colors.surfaceAlt
  },
  walletTxnType: {
    color: colors.text,
    fontWeight: "700",
    fontSize: fontScale(12)
  },
  walletTxnDate: {
    color: colors.textSecondary,
    fontWeight: "500",
    marginTop: verticalScale(2),
    fontSize: fontScale(12)
  },
  walletTxnAmount: {
    fontWeight: "800"
  },
  walletTxnCredit: {
    color: "#059669"
  },
  walletTxnDebit: {
    color: "#DC2626"
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  sectionTitle: {
    color: colors.text,
    fontSize: fontScale(18),
    fontWeight: "800"
  },
  sectionMeta: {
    color: "#FF6B35",
    fontWeight: "800"
  },
  infoLine: {
    color: colors.textSecondary,
    fontWeight: "600"
  },
  statsRow: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: moderateScale(20),
    padding: moderateScale(16),
    alignItems: "center",
    shadowColor: colors.text,
    shadowOpacity: 0.05,
    shadowRadius: moderateScale(10),
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  statBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(12)
  },
  statIconWrap: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: moderateScale(10),
    alignItems: "center",
    justifyContent: "center"
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: fontScale(12),
    fontWeight: "600"
  },
  statValue: {
    color: colors.text,
    fontSize: fontScale(16),
    fontWeight: "800",
    marginTop: verticalScale(2)
  },
  statDivider: {
    width: 1,
    height: moderateScale(30),
    backgroundColor: colors.surfaceAlt,
    marginHorizontal: moderateScale(16)
  },
  menuSection: {
    gap: moderateScale(8),
    marginTop: verticalScale(4)
  },
  sectionLabel: {
    fontSize: fontScale(12),
    fontWeight: "700",
    color: colors.textSecondary,
    marginLeft: moderateScale(4),
    letterSpacing: 0.5
  },
  menuCard: {
    backgroundColor: colors.card,
    borderRadius: moderateScale(20),
    overflow: "hidden",
    shadowColor: colors.text,
    shadowOpacity: 0.05,
    shadowRadius: moderateScale(10),
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: moderateScale(16),
    gap: moderateScale(12)
  },
  menuIcon: {
    width: moderateScale(32),
    height: moderateScale(32),
    borderRadius: moderateScale(8),
    alignItems: "center",
    justifyContent: "center"
  },
  menuText: {
    flex: 1,
    fontSize: fontScale(15),
    fontWeight: "600",
    color: colors.text
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.surfaceAlt,
    marginLeft: moderateScale(60)
  },
  logoutBtn: {
    backgroundColor: "#FFF1F2",
    borderRadius: moderateScale(20),
    paddingVertical: moderateScale(16),
    marginTop: verticalScale(8),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: moderateScale(8),
    shadowColor: "#DC2626",
    shadowOpacity: 0.1,
    shadowRadius: moderateScale(8),
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  logoutBtnText: {
    color: "#DC2626",
    textAlign: "center",
    fontWeight: "700",
    fontSize: fontScale(16)
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    padding: moderateScale(20)
  },
  modalCard: {
    backgroundColor: colors.card,
    borderRadius: moderateScale(28),
    padding: moderateScale(24),
    gap: moderateScale(16),
    shadowColor: colors.text,
    shadowOpacity: 0.15,
    shadowRadius: moderateScale(20),
    shadowOffset: { width: 0, height: 10 },
    elevation: 10
  },
  modalTitle: {
    color: colors.text,
    fontSize: fontScale(22),
    fontWeight: "900",
    textAlign: "center",
    marginBottom: verticalScale(4)
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: moderateScale(16),
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(16),
    fontSize: fontScale(16),
    color: colors.text,
    fontWeight: "500"
  },
  modalActions: {
    flexDirection: "row",
    gap: moderateScale(12),
    marginTop: verticalScale(8)
  },
  modalActionBtn: {
    flex: 1,
    borderRadius: moderateScale(16),
    paddingVertical: moderateScale(16),
    justifyContent: "center",
    alignItems: "center"
  },
  modalActionPrimary: {
    backgroundColor: "#FF6B35",
    shadowColor: "#FF6B35",
    shadowOpacity: 0.2,
    shadowRadius: moderateScale(8),
    shadowOffset: { width: 0, height: 4 },
    elevation: 4
  },
  modalActionSecondary: {
    backgroundColor: colors.surfaceAlt
  },
  modalActionPrimaryText: {
    color: "white",
    textAlign: "center",
    fontWeight: "800",
    fontSize: fontScale(16)
  },
  modalActionSecondaryText: {
    color: colors.textSecondary,
    textAlign: "center",
    fontWeight: "800",
    fontSize: fontScale(16)
  }
});
