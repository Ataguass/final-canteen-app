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
          <Ionicons name="location" size={20} color="#0F172A" />
          <Text style={styles.headerUserName}>Welcome, {user?.name?.split(" ")[0] ?? "Student"}</Text>
          <Ionicons name="chevron-down" size={14} color="#0F172A" />
        </View>
        <View style={styles.headerRight}>
          <Pressable onPress={() => router.push("/(student)/cart" as any)} style={styles.cartIconWrapper}>
            <Ionicons name="cart-outline" size={26} color="#0F172A" />
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
          <View style={styles.micWrap}>
            <Ionicons name="mic" size={18} color="#FF6B35" />
          </View>
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

        {categories.length > 0 ? (
          <View style={[styles.sectionWrap, { marginTop: 8 }]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalCategories}
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
                  <Pressable style={styles.categoryCircleItem}>
                    <View style={styles.categoryCircleWrap}>
                      {category.imageUrl ? (
                        <Image
                          source={{ uri: category.imageUrl }}
                          style={styles.categoryCircleImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <Ionicons name="fast-food" size={24} color="#94A3B8" />
                      )}
                    </View>
                    <Text style={styles.categoryCircleName} numberOfLines={1}>{category.name}</Text>
                  </Pressable>
                </Link>
              ))}
            </ScrollView>
          </View>
        ) : null}



        {todaySpecialItems.length > 0 ? (
          <View style={styles.sectionWrap}>
            <Text style={styles.sectionTitleRecommended}>RECOMMENDED FOR YOU</Text>
            <View style={styles.gridContainer}>
              {todaySpecialItems.slice(0, 6).map((item, i) => (
                <View key={item.id + "_" + i} style={styles.gridCard}>
                  <View style={styles.gridImageWrap}>
                    <Image source={{ uri: item.image || "https://via.placeholder.com/150" }} style={styles.gridImage} />
                    <View style={styles.ratingBadge}>
                      <Text style={styles.ratingText}>4.5</Text>
                      <Ionicons name="star" size={10} color="white" />
                    </View>
                    <Pressable style={styles.gridAddBtn} onPress={() => onAddToCart(item)}>
                       <Ionicons name="add" size={20} color="#FF6B35" />
                    </Pressable>
                  </View>
                  <Text style={styles.gridName} numberOfLines={1}>{item.name}</Text>
                  <View style={styles.gridMetaRow}>
                    <Ionicons name="time-outline" size={14} color="#64748B" />
                    <Text style={styles.gridMetaText}>10-15 mins</Text>
                    <Text style={styles.gridPriceText}> • ₹{item.price.toFixed(0)}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}
        
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
    backgroundColor: "#F8FAFC",
  },
  topHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 12,
    backgroundColor: "#F8FAFC",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerUserName: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "800",
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
    borderColor: "#F8FAFC",
  },
  cartBadgeText: {
    color: "white",
    fontSize: 9,
    fontWeight: "900",
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
  },
  userAvatarText: {
    color: "#1D4ED8",
    fontWeight: "800",
    fontSize: 14,
  },
  content: {
    paddingTop: 8,
    paddingHorizontal: 16,
    gap: 20,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#0F172A",
    padding: 0,
  },
  micWrap: {
    paddingLeft: 10,
    borderLeftWidth: 1,
    borderLeftColor: "#E2E8F0",
  },
  sectionWrap: {
    gap: 16,
  },
  bannerCard: {
    height: 160,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
  bannerImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "#E2E8F0",
  },
  horizontalCategories: {
    gap: 20,
    paddingRight: 16,
    paddingVertical: 4,
  },
  categoryCircleItem: {
    alignItems: "center",
    width: 72,
    gap: 8,
  },
  categoryCircleWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  categoryCircleImage: {
    width: "100%",
    height: "100%",
  },
  categoryCircleName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
    textAlign: "center",
  },

  sectionTitleRecommended: {
    color: "#64748B",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 24,
  },
  gridCard: {
    width: "48%",
    gap: 8,
  },
  gridImageWrap: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    overflow: "hidden",
  },
  gridImage: {
    width: "100%",
    height: "100%",
  },
  ratingBadge: {
    position: "absolute",
    bottom: 8,
    left: 8,
    backgroundColor: "#22C55E",
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ratingText: {
    color: "white",
    fontSize: 11,
    fontWeight: "800",
  },
  gridAddBtn: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "white",
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  gridName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 2,
  },
  gridMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  gridMetaText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
  },
  gridPriceText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F172A",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  linkText: {
    color: "#FF6B35",
    fontWeight: "700",
  },
  emptyCard: {
    borderRadius: 12,
    padding: 14,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  emptyText: {
    color: "#64748B",
    fontWeight: "600",
  },
  orderCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  orderNumber: {
    color: "#0F172A",
    fontWeight: "800",
    fontSize: 15,
  },
  orderMeta: {
    color: "#64748B",
    fontWeight: "600",
    marginTop: 4,
  },
  orderPrice: {
    color: "#0F172A",
    fontWeight: "800",
    fontSize: 15,
  }
});
`;

const finalContent = content.substring(0, returnStart) + newReturnAndStyles;
fs.writeFileSync(filePath, finalContent, 'utf8');
console.log("Successfully rewrote dashboard.tsx");
