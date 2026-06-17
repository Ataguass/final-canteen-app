const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'app', '(student)', 'dashboard.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const returnStart = content.indexOf('  return (\n');
if (returnStart === -1) {
  console.error("Could not find 'return ('");
  process.exit(1);
}

const newReturnAndStyles = `  return (
    <View style={styles.screen}>
      <View style={styles.topHeader}>
        <View style={styles.headerLeft}>
          <Ionicons name="location" size={24} color="#FF6B35" style={{ marginTop: 2 }} />
          <View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Text style={styles.headerUserName}>{user?.name ?? "Student"}</Text>
              <Ionicons name="chevron-down" size={14} color="#0F172A" />
            </View>
            <Text style={styles.headerSub}>Campus Canteen</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <Pressable onPress={() => router.push("/(student)/cart")} style={styles.cartIconWrapper}>
            <Ionicons name="cart-outline" size={28} color="#0F172A" />
            {cartItemsCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartItemsCount}</Text>
              </View>
            )}
          </Pressable>
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>{user?.name?.[0]?.toUpperCase() ?? "S"}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#FF6B35" />
          <TextInput 
            placeholder="Search for snacks, lunch..." 
            style={styles.searchInput} 
            placeholderTextColor="#94A3B8" 
            editable={false}
          />
          <Ionicons name="mic-outline" size={20} color="#FF6B35" />
        </View>

        {banners.length > 0 ? (
          <View style={styles.sectionWrap}>
            <ScrollView
              ref={bannerScrollRef}
              horizontal
              snapToInterval={bannerPitch}
              snapToAlignment="start"
              decelerationRate="fast"
              showsHorizontalScrollIndicator={false}
              onScrollBeginDrag={() => {
                bannerInteractingRef.current = true;
              }}
              onScrollEndDrag={() => {
                setTimeout(() => {
                  bannerInteractingRef.current = false;
                }, 240);
              }}
              contentContainerStyle={{ paddingRight: 16 }}
            >
              {banners.map((banner, i) => (
                <Pressable
                  key={banner.id + "_" + i}
                  onPress={() => onOpenBanner(banner)}
                  style={[
                    styles.bannerCard,
                    { width: bannerPitch - 16, marginRight: 16 }
                  ]}
                >
                  <Image
                    source={{ uri: banner.imageUrl }}
                    style={styles.bannerImage}
                    resizeMode="cover"
                  />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {todaySpecialItems.length > 0 ? (
          <View style={styles.sectionWrap}>
            <Text style={styles.sectionTitleRecommended}>RECOMMENDED FOR YOU</Text>
            <ScrollView
              ref={specialScrollRef}
              horizontal
              snapToInterval={SPECIAL_PITCH}
              snapToAlignment="start"
              decelerationRate="fast"
              showsHorizontalScrollIndicator={false}
              onScrollBeginDrag={() => {
                specialInteractingRef.current = true;
              }}
              onScrollEndDrag={() => {
                setTimeout(() => {
                  specialInteractingRef.current = false;
                }, 240);
              }}
              contentContainerStyle={{ paddingRight: 16 }}
            >
              {todaySpecialItems.map((item, i) => (
                <View key={item.id + "_" + i} style={styles.recCard}>
                  <Image source={{ uri: item.imageUrl || "https://via.placeholder.com/150" }} style={styles.recImage} />
                  <View style={styles.recBody}>
                    <View style={styles.vegIconWrap}>
                      <View style={styles.vegIconDot} />
                    </View>
                    <Text style={styles.recName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.recPrice}>₹ {item.price.toFixed(2)}</Text>
                    <Pressable onPress={() => onAddToCart(item)} style={styles.recAddButton}>
                      <Text style={styles.recAddText}>ADD</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitleRecommended}>CATEGORIES</Text>
            <Pressable onPress={() => router.push("/(student)/menu/index")}>
              <Text style={styles.linkText}>View all</Text>
            </Pressable>
          </View>
          {categories.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No categories available.</Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            >
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={{
                    pathname: "/(student)/menu/[categoryId]",
                    params: { categoryId: category.id }
                  }}
                  asChild
                >
                  <Pressable style={styles.categoryCard}>
                    {category.imageUrl ? (
                      <Image
                        source={{ uri: category.imageUrl }}
                        style={styles.categoryImage}
                        resizeMode="cover"
                      />
                    ) : null}
                    <View style={styles.categoryBody}>
                      <Text style={styles.categoryName}>{category.name}</Text>
                    </View>
                  </Pressable>
                </Link>
              ))}
            </ScrollView>
          )}
        </View>

        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitleRecommended}>RECENT ORDERS</Text>
            <Pressable onPress={() => router.push("/(student)/orders")}>
              <Text style={styles.linkText}>View all</Text>
            </Pressable>
          </View>
          {recentOrders.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No orders yet.</Text>
            </View>
          ) : (
            recentOrders.map((order) => (
              <Link
                key={order.id}
                href={{
                  pathname: "/(student)/orders/[id]",
                  params: { id: order.id }
                }}
                asChild
              >
                <Pressable style={styles.orderCard}>
                  <View>
                    <Text style={styles.orderNumber}>{order.orderNumber}</Text>
                    <Text style={styles.orderMeta}>Status: {order.status}</Text>
                  </View>
                  <Text style={styles.orderPrice}>
                    {formatCurrency(order.totalAmount)}
                  </Text>
                </Pressable>
              </Link>
            ))
          )}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#2B2B2B", // Deep dark background from screenshot
  },
  topHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: "#2B2B2B",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  headerUserName: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
  headerSub: {
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "600",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  cartIconWrapper: {
    position: "relative",
  },
  cartBadge: {
    position: "absolute",
    top: -4,
    right: -6,
    backgroundColor: "#EF4444",
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#2B2B2B",
  },
  cartBadgeText: {
    color: "white",
    fontSize: 9,
    fontWeight: "900",
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
  },
  userAvatarText: {
    color: "#60A5FA",
    fontWeight: "800",
    fontSize: 16,
  },
  content: {
    padding: 16,
    gap: 24,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#334155", // dark input bg
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
    padding: 0,
  },
  sectionWrap: {
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitleRecommended: {
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  horizontalList: {
    gap: 12,
    paddingRight: 16,
  },
  bannerCard: {
    height: 180,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
  bannerImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "#E2E8F0",
  },
  recCard: {
    width: 160,
    borderRadius: 16,
    backgroundColor: "#334155",
    overflow: "hidden",
    marginRight: 16,
  },
  recImage: {
    width: "100%",
    height: 120,
    backgroundColor: "#475569",
  },
  recBody: {
    padding: 12,
    gap: 6,
  },
  vegIconWrap: {
    width: 16,
    height: 16,
    borderWidth: 1,
    borderColor: "#22C55E",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
    marginBottom: 2,
  },
  vegIconDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#22C55E",
  },
  recName: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 15,
  },
  recPrice: {
    color: "#94A3B8",
    fontWeight: "800",
    fontSize: 13,
  },
  recAddButton: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#475569",
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
  },
  recAddText: {
    color: "#EF4444",
    fontWeight: "800",
    fontSize: 13,
  },
  linkText: {
    color: "#FF6B35",
    fontWeight: "700",
  },
  emptyCard: {
    borderRadius: 12,
    padding: 14,
    backgroundColor: "#334155",
  },
  emptyText: {
    color: "#94A3B8",
    fontWeight: "600",
  },
  categoryCard: {
    width: 120,
    borderRadius: 14,
    backgroundColor: "#334155",
    overflow: "hidden",
  },
  categoryImage: {
    width: "100%",
    height: 80,
    backgroundColor: "#475569",
  },
  categoryBody: {
    padding: 10,
    alignItems: "center",
  },
  categoryName: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 13,
    textAlign: "center",
  },
  orderCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: "#334155",
    padding: 14,
  },
  orderNumber: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 15,
  },
  orderMeta: {
    color: "#94A3B8",
    fontWeight: "600",
    marginTop: 4,
  },
  orderPrice: {
    color: "#FF6B35",
    fontWeight: "800",
    fontSize: 15,
  }
});
`;

const finalContent = content.substring(0, returnStart) + newReturnAndStyles;
fs.writeFileSync(filePath, finalContent, 'utf8');
console.log("Successfully rewrote dashboard.tsx");
