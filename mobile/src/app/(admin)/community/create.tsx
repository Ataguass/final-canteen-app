import { Ionicons } from "@expo/vector-icons";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Image, Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useAuth } from "../../../hooks/useAuth";
import { communityService } from "../../../services/communityService";

const MAX_IMAGE_WIDTH = 1280;
const MAX_IMAGE_HEIGHT = 1280;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
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
  const router = useRouter();
  const { resetKey } = useLocalSearchParams<{ resetKey?: string }>();
  const { user, accessToken } = useAuth();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"IMAGE" | "VIDEO" | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const resetForm = useCallback(() => {
    setTitle("");
    setBody("");
    setMediaUrl(null);
    setMediaType(null);
    setIsPinned(false);
    setIsVisible(true);
  }, []);

  useEffect(() => {
    resetForm();
  }, [resetForm, resetKey]);

  const uploadCommunityMedia = async () => {
    if (!user?.tenantId || !accessToken) return;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission needed", "Please allow gallery access.");
        return;
      }

      const picked = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        quality: 1,
        mediaTypes: ["images", "videos"]
      });

      if (picked.canceled || !picked.assets.length) return;
      const asset = picked.assets[0];
      const mimeType = asset.mimeType ?? (asset.type === "video" ? "video/mp4" : "image/jpeg");

      let uploadUri = asset.uri;
      let uploadType = mimeType;
      let uploadName =
        asset.fileName ?? `community-${Date.now()}.${asset.type === "video" ? "mp4" : "jpg"}`;

      if (asset.type === "image") {
        const scale = Math.min(MAX_IMAGE_WIDTH / asset.width, MAX_IMAGE_HEIGHT / asset.height, 1);
        const targetWidth = Math.max(1, Math.round(asset.width * scale));
        const targetHeight = Math.max(1, Math.round(asset.height * scale));

        const primary = await ImageManipulator.manipulateAsync(
          asset.uri,
          scale < 1 ? [{ resize: { width: targetWidth, height: targetHeight } }] : [],
          { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );

        let base64 = primary.base64 ?? "";
        if (estimateBase64Bytes(base64) > MAX_IMAGE_BYTES) {
          const compressed = await ImageManipulator.manipulateAsync(primary.uri, [], {
            compress: 0.6,
            format: ImageManipulator.SaveFormat.JPEG,
            base64: true
          });
          base64 = compressed.base64 ?? "";
          uploadUri = compressed.uri;
        } else {
          uploadUri = primary.uri;
        }

        uploadType = "image/jpeg";
        uploadName = `community-${Date.now()}.jpg`;
      } else {
        uploadType = mimeType;
        if (!uploadType.startsWith("video/")) {
          uploadType = "video/mp4";
        }
      }

      setUploading(true);
      const response = await communityService.uploadMedia(accessToken, user.tenantId, {
        uri: uploadUri,
        type: uploadType,
        name: uploadName
      });
      setMediaUrl(response.data.mediaUrl);
      setMediaType(response.data.mediaType);
      Alert.alert("Uploaded", `${response.data.mediaType === "IMAGE" ? "Image" : "Video"} uploaded.`);
    } catch (error) {
      Alert.alert("Upload failed", error instanceof Error ? error.message : "Could not upload media");
    } finally {
      setUploading(false);
    }
  };

  const onCreate = async () => {
    if (!user?.tenantId || !accessToken) return;
    if (!title.trim() || !body.trim()) {
      Alert.alert("Missing fields", "Title and body are required.");
      return;
    }
    try {
      setSaving(true);
      await communityService.createPost(accessToken, user.tenantId, {
        title: title.trim(),
        body: body.trim(),
        mediaUrl,
        mediaType,
        isPinned,
        isVisible
      });
      resetForm();
      Alert.alert("Success", "Community post created.");
      router.replace("/(admin)/community");
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Could not create post");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#F8FAFC" }} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 22 }}>
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 28, fontWeight: "800", color: "#0F172A" }}>Create Community Post</Text>
        <Text style={{ color: "#64748B" }}>Publish announcements with optional image/video.</Text>
      </View>

      <View style={{ ...cardShadow, padding: 12, gap: 10 }}>
        <Text style={{ fontSize: 16, fontWeight: "800", color: "#0F172A" }}>Content</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Post title"
          placeholderTextColor="#94A3B8"
          style={{
            borderWidth: 1,
            borderColor: "#D1D5DB",
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 10,
            backgroundColor: "#F8FAFC",
            color: "#0F172A"
          }}
        />
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="Write announcement..."
          placeholderTextColor="#94A3B8"
          multiline
          style={{
            borderWidth: 1,
            borderColor: "#D1D5DB",
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 10,
            minHeight: 150,
            textAlignVertical: "top",
            backgroundColor: "#F8FAFC",
            color: "#0F172A"
          }}
        />
      </View>

      <View style={{ ...cardShadow, padding: 12, gap: 10 }}>
        <Text style={{ fontSize: 16, fontWeight: "800", color: "#0F172A" }}>Attachment (optional)</Text>
        <Pressable
          onPress={uploadCommunityMedia}
          disabled={uploading}
          style={{
            borderRadius: 12,
            paddingVertical: 11,
            backgroundColor: "#1D4ED8",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: 8
          }}
        >
          <Ionicons name="cloud-upload-outline" size={18} color="white" />
          <Text style={{ color: "white", fontWeight: "800" }}>{uploading ? "Uploading..." : "Upload Image / Video"}</Text>
        </Pressable>
        <Text style={{ color: "#64748B" }}>Image max ~2MB, Video max ~15MB.</Text>

        {mediaUrl && mediaType === "IMAGE" ? (
          <Image
            source={{ uri: mediaUrl }}
            resizeMode="cover"
            style={{ width: "100%", height: 190, backgroundColor: "#F1F5F9", borderRadius: 12 }}
          />
        ) : null}

        {mediaUrl && mediaType === "VIDEO" ? (
          <View style={{ borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 12, padding: 10, gap: 8, backgroundColor: "#F8FAFC" }}>
            <Text style={{ fontWeight: "700", color: "#0F172A" }}>Video attached</Text>
            <Pressable
              onPress={async () => {
                const canOpen = await Linking.canOpenURL(mediaUrl);
                if (canOpen) await Linking.openURL(mediaUrl);
              }}
              style={{ backgroundColor: "#0F172A", borderRadius: 10, paddingVertical: 10, alignItems: "center" }}
            >
              <Text style={{ color: "white", fontWeight: "800" }}>Open Uploaded Video</Text>
            </Pressable>
          </View>
        ) : null}

        {mediaUrl ? (
          <Pressable
            onPress={() => {
              setMediaUrl(null);
              setMediaType(null);
            }}
            style={{ borderRadius: 12, paddingVertical: 10, backgroundColor: "#B91C1C", alignItems: "center" }}
          >
            <Text style={{ color: "white", fontWeight: "800" }}>Remove Attachment</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={{ ...cardShadow, padding: 12, gap: 10 }}>
        <Text style={{ fontSize: 16, fontWeight: "800", color: "#0F172A" }}>Visibility</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            onPress={() => setIsPinned((value) => !value)}
            style={{
              flex: 1,
              borderRadius: 12,
              paddingVertical: 10,
              alignItems: "center",
              backgroundColor: isPinned ? "#4F46E5" : "#E2E8F0"
            }}
          >
            <Text style={{ color: isPinned ? "white" : "#0F172A", fontWeight: "800" }}>{isPinned ? "Pinned" : "Not Pinned"}</Text>
          </Pressable>
          <Pressable
            onPress={() => setIsVisible((value) => !value)}
            style={{
              flex: 1,
              borderRadius: 12,
              paddingVertical: 10,
              alignItems: "center",
              backgroundColor: isVisible ? "#059669" : "#E2E8F0"
            }}
          >
            <Text style={{ color: isVisible ? "white" : "#0F172A", fontWeight: "800" }}>{isVisible ? "Visible" : "Hidden"}</Text>
          </Pressable>
        </View>
      </View>

      <Pressable
        onPress={onCreate}
        disabled={saving}
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
        <Ionicons name="send-outline" size={18} color="white" />
        <Text style={{ color: "white", fontWeight: "800" }}>{saving ? "Creating..." : "Create Post"}</Text>
      </Pressable>
    </ScrollView>
  );
}
