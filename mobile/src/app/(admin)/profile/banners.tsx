import { Ionicons } from "@expo/vector-icons";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useAuth } from "../../../hooks/useAuth";
import { bannerService, type Banner } from "../../../services/bannerService";

const MAX_BANNER_SIZE_BYTES = 2 * 1024 * 1024;
const MAX_BANNER_WIDTH = 1600;
const MAX_BANNER_HEIGHT = 900;
const estimateBase64Bytes = (base64: string): number => Math.floor((base64.length * 3) / 4);

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

export default function Screen() {
  const { user, accessToken } = useAuth();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [actionUrl, setActionUrl] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
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

  const onCreate = async () => {
    if (!user?.tenantId || !accessToken) return;
    if (!imageUrl.trim()) {
      Alert.alert("Missing fields", "Image URL is required.");
      return;
    }
    try {
      setCreating(true);
      await bannerService.createBanner(accessToken, user.tenantId, {
        title: title.trim(),
        imageUrl: imageUrl.trim(),
        actionUrl: actionUrl.trim() || undefined,
        sortOrder: Number(sortOrder) || 0
      });
      setTitle("");
      setImageUrl("");
      setActionUrl("");
      setSortOrder("0");
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
      setImageUrl(upload.data.imageUrl);
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
    <ScrollView style={{ flex: 1, backgroundColor: "#EEF2F7" }} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 24 }}>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1, ...cardShadow, padding: 12 }}>
          <Text style={{ color: "#475569", fontSize: 12, fontWeight: "700" }}>Total</Text>
          <Text style={{ color: "#0F172A", fontSize: 24, fontWeight: "800", marginTop: 4 }}>{stats.total}</Text>
        </View>
        <View style={{ flex: 1, ...cardShadow, padding: 12 }}>
          <Text style={{ color: "#475569", fontSize: 12, fontWeight: "700" }}>Active</Text>
          <Text style={{ color: "#059669", fontSize: 24, fontWeight: "800", marginTop: 4 }}>{stats.active}</Text>
        </View>
        <View style={{ flex: 1, ...cardShadow, padding: 12 }}>
          <Text style={{ color: "#475569", fontSize: 12, fontWeight: "700" }}>Hidden</Text>
          <Text style={{ color: "#DC2626", fontSize: 24, fontWeight: "800", marginTop: 4 }}>{stats.hidden}</Text>
        </View>
      </View>

      <View style={{ ...cardShadow, padding: 16, gap: 12 }}>
        <Text style={{ fontSize: 18, fontWeight: "800", color: "#0F172A" }}>Add New Banner</Text>
        
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Banner title (optional)"
            placeholderTextColor="#94A3B8"
            style={{ flex: 2, borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: "#F8FAFC", fontSize: 14, color: "#0F172A", fontWeight: "500" }}
          />
          <TextInput
            value={sortOrder}
            onChangeText={setSortOrder}
            placeholder="Order (0)"
            keyboardType="numeric"
            placeholderTextColor="#94A3B8"
            style={{ flex: 1, borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: "#F8FAFC", fontSize: 14, color: "#0F172A", fontWeight: "500" }}
          />
        </View>

        <TextInput
          value={actionUrl}
          onChangeText={setActionUrl}
          placeholder="Action URL (optional destination link)"
          autoCapitalize="none"
          placeholderTextColor="#94A3B8"
          style={{ borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: "#F8FAFC", fontSize: 14, color: "#0F172A", fontWeight: "500" }}
        />

        <View style={{ backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0", borderStyle: "dashed", borderRadius: 14, padding: 16, alignItems: "center", gap: 10 }}>
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              resizeMode="cover"
              style={{ width: "100%", height: 110, backgroundColor: "#EEF2F7", borderRadius: 10 }}
            />
          ) : (
            <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: "#EEF2F7", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="image-outline" size={28} color="#94A3B8" />
            </View>
          )}

          <Pressable
            onPress={pickAndUploadImage}
            disabled={uploadingImage}
            style={{
              borderRadius: 999,
              paddingVertical: 10,
              paddingHorizontal: 20,
              backgroundColor: "#4338CA",
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
          <Text style={{ color: "#64748B", fontSize: 12, textAlign: "center", fontWeight: "500" }}>
            Recommended size: 1600x900 px (16:9 ratio). Max 2MB.
          </Text>
        </View>

        <TextInput
          value={imageUrl}
          onChangeText={setImageUrl}
          placeholder="Or paste an image URL here..."
          autoCapitalize="none"
          placeholderTextColor="#94A3B8"
          style={{ borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "#F8FAFC", fontSize: 13, color: "#0F172A", fontWeight: "500" }}
        />

        <Pressable
          onPress={onCreate}
          disabled={creating}
          style={{ borderRadius: 14, paddingVertical: 14, alignItems: "center", backgroundColor: "#0F172A", marginTop: 4, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3 }}
        >
          <Text style={{ color: "white", fontWeight: "800", fontSize: 15 }}>{creating ? "Creating Banner..." : "Create Banner"}</Text>
        </Pressable>
      </View>

      <View style={{ ...cardShadow, padding: 14, gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ flex: 1, borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, backgroundColor: "#F8FAFC", flexDirection: "row", alignItems: "center", paddingHorizontal: 12 }}>
            <Ionicons name="search-outline" size={16} color="#64748B" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search title..."
              placeholderTextColor="#94A3B8"
              style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 8, color: "#0F172A", fontWeight: "500", fontSize: 14 }}
            />
            {query ? (
              <Pressable onPress={() => setQuery("")}>
                <Ionicons name="close-circle" size={18} color="#94A3B8" />
              </Pressable>
            ) : null}
          </View>
          <Pressable
            onPress={() => setShowActiveOnly((value) => !value)}
            style={{
              borderRadius: 12,
              borderWidth: 1,
              borderColor: showActiveOnly ? "#0F172A" : "#E2E8F0",
              backgroundColor: showActiveOnly ? "#0F172A" : "#F8FAFC",
              paddingVertical: 12,
              paddingHorizontal: 14,
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <Ionicons name={showActiveOnly ? "eye-outline" : "eye-off-outline"} size={18} color={showActiveOnly ? "white" : "#64748B"} />
          </Pressable>
        </View>
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6, paddingHorizontal: 4 }}>
        <Text style={{ fontSize: 18, fontWeight: "800", color: "#0F172A" }}>
          Existing Banners <Text style={{ color: "#64748B", fontWeight: "600", fontSize: 14 }}>({filteredBanners.length})</Text>
        </Text>
        <Pressable onPress={() => load().catch(() => undefined)} disabled={loading}>
          <Text style={{ color: "#1D4ED8", fontWeight: "700", fontSize: 14 }}>{loading ? "Loading..." : "Refresh"}</Text>
        </Pressable>
      </View>

      {filteredBanners.length === 0 ? (
        <View style={{ ...cardShadow, padding: 14 }}>
          <Text style={{ color: "#64748B" }}>No banners found.</Text>
        </View>
      ) : (
        filteredBanners.map((banner) => (
          <View key={banner.id} style={{ ...cardShadow, padding: 14, gap: 12 }}>
            <Image
              source={{ uri: banner.imageUrl }}
              resizeMode="cover"
              style={{ width: "100%", height: 160, backgroundColor: "#F3F4F6", borderRadius: 12 }}
            />
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: "#0F172A", fontWeight: "800", fontSize: 16 }}>{banner.title || "(No Title)"}</Text>
                <Text style={{ color: "#64748B", fontSize: 13, fontWeight: "500" }}>Order: {banner.sortOrder} {banner.actionUrl ? `• Link: ${banner.actionUrl}` : ""}</Text>
              </View>
              <View style={{ borderRadius: 999, backgroundColor: banner.isActive ? "#ECFDF5" : "#FEF2F2", paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: banner.isActive ? "#A7F3D0" : "#FECACA" }}>
                <Text style={{ color: banner.isActive ? "#059669" : "#DC2626", fontWeight: "800", fontSize: 11, textTransform: "uppercase" }}>
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
                  backgroundColor: banner.isActive ? "#F1F5F9" : "#10B981"
                }}
              >
                <Text style={{ color: banner.isActive ? "#475569" : "white", fontWeight: "800", fontSize: 14 }}>{banner.isActive ? "Hide" : "Activate"}</Text>
              </Pressable>
              <Pressable
                onPress={() => onDelete(banner.id)}
                style={{ flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: "center", backgroundColor: "#FEF2F2" }}
              >
                <Text style={{ color: "#DC2626", fontWeight: "800", fontSize: 14 }}>Delete</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}
