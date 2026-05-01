import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { File, Paths } from "expo-file-system";
import { useAuth } from "../../../hooks/useAuth";
import { backupService, type BackupFile } from "../../../services/backupService";

const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const decimals = unitIndex === 0 ? 0 : 2;
  return `${value.toFixed(decimals)} ${units[unitIndex]}`;
};

const formatDate = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

export default function Screen() {
  const { user, accessToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [activeBackupId, setActiveBackupId] = useState<string | null>(null);
  const [items, setItems] = useState<BackupFile[]>([]);

  const isAdmin = useMemo(
    () => user?.role === "ADMIN" || user?.role === "SUPER_ADMIN",
    [user?.role]
  );

  const loadBackups = useCallback(async () => {
    if (!user?.tenantId || !accessToken || !isAdmin) return;
    try {
      setLoading(true);
      const response = await backupService.listBackups(accessToken, user.tenantId);
      setItems(response.data);
    } catch (error) {
      Alert.alert("Load failed", error instanceof Error ? error.message : "Could not load backups");
    } finally {
      setLoading(false);
    }
  }, [accessToken, isAdmin, user?.tenantId]);

  useEffect(() => {
    loadBackups().catch(() => undefined);
  }, [loadBackups]);

  const onCreateBackup = async () => {
    if (!user?.tenantId || !accessToken) return;
    try {
      setCreating(true);
      const response = await backupService.createBackup(accessToken, user.tenantId);
      const counts = response.data.counts;
      Alert.alert(
        "Backup created",
        `Saved snapshot with ${counts.orders} orders, ${counts.menuItems} items and ${counts.users} users.`
      );
      await loadBackups();
    } catch (error) {
      Alert.alert("Create failed", error instanceof Error ? error.message : "Could not create backup");
    } finally {
      setCreating(false);
    }
  };

  const executeRestore = async (backupId: string) => {
    if (!user?.tenantId || !accessToken) return;
    try {
      setActiveBackupId(backupId);
      const response = await backupService.restoreBackup(accessToken, user.tenantId, backupId);
      Alert.alert(
        "Restore complete",
        `${response.message}\nOrders: ${response.data.counts.orders}\nItems: ${response.data.counts.menuItems}`
      );
      await loadBackups();
    } catch (error) {
      Alert.alert("Restore failed", error instanceof Error ? error.message : "Could not restore backup");
    } finally {
      setActiveBackupId(null);
    }
  };

  const onRestore = (backupId: string) => {
    Alert.alert(
      "Restore backup?",
      "This will replace current tenant data with selected backup. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Restore",
          style: "destructive",
          onPress: () => {
            executeRestore(backupId).catch(() => undefined);
          }
        }
      ]
    );
  };

  const executeDelete = async (backupId: string) => {
    if (!user?.tenantId || !accessToken) return;
    try {
      setActiveBackupId(backupId);
      await backupService.deleteBackup(accessToken, user.tenantId, backupId);
      setItems((prev) => prev.filter((entry) => entry.id !== backupId));
      Alert.alert("Deleted", "Backup deleted successfully.");
    } catch (error) {
      Alert.alert("Delete failed", error instanceof Error ? error.message : "Could not delete backup");
    } finally {
      setActiveBackupId(null);
    }
  };

  const onDelete = (backupId: string) => {
    Alert.alert("Delete backup?", "This will permanently remove this backup file.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          executeDelete(backupId).catch(() => undefined);
        }
      }
    ]);
  };

  const onDownloadZip = async (backupId: string) => {
    if (!user?.tenantId || !accessToken) return;
    try {
      setActiveBackupId(backupId);
      const archiveName = backupId.replace(/\.json$/i, ".zip");
      const destination = new File(Paths.document, archiveName);
      const file = await File.downloadFileAsync(backupService.downloadUrl(backupId, "zip"), destination, {
        idempotent: true,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "x-tenant-id": user.tenantId
        }
      });
      Alert.alert("Download complete", `ZIP saved to:\n${file.uri}`);
    } catch (error) {
      Alert.alert("Download failed", error instanceof Error ? error.message : "Could not download ZIP backup");
    } finally {
      setActiveBackupId(null);
    }
  };

  if (!isAdmin) {
    return (
      <View style={styles.centerScreen}>
        <Ionicons name="lock-closed-outline" size={28} color="#475569" />
        <Text style={styles.centerTitle}>Admin access required.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.heroCard}>
        <View style={styles.heroIconWrap}>
          <Ionicons name="shield-checkmark-outline" size={22} color="#0F172A" />
        </View>
        <View style={styles.heroTextWrap}>
          <Text style={styles.heroTitle}>Data Backup</Text>
          <Text style={styles.heroSubtitle}>
            Create snapshots of your tenant data to recover from accidental deletion or attacks.
          </Text>
        </View>
      </View>

      <View style={styles.infoCard}>
        <Ionicons name="information-circle-outline" size={16} color="#1E3A8A" />
        <Text style={styles.infoText}>
          Take backups before major edits. Keep at least one latest backup and one monthly backup.
        </Text>
      </View>

      <Pressable
        onPress={onCreateBackup}
        disabled={creating}
        style={[styles.primaryButton, creating && styles.buttonDisabled]}
      >
        <Ionicons name="cloud-upload-outline" size={18} color="white" />
        <Text style={styles.primaryButtonText}>{creating ? "Creating backup..." : "Create New Backup"}</Text>
      </Pressable>

      <View style={styles.listHeader}>
        <Text style={styles.sectionTitle}>Backup History</Text>
        <Pressable onPress={() => loadBackups().catch(() => undefined)} disabled={loading}>
          <Text style={styles.refreshText}>{loading ? "Loading..." : "Refresh"}</Text>
        </Pressable>
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="archive-outline" size={20} color="#64748B" />
          <Text style={styles.emptyText}>No backups yet. Create your first backup now.</Text>
        </View>
      ) : (
        items.map((item) => {
          const busy = activeBackupId === item.id;
          return (
            <View key={item.id} style={styles.backupCard}>
              <View style={{ gap: 4 }}>
                <Text style={styles.backupId}>{item.id}</Text>
                <Text style={styles.metaText}>Created: {formatDate(item.createdAt)}</Text>
                <Text style={styles.metaText}>Size: {formatBytes(item.sizeBytes)}</Text>
              </View>

              <View style={styles.rowButtons}>
                <Pressable
                  onPress={() => onRestore(item.id)}
                  disabled={busy}
                  style={[styles.smallButton, styles.restoreButton, busy && styles.buttonDisabled]}
                >
                  <Ionicons name="refresh-outline" size={14} color="white" />
                  <Text style={styles.smallButtonText}>{busy ? "Please wait..." : "Restore"}</Text>
                </Pressable>
                <Pressable
                  onPress={() => onDelete(item.id)}
                  disabled={busy}
                  style={[styles.smallButton, styles.deleteButton, busy && styles.buttonDisabled]}
                >
                  <Ionicons name="trash-outline" size={14} color="white" />
                  <Text style={styles.smallButtonText}>{busy ? "Please wait..." : "Delete"}</Text>
                </Pressable>
              </View>

              <Pressable
                onPress={() => onDownloadZip(item.id).catch(() => undefined)}
                disabled={busy}
                style={[styles.downloadButton, busy && styles.buttonDisabled]}
              >
                <Ionicons name="download-outline" size={15} color="#0F172A" />
                <Text style={styles.downloadText}>{busy ? "Please wait..." : "Download ZIP"}</Text>
              </Pressable>
            </View>
          );
        })
      )}
    </ScrollView>
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
    paddingBottom: 24
  },
  centerScreen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#EEF2F7"
  },
  centerTitle: {
    color: "#334155",
    fontWeight: "700"
  },
  heroCard: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  heroIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center"
  },
  heroTextWrap: {
    flex: 1,
    gap: 2
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0F172A"
  },
  heroSubtitle: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "500"
  },
  infoCard: {
    borderWidth: 1,
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    padding: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8
  },
  infoText: {
    flex: 1,
    color: "#1E3A8A",
    fontWeight: "600"
  },
  primaryButton: {
    borderRadius: 12,
    paddingVertical: 12,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8
  },
  primaryButtonText: {
    color: "white",
    fontWeight: "800"
  },
  buttonDisabled: {
    opacity: 0.6
  },
  listHeader: {
    marginTop: 2,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A"
  },
  refreshText: {
    color: "#1D4ED8",
    fontWeight: "700"
  },
  emptyCard: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  emptyText: {
    color: "#475569",
    fontWeight: "600",
    flex: 1
  },
  backupCard: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "white",
    borderRadius: 14,
    padding: 12,
    gap: 10
  },
  backupId: {
    color: "#0F172A",
    fontWeight: "800",
    fontSize: 14
  },
  metaText: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "600"
  },
  rowButtons: {
    flexDirection: "row",
    gap: 8
  },
  smallButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6
  },
  restoreButton: {
    backgroundColor: "#2563EB"
  },
  deleteButton: {
    backgroundColor: "#B91C1C"
  },
  smallButtonText: {
    color: "white",
    fontWeight: "700"
  },
  downloadButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6
  },
  downloadText: {
    color: "#0F172A",
    fontWeight: "700"
  }
});
