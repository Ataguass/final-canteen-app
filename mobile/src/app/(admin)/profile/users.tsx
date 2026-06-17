import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useAuth } from "../../../hooks/useAuth";
import { ManageableUserRole, ManagedUser, userService } from "../../../services/userService";
import { useTheme } from '../../../hooks/useTheme';

type RoleFilter = "ALL" | ManageableUserRole;
type ApprovalFilter = "ALL" | "APPROVED" | "PENDING";

type ParsedBulkRow = {
  name: string;
  phone: string;
  password: string;
  role: ManageableUserRole;
};


const parseCsvCells = (line: string): string[] => {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === "\"") {
      if (inQuotes && line[i + 1] === "\"") {
        current += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
};

const parseBulkCsv = (raw: string, defaultRole: ManageableUserRole) => {
  const sourceLines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => Boolean(line));

  const rows: ParsedBulkRow[] = [];
  const errors: string[] = [];
  const phones = new Set<string>();

  sourceLines.forEach((line, index) => {
    const rowNumber = index + 1;
    const cells = parseCsvCells(line);

    if (index === 0) {
      const normalizedHeader = cells.map((cell) => cell.trim().toLowerCase());
      if (
        normalizedHeader.includes("name") &&
        normalizedHeader.includes("phone") &&
        normalizedHeader.includes("password")
      ) {
        return;
      }
    }

    if (cells.length < 3) {
      errors.push(`Row ${rowNumber}: use format name,phone,password,role`);
      return;
    }

    const name = cells[0]?.trim();
    const phone = cells[1]?.replace(/\s+/g, "").trim();
    const password = cells[2]?.trim();
    const roleCell = (cells[3] ?? "").trim().toUpperCase();
    const role = roleCell ? (roleCell as ManageableUserRole) : defaultRole;

    if (!name) {
      errors.push(`Row ${rowNumber}: name is required`);
      return;
    }

    if (!phone) {
      errors.push(`Row ${rowNumber}: phone is required`);
      return;
    }

    if (phones.has(phone)) {
      errors.push(`Row ${rowNumber}: duplicate phone in CSV (${phone})`);
      return;
    }
    phones.add(phone);

    if (!password || password.length < 6) {
      errors.push(`Row ${rowNumber}: password must be at least 6 characters`);
      return;
    }

    if (role !== "TEACHER" && role !== "STAFF") {
      errors.push(`Row ${rowNumber}: role must be TEACHER or STAFF`);
      return;
    }

    rows.push({ name, phone, password, role });
  });

  return { rows, errors };
};

export default function Screen() {
  const theme = useTheme();
  const { colors, isDark } = theme;
  const { user, accessToken } = useAuth();
  
  const getRoleBadgeStyle = (role: ManageableUserRole) =>
    role === "TEACHER"
      ? { backgroundColor: isDark ? 'rgba(79, 70, 229, 0.15)' : "#EEF2FF", color: isDark ? '#A5B4FC' : "#4338CA" }
      : { backgroundColor: isDark ? 'rgba(8, 145, 178, 0.15)' : "#ECFEFF", color: isDark ? '#67E8F9' : "#0E7490" };

  const cardShadow = {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    backgroundColor: colors.card,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3
  } as const;
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<ManageableUserRole>("TEACHER");
  const [creating, setCreating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
  const [approvalFilter, setApprovalFilter] = useState<ApprovalFilter>("ALL");
  const [resetTarget, setResetTarget] = useState<ManagedUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [bulkCsv, setBulkCsv] = useState("");
  const [bulkDefaultRole, setBulkDefaultRole] = useState<ManageableUserRole>("TEACHER");
  const [bulkImporting, setBulkImporting] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadUsers = useCallback(async () => {
    if (!user?.tenantId || !accessToken) return;
    try {
      setRefreshing(true);
      const response = await userService.listUsers(accessToken, user.tenantId);
      setUsers(response.data);
      setLastUpdated(new Date());
    } finally {
      setRefreshing(false);
    }
  }, [user?.tenantId, accessToken]);

  useEffect(() => {
    loadUsers().catch((error: unknown) => {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to load users");
    });
  }, [loadUsers]);

  const onCreate = async () => {
    if (!user?.tenantId || !accessToken) return;
    if (!name.trim() || !phone.trim() || !password.trim()) {
      Alert.alert("Missing fields", "Name, phone and password are required.");
      return;
    }

    try {
      setCreating(true);
      await userService.createUser(accessToken, user.tenantId, {
        name: name.trim(),
        phone: phone.trim(),
        password: password.trim(),
        role,
        isApproved: true
      });
      setName("");
      setPhone("");
      setPassword("");
      await loadUsers();
      Alert.alert("Success", `${role === "TEACHER" ? "Teacher" : "Staff"} account created.`);
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Could not create user");
    } finally {
      setCreating(false);
    }
  };

  const onImportBulk = async () => {
    if (!user?.tenantId || !accessToken) return;

    const { rows, errors } = parseBulkCsv(bulkCsv, bulkDefaultRole);
    if (rows.length === 0) {
      Alert.alert("No valid rows", errors[0] ?? "Paste CSV rows before importing.");
      return;
    }

    if (errors.length > 0) {
      Alert.alert("Fix CSV first", `${errors.slice(0, 5).join("\n")}${errors.length > 5 ? "\n..." : ""}`);
      return;
    }

    try {
      setBulkImporting(true);
      const response = await userService.importUsers(accessToken, user.tenantId, rows);
      const result = response.data;
      await loadUsers();
      setBulkCsv("");

      if (result.failedCount === 0) {
        Alert.alert("Import complete", `${result.createdCount} users created successfully.`);
        return;
      }

      const details = result.errors
        .slice(0, 5)
        .map((item) => `Row ${item.rowNumber}${item.phone ? ` (${item.phone})` : ""}: ${item.reason}`)
        .join("\n");
      Alert.alert(
        "Import finished with errors",
        `Created: ${result.createdCount}\nFailed: ${result.failedCount}\n\n${details}${result.errors.length > 5 ? "\n..." : ""}`
      );
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Could not import users");
    } finally {
      setBulkImporting(false);
    }
  };

  const onToggleApproval = async (item: ManagedUser) => {
    if (!user?.tenantId || !accessToken) return;
    try {
      await userService.setApproval(accessToken, user.tenantId, item.id, !item.isApproved);
      await loadUsers();
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Could not update approval");
    }
  };

  const onToggleActive = async (item: ManagedUser) => {
    if (!user?.tenantId || !accessToken) return;
    try {
      await userService.setActive(accessToken, user.tenantId, item.id, !item.isActive);
      await loadUsers();
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Could not update active status");
    }
  };

  const onOpenResetPassword = (item: ManagedUser) => {
    setResetTarget(item);
    setNewPassword("");
  };

  const onCloseResetPassword = () => {
    setResetTarget(null);
    setNewPassword("");
  };

  const onSaveResetPassword = async () => {
    if (!user?.tenantId || !accessToken || !resetTarget) return;
    if (newPassword.trim().length < 6) {
      Alert.alert("Invalid password", "Password must be at least 6 characters.");
      return;
    }

    try {
      setSavingPassword(true);
      await userService.resetPassword(accessToken, user.tenantId, resetTarget.id, newPassword.trim());
      onCloseResetPassword();
      Alert.alert("Success", `Password reset for ${resetTarget.name}.`);
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Could not reset password");
    } finally {
      setSavingPassword(false);
    }
  };

  const stats = useMemo(
    () => ({
      total: users.length,
      teachers: users.filter((item) => item.role === "TEACHER").length,
      staff: users.filter((item) => item.role === "STAFF").length,
      pending: users.filter((item) => !item.isApproved).length
    }),
    [users]
  );

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return users.filter((item) => {
      if (roleFilter !== "ALL" && item.role !== roleFilter) return false;
      if (approvalFilter === "APPROVED" && !item.isApproved) return false;
      if (approvalFilter === "PENDING" && item.isApproved) return false;
      if (!normalized) return true;
      return item.name.toLowerCase().includes(normalized) || (item.phone ?? "").toLowerCase().includes(normalized);
    });
  }, [users, query, roleFilter, approvalFilter]);

  if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}>
        <Text style={{ color: colors.text }}>Admin access required.</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }}>
        
        {/* STATS ROW */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 8 }}>
          <View style={{ ...cardShadow, padding: 14, minWidth: 100 }}>
            <Text style={{ color: colors.textSecondary, fontWeight: "700", fontSize: 12, textTransform: "uppercase" }}>Total</Text>
            <Text style={{ fontSize: 26, fontWeight: "900", color: colors.text, marginTop: 4 }}>{stats.total}</Text>
          </View>
          <View style={{ ...cardShadow, padding: 14, minWidth: 100 }}>
            <Text style={{ color: colors.textSecondary, fontWeight: "700", fontSize: 12, textTransform: "uppercase" }}>Teachers</Text>
            <Text style={{ fontSize: 26, fontWeight: "900", color: isDark ? '#818CF8' : "#4F46E5", marginTop: 4 }}>{stats.teachers}</Text>
          </View>
          <View style={{ ...cardShadow, padding: 14, minWidth: 100 }}>
            <Text style={{ color: colors.textSecondary, fontWeight: "700", fontSize: 12, textTransform: "uppercase" }}>Staff</Text>
            <Text style={{ fontSize: 26, fontWeight: "900", color: isDark ? '#22D3EE' : "#0891B2", marginTop: 4 }}>{stats.staff}</Text>
          </View>
          <View style={{ ...cardShadow, padding: 14, minWidth: 100 }}>
            <Text style={{ color: colors.textSecondary, fontWeight: "700", fontSize: 12, textTransform: "uppercase" }}>Pending</Text>
            <Text style={{ fontSize: 26, fontWeight: "900", color: isDark ? '#F87171' : "#DC2626", marginTop: 4 }}>{stats.pending}</Text>
          </View>
        </ScrollView>

        {/* CREATE USER */}
        <View style={{ ...cardShadow, padding: 16, gap: 12 }}>
          <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>Add New User</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TextInput
              placeholder="Full name"
              placeholderTextColor={colors.textSecondary}
              value={name}
              onChangeText={setName}
              style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: colors.surfaceAlt, fontSize: 14, color: colors.text }}
            />
            <TextInput
              placeholder="Phone"
              placeholderTextColor={colors.textSecondary}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: colors.surfaceAlt, fontSize: 14, color: colors.text }}
            />
          </View>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <TextInput
              placeholder="Temporary password"
              placeholderTextColor={colors.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              style={{ flex: 3, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: colors.surfaceAlt, fontSize: 14, color: colors.text }}
            />
            <View style={{ flex: 2, flexDirection: "row", backgroundColor: colors.surfaceAlt, borderRadius: 12, padding: 4 }}>
              {(["TEACHER", "STAFF"] as ManageableUserRole[]).map((value) => {
                const active = role === value;
                return (
                  <Pressable
                    key={value}
                    onPress={() => setRole(value)}
                    style={{ flex: 1, borderRadius: 8, paddingVertical: 8, alignItems: "center", backgroundColor: active ? colors.card : "transparent", shadowColor: active ? "#000" : "transparent", shadowOpacity: 0.05, shadowRadius: 4, elevation: active ? 1 : 0 }}
                  >
                    <Text style={{ color: active ? colors.text : colors.textSecondary, fontWeight: active ? "800" : "600", fontSize: 12 }}>
                      {value === "TEACHER" ? "Teacher" : "Staff"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <Pressable
            onPress={onCreate}
            disabled={creating}
            style={{ borderRadius: 12, paddingVertical: 14, alignItems: "center", backgroundColor: colors.primary, marginTop: 4 }}
          >
            <Text style={{ color: "white", fontWeight: "800", fontSize: 15 }}>{creating ? "Creating..." : "Create User"}</Text>
          </Pressable>
        </View>

        <View style={{ ...cardShadow, padding: 12, gap: 10 }}>
          <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>Bulk Import (CSV)</Text>
          <Text style={{ color: colors.textSecondary }}>
            Paste: name,phone,password,role. Role optional. Max 200 rows.
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {(["TEACHER", "STAFF"] as ManageableUserRole[]).map((value) => {
              const active = bulkDefaultRole === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setBulkDefaultRole(value)}
                  style={{
                    flex: 1,
                    borderRadius: 10,
                    paddingVertical: 9,
                    alignItems: "center",
                    backgroundColor: active ? (isDark ? colors.text : "#0F172A") : colors.surfaceAlt
                  }}
                >
                  <Text style={{ color: active ? (isDark ? colors.background : "white") : colors.textSecondary, fontWeight: "700" }}>
                    Default: {value === "TEACHER" ? "Teacher" : "Staff"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            multiline
            value={bulkCsv}
            onChangeText={setBulkCsv}
            placeholderTextColor={colors.textSecondary}
            placeholder={"name,phone,password,role\nAnanya,9000000001,pass123,TEACHER\nRahul,9000000002,pass123,STAFF"}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 14,
              minHeight: 120,
              textAlignVertical: "top",
              backgroundColor: colors.surfaceAlt,
              fontSize: 13,
              fontFamily: "monospace",
              color: colors.text
            }}
          />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              onPress={onImportBulk}
              disabled={bulkImporting}
              style={{ flex: 1, borderRadius: 12, paddingVertical: 11, alignItems: "center", backgroundColor: colors.primary }}
            >
              <Text style={{ color: "white", fontWeight: "800" }}>{bulkImporting ? "Importing..." : "Import CSV"}</Text>
            </Pressable>
            <Pressable
              onPress={() => setBulkCsv("")}
              style={{ flex: 1, borderRadius: 12, paddingVertical: 11, alignItems: "center", backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border }}
            >
              <Text style={{ color: colors.text, fontWeight: "800" }}>Clear</Text>
            </Pressable>
          </View>
        </View>

        {/* SEARCH & FILTER */}
        <View style={{ ...cardShadow, padding: 16, gap: 14 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>Users Directory</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "600" }}>
              {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : ""}
            </Text>
          </View>
          
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surfaceAlt, flexDirection: "row", alignItems: "center", paddingHorizontal: 12 }}>
              <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
              <TextInput
                placeholder="Search by name or phone"
                placeholderTextColor={colors.textSecondary}
                value={query}
                onChangeText={setQuery}
                style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 10, color: colors.text, fontSize: 15 }}
              />
            </View>
            <Pressable
              onPress={() => loadUsers().catch(() => undefined)}
              style={{ borderRadius: 12, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, width: 48, alignItems: "center", justifyContent: "center" }}
            >
              <Ionicons name="refresh" size={20} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {(["ALL", "TEACHER", "STAFF"] as RoleFilter[]).map((value) => {
              const active = roleFilter === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setRoleFilter(value)}
                  style={{
                    borderRadius: 999,
                    paddingVertical: 8,
                    paddingHorizontal: 14,
                    backgroundColor: active ? (isDark ? colors.text : "#0F172A") : colors.surfaceAlt
                  }}
                >
                  <Text style={{ color: active ? (isDark ? colors.background : "white") : colors.textSecondary, fontWeight: "700" }}>
                    {value === "ALL" ? "All Roles" : value}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {(["ALL", "APPROVED", "PENDING"] as ApprovalFilter[]).map((value) => {
              const active = approvalFilter === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setApprovalFilter(value)}
                  style={{
                    borderRadius: 999,
                    paddingVertical: 8,
                    paddingHorizontal: 14,
                    backgroundColor: active ? (isDark ? colors.text : "#0F172A") : colors.surfaceAlt
                  }}
                >
                  <Text style={{ color: active ? (isDark ? colors.background : "white") : colors.textSecondary, fontWeight: "700" }}>{value}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>User List</Text>
          <Text style={{ color: colors.textSecondary, fontWeight: "700" }}>{filteredUsers.length} found</Text>
        </View>

        {filteredUsers.length === 0 ? (
          <View style={{ ...cardShadow, padding: 14 }}>
            <Text style={{ color: colors.textSecondary }}>
              {users.length === 0 ? "No users yet." : "No users match current filters."}
            </Text>
          </View>
        ) : null}

        {filteredUsers.map((item) => {
          const roleBadge = getRoleBadgeStyle(item.role);
          return (
            <View key={item.id} style={{ ...cardShadow, padding: 16, gap: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 17, fontWeight: "800" }}>{item.name}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2, fontWeight: "500" }}>{item.phone ?? "No phone"}</Text>
                </View>
                <View style={{ borderRadius: 8, backgroundColor: roleBadge.backgroundColor, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ color: roleBadge.color, fontWeight: "800", fontSize: 12 }}>{item.role}</Text>
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ borderRadius: 8, backgroundColor: item.isApproved ? (isDark ? 'rgba(16, 185, 129, 0.15)' : "#ECFDF5") : (isDark ? 'rgba(239, 68, 68, 0.15)' : "#FEF2F2"), paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ color: item.isApproved ? (isDark ? '#34D399' : "#059669") : (isDark ? '#F87171' : "#DC2626"), fontWeight: "700", fontSize: 12 }}>
                    {item.isApproved ? "Approved" : "Pending"}
                  </Text>
                </View>
                <View style={{ borderRadius: 8, backgroundColor: item.isActive ? colors.surfaceAlt : colors.border, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ color: item.isActive ? colors.text : colors.textSecondary, fontWeight: "700", fontSize: 12 }}>
                    {item.isActive ? "Active" : "Inactive"}
                  </Text>
                </View>
              </View>

              <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <Pressable
                  onPress={() => onToggleApproval(item)}
                  style={{ flex: 1, minWidth: "30%", borderRadius: 10, backgroundColor: item.isApproved ? (isDark ? 'rgba(239, 68, 68, 0.15)' : "#FEF2F2") : (isDark ? 'rgba(16, 185, 129, 0.15)' : "#ECFDF5"), paddingVertical: 10, alignItems: "center" }}
                >
                  <Text style={{ color: item.isApproved ? (isDark ? '#F87171' : "#DC2626") : (isDark ? '#34D399' : "#059669"), fontWeight: "700", fontSize: 13 }}>{item.isApproved ? "Revoke" : "Approve"}</Text>
                </Pressable>
                <Pressable
                  onPress={() => onToggleActive(item)}
                  style={{ flex: 1, minWidth: "30%", borderRadius: 10, backgroundColor: item.isActive ? colors.surfaceAlt : (isDark ? colors.text : "#0F172A"), paddingVertical: 10, alignItems: "center" }}
                >
                  <Text style={{ color: item.isActive ? colors.textSecondary : (isDark ? colors.background : "white"), fontWeight: "700", fontSize: 13 }}>{item.isActive ? "Deactivate" : "Activate"}</Text>
                </Pressable>
                <Pressable
                  onPress={() => onOpenResetPassword(item)}
                  style={{ flex: 1, minWidth: "30%", borderRadius: 10, backgroundColor: colors.surfaceAlt, paddingVertical: 10, alignItems: "center" }}
                >
                  <Text style={{ color: colors.textSecondary, fontWeight: "700", fontSize: 13 }}>Reset Pass</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={Boolean(resetTarget)} transparent animationType="fade" onRequestClose={onCloseResetPassword}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 16 }}>
          <View style={{ ...cardShadow, borderColor: colors.border, borderRadius: 14, padding: 14, gap: 10 }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>Reset Password</Text>
            <Text style={{ color: colors.textSecondary }}>
              {resetTarget ? `Set a new password for ${resetTarget.name}` : ""}
            </Text>
            <TextInput
              placeholder="New password (min 6 characters)"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
              style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, backgroundColor: colors.surfaceAlt, color: colors.text }}
            />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={onSaveResetPassword}
                disabled={savingPassword}
                style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 10, alignItems: "center" }}
              >
                <Text style={{ color: "white", fontWeight: "800" }}>{savingPassword ? "Saving..." : "Save Password"}</Text>
              </Pressable>
              <Pressable
                onPress={onCloseResetPassword}
                style={{ flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: 10, paddingVertical: 10, alignItems: "center" }}
              >
                <Text style={{ color: colors.textSecondary, fontWeight: "800" }}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
