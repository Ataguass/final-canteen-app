import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Image, Linking, Pressable, ScrollView, Text, TextInput, View, RefreshControl } from "react-native";
import { useAuth } from "../../../hooks/useAuth";
import { communityService, type CommunityPost } from "../../../services/communityService";

type VisibilityFilter = "ALL" | "PINNED" | "VISIBLE" | "HIDDEN";

const filters: VisibilityFilter[] = ["ALL", "PINNED", "VISIBLE", "HIDDEN"];

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
  const { user, accessToken } = useAuth();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<VisibilityFilter>("ALL");

  const load = useCallback(async () => {
    if (!user?.tenantId || !accessToken) return;
    try {
      setLoading(true);
      const response = await communityService.listPosts(accessToken, user.tenantId, true);
      const sorted = [...response.data].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
      setPosts(sorted);
      setLastUpdated(new Date());
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to load posts");
    } finally {
      setLoading(false);
    }
  }, [accessToken, user?.tenantId]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const onTogglePin = async (postId: string) => {
    if (!user?.tenantId || !accessToken) return;
    try {
      await communityService.togglePin(accessToken, user.tenantId, postId);
      await load();
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Could not update pin");
    }
  };

  const onToggleVisibility = async (postId: string) => {
    if (!user?.tenantId || !accessToken) return;
    try {
      await communityService.toggleVisibility(accessToken, user.tenantId, postId);
      await load();
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Could not update visibility");
    }
  };

  const onDelete = async (postId: string) => {
    if (!user?.tenantId || !accessToken) return;
    Alert.alert("Delete post", "Are you sure you want to delete this post?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await communityService.deletePost(accessToken, user.tenantId, postId);
            await load();
          } catch (error) {
            Alert.alert("Error", error instanceof Error ? error.message : "Could not delete post");
          }
        }
      }
    ]);
  };

  const stats = useMemo(
    () => ({
      total: posts.length,
      pinned: posts.filter((post) => post.isPinned).length,
      visible: posts.filter((post) => post.isVisible).length,
      hidden: posts.filter((post) => !post.isVisible).length
    }),
    [posts]
  );

  const filteredPosts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return posts.filter((post) => {
      if (filter === "PINNED" && !post.isPinned) return false;
      if (filter === "VISIBLE" && !post.isVisible) return false;
      if (filter === "HIDDEN" && post.isVisible) return false;
      if (!normalized) return true;
      return (
        post.title.toLowerCase().includes(normalized) ||
        post.body.toLowerCase().includes(normalized) ||
        (post.author?.name ?? "").toLowerCase().includes(normalized)
      );
    });
  }, [posts, query, filter]);

  return (
    <View style={{ flex: 1, backgroundColor: "#F8FAFC" }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load().catch(() => undefined)} />}
      >
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "white", borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: "#E2E8F0" }}>
            <Ionicons name="search" size={18} color="#64748B" />
            <TextInput
              placeholder="Search posts..."
              value={query}
              onChangeText={setQuery}
              style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 8, fontSize: 14, color: "#0F172A" }}
              placeholderTextColor="#94A3B8"
            />
            {query ? (
              <Pressable onPress={() => setQuery("")}>
                <Ionicons name="close-circle" size={18} color="#94A3B8" />
              </Pressable>
            ) : null}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {filters.map((value) => {
              const active = filter === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setFilter(value)}
                  style={{
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: active ? "#0F172A" : "#E2E8F0",
                    backgroundColor: active ? "#0F172A" : "white",
                    paddingHorizontal: 16,
                    paddingVertical: 8
                  }}
                >
                  <Text style={{ color: active ? "white" : "#475569", fontWeight: "700", fontSize: 13 }}>{value}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {filteredPosts.length === 0 ? (
          <View style={{ ...cardShadow, padding: 24, alignItems: "center", justifyContent: "center", marginTop: 20 }}>
            <Ionicons name="document-text-outline" size={32} color="#94A3B8" style={{ marginBottom: 8 }} />
            <Text style={{ color: "#0F172A", fontWeight: "700", fontSize: 16 }}>No posts found</Text>
            <Text style={{ color: "#64748B", fontSize: 13, marginTop: 4 }}>Try adjusting your filters or create a new post.</Text>
          </View>
        ) : (
        filteredPosts.map((post) => (
          <View key={post.id} style={{ ...cardShadow, padding: 16, gap: 12 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: "#0F172A", fontSize: 18, fontWeight: "800" }}>{post.title}</Text>
                <Text style={{ color: "#64748B", fontSize: 12 }}>
                  By {post.author?.name ?? "Admin"} • {new Date(post.createdAt).toLocaleDateString()}
                </Text>
              </View>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {post.isPinned ? (
                  <View style={{ borderRadius: 6, backgroundColor: "#EEF2FF", paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: "#C7D2FE" }}>
                    <Text style={{ color: "#4F46E5", fontWeight: "800", fontSize: 11 }}>Pinned</Text>
                  </View>
                ) : null}
                <View style={{ borderRadius: 6, backgroundColor: post.isVisible ? "#ECFDF5" : "#FEF2F2", paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: post.isVisible ? "#A7F3D0" : "#FECACA" }}>
                  <Text style={{ color: post.isVisible ? "#059669" : "#DC2626", fontWeight: "800", fontSize: 11 }}>
                    {post.isVisible ? "Visible" : "Hidden"}
                  </Text>
                </View>
              </View>
            </View>

            <Text style={{ color: "#334155", lineHeight: 22, fontSize: 14 }}>{post.body}</Text>

            {post.mediaUrl && post.mediaType === "IMAGE" ? (
              <Image
                source={{ uri: post.mediaUrl }}
                resizeMode="cover"
                style={{ width: "100%", height: 200, borderRadius: 12, backgroundColor: "#F1F5F9", borderWidth: 1, borderColor: "#E2E8F0" }}
              />
            ) : null}
            {post.mediaUrl && post.mediaType === "VIDEO" ? (
              <Pressable
                onPress={async () => {
                  const canOpen = await Linking.canOpenURL(post.mediaUrl as string);
                  if (canOpen) await Linking.openURL(post.mediaUrl as string);
                }}
                style={{
                  borderRadius: 12,
                  paddingVertical: 12,
                  backgroundColor: "#F8FAFC",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: 8,
                  borderWidth: 1,
                  borderColor: "#E2E8F0"
                }}
              >
                <Ionicons name="play-circle" size={20} color="#0F172A" />
                <Text style={{ color: "#0F172A", fontWeight: "800" }}>Watch Attached Video</Text>
              </Pressable>
            ) : null}

            <View style={{ flexDirection: "row", gap: 8, marginTop: 4, paddingTop: 16, borderTopWidth: 1, borderColor: "#F1F5F9" }}>
              <Pressable
                onPress={() => onTogglePin(post.id)}
                style={{ flex: 1, borderRadius: 10, backgroundColor: "#F1F5F9", paddingVertical: 10, alignItems: "center" }}
              >
                <Text style={{ color: "#475569", fontWeight: "700", fontSize: 13 }}>{post.isPinned ? "Unpin" : "Pin"}</Text>
              </Pressable>
              <Pressable
                onPress={() => onToggleVisibility(post.id)}
                style={{ flex: 1, borderRadius: 10, backgroundColor: "#F1F5F9", paddingVertical: 10, alignItems: "center" }}
              >
                <Text style={{ color: "#475569", fontWeight: "700", fontSize: 13 }}>{post.isVisible ? "Hide" : "Show"}</Text>
              </Pressable>
              <Pressable
                onPress={() => onDelete(post.id)}
                style={{ flex: 1, borderRadius: 10, backgroundColor: "#FEF2F2", paddingVertical: 10, alignItems: "center" }}
              >
                <Text style={{ color: "#DC2626", fontWeight: "700", fontSize: 13 }}>Delete</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}
      </ScrollView>

      <Pressable
        onPress={() =>
          router.push({
            pathname: "/(admin)/community/create",
            params: { resetKey: Date.now().toString() }
          })
        }
        style={{
          position: "absolute",
          bottom: 24,
          right: 24,
          backgroundColor: "#0F172A",
          width: 60,
          height: 60,
          borderRadius: 30,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#0F172A",
          shadowOpacity: 0.3,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 6
        }}
      >
        <Ionicons name="add" size={32} color="white" />
      </Pressable>
    </View>
  );
}
