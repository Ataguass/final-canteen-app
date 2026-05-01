import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useAuth } from "../../hooks/useAuth";
import { communityService, type CommunityPost } from "../../services/communityService";

export default function Screen() {
  const { user, accessToken } = useAuth();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user?.tenantId || !accessToken) return;
    try {
      setLoading(true);
      const response = await communityService.listPosts(accessToken, user.tenantId);
      setPosts(response.data);
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "Failed to load community posts"
      );
    } finally {
      setLoading(false);
    }
  }, [accessToken, user?.tenantId]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const orderedPosts = useMemo(
    () =>
      [...posts].sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return +new Date(b.createdAt) - +new Date(a.createdAt);
      }),
    [posts]
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerCard}>
        <View style={styles.headerRow}>
          <View style={styles.headerIconWrap}>
            <Ionicons name="megaphone-outline" size={20} color="#1D4ED8" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Community</Text>
            <Text style={styles.headerSubtitle}>Announcements and updates</Text>
          </View>
          <Pressable onPress={load} style={styles.refreshBtn}>
            <Text style={styles.refreshBtnText}>
              {loading ? "Refreshing..." : "Refresh"}
            </Text>
          </Pressable>
        </View>
      </View>

      {orderedPosts.length === 0 && !loading ? (
        <View style={styles.emptyCard}>
          <Ionicons name="chatbubbles-outline" size={28} color="#94A3B8" />
          <Text style={styles.emptyTitle}>No announcements yet</Text>
          <Text style={styles.emptySub}>New updates from admin will appear here.</Text>
        </View>
      ) : null}

      {orderedPosts.map((post) => (
        <View key={post.id} style={styles.postCard}>
          <View style={styles.postHeaderRow}>
            <Text style={styles.postTitle}>
              {post.isPinned ? "[PINNED] " : ""}
              {post.title}
            </Text>
            {post.isPinned ? (
              <View style={styles.pinnedPill}>
                <Text style={styles.pinnedPillText}>Pinned</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.postBody}>{post.body}</Text>

          {post.mediaUrl && post.mediaType === "IMAGE" ? (
            <Image
              source={{ uri: post.mediaUrl }}
              resizeMode="cover"
              style={styles.postImage}
            />
          ) : null}

          {post.mediaUrl && post.mediaType === "VIDEO" ? (
            <Pressable
              onPress={async () => {
                const canOpen = await Linking.canOpenURL(post.mediaUrl as string);
                if (!canOpen) {
                  Alert.alert("Invalid URL", "Could not open this video.");
                  return;
                }
                await Linking.openURL(post.mediaUrl as string);
              }}
              style={styles.videoBtn}
            >
              <Text style={styles.videoBtnText}>Open Video</Text>
            </Pressable>
          ) : null}

          <Text style={styles.postMeta}>
            By {post.author?.name ?? "Admin"} •{" "}
            {new Date(post.createdAt).toLocaleString()}
          </Text>
        </View>
      ))}
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
  headerCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "white",
    padding: 12
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  headerIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center"
  },
  headerTitle: {
    color: "#0F172A",
    fontSize: 24,
    fontWeight: "800"
  },
  headerSubtitle: {
    color: "#64748B",
    marginTop: 2,
    fontWeight: "600"
  },
  refreshBtn: {
    backgroundColor: "#0F172A",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  refreshBtnText: {
    color: "white",
    fontWeight: "700"
  },
  emptyCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
    padding: 18,
    alignItems: "center",
    gap: 6
  },
  emptyTitle: {
    color: "#0F172A",
    fontWeight: "800",
    fontSize: 18
  },
  emptySub: {
    color: "#64748B",
    textAlign: "center"
  },
  postCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "white",
    padding: 12,
    gap: 8
  },
  postHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8
  },
  postTitle: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "800",
    flex: 1
  },
  pinnedPill: {
    backgroundColor: "#E0E7FF",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  pinnedPillText: {
    color: "#3730A3",
    fontWeight: "700",
    fontSize: 12
  },
  postBody: {
    color: "#334155",
    lineHeight: 20
  },
  postImage: {
    width: "100%",
    height: 180,
    borderRadius: 10,
    backgroundColor: "#F1F5F9"
  },
  videoBtn: {
    backgroundColor: "#0F172A",
    borderRadius: 10,
    paddingVertical: 10
  },
  videoBtnText: {
    color: "white",
    textAlign: "center",
    fontWeight: "700"
  },
  postMeta: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "600"
  }
});
