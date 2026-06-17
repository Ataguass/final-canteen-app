import { Ionicons } from "@expo/vector-icons";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useAuth } from "../../../hooks/useAuth";
import { menuService, type Category, type MenuItem } from "../../../services/menuService";
import { tenantService } from "../../../services/tenantService";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_WIDTH = 1280;
const MAX_IMAGE_HEIGHT = 1280;
const estimateBase64Bytes = (base64: string): number => Math.floor((base64.length * 3) / 4);

const card = {
  borderWidth: 1,
  borderColor: "#E2E8F0",
  borderRadius: 16,
  backgroundColor: "white",
  shadowColor: "#0F172A",
  shadowOpacity: 0.05,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2
} as const;

export default function Screen() {
  const scrollViewRef = useRef<ScrollView>(null);
  const { user, accessToken } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryDescription, setNewCategoryDescription] = useState("");
  const [newCategoryImageUrl, setNewCategoryImageUrl] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);

  const [itemName, setItemName] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [itemImageUrl, setItemImageUrl] = useState("");
  const [itemIsTodaySpecial, setItemIsTodaySpecial] = useState(false);
  const [itemPrice, setItemPrice] = useState("");
  const [itemStock, setItemStock] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [todaySpecialsEnabled, setTodaySpecialsEnabled] = useState(true);

  const [loading, setLoading] = useState(false);
  const [uploadingCategoryImage, setUploadingCategoryImage] = useState(false);
  const [uploadingItemImage, setUploadingItemImage] = useState(false);

  const loadData = useCallback(async () => {
    if (!user?.tenantId || !accessToken) return;
    const [categoryRes, itemRes, featureRes] = await Promise.all([
      menuService.listCategories(accessToken, user.tenantId),
      menuService.listItems(accessToken, user.tenantId),
      tenantService.getFeatureSettings(accessToken, user.tenantId)
    ]);
    setCategories(categoryRes.data);
    setItems(itemRes.data);
    setTodaySpecialsEnabled(featureRes.data.todaySpecialsEnabled);
    if (!categoryId && categoryRes.data.length > 0) {
      setCategoryId(categoryRes.data[0].id);
    }
  }, [user?.tenantId, accessToken, categoryId]);

  useEffect(() => {
    loadData().catch((error: unknown) => {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to load menu data");
    });
  }, [loadData]);

  const resetCategoryForm = () => {
    setNewCategoryName("");
    setNewCategoryDescription("");
    setNewCategoryImageUrl("");
    setEditingCategoryId(null);
  };

  const resetItemForm = () => {
    setItemName("");
    setItemDescription("");
    setItemImageUrl("");
    setItemIsTodaySpecial(false);
    setItemPrice("");
    setItemStock("");
  };

  const pickAndUploadImageAndReturnUrl = async (target: "CATEGORY" | "ITEM"): Promise<string | null> => {
    if (!user?.tenantId || !accessToken) return null;

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission needed", "Allow gallery access to upload image.");
        return null;
      }

      const picked = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        quality: 1,
        mediaTypes: ["images"],
        aspect: target === "CATEGORY" ? [16, 9] : [1, 1]
      });
      if (picked.canceled || !picked.assets.length) return null;

      const asset = picked.assets[0];
      const scale = Math.min(MAX_IMAGE_WIDTH / asset.width, MAX_IMAGE_HEIGHT / asset.height, 1);
      const targetWidth = Math.max(1, Math.round(asset.width * scale));
      const targetHeight = Math.max(1, Math.round(asset.height * scale));

      const firstPass = await ImageManipulator.manipulateAsync(
        asset.uri,
        scale < 1 ? [{ resize: { width: targetWidth, height: targetHeight } }] : [],
        { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      let base64 = firstPass.base64 ?? "";
      if (!base64) throw new Error("Could not prepare image");

      if (estimateBase64Bytes(base64) > MAX_IMAGE_BYTES) {
        const secondPass = await ImageManipulator.manipulateAsync(firstPass.uri, [], {
          compress: 0.62,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true
        });
        base64 = secondPass.base64 ?? "";
      }

      if (!base64 || estimateBase64Bytes(base64) > MAX_IMAGE_BYTES) {
        Alert.alert("Image too large", "Please pick a smaller image (max 2 MB). ");
        return null;
      }

      if (target === "CATEGORY") setUploadingCategoryImage(true);
      if (target === "ITEM") setUploadingItemImage(true);

      const upload = await menuService.uploadMenuImage(
        accessToken,
        user.tenantId,
        `data:image/jpeg;base64,${base64}`,
        target
      );
      return upload.data.imageUrl;
    } catch (error) {
      Alert.alert("Upload failed", error instanceof Error ? error.message : "Could not upload image");
    } finally {
      setUploadingCategoryImage(false);
      setUploadingItemImage(false);
    }
    return null;
  };

  const pickAndUploadImage = async (target: "CATEGORY" | "ITEM") => {
    const imageUrl = await pickAndUploadImageAndReturnUrl(target);
    if (!imageUrl) return;
    if (target === "CATEGORY") {
      setNewCategoryImageUrl(imageUrl);
    } else {
      setItemImageUrl(imageUrl);
    }
    Alert.alert("Uploaded", `${target === "CATEGORY" ? "Category" : "Item"} image uploaded.`);
  };

  const onUpdateExistingItemImage = async (itemId: string, itemName: string) => {
    if (!user?.tenantId || !accessToken) return;
    const imageUrl = await pickAndUploadImageAndReturnUrl("ITEM");
    if (!imageUrl) return;
    try {
      setLoading(true);
      await menuService.updateItem(accessToken, user.tenantId, itemId, { image: imageUrl });
      await loadData();
      Alert.alert("Updated", `${itemName} image updated.`);
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Could not update item image");
    } finally {
      setLoading(false);
    }
  };

  const onSaveCategory = async () => {
    if (!user?.tenantId || !accessToken || !newCategoryName.trim()) {
      Alert.alert("Missing fields", "Category name is required.");
      return;
    }

    try {
      setLoading(true);
      if (editingCategoryId) {
        await menuService.updateCategory(accessToken, user.tenantId, editingCategoryId, {
          name: newCategoryName.trim(),
          description: newCategoryDescription.trim() || null,
          imageUrl: newCategoryImageUrl.trim() || null
        });
      } else {
        await menuService.createCategory(accessToken, user.tenantId, {
          name: newCategoryName.trim(),
          description: newCategoryDescription.trim() || undefined,
          imageUrl: newCategoryImageUrl.trim() || undefined
        });
      }
      resetCategoryForm();
      await loadData();
      Alert.alert("Success", editingCategoryId ? "Category updated." : "Category created.");
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Could not save category");
    } finally {
      setLoading(false);
    }
  };

  const onCreateItem = async () => {
    if (!user?.tenantId || !accessToken || !itemName.trim() || !categoryId) {
      Alert.alert("Missing fields", "Select category and enter item name.");
      return;
    }

    try {
      setLoading(true);
      await menuService.createItem(accessToken, user.tenantId, {
        categoryId,
        name: itemName.trim(),
        description: itemDescription.trim() || undefined,
        image: itemImageUrl.trim() || undefined,
        price: Number(itemPrice || 0),
        stockQty: Number(itemStock || 0),
        isTodaySpecial: itemIsTodaySpecial
      });
      resetItemForm();
      await loadData();
      Alert.alert("Success", "Item created.");
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Could not create item");
    } finally {
      setLoading(false);
    }
  };

  const onToggle = async (id: string) => {
    if (!user?.tenantId || !accessToken) return;
    try {
      await menuService.toggleItem(accessToken, user.tenantId, id);
      await loadData();
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Could not toggle item");
    }
  };

  const onDelete = async (id: string) => {
    if (!user?.tenantId || !accessToken) return;
    Alert.alert("Delete Item", "Do you want to delete this item?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await menuService.deleteItem(accessToken, user.tenantId, id);
            await loadData();
          } catch (error) {
            Alert.alert("Error", error instanceof Error ? error.message : "Could not delete item");
          }
        }
      }
    ]);
  };

  const onToggleTodaySpecialsFeature = async () => {
    if (!user?.tenantId || !accessToken) return;
    try {
      setLoading(true);
      const response = await tenantService.updateFeatureSettings(accessToken, user.tenantId, {
        todaySpecialsEnabled: !todaySpecialsEnabled
      });
      setTodaySpecialsEnabled(response.data.todaySpecialsEnabled);
      Alert.alert(
        "Updated",
        response.data.todaySpecialsEnabled
          ? "Today's Specials is now visible on user dashboard."
          : "Today's Specials is now hidden on user dashboard."
      );
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Could not update feature");
    } finally {
      setLoading(false);
    }
  };

  const onToggleItemTodaySpecial = async (item: MenuItem) => {
    if (!user?.tenantId || !accessToken) return;
    try {
      setLoading(true);
      await menuService.updateItem(accessToken, user.tenantId, item.id, {
        isTodaySpecial: !item.isTodaySpecial
      });
      await loadData();
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "Could not update item special status"
      );
    } finally {
      setLoading(false);
    }
  };

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((category) => map.set(category.id, category.name));
    return map;
  }, [categories]);

  if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>Admin access required.</Text>
      </View>
    );
  }

  return (
    <ScrollView ref={scrollViewRef} style={{ flex: 1, backgroundColor: "#EEF2F7" }} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}>


      <View style={{ ...card, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: "800", color: "#0F172A" }}>Today's Specials Feature</Text>
          <Text style={{ color: "#475569", fontSize: 12, marginTop: 2 }}>
            Toggle specials section for all users.
          </Text>
        </View>
        <Pressable
          onPress={onToggleTodaySpecialsFeature}
          disabled={loading}
          style={{
            borderRadius: 999,
            paddingVertical: 8,
            paddingHorizontal: 16,
            backgroundColor: todaySpecialsEnabled ? "#059669" : "#475569"
          }}
        >
          <Text style={{ color: "white", fontWeight: "800", fontSize: 13 }}>
            {todaySpecialsEnabled ? "Enabled" : "Disabled"}
          </Text>
        </Pressable>
      </View>

      <View style={{ ...card, padding: 16, gap: 12 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <Text style={{ fontSize: 16, fontWeight: "800", color: "#0F172A" }}>Category Details</Text>
            <Text style={{ color: "#64748B", fontSize: 12 }}>Create or edit a category</Text>
          </View>
          {editingCategoryId ? (
            <Pressable onPress={resetCategoryForm} style={{ borderRadius: 999, backgroundColor: "#FEE2E2", paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ color: "#DC2626", fontWeight: "700", fontSize: 11 }}>Cancel Edit</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1, gap: 8 }}>
            <TextInput
              placeholder="Category Name"
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              style={{ borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 10, padding: 10, backgroundColor: "#F8FAFC", fontSize: 14 }}
            />
            <TextInput
              placeholder="Description (optional)"
              value={newCategoryDescription}
              onChangeText={setNewCategoryDescription}
              multiline
              style={{ borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 10, padding: 10, height: 60, textAlignVertical: "top", backgroundColor: "#F8FAFC", fontSize: 14 }}
            />
          </View>

          <View style={{ width: 120 }}>
            {newCategoryImageUrl ? (
              <View style={{ borderRadius: 10, overflow: "hidden", borderWidth: 1, borderColor: "#E2E8F0", width: 120, height: 67 }}>
                <Image source={{ uri: newCategoryImageUrl }} style={{ width: "100%", height: "100%", backgroundColor: "#F1F5F9" }} resizeMode="cover" />
                <Pressable onPress={() => pickAndUploadImage("CATEGORY")} disabled={uploadingCategoryImage} style={{ position: "absolute", bottom: 4, right: 4, backgroundColor: "rgba(15, 23, 42, 0.7)", borderRadius: 999, padding: 4 }}>
                  <Ionicons name="camera" size={14} color="white" />
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={() => pickAndUploadImage("CATEGORY")}
                disabled={uploadingCategoryImage}
                style={{ width: 120, height: 67, backgroundColor: "#EFF6FF", borderWidth: 1, borderColor: "#BFDBFE", borderStyle: "dashed", borderRadius: 10, alignItems: "center", justifyContent: "center", gap: 4 }}
              >
                <Ionicons name="cloud-upload" size={18} color="#1D4ED8" />
                <Text style={{ color: "#1D4ED8", fontWeight: "700", fontSize: 11, textAlign: "center" }}>{uploadingCategoryImage ? "..." : "Banner\n(16:9)"}</Text>
              </Pressable>
            )}
            
            <Pressable
              onPress={onSaveCategory}
              disabled={loading}
              style={{ backgroundColor: "#0F172A", borderRadius: 10, paddingVertical: 10, alignItems: "center", marginTop: "auto" }}
            >
              <Text style={{ color: "white", fontWeight: "800", fontSize: 13 }}>
                {loading ? "..." : editingCategoryId ? "Update" : "Add"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      <View style={{ ...card, padding: 16, gap: 12 }}>
        <View>
          <Text style={{ fontSize: 16, fontWeight: "800", color: "#0F172A" }}>Item Details</Text>
          <Text style={{ color: "#64748B", fontSize: 12 }}>Add a new food or beverage item</Text>
        </View>

        <View style={{ gap: 8 }}>
          <TextInput
            placeholder="Item Name (e.g. Classic Cheeseburger)"
            value={itemName}
            onChangeText={setItemName}
            style={{ borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 10, padding: 10, backgroundColor: "#F8FAFC", fontSize: 14 }}
          />
          <TextInput
            placeholder="Description (optional)"
            value={itemDescription}
            onChangeText={setItemDescription}
            multiline
            style={{ borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 10, padding: 10, height: 60, textAlignVertical: "top", backgroundColor: "#F8FAFC", fontSize: 14 }}
          />
        </View>

        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1, gap: 8 }}>
            <TextInput
              placeholder="Price (INR)"
              keyboardType="numeric"
              value={itemPrice}
              onChangeText={setItemPrice}
              style={{ borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 10, padding: 10, backgroundColor: "#F8FAFC", fontSize: 14 }}
            />
            <TextInput
              placeholder="Stock Qty"
              keyboardType="numeric"
              value={itemStock}
              onChangeText={setItemStock}
              style={{ borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 10, padding: 10, backgroundColor: "#F8FAFC", fontSize: 14 }}
            />
          </View>

          <View style={{ width: 90 }}>
            {itemImageUrl ? (
              <View style={{ position: "relative", borderRadius: 10, overflow: "hidden", borderWidth: 1, borderColor: "#E2E8F0", width: 90, height: 90 }}>
                <Image source={{ uri: itemImageUrl }} style={{ width: "100%", height: "100%", backgroundColor: "#F1F5F9" }} resizeMode="cover" />
                <Pressable
                  onPress={() => pickAndUploadImage("ITEM")}
                  disabled={uploadingItemImage}
                  style={{ position: "absolute", bottom: 4, right: 4, backgroundColor: "rgba(15, 23, 42, 0.7)", borderRadius: 999, padding: 6 }}
                >
                  <Ionicons name="camera" size={14} color="white" />
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={() => pickAndUploadImage("ITEM")}
                disabled={uploadingItemImage}
                style={{ width: 90, height: 90, backgroundColor: "#F0FDF4", borderWidth: 1, borderColor: "#BBF7D0", borderStyle: "dashed", borderRadius: 10, alignItems: "center", justifyContent: "center", gap: 4 }}
              >
                <Ionicons name="image-outline" size={20} color="#16A34A" />
                <Text style={{ color: "#16A34A", fontWeight: "700", fontSize: 10, textAlign: "center" }}>{uploadingItemImage ? "..." : "Photo\n(1:1)"}</Text>
              </Pressable>
            )}
          </View>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ color: "#334155", fontWeight: "700", fontSize: 13 }}>Mark as Today's Special</Text>
          <Pressable
            onPress={() => setItemIsTodaySpecial((value) => !value)}
            style={{
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: 999,
              backgroundColor: itemIsTodaySpecial ? "#ECFDF5" : "#F1F5F9",
              borderWidth: 1,
              borderColor: itemIsTodaySpecial ? "#059669" : "#E2E8F0",
              flexDirection: "row",
              alignItems: "center",
              gap: 6
            }}
          >
            <Ionicons name={itemIsTodaySpecial ? "star" : "star-outline"} size={16} color={itemIsTodaySpecial ? "#059669" : "#64748B"} />
            <Text style={{ color: itemIsTodaySpecial ? "#065F46" : "#475569", fontWeight: "700", fontSize: 13 }}>
              {itemIsTodaySpecial ? "Yes" : "No"}
            </Text>
          </Pressable>
        </View>

        <View style={{ gap: 8 }}>
          <Text style={{ color: "#334155", fontWeight: "700", fontSize: 13, marginLeft: 4 }}>Select Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
            {categories.map((category) => {
              const selected = categoryId === category.id;
              return (
                <Pressable
                  key={category.id}
                  onPress={() => setCategoryId(category.id)}
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 16,
                    borderRadius: 999,
                    backgroundColor: selected ? "#1D4ED8" : "#E2E8F0"
                  }}
                >
                  <Text style={{ color: selected ? "white" : "#334155", fontWeight: "700" }}>{category.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <Pressable
          onPress={onCreateItem}
          disabled={loading}
          style={{ backgroundColor: "#059669", borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: 4 }}
        >
          <Text style={{ color: "white", fontWeight: "800", fontSize: 14 }}>{loading ? "Saving..." : "Add New Item"}</Text>
        </Pressable>
      </View>

      <View style={{ ...card, padding: 20, gap: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: "800", color: "#0F172A" }}>Categories ({categories.length})</Text>
        {categories.length === 0 ? <Text style={{ color: "#64748B" }}>No categories yet.</Text> : null}
        {categories.map((category) => (
          <View key={category.id} style={{ borderRadius: 12, overflow: "hidden", backgroundColor: "white", borderWidth: 1, borderColor: "#E2E8F0", shadowColor: "#0F172A", shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2, flexDirection: "row", alignItems: "center" }}>
            {category.imageUrl ? (
              <Image source={{ uri: category.imageUrl }} style={{ width: 120, height: 67, backgroundColor: "#F1F5F9" }} resizeMode="cover" />
            ) : (
              <View style={{ width: 120, height: 67, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="image-outline" size={24} color="#CBD5E1" />
              </View>
            )}
            <View style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 8, gap: 4 }}>
              <Text style={{ fontWeight: "800", color: "#0F172A", fontSize: 15 }} numberOfLines={1}>{category.name}</Text>
              {category.description ? <Text style={{ color: "#64748B", fontSize: 12 }} numberOfLines={1}>{category.description}</Text> : null}
            </View>
            <Pressable
              onPress={() => {
                setEditingCategoryId(category.id);
                setNewCategoryName(category.name);
                setNewCategoryDescription(category.description ?? "");
                setNewCategoryImageUrl(category.imageUrl ?? "");
                scrollViewRef.current?.scrollTo({ y: 0, animated: true });
              }}
              style={{ padding: 12, borderLeftWidth: 1, borderColor: "#E2E8F0", backgroundColor: "#F8FAFC", alignSelf: "stretch", justifyContent: "center" }}
            >
              <Ionicons name="create-outline" size={20} color="#1D4ED8" />
            </Pressable>
          </View>
        ))}
      </View>

      <View style={{ ...card, padding: 20, gap: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: "800", color: "#0F172A" }}>Menu Items ({items.length})</Text>
        {items.length === 0 ? <Text style={{ color: "#64748B" }}>No items yet.</Text> : null}
        {items.map((item) => (
          <View key={item.id} style={{ borderRadius: 16, overflow: "hidden", backgroundColor: "white", borderWidth: 1, borderColor: "#E2E8F0", shadowColor: "#0F172A", shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 }}>
            <View style={{ flexDirection: "row", padding: 12, gap: 12 }}>
              {item.image ? (
                <Image source={{ uri: item.image }} style={{ width: 100, height: 100, borderRadius: 12, backgroundColor: "#F1F5F9" }} resizeMode="cover" />
              ) : (
                <View style={{ width: 100, height: 100, borderRadius: 12, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="fast-food-outline" size={32} color="#CBD5E1" />
                </View>
              )}
              
              <View style={{ flex: 1, justifyContent: "center", gap: 4 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <Text style={{ fontWeight: "800", color: "#0F172A", fontSize: 16, flex: 1 }} numberOfLines={2}>{item.name}</Text>
                  <Text style={{ fontWeight: "800", color: "#0F172A", fontSize: 16 }}>₹ {item.price.toFixed(2)}</Text>
                </View>
                <Text style={{ color: "#64748B", fontSize: 13 }}>{item.categoryId ? categoryNameById.get(item.categoryId) ?? "Unknown" : "Uncategorized"}</Text>
                {item.description ? <Text style={{ color: "#475569", fontSize: 13 }} numberOfLines={1}>{item.description}</Text> : null}
                
                <View style={{ flexDirection: "row", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                  <View style={{ backgroundColor: "#F1F5F9", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                    <Text style={{ color: "#475569", fontSize: 11, fontWeight: "700" }}>Stock: {item.stockQty}</Text>
                  </View>
                  <View style={{ backgroundColor: item.isAvailable ? "#DCFCE7" : "#FEE2E2", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                    <Text style={{ color: item.isAvailable ? "#16A34A" : "#DC2626", fontSize: 11, fontWeight: "700" }}>{item.isAvailable ? "Available" : "Hidden"}</Text>
                  </View>
                  {item.isTodaySpecial && (
                    <View style={{ backgroundColor: "#FEF3C7", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                      <Text style={{ color: "#D97706", fontSize: 11, fontWeight: "700" }}>Today's Special</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            <View style={{ flexDirection: "row", borderTopWidth: 1, borderColor: "#E2E8F0", backgroundColor: "#F8FAFC" }}>
              <Pressable onPress={() => onUpdateExistingItemImage(item.id, item.name)} style={{ flex: 1, paddingVertical: 12, alignItems: "center", borderRightWidth: 1, borderColor: "#E2E8F0", opacity: loading || uploadingItemImage ? 0.5 : 1 }}>
                <Ionicons name="camera-outline" size={20} color="#1D4ED8" />
              </Pressable>
              <Pressable onPress={() => onToggleItemTodaySpecial(item)} style={{ flex: 1, paddingVertical: 12, alignItems: "center", borderRightWidth: 1, borderColor: "#E2E8F0", opacity: loading ? 0.5 : 1 }}>
                <Ionicons name={item.isTodaySpecial ? "star" : "star-outline"} size={20} color={item.isTodaySpecial ? "#D97706" : "#64748B"} />
              </Pressable>
              <Pressable onPress={() => onToggle(item.id)} style={{ flex: 1, paddingVertical: 12, alignItems: "center", borderRightWidth: 1, borderColor: "#E2E8F0" }}>
                <Ionicons name={item.isAvailable ? "eye-off-outline" : "eye-outline"} size={20} color="#334155" />
              </Pressable>
              <Pressable onPress={() => onDelete(item.id)} style={{ flex: 1, paddingVertical: 12, alignItems: "center" }}>
                <Ionicons name="trash-outline" size={20} color="#DC2626" />
              </Pressable>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
