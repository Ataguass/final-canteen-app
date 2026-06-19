import { Ionicons } from "@expo/vector-icons";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuthStore } from '../../../stores/useAuthStore';
import { Banner } from "../../../types";
import { bannerService} from "../../../services/bannerService";
import { useTheme } from '../../../hooks/useTheme';
import { bannerSchema, BannerFormData } from "../../../schemas/admin";

const MAX_BANNER_SIZE_BYTES = 2 * 1024 * 1024;
const MAX_BANNER_WIDTH = 1600;
const MAX_BANNER_HEIGHT = 900;
const estimateBase64Bytes = (base64: string): number => Math.floor((base64.length * 3) / 4);


export default function Screen() {
  const theme = useTheme();
  const { colors, isDark } = theme;
  const { user, accessToken } = useAuthStore();
  
  const cardShadow = {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.card,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  } as const;
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const { control, handleSubmit, setValue, watch, reset } = useForm<BannerFormData>({
    resolver: zodResolver(bannerSchema),
    defaultValues: {
      title: "",
      imageUrl: "",
      actionUrl: "",
      sortOrder: 0,
      isActive: true,
    }
  });

  const imageUrl = watch("imageUrl");

  const [uploadingImage, setUploadingImage] = useState(false);
  const [query, setQuery] = useState("");
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    if (!user?.tenantId || !accessToken) return;
    try {
      setLoading(true);
      const response = await bannerService.listBanners(accessToken, user.tenantId, true);
      const sorted = [...response.data].sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return +new Date(b.createdAt) - +new Date(a.createdAt);
      });
      setBanners(sorted);
      setLastUpdated(new Date());
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to load banners");
    } finally {
      setLoading(false);
    }
  }, [accessToken, user?.tenantId]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const onCreate = async (data: BannerFormData) => {
    if (!user?.tenantId || !accessToken) return;
    try {
      setCreating(true);
      await bannerService.createBanner(accessToken, user.tenantId, {
        title: data.title?.trim() || "",
        imageUrl: data.imageUrl.trim(),
        actionUrl: data.actionUrl?.trim() || undefined,
        sortOrder: data.sortOrder || 0
      });
      reset();
      await load();
      Alert.alert("Success", "Banner created.");
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Could not create banner");
    } finally {
      setCreating(false);
    }
  };

  const onToggle = async (bannerId: string) => {
    if (!user?.tenantId || !accessToken) return;
    try {
      await bannerService.toggleBanner(accessToken, user.tenantId, bannerId);
      await load();
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Could not update banner");
    }
  };

  const onDelete = async (bannerId: string) => {
    if (!user?.tenantId || !accessToken) return;
    Alert.alert("Delete banner", "Are you sure you want to delete this banner?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await bannerService.deleteBanner(accessToken, user.tenantId, bannerId);
            await load();
          } catch (error) {
            Alert.alert("Error", error instanceof Error ? error.message : "Could not delete banner");
          }
        }
      }
    ]);
  };

  const pickAndUploadImage = async () => {
    if (!user?.tenantId || !accessToken) return;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission needed", "Allow gallery access to upload banner image.");
        return;
      }

      const picked = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        quality: 1,
        mediaTypes: ["images"],
        aspect: [16, 9]
      });

      if (picked.canceled || !picked.assets.length) return;
      const asset = picked.assets[0];
      if (asset.mimeType && !asset.mimeType.startsWith("image/")) {
        Alert.alert("Invalid file", "Please select an image.");
        return;
      }

      const scale = Math.min(MAX_BANNER_WIDTH / asset.width, MAX_BANNER_HEIGHT / asset.height, 1);
      const targetWidth = Math.max(1, Math.round(asset.width * scale));
      const targetHeight = Math.max(1, Math.round(asset.height * scale));

      const firstPass = await ImageManipulator.manipulateAsync(
        asset.uri,
        scale < 1 ? [{ resize: { width: targetWidth, height: targetHeight } }] : [],
        { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      let base64 = firstPass.base64 ?? "";
      if (!base64) throw new Error("Could not prepare banner image");

      if (estimateBase64Bytes(base64) > MAX_BANNER_SIZE_BYTES) {
        const secondPass = await ImageManipulator.manipulateAsync(firstPass.uri, [], {
          compress: 0.62,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true
        });
        base64 = secondPass.base64 ?? "";
      }

      if (!base64 || estimateBase64Bytes(base64) > MAX_BANNER_SIZE_BYTES) {
        Alert.alert("Image too large", "Please pick a smaller image (max 2 MB).");
        return;
      }

      setUploadingImage(true);
      const upload = await bannerService.uploadBannerImage(accessToken, user.tenantId, `data:image/jpeg;base64,${base64}`);
      setValue("imageUrl", upload.data.imageUrl);
      Alert.alert("Uploaded", "Banner image uploaded from phone.");
    } catch (error) {
      Alert.alert("Upload failed", error instanceof Error ? error.message : "Could not upload image");
    } finally {
      setUploadingImage(false);
    }
  };

  const stats = useMemo(
    () => ({
      total: banners.length,
      active: banners.filter((banner) => banner.isActive).length,
      hidden: banners.filter((banner) => !banner.isActive).length
    }),
    [banners]
  );

  const filteredBanners = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return banners.filter((banner) => {
      if (showActiveOnly && !banner.isActive) return false;
      if (!normalized) return true;
      return (
        banner.title.toLowerCase().includes(normalized) ||
        (banner.actionUrl ?? "").toLowerCase().includes(normalized)
      );
    });
  }, [banners, query, showActiveOnly]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 24 }}>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1, ...cardShadow, padding: 12 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "700" }}>Total</Text>
          <Text style={{ color: colors.text, fontSize: 24, fontWeight: "800", marginTop: 4 }}>{stats.total}</Text>
        </View>
        <View style={{ flex: 1, ...cardShadow, padding: 12 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "700" }}>Active</Text>
          <Text style={{ color: isDark ? '#34D399' : "#059669", fontSize: 24, fontWeight: "800", marginTop: 4 }}>{stats.active}</Text>
        </View>
        <View style={{ flex: 1, ...cardShadow, padding: 12 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "700" }}>Hidden</Text>
          <Text style={{ color: isDark ? '#F87171' : "#DC2626", fontSize: 24, fontWeight: "800", marginTop: 4 }}>{stats.hidden}</Text>
        </View>
      </View>

      <View style={{ ...cardShadow, padding: 16, gap: 12 }}>
        <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>Add New Banner</Text>
        
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Controller
            control={control}
            name="title"
            render={({ field: { onChange, value }, fieldState: { error } }) => (
              <View style={{ flex: 2 }}>
                <TextInput
                  value={value || ""}
                  onChangeText={onChange}
                  placeholder="Banner title (optional)"
                  placeholderTextColor={colors.textSecondary}
                  style={{ borderWidth: 1, borderColor: error ? "#EF4444" : colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: colors.surfaceAlt, fontSize: 14, color: colors.text, fontWeight: "500" }}
                />
                {error && <Text style={{ color: "#EF4444", fontSize: 12, marginLeft: 4, marginTop: 4 }}>{error.message}</Text>}
              </View>
            )}
          />
          <Controller
            control={control}
            name="sortOrder"
            render={({ field: { onChange, value }, fieldState: { error } }) => (
              <View style={{ flex: 1 }}>
                <TextInput
                  value={value === 0 ? "0" : String(value || "")}
                  onChangeText={onChange}
                  placeholder="Order (0)"
                  keyboardType="numeric"
                  placeholderTextColor={colors.textSecondary}
                  style={{ borderWidth: 1, borderColor: error ? "#EF4444" : colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: colors.surfaceAlt, fontSize: 14, color: colors.text, fontWeight: "500" }}
                />
                {error && <Text style={{ color: "#EF4444", fontSize: 12, marginLeft: 4, marginTop: 4 }}>{error.message}</Text>}
              </View>
            )}
          />
        </View>

        <Controller
          control={control}
          name="actionUrl"
          render={({ field: { onChange, value }, fieldState: { error } }) => (
            <View>
              <TextInput
                value={value || ""}
                onChangeText={onChange}
                placeholder="Action URL (optional destination link)"
                autoCapitalize="none"
                placeholderTextColor={colors.textSecondary}
                style={{ borderWidth: 1, borderColor: error ? "#EF4444" : colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: colors.surfaceAlt, fontSize: 14, color: colors.text, fontWeight: "500" }}
              />
              {error && <Text style={{ color: "#EF4444", fontSize: 12, marginLeft: 4, marginTop: 4 }}>{error.message}</Text>}
            </View>
          )}
        />

        <View style={{ backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, borderStyle: "dashed", borderRadius: 14, padding: 16, alignItems: "center", gap: 10 }}>
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              resizeMode="cover"
              style={{ width: "100%", height: 110, backgroundColor: colors.background, borderRadius: 10 }}
            />
          ) : (
            <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="image-outline" size={28} color={colors.textSecondary} />
            </View>
          )}

          <Pressable
            onPress={pickAndUploadImage}
            disabled={uploadingImage}
            style={{
              borderRadius: 999,
              paddingVertical: 10,
              paddingHorizontal: 20,
              backgroundColor: colors.primary,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 8,
              marginTop: 4
            }}
          >
            <Ionicons name="cloud-upload-outline" size={16} color="white" />
            <Text style={{ color: "white", fontWeight: "700", fontSize: 14 }}>{uploadingImage ? "Uploading..." : "Upload Image"}</Text>
          </Pressable>
          <Text style={{ color: colors.textSecondary, fontSize: 12, textAlign: "center", fontWeight: "500" }}>
            Recommended size: 1600x900 px (16:9 ratio). Max 2MB.
          </Text>
        </View>

        <Controller
          control={control}
          name="imageUrl"
          render={({ field: { onChange, value }, fieldState: { error } }) => (
            <View>
              <TextInput
                value={value || ""}
                onChangeText={onChange}
                placeholder="Or paste an image URL here..."
                autoCapitalize="none"
                placeholderTextColor={colors.textSecondary}
                style={{ borderWidth: 1, borderColor: error ? "#EF4444" : colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: colors.surfaceAlt, fontSize: 13, color: colors.text, fontWeight: "500" }}
              />
              {error && <Text style={{ color: "#EF4444", fontSize: 12, marginLeft: 4, marginTop: 4 }}>{error.message}</Text>}
            </View>
          )}
        />

        <Pressable
          onPress={handleSubmit(onCreate)}
          disabled={creating}
          style={{ borderRadius: 14, paddingVertical: 14, alignItems: "center", backgroundColor: isDark ? colors.text : "#0F172A", marginTop: 4, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3 }}
        >
          <Text style={{ color: isDark ? colors.background : "white", fontWeight: "800", fontSize: 15 }}>{creating ? "Creating Banner..." : "Create Banner"}</Text>
        </Pressable>
      </View>

      <View style={{ ...cardShadow, padding: 14, gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surfaceAlt, flexDirection: "row", alignItems: "center", paddingHorizontal: 12 }}>
            <Ionicons name="search-outline" size={16} color={colors.textSecondary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search title..."
              placeholderTextColor={colors.textSecondary}
              style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 8, color: colors.text, fontWeight: "500", fontSize: 14 }}
            />
            {query ? (
              <Pressable onPress={() => setQuery("")}>
                <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
              </Pressable>
            ) : null}
          </View>
          <Pressable
            onPress={() => setShowActiveOnly((value) => !value)}
            style={{
              borderRadius: 12,
              borderWidth: 1,
              borderColor: showActiveOnly ? (isDark ? colors.text : "#0F172A") : colors.border,
              backgroundColor: showActiveOnly ? (isDark ? colors.text : "#0F172A") : colors.surfaceAlt,
              paddingVertical: 12,
              paddingHorizontal: 14,
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <Ionicons name={showActiveOnly ? "eye-outline" : "eye-off-outline"} size={18} color={showActiveOnly ? (isDark ? colors.background : "white") : colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6, paddingHorizontal: 4 }}>
        <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>
          Existing Banners <Text style={{ color: colors.textSecondary, fontWeight: "600", fontSize: 14 }}>({filteredBanners.length})</Text>
        </Text>
        <Pressable onPress={() => load().catch(() => undefined)} disabled={loading}>
          <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 14 }}>{loading ? "Loading..." : "Refresh"}</Text>
        </Pressable>
      </View>

      {filteredBanners.length === 0 ? (
        <View style={{ ...cardShadow, padding: 14 }}>
          <Text style={{ color: colors.textSecondary }}>No banners found.</Text>
        </View>
      ) : (
        filteredBanners.map((banner) => (
          <View key={banner.id} style={{ ...cardShadow, padding: 14, gap: 12 }}>
            <Image
              source={{ uri: banner.imageUrl }}
              resizeMode="cover"
              style={{ width: "100%", height: 160, backgroundColor: colors.surfaceAlt, borderRadius: 12 }}
            />
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: colors.text, fontWeight: "800", fontSize: 16 }}>{banner.title || "(No Title)"}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "500" }}>Order: {banner.sortOrder} {banner.actionUrl ? `• Link: ${banner.actionUrl}` : ""}</Text>
              </View>
              <View style={{ borderRadius: 999, backgroundColor: banner.isActive ? (isDark ? 'rgba(16, 185, 129, 0.15)' : "#ECFDF5") : (isDark ? 'rgba(239, 68, 68, 0.15)' : "#FEF2F2"), paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: banner.isActive ? (isDark ? '#059669' : "#A7F3D0") : (isDark ? '#DC2626' : "#FECACA") }}>
                <Text style={{ color: banner.isActive ? (isDark ? '#34D399' : "#059669") : (isDark ? '#F87171' : "#DC2626"), fontWeight: "800", fontSize: 11, textTransform: "uppercase" }}>
                  {banner.isActive ? "Active" : "Hidden"}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 8, paddingTop: 4 }}>
              <Pressable
                onPress={() => onToggle(banner.id)}
                style={{
                  flex: 1,
                  borderRadius: 12,
                  paddingVertical: 12,
                  alignItems: "center",
                  backgroundColor: banner.isActive ? colors.surfaceAlt : (isDark ? '#059669' : "#10B981")
                }}
              >
                <Text style={{ color: banner.isActive ? colors.textSecondary : "white", fontWeight: "800", fontSize: 14 }}>{banner.isActive ? "Hide" : "Activate"}</Text>
              </Pressable>
              <Pressable
                onPress={() => onDelete(banner.id)}
                style={{ flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: "center", backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : "#FEF2F2" }}
              >
                <Text style={{ color: isDark ? '#F87171' : "#DC2626", fontWeight: "800", fontSize: 14 }}>Delete</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}
