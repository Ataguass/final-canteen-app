import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Image, Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";
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
    <ScrollView style={{ flex: 1, backgroundColor: "#F8FAFC" }} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 22 }}>
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 28, fontWeight: "800", color: "#0F172A" }}>Community</Text>
        <Text style={{ color: "#64748B", fontSize: 13 }}>
          Last updated: {lastUpdated ? lastUpdated.toLocaleString() : "Not loaded yet"}
        </Text>
      </View>

      <View style={{ flexDirection: "row", gap: 8 }}>
        <Pressable
          onPress={() =>
            router.push({
              pathname: "/(admin)/community/create",
              params: { resetKey: Date.now().toString() }
            })
          }
          style={{
            flex: 1,
            borderRadius: 12,
            padding: 12,
            backgroundColor: "#0F172A",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: 8
          }}
        >
          <Ionicons name="add-circle-outline" size={18} color="white" />
          <Text style={{ color: "white", fontWeight: "800" }}>Create Post</Text>
        </Pressable>
        <Pressable
          onPress={() => load().catch(() => undefined)}
          style={{
            flex: 1,
            borderRadius: 12,
            padding: 12,
            backgroundColor: "#334155",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: 8
          }}
        >
          <Ionicons name="refresh-outline" size={18} color="white" />
          <Text style={{ color: "white", fontWeight: "800" }}>{loading ? "Refreshing..." : "Refresh"}</Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <View style={{ width: "48%", ...cardShadow, padding: 12 }}>
          <Text style={{ color: "#475569", fontSize: 12, fontWeight: "700" }}>Total Posts</Text>
          <Text style={{ color: "#0F172A", fontSize: 24, fontWeight: "800", marginTop: 4 }}>{stats.total}</Text>
        </View>
        <View style={{ width: "48%", ...cardShadow, padding: 12 }}>
          <Text style={{ color: "#475569", fontSize: 12, fontWeight: "700" }}>Pinned</Text>
          <Text style={{ color: "#4F46E5", fontSize: 24, fontWeight: "800", marginTop: 4 }}>{stats.pinned}</Text>
        </View>
        <View style={{ width: "48%", ...cardShadow, padding: 12 }}>
          <Text style={{ color: "#475569", fontSize: 12, fontWeight: "700" }}>Visible</Text>
          <Text style={{ color: "#059669", fontSize: 24, fontWeight: "800", marginTop: 4 }}>{stats.visible}</Text>
        </View>
        <View style={{ width: "48%", ...cardShadow, padding: 12 }}>
          <Text style={{ color: "#475569", fontSize: 12, fontWeight: "700" }}>Hidden</Text>
          <Text style={{ color: "#DC2626", fontSize: 24, fontWeight: "800", marginTop: 4 }}>{stats.hidden}</Text>
        </View>
      </View>

      <View style={{ ...cardShadow, padding: 12, gap: 10 }}>
        <Text style={{ fontSize: 16, fontWeight: "800", color: "#0F172A" }}>Search & Filter</Text>
        <View
          style={{
            borderWidth: 1,
            borderColor: "#E2E8F0",
            borderRadius: 12,
            backgroundColor: "#F8FAFC",
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 10
          }}
        >
          <Ionicons name="search-outline" size={16} color="#64748B" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search title, body or author"
            placeholderTextColor="#94A3B8"
            style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 8, color: "#0F172A" }}
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
                  paddingHorizontal: 14,
                  paddingVertical: 8
                }}
              >
                <Text style={{ color: active ? "white" : "#334155", fontWeight: "700" }}>{value}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontSize: 18, fontWeight: "800", color: "#0F172A" }}>Posts</Text>
        <Text style={{ color: "#64748B", fontWeight: "700" }}>{filteredPosts.length} found</Text>
      </View>

      {filteredPosts.length === 0 ? (
        <View style={{ ...cardShadow, padding: 14 }}>
          <Text style={{ color: "#64748B" }}>No community posts yet.</Text>
        </View>
      ) : (
        filteredPosts.map((post) => (
          <View key={post.id} style={{ ...cardShadow, padding: 12, gap: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <Text style={{ color: "#0F172A", fontSize: 17, fontWeight: "800", flex: 1 }}>{post.title}</Text>
              {post.isPinned ? (
                <View style={{ borderRadius: 999, backgroundColor: "#EEF2FF", paddingHorizontal: 8, paddingVertical: 4 }}>
                  <Text style={{ color: "#4F46E5", fontWeight: "800", fontSize: 12 }}>Pinned</Text>
                </View>
              ) : null}
            </View>

            <Text style={{ color: "#334155", lineHeight: 20 }}>{post.body}</Text>

            {post.mediaUrl && post.mediaType === "IMAGE" ? (
              <Image
                source={{ uri: post.mediaUrl }}
                resizeMode="cover"
                style={{ width: "100%", height: 180, borderRadius: 12, backgroundColor: "#F1F5F9" }}
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
                  paddingVertical: 10,
                  backgroundColor: "#0F172A",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: 8
                }}
              >
                <Ionicons name="play-circle-outline" size={18} color="white" />
                <Text style={{ color: "white", fontWeight: "800" }}>Open Video</Text>
              </Pressable>
            ) : null}

            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <Text style={{ color: "#64748B", fontSize: 12, flex: 1 }}>
                By {post.author?.name ?? "Admin"} on {new Date(post.createdAt).toLocaleString()}
              </Text>
              <View
                style={{
                  borderRadius: 999,
                  backgroundColor: post.isVisible ? "#ECFDF5" : "#FEF2F2",
                  paddingHorizontal: 8,
                  paddingVertical: 4
                }}
              >
                <Text style={{ color: post.isVisible ? "#059669" : "#DC2626", fontWeight: "800", fontSize: 11 }}>
                  {post.isVisible ? "Visible" : "Hidden"}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Pressable
                onPress={() => onTogglePin(post.id)}
                style={{
                  flex: 1,
                  minWidth: 100,
                  borderRadius: 10,
                  backgroundColor: "#4F46E5",
                  paddingVertical: 9,
                  alignItems: "center"
                }}
              >
                <Text style={{ color: "white", fontWeight: "800" }}>{post.isPinned ? "Unpin" : "Pin"}</Text>
              </Pressable>
              <Pressable
                onPress={() => onToggleVisibility(post.id)}
                style={{
                  flex: 1,
                  minWidth: 100,
                  borderRadius: 10,
                  backgroundColor: "#D97706",
                  paddingVertical: 9,
                  alignItems: "center"
                }}
              >
                <Text style={{ color: "white", fontWeight: "800" }}>{post.isVisible ? "Hide" : "Show"}</Text>
              </Pressable>
              <Pressable
                onPress={() => onDelete(post.id)}
                style={{
                  flex: 1,
                  minWidth: 100,
                  borderRadius: 10,
                  backgroundColor: "#B91C1C",
                  paddingVertical: 9,
                  alignItems: "center"
                }}
              >
                <Text style={{ color: "white", fontWeight: "800" }}>Delete</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}
