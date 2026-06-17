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
  Platform
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../hooks/useAuth";
import { CanteenHeader } from "../../components/CanteenHeader";
import { Order, orderService } from "../../services/orderService";
import { MyProfile, userService } from "../../services/userService";
import { WalletTransaction, walletService } from "../../services/walletService";

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
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, accessToken, logout, setSessionUser } = useAuth();

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
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{avatarLetter}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroName}>{profileView.name}</Text>
              <Text style={styles.heroRole}>
                {roleLabelMap[profileView.role]} • {profileView.phone ?? "No phone"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <View style={[styles.statIconWrap, { backgroundColor: "#F1F5F9" }]}>
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
          <View style={styles.walletCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Wallet</Text>
              <Text style={styles.walletBalanceText}>
                {walletBalance === null ? "Not available" : formatCurrency(walletBalance)}
              </Text>
            </View>
            <Text style={styles.helperText}>Use wallet for faster checkout in class or at canteen.</Text>
            <Pressable
              onPress={() => setWalletModalVisible(true)}
              style={styles.walletTopupBtn}
            >
              <Ionicons name="add-circle-outline" size={16} color="white" />
              <Text style={styles.walletTopupBtnText}>Top Up via UPI</Text>
            </Pressable>
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
          </View>
        )}

        <View style={styles.menuSection}>
          <Text style={styles.sectionLabel}>ACCOUNT SETTINGS</Text>
          <View style={styles.menuCard}>
            <Pressable onPress={onOpenEdit} style={styles.menuItem}>
              <View style={[styles.menuIcon, { backgroundColor: "#F3F4F6" }]}>
                <Ionicons name="person-outline" size={18} color="#4B5563" />
              </View>
              <Text style={styles.menuText}>Edit Profile</Text>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </Pressable>
            
            <View style={styles.menuDivider} />
            
            <Pressable onPress={() => setPasswordVisible(true)} style={styles.menuItem}>
              <View style={[styles.menuIcon, { backgroundColor: "#F3F4F6" }]}>
                <Ionicons name="lock-closed-outline" size={18} color="#4B5563" />
              </View>
              <Text style={styles.menuText}>Change Password</Text>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </Pressable>

            <View style={styles.menuDivider} />
            
            <Pressable onPress={() => Alert.alert("Coming Soon", "Notifications settings will be available soon.")} style={styles.menuItem}>
              <View style={[styles.menuIcon, { backgroundColor: "#F3F4F6" }]}>
                <Ionicons name="notifications-outline" size={18} color="#4B5563" />
              </View>
              <Text style={styles.menuText}>Notifications</Text>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </Pressable>
          </View>
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.sectionLabel}>SUPPORT & MORE</Text>
          <View style={styles.menuCard}>
            <Pressable onPress={() => Alert.alert("Help Center", "Support contact: support@collegecanteen.com")} style={styles.menuItem}>
              <View style={[styles.menuIcon, { backgroundColor: "#F3F4F6" }]}>
                <Ionicons name="help-circle-outline" size={18} color="#4B5563" />
              </View>
              <Text style={styles.menuText}>Help Center</Text>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </Pressable>
            
            <View style={styles.menuDivider} />
            
            <Pressable onPress={() => Alert.alert("About", "Canteen App v1.0.0")} style={styles.menuItem}>
              <View style={[styles.menuIcon, { backgroundColor: "#F3F4F6" }]}>
                <Ionicons name="information-circle-outline" size={18} color="#4B5563" />
              </View>
              <Text style={styles.menuText}>About</Text>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </Pressable>
          </View>
        </View>

        <Pressable onPress={onLogout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={18} color="#DC2626" />
          <Text style={styles.logoutBtnText}>Log Out</Text>
        </Pressable>
      </ScrollView>

      <Modal
        visible={editVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditVisible(false)}
      >
        <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <TextInput
              value={editName}
              onChangeText={setEditName}
              placeholder="Full name"
              style={styles.modalInput}
            />
            <TextInput
              value={editPhone}
              onChangeText={setEditPhone}
              keyboardType="phone-pad"
              placeholder="Phone (10 digits)"
              style={styles.modalInput}
            />
            <TextInput
              value={editEmail}
              onChangeText={setEditEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="Email (optional)"
              style={styles.modalInput}
            />
            <TextInput
              value={editRollNumber}
              onChangeText={setEditRollNumber}
              placeholder={`${profileIdLabel} (optional)`}
              style={styles.modalInput}
            />
            <View style={styles.modalActions}>
              <Pressable
                onPress={onSaveEdit}
                disabled={savingEdit}
                style={[styles.modalActionBtn, styles.modalActionPrimary]}
              >
                <Text style={styles.modalActionPrimaryText}>
                  {savingEdit ? "Saving..." : "Save"}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setEditVisible(false)}
                style={[styles.modalActionBtn, styles.modalActionSecondary]}
              >
                <Text style={styles.modalActionSecondaryText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={passwordVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPasswordVisible(false)}
      >
        <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Change Password</Text>
            <TextInput
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Current password"
              secureTextEntry
              style={styles.modalInput}
            />
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="New password"
              secureTextEntry
              style={styles.modalInput}
            />
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm new password"
              secureTextEntry
              style={styles.modalInput}
            />
            <View style={styles.modalActions}>
              <Pressable
                onPress={onChangePassword}
                disabled={savingPassword}
                style={[styles.modalActionBtn, styles.modalActionPrimary]}
              >
                <Text style={styles.modalActionPrimaryText}>
                  {savingPassword ? "Updating..." : "Update"}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setPasswordVisible(false)}
                style={[styles.modalActionBtn, styles.modalActionSecondary]}
              >
                <Text style={styles.modalActionSecondaryText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={walletModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setWalletModalVisible(false)}
      >
        <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Top Up Wallet (UPI)</Text>
            <TextInput
              value={topupAmount}
              onChangeText={setTopupAmount}
              keyboardType="numeric"
              placeholder="Amount"
              style={styles.modalInput}
            />
            <TextInput
              value={topupReference}
              onChangeText={setTopupReference}
              placeholder="UPI Reference (optional)"
              style={styles.modalInput}
            />
            <View style={styles.modalActions}>
              <Pressable
                onPress={onTopupWallet}
                disabled={savingTopup}
                style={[styles.modalActionBtn, styles.modalActionPrimary]}
              >
                <Text style={styles.modalActionPrimaryText}>
                  {savingTopup ? "Processing..." : "Top Up"}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setWalletModalVisible(false)}
                style={[styles.modalActionBtn, styles.modalActionSecondary]}
              >
                <Text style={styles.modalActionSecondaryText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC"
  },
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 28
  },
  heroCard: {
    borderRadius: 20,
    backgroundColor: "#0F172A",
    padding: 20,
    gap: 10,
    shadowColor: "#0F172A",
    shadowOpacity: 0.2,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FF6B35",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FF6B35",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4
  },
  avatarText: {
    color: "white",
    fontWeight: "900",
    fontSize: 22
  },
  heroName: {
    color: "white",
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 2
  },
  heroRole: {
    color: "#94A3B8",
    fontWeight: "600",
    fontSize: 14
  },
  heroStatusRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap"
  },
  statusChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  statusChipText: {
    fontWeight: "700",
    fontSize: 12
  },
  statusChipGreen: {
    backgroundColor: "#DCFCE7"
  },
  statusChipBlue: {
    backgroundColor: "#F1F5F9"
  },
  statusChipAmber: {
    backgroundColor: "#FEF3C7"
  },
  statusChipRed: {
    backgroundColor: "#FEE2E2"
  },
  completionCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "white",
    padding: 12,
    gap: 8
  },
  progressTrack: {
    width: "100%",
    height: 10,
    borderRadius: 999,
    backgroundColor: "#E2E8F0",
    overflow: "hidden"
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#FF6B35"
  },
  helperText: {
    color: "#64748B"
  },
  infoCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "white",
    padding: 12,
    gap: 6
  },
  walletCard: {
    borderRadius: 20,
    backgroundColor: "white",
    padding: 16,
    gap: 12,
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  walletBalanceText: {
    color: "#059669",
    fontWeight: "900",
    fontSize: 18
  },
  walletTopupBtn: {
    backgroundColor: "#FF6B35",
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#FF6B35",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4
  },
  walletTopupBtnText: {
    color: "white",
    fontWeight: "700"
  },
  walletTxnList: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    overflow: "hidden"
  },
  walletTxnRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9"
  },
  walletTxnType: {
    color: "#0F172A",
    fontWeight: "700",
    fontSize: 12
  },
  walletTxnDate: {
    color: "#64748B",
    fontWeight: "500",
    marginTop: 2,
    fontSize: 12
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
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "800"
  },
  sectionMeta: {
    color: "#FF6B35",
    fontWeight: "800"
  },
  infoLine: {
    color: "#475569",
    fontWeight: "600"
  },
  statsRow: {
    flexDirection: "row",
    backgroundColor: "white",
    borderRadius: 20,
    padding: 16,
    alignItems: "center",
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  statBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  statIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  statLabel: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "600"
  },
  statValue: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "800",
    marginTop: 2
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: "#E2E8F0",
    marginHorizontal: 16
  },
  menuSection: {
    gap: 8,
    marginTop: 4
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
    marginLeft: 4,
    letterSpacing: 0.5
  },
  menuCard: {
    backgroundColor: "white",
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12
  },
  menuIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  menuText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#0F172A"
  },
  menuDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginLeft: 60
  },
  logoutBtn: {
    backgroundColor: "#FFF1F2",
    borderRadius: 20,
    paddingVertical: 16,
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#DC2626",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  logoutBtnText: {
    color: "#DC2626",
    textAlign: "center",
    fontWeight: "700",
    fontSize: 16
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    padding: 20
  },
  modalCard: {
    backgroundColor: "white",
    borderRadius: 28,
    padding: 24,
    gap: 16,
    shadowColor: "#0F172A",
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10
  },
  modalTitle: {
    color: "#0F172A",
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 4
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: "#0F172A",
    fontWeight: "500"
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8
  },
  modalActionBtn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 16,
    justifyContent: "center",
    alignItems: "center"
  },
  modalActionPrimary: {
    backgroundColor: "#FF6B35",
    shadowColor: "#FF6B35",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4
  },
  modalActionSecondary: {
    backgroundColor: "#F1F5F9"
  },
  modalActionPrimaryText: {
    color: "white",
    textAlign: "center",
    fontWeight: "800",
    fontSize: 16
  },
  modalActionSecondaryText: {
    color: "#64748B",
    textAlign: "center",
    fontWeight: "800",
    fontSize: 16
  }
});
