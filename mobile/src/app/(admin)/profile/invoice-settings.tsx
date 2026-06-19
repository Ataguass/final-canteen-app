import { useCallback, useEffect, useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuthStore } from '../../../stores/useAuthStore';
import { InvoiceSettings } from "../../../types";
import { tenantService} from "../../../services/tenantService";
import { moderateScale, fontScale, verticalScale, scale, isTablet, gridColumns } from '../../../utils/responsive';
import { useTheme } from '../../../hooks/useTheme';
import { invoiceSettingsSchema, InvoiceSettingsFormData } from "../../../schemas/admin";
import { InputField } from "../../../components/ui/InputField";
import Animated, { FadeInUp } from "react-native-reanimated";

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
  const theme = useTheme();
  const { colors, isDark } = theme;
  const styles = createStyles(theme);
  const { user, accessToken } = useAuthStore();
  const [settings, setSettings] = useState<InvoiceSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const { control, handleSubmit, setValue, watch, reset } = useForm<InvoiceSettingsFormData>({
    resolver: zodResolver(invoiceSettingsSchema),
    defaultValues: {
      invoiceLogoUrl: "",
      invoiceFooterNote: "",
      invoiceShowLogo: true,
      invoiceShowSchoolName: true,
      invoiceShowOrderNumber: true,
      invoiceShowDate: true,
      invoiceShowCashier: true,
      invoiceShowPaymentDetails: true,
      invoiceShowTaxBreakup: true,
      invoiceShowNotes: true,
    }
  });

  const logoUrl = watch("invoiceLogoUrl");

  const loadSettings = useCallback(async () => {
    if (!user?.tenantId || !accessToken) return;
    const response = await tenantService.getInvoiceSettings(accessToken, user.tenantId);
    setSettings(response.data);
    reset({
      invoiceLogoUrl: response.data.invoiceLogoUrl ?? response.data.logo ?? "",
      invoiceFooterNote: response.data.invoiceFooterNote ?? "",
      invoiceShowLogo: response.data.invoiceShowLogo ?? true,
      invoiceShowSchoolName: response.data.invoiceShowSchoolName ?? true,
      invoiceShowOrderNumber: response.data.invoiceShowOrderNumber ?? true,
      invoiceShowDate: response.data.invoiceShowDate ?? true,
      invoiceShowCashier: response.data.invoiceShowCashier ?? true,
      invoiceShowPaymentDetails: response.data.invoiceShowPaymentDetails ?? true,
      invoiceShowTaxBreakup: response.data.invoiceShowTaxBreakup ?? true,
      invoiceShowNotes: response.data.invoiceShowNotes ?? true,
    });
  }, [accessToken, user?.tenantId, reset]);

  useEffect(() => {
    loadSettings().catch((error: unknown) => {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to load invoice settings");
    });
  }, [loadSettings]);

  const toggleField = (field: keyof InvoiceSettingsFormData) => {
    const current = watch(field);
    if (typeof current === "boolean") {
      setValue(field, !current);
    }
  };

  const saveSettings = async (data: InvoiceSettingsFormData) => {
    if (!settings || !user?.tenantId || !accessToken) return;
    try {
      setSaving(true);
      const response = await tenantService.updateInvoiceSettings(accessToken, user.tenantId, {
        invoiceLogoUrl: data.invoiceLogoUrl?.trim() || null,
        invoiceFooterNote: data.invoiceFooterNote?.trim() || null,
        invoiceShowLogo: data.invoiceShowLogo,
        invoiceShowSchoolName: data.invoiceShowSchoolName,
        invoiceShowOrderNumber: data.invoiceShowOrderNumber,
        invoiceShowDate: data.invoiceShowDate,
        invoiceShowCashier: data.invoiceShowCashier,
        invoiceShowPaymentDetails: data.invoiceShowPaymentDetails,
        invoiceShowTaxBreakup: data.invoiceShowTaxBreakup,
        invoiceShowNotes: data.invoiceShowNotes
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
      setValue("invoiceLogoUrl", response.data.invoiceLogoUrl ?? "");
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
      setValue("invoiceLogoUrl", "");
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

  const formValues = watch();

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Branding</Text>

          <View style={{ alignItems: "center", paddingVertical: verticalScale(8) }}>
            {logoUrl ? (
              <View style={{ position: "relative" }}>
                <View style={{ width: moderateScale(100), height: moderateScale(100), borderRadius: moderateScale(20), backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
                  <Image source={{ uri: logoUrl }} resizeMode="contain" style={{ width: moderateScale(90), height: moderateScale(90) }} />
                </View>
                <Pressable
                  onPress={removeLogo}
                  disabled={uploadingLogo}
                  style={{ position: "absolute", bottom: -6, right: -6, backgroundColor: "#EF4444", borderRadius: moderateScale(14), width: moderateScale(28), height: moderateScale(28), alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "white" }}
                >
                  <Ionicons name="trash" size={14} color="white" />
                </Pressable>
              </View>
            ) : (
              <View style={{ width: moderateScale(100), height: moderateScale(100), borderRadius: moderateScale(20), backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderStyle: "dashed", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="image-outline" size={32} color="#94A3B8" />
              </View>
            )}

            <View style={{ flexDirection: "row", gap: moderateScale(8), marginTop: verticalScale(16) }}>
              <Pressable
                onPress={() => pickAndUploadLogo("fit")}
                disabled={uploadingLogo}
                style={{ backgroundColor: colors.surfaceAlt, paddingHorizontal: moderateScale(16), paddingVertical: verticalScale(8), borderRadius: moderateScale(999), borderWidth: 1, borderColor: colors.border }}
              >
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: fontScale(13) }}>{uploadingLogo ? "..." : "Upload Fit"}</Text>
              </Pressable>
              <Pressable
                onPress={() => pickAndUploadLogo("square")}
                disabled={uploadingLogo}
                style={{ backgroundColor: colors.surfaceAlt, paddingHorizontal: moderateScale(16), paddingVertical: verticalScale(8), borderRadius: moderateScale(999), borderWidth: 1, borderColor: colors.border }}
              >
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: fontScale(13) }}>{uploadingLogo ? "..." : "Upload Square"}</Text>
              </Pressable>
            </View>
            
            <Text style={{ color: colors.textSecondary, fontSize: fontScale(11), marginTop: verticalScale(12), textAlign: "center", fontWeight: "500" }}>
              Recommended: 500x500 px. Max size 1MB.
            </Text>
          </View>

          <View style={{ marginTop: verticalScale(4) }}>
            <Text style={{ color: colors.textSecondary, fontSize: fontScale(11), fontWeight: "700", textTransform: "uppercase", marginBottom: verticalScale(6), marginLeft: moderateScale(2) }}>Or enter logo URL</Text>
            <Controller
              control={control}
              name="invoiceLogoUrl"
              render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
                <InputField
                  leftIcon="link-outline"
                  placeholder="https://your-domain.com/logo.png"
                  value={value || ""}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={error?.message}
                />
              )}
            />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(200).springify()} style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Footer Note</Text>
          <Text style={styles.sectionHint}>Optional message printed at the bottom of receipt.</Text>
          <Controller
            control={control}
            name="invoiceFooterNote"
            render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
              <InputField
                leftIcon="document-text-outline"
                placeholder="Thank you for visiting our canteen"
                value={value || ""}
                onChangeText={onChange}
                onBlur={onBlur}
                error={error?.message}
              />
            )}
          />
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(300).springify()} style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Receipt Fields</Text>
          <Text style={styles.sectionHint}>Enable or hide fields shown on invoice print.</Text>

          <View style={styles.toggleListContainer}>
            {toggleRows.map((row, index) => {
              const enabled = formValues[row.key as keyof InvoiceSettingsFormData] as boolean;
              return (
                <View key={row.key} style={[styles.toggleRow, index === toggleRows.length - 1 && styles.toggleRowLast]}>
                  <View style={styles.toggleIconWrap}>
                    <Ionicons name={row.icon} size={18} color={enabled ? (isDark ? colors.text : "#0F172A") : colors.textSecondary} />
                  </View>
                  <View style={styles.toggleTextWrap}>
                    <Text style={[styles.toggleTitle, !enabled && styles.toggleTitleDisabled]}>{row.label}</Text>
                    <Text style={styles.toggleHint}>{row.hint}</Text>
                  </View>
                  <Switch
                    value={enabled}
                    onValueChange={() => toggleField(row.key as keyof InvoiceSettingsFormData)}
                    thumbColor="white"
                    trackColor={{ false: "#CBD5E1", true: "#10B981" }}
                  />
                </View>
              );
            })}
          </View>
        </Animated.View>

        <Pressable onPress={handleSubmit(saveSettings)} disabled={saving} style={[styles.saveButton, saving && styles.buttonDisabled]}>
          <Ionicons name="save-outline" size={17} color="white" />
          <Text style={styles.saveButtonText}>{saving ? "Saving..." : "Save Invoice Settings"}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const createStyles = ({ colors, isDark }: { colors: any, isDark: boolean }) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background
  },
  scroll: {
    flex: 1
  },
  content: {
    padding: moderateScale(16),
    gap: moderateScale(12),
    paddingBottom: verticalScale(26)
  },
  centerScreen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: moderateScale(8),
    backgroundColor: colors.background
  },
  centerTitle: {
    color: colors.text,
    fontWeight: "700"
  },
  heroCard: {
    backgroundColor: colors.background,
    borderRadius: moderateScale(18),
    borderWidth: 1,
    borderColor: colors.border,
    padding: moderateScale(14),
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(12),
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: moderateScale(10),
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  heroIconWrap: {
    width: moderateScale(42),
    height: moderateScale(42),
    borderRadius: moderateScale(12),
    backgroundColor: isDark ? colors.surfaceAlt : "#DBEAFE",
    alignItems: "center",
    justifyContent: "center"
  },
  heroTextWrap: {
    flex: 1,
    gap: moderateScale(2)
  },
  heroTitle: {
    fontSize: fontScale(22),
    fontWeight: "800",
    color: colors.text
  },
  heroSubtitle: {
    color: colors.textSecondary,
    fontSize: fontScale(13),
    fontWeight: "500"
  },
  sectionCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: moderateScale(16),
    padding: moderateScale(16),
    gap: moderateScale(12),
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowRadius: moderateScale(8),
    shadowOffset: { width: 0, height: 3 },
    elevation: 2
  },
  sectionTitle: {
    fontSize: fontScale(19),
    fontWeight: "800",
    color: colors.text
  },
  sectionHint: {
    color: colors.textSecondary,
    fontWeight: "500"
  },
  fieldLabel: {
    color: colors.text,
    fontWeight: "700"
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: moderateScale(12),
    padding: moderateScale(11),
    backgroundColor: colors.card
  },
  multilineInput: {
    minHeight: moderateScale(84),
    textAlignVertical: "top"
  },
  buttonText: {
    color: "white",
    textAlign: "center",
    fontWeight: "700"
  },
  buttonDisabled: {
    opacity: 0.6
  },
  toggleListContainer: {
    marginTop: verticalScale(4),
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: moderateScale(16),
    backgroundColor: colors.background,
    overflow: "hidden"
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: moderateScale(14),
    paddingHorizontal: moderateScale(14),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: moderateScale(12)
  },
  toggleRowLast: {
    borderBottomWidth: 0
  },
  toggleIconWrap: {
    width: moderateScale(38),
    height: moderateScale(38),
    borderRadius: moderateScale(12),
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border
  },
  toggleTextWrap: {
    flex: 1,
    justifyContent: "center",
    gap: moderateScale(2)
  },
  toggleTitle: {
    color: colors.text,
    fontWeight: "800",
    fontSize: fontScale(15)
  },
  toggleTitleDisabled: {
    color: colors.textSecondary,
    fontWeight: "700"
  },
  toggleHint: {
    color: colors.textSecondary,
    fontSize: fontScale(12),
    fontWeight: "500"
  },
  saveButton: {
    marginTop: verticalScale(2),
    backgroundColor: isDark ? colors.text : "#0F172A",
    borderRadius: moderateScale(12),
    padding: moderateScale(13),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: moderateScale(8)
  },
  saveButtonText: {
    color: isDark ? colors.background : "white",
    textAlign: "center",
    fontWeight: "800"
  }
});
