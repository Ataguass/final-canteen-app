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
  View
} from "react-native";
import { useAuth } from "../../hooks/useAuth";
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
  ACCEPTED: "#2563EB",
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

  const recentOrders = useMemo(
    () =>
      [...orders]
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
        .slice(0, 4),
    [orders]
  );

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

  const completionPercent = useMemo(() => {
    const checks = profileView.role === "STUDENT"
      ? [
          Boolean(profileView.name?.trim()),
          Boolean(profileView.phone?.trim()),
          Boolean(profileView.rollNumber?.trim()),
          Boolean(profileView.email?.trim())
        ]
      : [
          Boolean(profileView.name?.trim()),
          Boolean(profileView.phone?.trim()),
          Boolean(profileView.email?.trim())
        ];
    const completed = checks.filter(Boolean).length;
    return Math.round((completed / checks.length) * 100);
  }, [profileView.email, profileView.name, profileView.phone, profileView.role, profileView.rollNumber]);

  const isStudentRole = profileView.role === "STUDENT";
  const canTopUpWallet = profileView.role === "TEACHER" || profileView.role === "STAFF";
  const profileIdLabel = isStudentRole ? "Roll Number" : "Employee ID";
  const profileCompletionHint = isStudentRole
    ? "Add phone, email and roll number for a complete student profile."
    : "Add phone and email for a complete profile.";

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
      router.replace("/(auth)/login");
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
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
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
            <Pressable
              onPress={load}
              style={styles.refreshBtn}
              disabled={loading}
            >
              <Text style={styles.refreshBtnText}>
                {loading ? "Refreshing..." : "Refresh"}
              </Text>
            </Pressable>
          </View>

          <View style={styles.heroStatusRow}>
            <View
              style={[
                styles.statusChip,
                profileView.isActive ? styles.statusChipGreen : styles.statusChipRed
              ]}
            >
              <Text style={styles.statusChipText}>
                {profileView.isActive ? "Active" : "Inactive"}
              </Text>
            </View>
            <View
              style={[
                styles.statusChip,
                profileView.isApproved
                  ? styles.statusChipBlue
                  : styles.statusChipAmber
              ]}
            >
              <Text style={styles.statusChipText}>
                {profileView.isApproved ? "Approved" : "Approval Pending"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.completionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Profile Completion</Text>
            <Text style={styles.sectionMeta}>{completionPercent}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[styles.progressFill, { width: `${completionPercent}%` }]}
            />
          </View>
          <Text style={styles.helperText}>
            {profileCompletionHint}
          </Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Account Information</Text>
          <Text style={styles.infoLine}>Account Type: {roleLabelMap[profileView.role]}</Text>
          <Text style={styles.infoLine}>Tenant ID: {profileView.tenantId || "-"}</Text>
          <Text style={styles.infoLine}>Phone: {profileView.phone || "-"}</Text>
          <Text style={styles.infoLine}>Email: {profileView.email || "-"}</Text>
          <Text style={styles.infoLine}>{profileIdLabel}: {profileView.rollNumber || "-"}</Text>
          <Text style={styles.infoLine}>Member Since: {formatDate(profileView.createdAt)}</Text>
          <Text style={styles.infoLine}>Last Updated: {formatDate(profileView.updatedAt)}</Text>
        </View>

        <View style={styles.statsGrid}>
          <View style={[styles.statCard, styles.statBlue]}>
            <Text style={styles.statLabel}>Total Orders</Text>
            <Text style={styles.statValue}>{stats.totalOrders}</Text>
          </View>
          <View style={[styles.statCard, styles.statGreen]}>
            <Text style={styles.statLabel}>Active Orders</Text>
            <Text style={styles.statValue}>{stats.activeOrders}</Text>
          </View>
          <View style={[styles.statCard, styles.statAmber]}>
            <Text style={styles.statLabel}>This Month</Text>
            <Text style={styles.statValueSm}>{formatCurrency(stats.monthlySpend)}</Text>
          </View>
          <View style={[styles.statCard, styles.statPurple]}>
            <Text style={styles.statLabel}>Total Spend</Text>
            <Text style={styles.statValueSm}>{formatCurrency(stats.totalSpend)}</Text>
          </View>
        </View>

        <View style={styles.walletCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Wallet</Text>
            <Text style={styles.walletBalanceText}>
              {walletBalance === null ? "Not available" : formatCurrency(walletBalance)}
            </Text>
          </View>
          <Text style={styles.helperText}>Use wallet for faster checkout in class or at canteen.</Text>
          {canTopUpWallet ? (
            <Pressable
              onPress={() => setWalletModalVisible(true)}
              style={styles.walletTopupBtn}
            >
              <Ionicons name="add-circle-outline" size={16} color="white" />
              <Text style={styles.walletTopupBtnText}>Top Up via UPI</Text>
            </Pressable>
          ) : null}
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
          ) : (
            <Text style={styles.helperText}>No wallet transactions yet.</Text>
          )}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Manage Account</Text>
        </View>
        <View style={styles.actionGrid}>
          <Pressable onPress={onOpenEdit} style={[styles.actionBtn, { backgroundColor: "#1D4ED8" }]}>
            <Ionicons name="create-outline" size={16} color="white" />
            <Text style={styles.actionBtnText}>Edit Profile</Text>
          </Pressable>
          <Pressable
            onPress={() => setPasswordVisible(true)}
            style={[styles.actionBtn, { backgroundColor: "#4F46E5" }]}
          >
            <Ionicons name="key-outline" size={16} color="white" />
            <Text style={styles.actionBtnText}>Change Password</Text>
          </Pressable>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Orders</Text>
          <Pressable onPress={() => router.push("/(student)/orders")}>
            <Text style={styles.linkText}>View all</Text>
          </Pressable>
        </View>
        {recentOrders.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No orders yet.</Text>
          </View>
        ) : (
          recentOrders.map((order) => {
            const statusColor = statusColorMap[order.status] ?? "#334155";
            return (
              <Pressable
                key={order.id}
                onPress={() =>
                  router.push({
                    pathname: "/(student)/orders/[id]",
                    params: { id: order.id }
                  })
                }
                style={styles.orderCard}
              >
                <View style={styles.orderTopRow}>
                  <Text style={styles.orderNumber}>{order.orderNumber}</Text>
                  <View
                    style={[
                      styles.orderStatusPill,
                      { backgroundColor: `${statusColor}1A` }
                    ]}
                  >
                    <Text style={[styles.orderStatusText, { color: statusColor }]}>
                      {order.status}
                    </Text>
                  </View>
                </View>
                <Text style={styles.orderMeta}>
                  {new Date(order.createdAt).toLocaleString()}
                </Text>
                <Text style={styles.orderTotal}>
                  Total: {formatCurrency(order.totalAmount)}
                </Text>
              </Pressable>
            );
          })
        )}

        <Pressable onPress={onLogout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={17} color="white" />
          <Text style={styles.logoutBtnText}>Logout</Text>
        </Pressable>
      </ScrollView>

      <Modal
        visible={editVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditVisible(false)}
      >
        <View style={styles.modalBackdrop}>
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
        </View>
      </Modal>

      <Modal
        visible={passwordVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPasswordVisible(false)}
      >
        <View style={styles.modalBackdrop}>
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
        </View>
      </Modal>

      <Modal
        visible={walletModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setWalletModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
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
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#EEF2F7"
  },
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 28
  },
  heroCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "white",
    padding: 12,
    gap: 10
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  avatarCircle: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center"
  },
  avatarText: {
    color: "white",
    fontWeight: "800",
    fontSize: 19
  },
  heroName: {
    color: "#0F172A",
    fontSize: 22,
    fontWeight: "800"
  },
  heroRole: {
    color: "#64748B",
    fontWeight: "600"
  },
  refreshBtn: {
    backgroundColor: "#0F172A",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  refreshBtnText: {
    color: "white",
    fontWeight: "700"
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
    backgroundColor: "#DBEAFE"
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
    backgroundColor: "#2563EB"
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
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "white",
    padding: 12,
    gap: 8
  },
  walletBalanceText: {
    color: "#059669",
    fontWeight: "900",
    fontSize: 18
  },
  walletTopupBtn: {
    backgroundColor: "#0F172A",
    borderRadius: 10,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6
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
    color: "#2563EB",
    fontWeight: "800"
  },
  infoLine: {
    color: "#475569",
    fontWeight: "600"
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  statCard: {
    width: "48%",
    borderRadius: 12,
    borderWidth: 1,
    padding: 10
  },
  statBlue: {
    backgroundColor: "#DBEAFE",
    borderColor: "#BFDBFE"
  },
  statGreen: {
    backgroundColor: "#DCFCE7",
    borderColor: "#BBF7D0"
  },
  statAmber: {
    backgroundColor: "#FEF3C7",
    borderColor: "#FDE68A"
  },
  statPurple: {
    backgroundColor: "#EDE9FE",
    borderColor: "#DDD6FE"
  },
  statLabel: {
    color: "#334155",
    fontWeight: "700",
    fontSize: 12
  },
  statValue: {
    color: "#0F172A",
    fontSize: 24,
    fontWeight: "800",
    marginTop: 3
  },
  statValueSm: {
    color: "#0F172A",
    fontSize: 17,
    fontWeight: "800",
    marginTop: 6
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  actionBtn: {
    width: "48%",
    borderRadius: 11,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6
  },
  actionBtnText: {
    color: "white",
    textAlign: "center",
    fontWeight: "700"
  },
  linkText: {
    color: "#1D4ED8",
    fontWeight: "700"
  },
  emptyCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
    padding: 12
  },
  emptyTitle: {
    color: "#0F172A",
    fontWeight: "700"
  },
  orderCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "white",
    padding: 11,
    gap: 4
  },
  orderTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  orderNumber: {
    color: "#0F172A",
    fontWeight: "800",
    flex: 1
  },
  orderStatusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  orderStatusText: {
    fontSize: 12,
    fontWeight: "800"
  },
  orderMeta: {
    color: "#64748B",
    fontWeight: "600"
  },
  orderTotal: {
    color: "#0F172A",
    fontWeight: "700"
  },
  logoutBtn: {
    backgroundColor: "#B91C1C",
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6
  },
  logoutBtnText: {
    color: "white",
    textAlign: "center",
    fontWeight: "800"
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(17,24,39,0.45)",
    padding: 16
  },
  modalCard: {
    backgroundColor: "white",
    borderRadius: 14,
    padding: 14,
    gap: 10
  },
  modalTitle: {
    color: "#0F172A",
    fontSize: 20,
    fontWeight: "800"
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: "#0F172A"
  },
  modalActions: {
    flexDirection: "row",
    gap: 8
  },
  modalActionBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10
  },
  modalActionPrimary: {
    backgroundColor: "#0F172A"
  },
  modalActionSecondary: {
    backgroundColor: "#E2E8F0"
  },
  modalActionPrimaryText: {
    color: "white",
    textAlign: "center",
    fontWeight: "700"
  },
  modalActionSecondaryText: {
    color: "#0F172A",
    textAlign: "center",
    fontWeight: "700"
  }
});
