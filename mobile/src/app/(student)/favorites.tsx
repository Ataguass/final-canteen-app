import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from '../../stores/useAuthStore';
import { useFavoritesStore } from '../../stores/useFavoritesStore';
import { menuService } from "../../services/menuService";
import { moderateScale, fontScale, verticalScale, isTablet, gridColumns } from '../../utils/responsive';
import { useTheme } from '../../hooks/useTheme';

type MenuItem = {
  id: string;
  name: string;
  price: number;
  image?: string | null;
};

const formatCurrency = (value: number): string => `₹ ${value.toFixed(2)}`;

export default function FavoritesScreen() {
  const theme = useTheme();
  const { colors, isDark } = theme;
  const styles = createStyles(theme);
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  
  const { user, accessToken } = useAuthStore();
  const { favorites, removeFavorite } = useFavoritesStore();

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<MenuItem[]>([]);

  const itemGridColumns = screenWidth >= 1200 ? 4 : screenWidth >= 900 ? 3 : 2;
  const itemCardWidth = itemGridColumns === 4 ? "23.5%" : itemGridColumns === 3 ? "32%" : "48.5%";
  const itemImageHeight = itemGridColumns === 4 ? 88 : itemGridColumns === 3 ? 98 : 108;

  useEffect(() => {
    const load = async () => {
      if (!user?.tenantId || !accessToken) return;
      try {
        setLoading(true);
        const menu = await menuService.listItems(accessToken, user.tenantId);
        setItems(menu.data);
      } catch (error) {
        Alert.alert("Error", "Could not load menu items.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [accessToken, user?.tenantId]);

  const favoriteItems = items.filter((item) => favorites.includes(item.id));

  return (
    <View style={[styles.screen, { paddingTop: insets.top > 0 ? insets.top + 10 : 48 }]}>
      <View style={styles.topNav}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.topNavTitle}>Favorites</Text>
        <View style={{ width: moderateScale(40) }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.emptyWrap}>
            <Text style={{ color: colors.textSecondary }}>Loading favorites...</Text>
          </View>
        ) : favoriteItems.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="heart-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No favorites yet</Text>
            <Text style={styles.emptySub}>Items you favorite will appear here.</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {favoriteItems.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => router.push(`/(student)/menu/item/${item.id}`)}
                style={[styles.itemCard, { width: itemCardWidth as any }]}
              >
                <View style={[styles.itemImageWrap, { height: itemImageHeight }]}>
                  {item.image ? (
                    <Image source={{ uri: item.image }} style={styles.itemImage} resizeMode="cover" />
                  ) : (
                    <View style={styles.itemImageFallback}>
                      <Ionicons name="fast-food-outline" size={24} color={colors.textMuted} />
                    </View>
                  )}
                  <Pressable 
                    onPress={() => removeFavorite(item.id)}
                    style={styles.heartBtn}
                  >
                    <Ionicons name="heart" size={20} color="#EF4444" />
                  </Pressable>
                </View>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={styles.itemPrice}>{formatCurrency(item.price)}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = ({ colors, isDark }: { colors: any, isDark: boolean }) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background
  },
  topNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: moderateScale(16),
    paddingBottom: verticalScale(10)
  },
  backBtn: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: moderateScale(20),
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.text,
    shadowOpacity: 0.05,
    shadowRadius: moderateScale(10),
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  topNavTitle: {
    fontSize: fontScale(18),
    fontWeight: "900",
    color: colors.text
  },
  content: {
    padding: moderateScale(16),
    paddingBottom: verticalScale(40),
    gap: moderateScale(16)
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: verticalScale(100),
    gap: moderateScale(12)
  },
  emptyTitle: {
    color: colors.text,
    fontSize: fontScale(20),
    fontWeight: "800"
  },
  emptySub: {
    color: colors.textSecondary,
    textAlign: "center"
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: moderateScale(12)
  },
  itemCard: {
    backgroundColor: colors.card,
    borderRadius: moderateScale(16),
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    shadowColor: colors.text,
    shadowOpacity: 0.02,
    shadowRadius: moderateScale(8),
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
    marginBottom: verticalScale(12)
  },
  itemImageWrap: {
    width: "100%",
    backgroundColor: colors.surfaceAlt,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    position: "relative"
  },
  itemImage: {
    width: "100%",
    height: "100%"
  },
  itemImageFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  heartBtn: {
    position: "absolute",
    top: moderateScale(8),
    right: moderateScale(8),
    backgroundColor: colors.card,
    borderRadius: moderateScale(16),
    padding: moderateScale(4),
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: moderateScale(4),
    shadowOffset: { width: 0, height: 2 },
    elevation: 2
  },
  itemInfo: {
    padding: moderateScale(12),
    gap: moderateScale(4)
  },
  itemName: {
    color: colors.text,
    fontWeight: "700",
    fontSize: fontScale(14)
  },
  itemPrice: {
    color: colors.text,
    fontWeight: "800",
    fontSize: fontScale(15)
  }
});
