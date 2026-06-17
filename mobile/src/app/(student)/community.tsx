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
  View,
  RefreshControl
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../hooks/useAuth";
import { CanteenHeader } from "../../components/CanteenHeader";
import { communityService, type CommunityPost } from "../../services/communityService";
import { moderateScale, fontScale, verticalScale, scale, isTablet, gridColumns } from '../../utils/responsive';

export default function Screen() {
  const insets = useSafeAreaInsets();
  const { user, accessToken } = useAuth();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!user?.tenantId || !accessToken) return;
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const response = await communityService.listPosts(accessToken, user.tenantId);
      setPosts(response.data);
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "Failed to load community posts"
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
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
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={["#0F172A"]} />
      }
    >
      <CanteenHeader showBackButton title="Community" subtitle="Announcements and updates" />

      {orderedPosts.length === 0 && !loading && !refreshing ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="megaphone-outline" size={32} color="#94A3B8" />
          </View>
          <Text style={styles.emptyTitle}>No announcements yet</Text>
          <Text style={styles.emptySub}>New updates from the canteen admin will appear here.</Text>
        </View>
      ) : null}

      {loading && !refreshing && orderedPosts.length === 0 ? (
        <View style={styles.loadingWrap}>
          <Ionicons name="sync-outline" size={24} color="#94A3B8" />
          <Text style={styles.loadingText}>Loading updates...</Text>
        </View>
      ) : null}

      <View style={styles.feedContainer}>
        {orderedPosts.map((post) => {
          const isPinned = post.isPinned;
          return (
            <View key={post.id} style={[styles.postCard, isPinned && styles.postCardPinned]}>
              <View style={styles.postHeaderRow}>
                <View style={styles.authorWrap}>
                  <View style={styles.authorAvatar}>
                    <Ionicons name="person" size={16} color="#64748B" />
                  </View>
                  <View>
                    <Text style={styles.authorName}>{post.author?.name ?? "Canteen Admin"}</Text>
                    <Text style={styles.postDate}>{new Date(post.createdAt).toLocaleString(undefined, { 
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                    })}</Text>
                  </View>
                </View>
                {isPinned ? (
                  <View style={styles.pinnedPill}>
                    <Ionicons name="pin" size={12} color="#4F46E5" />
                    <Text style={styles.pinnedPillText}>Pinned</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.postContentWrap}>
                {post.title ? (
                  <Text style={styles.postTitle}>{post.title}</Text>
                ) : null}
                <Text style={styles.postBody}>{post.body}</Text>
              </View>

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
                  android_ripple={{ color: "#E2E8F0" }}
                >
                  <Ionicons name="play-circle" size={20} color="#0F172A" />
                  <Text style={styles.videoBtnText}>Watch Video</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#EEF2F7"
  },
  content: {
    padding: moderateScale(16),
    gap: moderateScale(16),
    paddingBottom: verticalScale(40)
  },
  loadingWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: moderateScale(32),
    gap: moderateScale(8)
  },
  loadingText: {
    color: "#64748B",
    fontWeight: "600",
    fontSize: fontScale(15)
  },
  emptyCard: {
    borderRadius: moderateScale(16),
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "white",
    padding: moderateScale(32),
    alignItems: "center",
    justifyContent: "center",
    gap: moderateScale(8),
    marginTop: verticalScale(16)
  },
  emptyIconWrap: {
    width: moderateScale(64),
    height: moderateScale(64),
    borderRadius: moderateScale(32),
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: verticalScale(8)
  },
  emptyTitle: {
    color: "#0F172A",
    fontWeight: "800",
    fontSize: fontScale(18)
  },
  emptySub: {
    color: "#64748B",
    textAlign: "center",
    fontSize: fontScale(14),
    lineHeight: 20
  },
  feedContainer: {
    gap: moderateScale(16)
  },
  postCard: {
    borderRadius: moderateScale(16),
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "white",
    padding: moderateScale(16),
    gap: moderateScale(14),
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: moderateScale(8),
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  postCardPinned: {
    borderColor: "#C7D2FE",
    backgroundColor: "#FAFAFF"
  },
  postHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: moderateScale(8)
  },
  authorWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(10),
    flex: 1
  },
  authorAvatar: {
    width: moderateScale(36),
    height: moderateScale(36),
    borderRadius: moderateScale(18),
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0"
  },
  authorName: {
    color: "#0F172A",
    fontWeight: "800",
    fontSize: fontScale(15)
  },
  postDate: {
    color: "#64748B",
    fontWeight: "600",
    fontSize: fontScale(12),
    marginTop: 1
  },
  pinnedPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEF2FF",
    borderRadius: moderateScale(6),
    paddingHorizontal: moderateScale(8),
    paddingVertical: moderateScale(4),
    gap: moderateScale(4),
    borderWidth: 1,
    borderColor: "#C7D2FE"
  },
  pinnedPillText: {
    color: "#4F46E5",
    fontWeight: "800",
    fontSize: fontScale(11),
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  postContentWrap: {
    gap: moderateScale(6)
  },
  postTitle: {
    color: "#0F172A",
    fontSize: fontScale(18),
    fontWeight: "800",
    lineHeight: 24
  },
  postBody: {
    color: "#334155",
    fontSize: fontScale(15),
    lineHeight: 22
  },
  postImage: {
    width: "100%",
    height: moderateScale(220),
    borderRadius: moderateScale(12),
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0"
  },
  videoBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: moderateScale(12),
    paddingVertical: moderateScale(14),
    gap: moderateScale(8),
    borderWidth: 1,
    borderColor: "#E2E8F0"
  },
  videoBtnText: {
    color: "#0F172A",
    fontWeight: "700",
    fontSize: fontScale(15)
  }
});
