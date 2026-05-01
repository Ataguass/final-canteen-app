import { useCallback, useEffect, useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../../../hooks/useAuth";
import { tenantService, type InvoiceSettings } from "../../../services/tenantService";

type ToggleField =
  | "invoiceShowLogo"
  | "invoiceShowSchoolName"
  | "invoiceShowOrderNumber"
  | "invoiceShowDate"
  | "invoiceShowCashier"
  | "invoiceShowPaymentDetails"
  | "invoiceShowTaxBreakup"
  | "invoiceShowNotes";

type ToggleRow = {
  key: ToggleField;
  label: string;
  hint: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const MAX_LOGO_SIZE_BYTES = 1024 * 1024;
const MAX_LOGO_WIDTH = 1024;
const MAX_LOGO_HEIGHT = 1024;
type UploadMode = "fit" | "square";

const estimateBase64Bytes = (base64: string): number => Math.floor((base64.length * 3) / 4);

const toggleRows: ToggleRow[] = [
  { key: "invoiceShowLogo", label: "Show Logo", hint: "Display logo at top of receipt", icon: "image-outline" },
  {
    key: "invoiceShowSchoolName",
    label: "Show School Name",
    hint: "Display tenant/school name in header",
    icon: "school-outline"
  },
  {
    key: "invoiceShowOrderNumber",
    label: "Show Order Number",
    hint: "Print order number for easier tracking",
    icon: "receipt-outline"
  },
  { key: "invoiceShowDate", label: "Show Date & Time", hint: "Print order date/time", icon: "calendar-outline" },
  { key: "invoiceShowCashier", label: "Show Cashier", hint: "Display cashier/admin name", icon: "person-outline" },
  {
    key: "invoiceShowPaymentDetails",
    label: "Show Payment Details",
    hint: "Print payment method and status",
    icon: "card-outline"
  },
  {
    key: "invoiceShowTaxBreakup",
    label: "Show Tax Breakup",
    hint: "Print subtotal and tax rows",
    icon: "calculator-outline"
  },
  {
    key: "invoiceShowNotes",
    label: "Show POS Note",
    hint: "Print note entered during payment",
    icon: "document-text-outline"
  }
];

export default function Screen() {
  const { user, accessToken } = useAuth();
  const [settings, setSettings] = useState<InvoiceSettings | null>(null);
  const [logoUrl, setLogoUrl] = useState("");
  const [footerNote, setFooterNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const loadSettings = useCallback(async () => {
    if (!user?.tenantId || !accessToken) return;
    const response = await tenantService.getInvoiceSettings(accessToken, user.tenantId);
    setSettings(response.data);
    setLogoUrl(response.data.invoiceLogoUrl ?? response.data.logo ?? "");
    setFooterNote(response.data.invoiceFooterNote ?? "");
  }, [accessToken, user?.tenantId]);

  useEffect(() => {
    loadSettings().catch((error: unknown) => {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to load invoice settings");
    });
  }, [loadSettings]);

  const toggleField = (field: ToggleField) => {
    if (!settings) return;
    setSettings({ ...settings, [field]: !settings[field] });
  };

  const saveSettings = async () => {
    if (!settings || !user?.tenantId || !accessToken) return;
    try {
      setSaving(true);
      const response = await tenantService.updateInvoiceSettings(accessToken, user.tenantId, {
        invoiceLogoUrl: logoUrl.trim() || null,
        invoiceFooterNote: footerNote.trim() || null,
        invoiceShowLogo: settings.invoiceShowLogo,
        invoiceShowSchoolName: settings.invoiceShowSchoolName,
        invoiceShowOrderNumber: settings.invoiceShowOrderNumber,
        invoiceShowDate: settings.invoiceShowDate,
        invoiceShowCashier: settings.invoiceShowCashier,
        invoiceShowPaymentDetails: settings.invoiceShowPaymentDetails,
        invoiceShowTaxBreakup: settings.invoiceShowTaxBreakup,
        invoiceShowNotes: settings.invoiceShowNotes
      });
      setSettings(response.data);
      Alert.alert("Saved", "Invoice settings updated.");
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Could not save invoice settings");
    } finally {
      setSaving(false);
    }
  };

  const pickAndUploadLogo = async (mode: UploadMode) => {
    if (!settings || !user?.tenantId || !accessToken) return;

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission needed", "Please allow photo access to upload logo.");
        return;
      }

      const picked = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        quality: 1,
        mediaTypes: ["images"]
      });

      if (picked.canceled || !picked.assets.length) {
        return;
      }

      const asset = picked.assets[0];
      if (asset.mimeType && !asset.mimeType.startsWith("image/")) {
        Alert.alert("Invalid file", "Please select an image file.");
        return;
      }

      const actions: ImageManipulator.Action[] = [];
      if (mode === "square") {
        const side = Math.min(asset.width, asset.height);
        const originX = Math.floor((asset.width - side) / 2);
        const originY = Math.floor((asset.height - side) / 2);
        actions.push({ crop: { originX, originY, width: side, height: side } });
        if (side > MAX_LOGO_WIDTH) {
          actions.push({ resize: { width: MAX_LOGO_WIDTH, height: MAX_LOGO_WIDTH } });
        }
      } else {
        const scale = Math.min(MAX_LOGO_WIDTH / asset.width, MAX_LOGO_HEIGHT / asset.height, 1);
        const targetWidth = Math.max(1, Math.round(asset.width * scale));
        const targetHeight = Math.max(1, Math.round(asset.height * scale));
        if (scale < 1) {
          actions.push({ resize: { width: targetWidth, height: targetHeight } });
        }
      }

      const primary = await ImageManipulator.manipulateAsync(asset.uri, actions, {
        compress: 0.82,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true
      });

      let base64 = primary.base64 ?? "";
      let uploadDataUrl = base64 ? `data:image/jpeg;base64,${base64}` : "";

      if (!uploadDataUrl) {
        throw new Error("Could not prepare image for upload");
      }

      if (estimateBase64Bytes(base64) > MAX_LOGO_SIZE_BYTES) {
        const compressed = await ImageManipulator.manipulateAsync(primary.uri, [], {
          compress: 0.6,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true
        });
        base64 = compressed.base64 ?? "";
        uploadDataUrl = base64 ? `data:image/jpeg;base64,${base64}` : "";
      }

      if (!uploadDataUrl || estimateBase64Bytes(base64) > MAX_LOGO_SIZE_BYTES) {
        Alert.alert("Image too large", "Please choose a smaller image (max 1 MB after compression).");
        return;
      }

      setUploadingLogo(true);
      const response = await tenantService.uploadInvoiceLogo(accessToken, user.tenantId, uploadDataUrl);
      setSettings(response.data);
      setLogoUrl(response.data.invoiceLogoUrl ?? "");
      Alert.alert("Uploaded", mode === "square" ? "Square logo uploaded successfully." : "Logo uploaded successfully.");
    } catch (error) {
      Alert.alert("Upload failed", error instanceof Error ? error.message : "Could not upload logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  const removeLogo = async () => {
    if (!settings || !user?.tenantId || !accessToken) return;
    try {
      setUploadingLogo(true);
      const response = await tenantService.removeInvoiceLogo(accessToken, user.tenantId);
      setSettings(response.data);
      setLogoUrl("");
      Alert.alert("Removed", "Logo removed successfully.");
    } catch (error) {
      Alert.alert("Remove failed", error instanceof Error ? error.message : "Could not remove logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
    return (
      <View style={styles.centerScreen}>
        <Ionicons name="lock-closed-outline" size={28} color="#475569" />
        <Text style={styles.centerTitle}>Admin access required.</Text>
      </View>
    );
  }

  if (!settings) {
    return (
      <View style={styles.centerScreen}>
        <Ionicons name="receipt-outline" size={28} color="#475569" />
        <Text style={styles.centerTitle}>Loading invoice settings...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="receipt" size={21} color="#0F172A" />
          </View>
          <View style={styles.heroTextWrap}>
            <Text style={styles.heroTitle}>Invoice Settings</Text>
            <Text style={styles.heroSubtitle}>Control branding and receipt fields shown to customers.</Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Branding</Text>
          <Text style={styles.sectionHint}>Use URL or upload from phone (max 1MB, max 1024x1024 px).</Text>

          <Text style={styles.fieldLabel}>Logo URL</Text>
          <TextInput
            value={logoUrl}
            onChangeText={setLogoUrl}
            placeholder="https://your-domain.com/logo.png"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />

          <View style={styles.buttonRow}>
            <Pressable
              onPress={() => pickAndUploadLogo("fit")}
              disabled={uploadingLogo}
              style={[styles.button, styles.buttonDark, uploadingLogo && styles.buttonDisabled]}
            >
              <Ionicons name="cloud-upload-outline" size={16} color="white" />
              <Text style={styles.buttonText}>{uploadingLogo ? "Uploading..." : "Upload Fit"}</Text>
            </Pressable>
            <Pressable
              onPress={() => pickAndUploadLogo("square")}
              disabled={uploadingLogo}
              style={[styles.button, styles.buttonIndigo, uploadingLogo && styles.buttonDisabled]}
            >
              <Ionicons name="scan-outline" size={16} color="white" />
              <Text style={styles.buttonText}>{uploadingLogo ? "Uploading..." : "Upload Square"}</Text>
            </Pressable>
          </View>

          {logoUrl ? (
            <>
              <View style={styles.previewCard}>
                <Text style={styles.previewTitle}>Current Logo Preview</Text>
                <Image source={{ uri: logoUrl }} resizeMode="contain" style={styles.logoPreview} />
              </View>

              <Pressable
                onPress={removeLogo}
                disabled={uploadingLogo}
                style={[styles.removeButton, uploadingLogo && styles.buttonDisabled]}
              >
                <Ionicons name="trash-outline" size={16} color="white" />
                <Text style={styles.buttonText}>{uploadingLogo ? "Please wait..." : "Remove Logo"}</Text>
              </Pressable>
            </>
          ) : (
            <View style={styles.emptyLogoCard}>
              <Ionicons name="image-outline" size={20} color="#64748B" />
              <Text style={styles.emptyLogoText}>No logo selected yet.</Text>
            </View>
          )}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Footer Note</Text>
          <Text style={styles.sectionHint}>Optional message printed at the bottom of receipt.</Text>
          <TextInput
            value={footerNote}
            onChangeText={setFooterNote}
            placeholder="Thank you for visiting our canteen"
            multiline
            style={[styles.input, styles.multilineInput]}
          />
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Receipt Fields</Text>
          <Text style={styles.sectionHint}>Enable or hide fields shown on invoice print.</Text>

          {toggleRows.map((row) => {
            const enabled = settings[row.key];
            return (
              <Pressable
                key={row.key}
                onPress={() => toggleField(row.key)}
                style={[styles.toggleCard, enabled && styles.toggleCardEnabled]}
              >
                <View style={styles.toggleLeft}>
                  <View style={[styles.toggleIconWrap, enabled && styles.toggleIconWrapEnabled]}>
                    <Ionicons name={row.icon} size={16} color={enabled ? "#047857" : "#64748B"} />
                  </View>
                  <View style={styles.toggleTextWrap}>
                    <Text style={[styles.toggleTitle, enabled && styles.toggleTitleEnabled]}>{row.label}</Text>
                    <Text style={styles.toggleHint}>{row.hint}</Text>
                  </View>
                </View>
                <View style={styles.toggleRight}>
                  <View style={[styles.toggleStatusBadge, enabled ? styles.toggleStatusOn : styles.toggleStatusOff]}>
                    <Text style={[styles.toggleStatusText, enabled ? styles.toggleStatusTextOn : styles.toggleStatusTextOff]}>
                      {enabled ? "ON" : "OFF"}
                    </Text>
                  </View>
                  <Switch
                    value={enabled}
                    onValueChange={() => toggleField(row.key)}
                    thumbColor={enabled ? "#FFFFFF" : "#FFFFFF"}
                    trackColor={{ false: "#CBD5E1", true: "#10B981" }}
                  />
                </View>
              </Pressable>
            );
          })}
        </View>

        <Pressable onPress={saveSettings} disabled={saving} style={[styles.saveButton, saving && styles.buttonDisabled]}>
          <Ionicons name="save-outline" size={17} color="white" />
          <Text style={styles.saveButtonText}>{saving ? "Saving..." : "Save Invoice Settings"}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#EEF2F7"
  },
  scroll: {
    flex: 1
  },
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 26
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
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
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
  sectionCard: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    padding: 12,
    gap: 10,
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#0F172A"
  },
  sectionHint: {
    color: "#64748B",
    fontWeight: "500"
  },
  fieldLabel: {
    color: "#334155",
    fontWeight: "700"
  },
  input: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    padding: 11,
    backgroundColor: "#FFFFFF"
  },
  multilineInput: {
    minHeight: 84,
    textAlignVertical: "top"
  },
  buttonRow: {
    flexDirection: "row",
    gap: 8
  },
  button: {
    flex: 1,
    borderRadius: 12,
    padding: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6
  },
  buttonDark: {
    backgroundColor: "#0F172A"
  },
  buttonIndigo: {
    backgroundColor: "#4338CA"
  },
  removeButton: {
    backgroundColor: "#B91C1C",
    borderRadius: 12,
    padding: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6
  },
  buttonText: {
    color: "white",
    textAlign: "center",
    fontWeight: "700"
  },
  buttonDisabled: {
    opacity: 0.6
  },
  previewCard: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 10,
    backgroundColor: "#F8FAFC",
    gap: 8
  },
  previewTitle: {
    color: "#0F172A",
    fontWeight: "700"
  },
  logoPreview: {
    width: "100%",
    height: 98,
    backgroundColor: "#FFFFFF",
    borderRadius: 10
  },
  emptyLogoCard: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    padding: 14,
    alignItems: "center",
    gap: 6
  },
  emptyLogoText: {
    color: "#64748B",
    fontWeight: "600"
  },
  toggleCard: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    padding: 10,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10
  },
  toggleCardEnabled: {
    borderColor: "#86EFAC",
    backgroundColor: "#ECFDF5"
  },
  toggleLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  toggleIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center"
  },
  toggleIconWrapEnabled: {
    backgroundColor: "#D1FAE5"
  },
  toggleTextWrap: {
    flex: 1,
    gap: 2
  },
  toggleTitle: {
    color: "#111827",
    fontWeight: "700"
  },
  toggleTitleEnabled: {
    color: "#065F46"
  },
  toggleHint: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "500"
  },
  toggleRight: {
    alignItems: "flex-end",
    gap: 4
  },
  toggleStatusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3
  },
  toggleStatusOn: {
    backgroundColor: "#BBF7D0"
  },
  toggleStatusOff: {
    backgroundColor: "#E2E8F0"
  },
  toggleStatusText: {
    fontSize: 11,
    fontWeight: "800"
  },
  toggleStatusTextOn: {
    color: "#065F46"
  },
  toggleStatusTextOff: {
    color: "#334155"
  },
  saveButton: {
    marginTop: 2,
    backgroundColor: "#0F172A",
    borderRadius: 12,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  saveButtonText: {
    color: "white",
    textAlign: "center",
    fontWeight: "800"
  }
});
