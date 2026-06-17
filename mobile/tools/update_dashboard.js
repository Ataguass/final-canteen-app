const fs = require('fs');
const path = require('path');

const dashboardPath = path.join(__dirname, 'src', 'app', '(student)', 'dashboard.tsx');
let content = fs.readFileSync(dashboardPath, 'utf8');

// 1. Add new imports
content = content.replace(
  'import { Link, useRouter } from "expo-router";',
  'import { Link, useRouter } from "expo-router";\nimport { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";\nimport { Ionicons } from "@expo/vector-icons";'
);
content = content.replace(
  'useWindowDimensions\n} from "react-native";',
  'useWindowDimensions,\n  TextInput,\n  StatusBar\n} from "react-native";'
);

// 2. Add insets to Screen
content = content.replace(
  '  const router = useRouter();',
  '  const router = useRouter();\n  const insets = useSafeAreaInsets();'
);

// 3. Add cartItems
content = content.replace(
  '  const { addItem } = useCart();',
  '  const { addItem, items: cartItems } = useCart();'
);

// 4. Update bannerCardWidth
content = content.replace(
  'const bannerCardWidth = Math.max(280, screenWidth - 32);',
  'const bannerCardWidth = screenWidth - 32;'
);

// 5. Replace return and styles
const returnIndex = content.lastIndexOf('  return (');
const hooksAndLogic = content.substring(0, returnIndex);

const newJSX = `  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFBEB" />
      
      {/* Background Gradient / Color at the top */}
      <View style={[styles.topBg, { height: insets.top + 180 }]} />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER ROW */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Ionicons name="location" size={26} color="#F97316" />
            <View>
              <Text style={styles.locationTitle}>
                {user?.name ?? "Student"} <Ionicons name="chevron-down" size={14} color="#0F172A" />
              </Text>
              <Text style={styles.locationSubtitle}>Campus Canteen</Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <Pressable onPress={() => router.push("/(student)/profile")} style={styles.iconButton}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{user?.name?.charAt(0).toUpperCase() ?? "S"}</Text>
              </View>
            </Pressable>
            <Pressable onPress={() => router.push("/(student)/cart")} style={styles.iconButton}>
              <Ionicons name="cart-outline" size={28} color="#0F172A" />
              {cartItems && cartItems.length > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{cartItems.length}</Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>

        {/* SEARCH BAR */}
        <Pressable style={styles.searchBar} onPress={() => router.push("/(student)/search")}>
          <Ionicons name="search" size={20} color="#F97316" style={styles.searchIcon} />
          <Text style={styles.searchText}>Search for snacks, lunch...</Text>
          <View style={styles.micDivider} />
          <Ionicons name="mic-outline" size={20} color="#F97316" />
        </Pressable>

        {/* BANNERS (Flash Sale style) */}
        {banners.length > 0 && (
          <View style={styles.bannerSection}>
            <ScrollView
              ref={bannerScrollRef}
              horizontal
              snapToInterval={bannerPitch}
              snapToAlignment="start"
              decelerationRate="fast"
              showsHorizontalScrollIndicator={false}
              onScrollBeginDrag={() => { bannerInteractingRef.current = true; }}
              onScrollEndDrag={() => { setTimeout(() => { bannerInteractingRef.current = false; }, 240); }}
              onMomentumScrollEnd={onBannerMomentumEnd}
              contentContainerStyle={styles.horizontalList}
            >
              {bannerLoopData.map((banner, index) => (
                <Pressable
                  key={\`\${banner.id}-\${index}\`}
                  onPress={() => onOpenBanner(banner)}
                  style={[styles.bannerCard, { width: bannerCardWidth }]}
                >
                  <Image source={{ uri: banner.imageUrl }} style={styles.bannerImage} resizeMode="cover" />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* CATEGORIES ROW (Rounded items) */}
        {categories.length > 0 && (
          <View style={styles.categorySection}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            >
              <Link href="/(student)/menu/index" asChild>
                <Pressable style={styles.catItem}>
                  <View style={styles.catImageWrap}>
                    <Ionicons name="grid-outline" size={24} color="#64748B" />
                  </View>
                  <Text style={styles.catItemText}>All</Text>
                </Pressable>
              </Link>
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={{ pathname: "/(student)/menu/[categoryId]", params: { categoryId: category.id } }}
                  asChild
                >
                  <Pressable style={styles.catItem}>
                    <View style={styles.catImageWrap}>
                      {category.imageUrl ? (
                        <Image source={{ uri: category.imageUrl }} style={styles.catItemImage} />
                      ) : (
                        <Ionicons name="fast-food-outline" size={24} color="#64748B" />
                      )}
                    </View>
                    <Text style={styles.catItemText} numberOfLines={1}>{category.name}</Text>
                  </Pressable>
                </Link>
              ))}
            </ScrollView>
          </View>
        )}

        {/* RECOMMENDED FOR YOU (2-COLUMN GRID) */}
        {(featureSettings?.todaySpecialsEnabled ?? true) && todaySpecialItems.length > 0 && (
          <View style={styles.recommendedSection}>
            <Text style={styles.sectionTitle}>RECOMMENDED FOR YOU</Text>
            <View style={styles.gridContainer}>
              {todaySpecialItems.map((item, index) => (
                <View key={\`\${item.id}-\${index}\`} style={styles.gridItem}>
                  <Image source={{ uri: item.image }} style={styles.gridImage} resizeMode="cover" />
                  <View style={styles.gridBody}>
                    <View style={styles.vegIconBox}>
                       <Ionicons name="stop-circle" size={14} color="#16A34A" />
                    </View>
                    <Text style={styles.gridName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.gridPrice}>{formatCurrency(item.price)}</Text>
                    <Pressable style={styles.addButton} onPress={() => onAddToCart(item)}>
                      <Text style={styles.addText}>ADD</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* RECENT ORDERS */}
        {recentOrders.length > 0 && (
          <View style={styles.ordersSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Recent Orders</Text>
              <Pressable onPress={() => router.push("/(student)/orders")}>
                <Text style={styles.linkText}>View all</Text>
              </Pressable>
            </View>
            {recentOrders.map((order) => (
              <Link
                key={order.id}
                href={{ pathname: "/(student)/orders/[id]", params: { id: order.id } }}
                asChild
              >
                <Pressable style={styles.orderCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.orderNumber}>{order.orderNumber}</Text>
                    <Text style={styles.orderMeta}>Status: {order.status}</Text>
                  </View>
                  <Text style={styles.orderTotal}>{formatCurrency(order.totalAmount)}</Text>
                </Pressable>
              </Link>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  topBg: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFBEB",
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 20,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  locationTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    flexDirection: "row",
    alignItems: "center",
  },
  locationSubtitle: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "500",
  },
  headerRight: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  iconButton: {
    padding: 4,
    position: "relative",
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#1D4ED8",
    fontWeight: "700",
    fontSize: 16,
  },
  cartBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: "#EF4444",
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFBEB",
  },
  cartBadgeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "800",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 999,
    paddingHorizontal: 16,
    height: 52,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    marginTop: 4,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchText: {
    flex: 1,
    color: "#94A3B8",
    fontSize: 15,
    fontWeight: "500",
  },
  micDivider: {
    width: 1,
    height: 24,
    backgroundColor: "#E2E8F0",
    marginHorizontal: 12,
  },
  bannerSection: {
    marginTop: 8,
  },
  horizontalList: {
    gap: 12,
    paddingRight: 16,
  },
  bannerCard: {
    height: 180,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#E2E8F0",
  },
  bannerImage: {
    width: "100%",
    height: "100%",
  },
  categorySection: {
    marginTop: 4,
  },
  catItem: {
    alignItems: "center",
    gap: 6,
    width: 72,
  },
  catImageWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    overflow: "hidden",
  },
  catItemImage: {
    width: "100%",
    height: "100%",
  },
  catItemText: {
    fontSize: 13,
    color: "#334155",
    fontWeight: "600",
    textAlign: "center",
  },
  recommendedSection: {
    gap: 12,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    color: "#64748B",
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  gridItem: {
    width: "48%",
    backgroundColor: "white",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#F1F5F9",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  gridImage: {
    width: "100%",
    height: 120,
    backgroundColor: "#F1F5F9",
  },
  gridBody: {
    padding: 12,
    gap: 4,
  },
  vegIconBox: {
    borderWidth: 1,
    borderColor: "#16A34A",
    width: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 2,
  },
  gridName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
    marginTop: 4,
  },
  gridPrice: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 2,
  },
  addButton: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 8,
    paddingVertical: 6,
    alignItems: "center",
    marginTop: 8,
  },
  addText: {
    color: "#DC2626",
    fontWeight: "800",
    fontSize: 13,
  },
  ordersSection: {
    gap: 12,
    marginTop: 8,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  linkText: {
    color: "#F97316",
    fontWeight: "700",
  },
  orderCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  orderMeta: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
  },
  orderTotal: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
});
`;

fs.writeFileSync(dashboardPath, hooksAndLogic + newJSX, 'utf8');
console.log("Dashboard updated successfully!");
