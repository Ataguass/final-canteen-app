import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useAuth } from "../../../hooks/useAuth";
import { ManageableUserRole, ManagedUser, userService } from "../../../services/userService";

type RoleFilter = "ALL" | ManageableUserRole;
type ApprovalFilter = "ALL" | "APPROVED" | "PENDING";

type ParsedBulkRow = {
  name: string;
  phone: string;
  password: string;
  role: ManageableUserRole;
};

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

const getRoleBadgeStyle = (role: ManageableUserRole) =>
  role === "TEACHER"
    ? { backgroundColor: "#EEF2FF", color: "#4338CA" }
    : { backgroundColor: "#ECFEFF", color: "#0E7490" };

export default function Screen() {
  const { user, accessToken } = useAuth();
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
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>Admin access required.</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView style={{ flex: 1, backgroundColor: "#F8FAFC" }} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}>
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 28, fontWeight: "800", color: "#0F172A" }}>Users</Text>
          <Text style={{ color: "#64748B", fontSize: 13 }}>
            Last updated: {lastUpdated ? lastUpdated.toLocaleString() : "Not loaded yet"}
          </Text>
        </View>

        <Pressable
          onPress={() => loadUsers().catch(() => undefined)}
          style={{
            borderRadius: 12,
            paddingVertical: 12,
            backgroundColor: "#0F172A",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: 8
          }}
        >
          <Ionicons name="refresh-outline" size={16} color="white" />
          <Text style={{ color: "white", fontWeight: "800" }}>{refreshing ? "Refreshing..." : "Refresh Users"}</Text>
        </Pressable>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          <View style={{ width: "48%", ...cardShadow, padding: 12 }}>
            <Text style={{ color: "#475569", fontWeight: "700", fontSize: 12 }}>Total</Text>
            <Text style={{ fontSize: 24, fontWeight: "800", color: "#0F172A", marginTop: 4 }}>{stats.total}</Text>
          </View>
          <View style={{ width: "48%", ...cardShadow, padding: 12 }}>
            <Text style={{ color: "#475569", fontWeight: "700", fontSize: 12 }}>Teachers</Text>
            <Text style={{ fontSize: 24, fontWeight: "800", color: "#4338CA", marginTop: 4 }}>{stats.teachers}</Text>
          </View>
          <View style={{ width: "48%", ...cardShadow, padding: 12 }}>
            <Text style={{ color: "#475569", fontWeight: "700", fontSize: 12 }}>Staff</Text>
            <Text style={{ fontSize: 24, fontWeight: "800", color: "#0E7490", marginTop: 4 }}>{stats.staff}</Text>
          </View>
          <View style={{ width: "48%", ...cardShadow, padding: 12 }}>
            <Text style={{ color: "#475569", fontWeight: "700", fontSize: 12 }}>Pending</Text>
            <Text style={{ fontSize: 24, fontWeight: "800", color: "#B91C1C", marginTop: 4 }}>{stats.pending}</Text>
          </View>
        </View>

        <View style={{ ...cardShadow, padding: 12, gap: 10 }}>
          <Text style={{ fontSize: 16, fontWeight: "800", color: "#0F172A" }}>Create User</Text>
          <TextInput
            placeholder="Full name"
            value={name}
            onChangeText={setName}
            style={{ borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#F8FAFC" }}
          />
          <TextInput
            placeholder="Phone"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            style={{ borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#F8FAFC" }}
          />
          <TextInput
            placeholder="Temporary password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={{ borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#F8FAFC" }}
          />

          <View style={{ flexDirection: "row", gap: 8 }}>
            {(["TEACHER", "STAFF"] as ManageableUserRole[]).map((value) => {
              const active = role === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setRole(value)}
                  style={{
                    flex: 1,
                    borderRadius: 10,
                    paddingVertical: 10,
                    alignItems: "center",
                    backgroundColor: active ? "#0F172A" : "#EEF2F7"
                  }}
                >
                  <Text style={{ color: active ? "white" : "#334155", fontWeight: "700" }}>{value === "TEACHER" ? "Teacher" : "Staff"}</Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={onCreate}
            disabled={creating}
            style={{ borderRadius: 12, paddingVertical: 11, alignItems: "center", backgroundColor: "#FF6B35" }}
          >
            <Text style={{ color: "white", fontWeight: "800" }}>{creating ? "Creating..." : "Add User"}</Text>
          </Pressable>
        </View>

        <View style={{ ...cardShadow, padding: 12, gap: 10 }}>
          <Text style={{ fontSize: 16, fontWeight: "800", color: "#0F172A" }}>Bulk Import (CSV)</Text>
          <Text style={{ color: "#64748B" }}>
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
                    backgroundColor: active ? "#0F172A" : "#EEF2F7"
                  }}
                >
                  <Text style={{ color: active ? "white" : "#334155", fontWeight: "700" }}>
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
            placeholder={"name,phone,password,role\nAnanya,9000000001,pass123,TEACHER\nRahul,9000000002,pass123,STAFF"}
            style={{
              borderWidth: 1,
              borderColor: "#D1D5DB",
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 10,
              minHeight: 120,
              textAlignVertical: "top",
              backgroundColor: "#F8FAFC"
            }}
          />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              onPress={onImportBulk}
              disabled={bulkImporting}
              style={{ flex: 1, borderRadius: 12, paddingVertical: 11, alignItems: "center", backgroundColor: "#0F172A" }}
            >
              <Text style={{ color: "white", fontWeight: "800" }}>{bulkImporting ? "Importing..." : "Import CSV"}</Text>
            </Pressable>
            <Pressable
              onPress={() => setBulkCsv("")}
              style={{ flex: 1, borderRadius: 12, paddingVertical: 11, alignItems: "center", backgroundColor: "#E2E8F0" }}
            >
              <Text style={{ color: "#334155", fontWeight: "800" }}>Clear</Text>
            </Pressable>
          </View>
        </View>

        <View style={{ ...cardShadow, padding: 12, gap: 10 }}>
          <Text style={{ fontSize: 16, fontWeight: "800", color: "#0F172A" }}>Search & Filter</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1, borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 12, backgroundColor: "#F8FAFC", flexDirection: "row", alignItems: "center", paddingHorizontal: 10 }}>
              <Ionicons name="search-outline" size={16} color="#64748B" />
              <TextInput
                placeholder="Search by name or phone"
                value={query}
                onChangeText={setQuery}
                style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 8, color: "#0F172A" }}
              />
            </View>
            <Pressable
              onPress={() => loadUsers().catch(() => undefined)}
              style={{ borderRadius: 12, backgroundColor: "#0F172A", paddingHorizontal: 12, alignItems: "center", justifyContent: "center" }}
            >
              <Ionicons name="refresh" size={17} color="white" />
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
                    backgroundColor: active ? "#0F172A" : "#EEF2F7"
                  }}
                >
                  <Text style={{ color: active ? "white" : "#334155", fontWeight: "700" }}>
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
                    backgroundColor: active ? "#0F172A" : "#EEF2F7"
                  }}
                >
                  <Text style={{ color: active ? "white" : "#334155", fontWeight: "700" }}>{value}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontSize: 18, fontWeight: "800", color: "#0F172A" }}>User List</Text>
          <Text style={{ color: "#64748B", fontWeight: "700" }}>{filteredUsers.length} found</Text>
        </View>

        {filteredUsers.length === 0 ? (
          <View style={{ ...cardShadow, padding: 14 }}>
            <Text style={{ color: "#64748B" }}>
              {users.length === 0 ? "No users yet." : "No users match current filters."}
            </Text>
          </View>
        ) : null}

        {filteredUsers.map((item) => {
          const roleBadge = getRoleBadgeStyle(item.role);
          return (
            <View key={item.id} style={{ ...cardShadow, padding: 12, gap: 8 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <Text style={{ color: "#0F172A", fontSize: 16, fontWeight: "800", flex: 1 }}>{item.name}</Text>
                <View style={{ borderRadius: 999, backgroundColor: roleBadge.backgroundColor, paddingHorizontal: 9, paddingVertical: 4 }}>
                  <Text style={{ color: roleBadge.color, fontWeight: "800", fontSize: 12 }}>{item.role}</Text>
                </View>
              </View>

              <Text style={{ color: "#334155" }}>Phone: {item.phone ?? "-"}</Text>

              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ borderRadius: 999, backgroundColor: item.isApproved ? "#ECFDF5" : "#FEF2F2", paddingHorizontal: 9, paddingVertical: 4 }}>
                  <Text style={{ color: item.isApproved ? "#059669" : "#DC2626", fontWeight: "800", fontSize: 12 }}>
                    {item.isApproved ? "Approved" : "Pending Approval"}
                  </Text>
                </View>
                <View style={{ borderRadius: 999, backgroundColor: item.isActive ? "#EEF2FF" : "#F1F5F9", paddingHorizontal: 9, paddingVertical: 4 }}>
                  <Text style={{ color: item.isActive ? "#1D4ED8" : "#64748B", fontWeight: "800", fontSize: 12 }}>
                    {item.isActive ? "Active" : "Inactive"}
                  </Text>
                </View>
              </View>

              <Text style={{ color: "#64748B", fontSize: 12 }}>
                Created: {new Date(item.createdAt).toLocaleDateString()}
              </Text>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <Pressable
                  onPress={() => onToggleApproval(item)}
                  style={{ flex: 1, minWidth: 100, borderRadius: 10, backgroundColor: "#0F172A", paddingVertical: 9, alignItems: "center" }}
                >
                  <Text style={{ color: "white", fontWeight: "800" }}>{item.isApproved ? "Revoke Approval" : "Approve"}</Text>
                </Pressable>
                <Pressable
                  onPress={() => onToggleActive(item)}
                  style={{ flex: 1, minWidth: 100, borderRadius: 10, backgroundColor: "#B91C1C", paddingVertical: 9, alignItems: "center" }}
                >
                  <Text style={{ color: "white", fontWeight: "800" }}>{item.isActive ? "Deactivate" : "Activate"}</Text>
                </Pressable>
                <Pressable
                  onPress={() => onOpenResetPassword(item)}
                  style={{ flex: 1, minWidth: 100, borderRadius: 10, backgroundColor: "#4F46E5", paddingVertical: 9, alignItems: "center" }}
                >
                  <Text style={{ color: "white", fontWeight: "800" }}>Reset Password</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={Boolean(resetTarget)} transparent animationType="fade" onRequestClose={onCloseResetPassword}>
        <View style={{ flex: 1, backgroundColor: "rgba(15,23,42,0.46)", justifyContent: "center", padding: 16 }}>
          <View style={{ ...cardShadow, borderColor: "#CBD5E1", borderRadius: 14, padding: 14, gap: 10 }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: "#0F172A" }}>Reset Password</Text>
            <Text style={{ color: "#64748B" }}>
              {resetTarget ? `Set a new password for ${resetTarget.name}` : ""}
            </Text>
            <TextInput
              placeholder="New password (min 6 characters)"
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
              style={{ borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 10, padding: 10, backgroundColor: "#F8FAFC" }}
            />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={onSaveResetPassword}
                disabled={savingPassword}
                style={{ flex: 1, backgroundColor: "#0F172A", borderRadius: 10, paddingVertical: 10, alignItems: "center" }}
              >
                <Text style={{ color: "white", fontWeight: "800" }}>{savingPassword ? "Saving..." : "Save Password"}</Text>
              </Pressable>
              <Pressable
                onPress={onCloseResetPassword}
                style={{ flex: 1, backgroundColor: "#E2E8F0", borderRadius: 10, paddingVertical: 10, alignItems: "center" }}
              >
                <Text style={{ color: "#334155", fontWeight: "800" }}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
