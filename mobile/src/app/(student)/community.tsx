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
import { Video, ResizeMode } from "expo-av";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from '../../stores/useAuthStore';
import { CanteenHeader } from "../../components/CanteenHeader";
import { Card } from "../../components/ui/Card";
import { Avatar } from "../../components/ui/Avatar";
import { Badge } from "../../components/ui/Badge";
import { useCommunityPosts } from "../../hooks/queries/useCommunity";
import { moderateScale, fontScale, verticalScale, scale, isTablet, gridColumns } from '../../utils/responsive';
import { useTheme } from '../../hooks/useTheme';

export default function Screen() {
  const theme = useTheme();
  const { colors, isDark } = theme;
  const styles = createStyles(theme);
  const insets = useSafeAreaInsets();
  const { user, accessToken } = useAuthStore();
  const { data: posts = [], isLoading, isFetching, refetch } = useCommunityPosts(false);

  const loading = isLoading;
  const refreshing = isFetching && !isLoading;

  const load = async (isRefresh = false) => {
    if (isRefresh) {
      await refetch();
    }
  };

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
        <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[colors.text]} tintColor={colors.text} />
      }
    >
      <CanteenHeader showBackButton title="Community" subtitle="Announcements and updates" />

      {orderedPosts.length === 0 && !loading && !refreshing ? (
        <Card style={styles.emptyCard} padding="large">
          <View style={styles.emptyIconWrap}>
            <Ionicons name="megaphone-outline" size={32} color={colors.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>No announcements yet</Text>
          <Text style={styles.emptySub}>New updates from the canteen admin will appear here.</Text>
        </Card>
      ) : null}

      {loading && !refreshing && orderedPosts.length === 0 ? (
        <View style={styles.loadingWrap}>
          <Ionicons name="sync-outline" size={24} color={colors.textMuted} />
          <Text style={styles.loadingText}>Loading updates...</Text>
        </View>
      ) : null}

      <View style={styles.feedContainer}>
        {orderedPosts.map((post) => {
          const isPinned = post.isPinned;
          return (
            <Card key={post.id} style={[styles.postCard, isPinned && styles.postCardPinned]}>
              <View style={styles.postHeaderRow}>
                <View style={styles.authorWrap}>
                  <Avatar size="small" name={post.author?.name ?? "Canteen Admin"} />
                  <View>
                    <Text style={styles.authorName}>{post.author?.name ?? "Canteen Admin"}</Text>
                    <Text style={styles.postDate}>{new Date(post.createdAt).toLocaleString(undefined, { 
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                    })}</Text>
                  </View>
                </View>
                {isPinned ? (
                  <View style={styles.pinnedPill}>
                    <Ionicons name="pin" size={12} color={isDark ? "#818CF8" : "#4F46E5"} />
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
                <Video
                  source={{ uri: post.mediaUrl }}
                  style={styles.postVideo}
                  useNativeControls
                  resizeMode={ResizeMode.COVER}
                  isLooping={false}
                />
              ) : null}
            </Card>
          );
        })}
      </View>
    </ScrollView>
  );
}

const createStyles = ({ colors, isDark }: { colors: any, isDark: boolean }) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background
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
    color: colors.textSecondary,
    fontWeight: "600",
    fontSize: fontScale(15)
  },
  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    gap: moderateScale(8),
    marginTop: verticalScale(16)
  },
  emptyIconWrap: {
    width: moderateScale(64),
    height: moderateScale(64),
    borderRadius: moderateScale(32),
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: verticalScale(8)
  },
  emptyTitle: {
    color: colors.text,
    fontWeight: "800",
    fontSize: fontScale(18)
  },
  emptySub: {
    color: colors.textSecondary,
    textAlign: "center",
    fontSize: fontScale(14),
    lineHeight: 20
  },
  feedContainer: {
    gap: moderateScale(16)
  },
  postCard: {
    gap: moderateScale(14),
  },
  postCardPinned: {
    borderColor: isDark ? "rgba(79, 70, 229, 0.4)" : "#C7D2FE",
    backgroundColor: isDark ? "rgba(79, 70, 229, 0.1)" : "#FAFAFF"
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
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border
  },
  authorName: {
    color: colors.text,
    fontWeight: "800",
    fontSize: fontScale(15)
  },
  postDate: {
    color: colors.textSecondary,
    fontWeight: "600",
    fontSize: fontScale(12),
    marginTop: 1
  },
  pinnedPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: isDark ? "rgba(79, 70, 229, 0.2)" : "#EEF2FF",
    borderRadius: moderateScale(6),
    paddingHorizontal: moderateScale(8),
    paddingVertical: moderateScale(4),
    gap: moderateScale(4),
    borderWidth: 1,
    borderColor: isDark ? "rgba(79, 70, 229, 0.4)" : "#C7D2FE"
  },
  pinnedPillText: {
    color: isDark ? "#818CF8" : "#4F46E5",
    fontWeight: "800",
    fontSize: fontScale(11),
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  postContentWrap: {
    gap: moderateScale(6)
  },
  postTitle: {
    color: colors.text,
    fontSize: fontScale(18),
    fontWeight: "800",
    lineHeight: 24
  },
  postBody: {
    color: colors.text,
    fontSize: fontScale(15),
    lineHeight: 22
  },
  postImage: {
    width: "100%",
    height: moderateScale(220),
    borderRadius: moderateScale(12),
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border
  },
  postVideo: {
    width: "100%",
    height: moderateScale(220),
    borderRadius: moderateScale(12),
    backgroundColor: "black",
  }
});
