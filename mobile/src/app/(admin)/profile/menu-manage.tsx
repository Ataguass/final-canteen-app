import { Ionicons } from "@expo/vector-icons";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useMemo, useState } from "react";
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
        mediaTypes: ["images"]
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
    <ScrollView style={{ flex: 1, backgroundColor: "#EEF2F7" }} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}>
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 28, fontWeight: "800", color: "#0F172A" }}>Menu Management</Text>
        <Text style={{ color: "#64748B" }}>Create categories/items with image and description for better ordering.</Text>
      </View>

      <View style={{ ...card, padding: 12, gap: 10 }}>
        <Text style={{ fontSize: 17, fontWeight: "800", color: "#0F172A" }}>Today's Specials Feature</Text>
        <Text style={{ color: "#475569" }}>
          Toggle to show or hide the Today's Specials section for students, teachers, staff and guests.
        </Text>
        <Pressable
          onPress={onToggleTodaySpecialsFeature}
          disabled={loading}
          style={{
            borderRadius: 12,
            paddingVertical: 11,
            alignItems: "center",
            backgroundColor: todaySpecialsEnabled ? "#059669" : "#475569"
          }}
        >
          <Text style={{ color: "white", fontWeight: "800" }}>
            {todaySpecialsEnabled ? "Enabled (Tap to Disable)" : "Disabled (Tap to Enable)"}
          </Text>
        </Pressable>
      </View>

      <View style={{ ...card, padding: 12, gap: 10 }}>
        <Text style={{ fontSize: 17, fontWeight: "800", color: "#0F172A" }}>Create Category</Text>
        {editingCategoryId ? (
          <View style={{ borderWidth: 1, borderColor: "#93C5FD", borderRadius: 10, backgroundColor: "#EFF6FF", padding: 10, gap: 8 }}>
            <Text style={{ color: "#1D4ED8", fontWeight: "700" }}>Editing existing category</Text>
            <Pressable
              onPress={resetCategoryForm}
              style={{ alignSelf: "flex-start", borderRadius: 999, backgroundColor: "#DBEAFE", paddingHorizontal: 10, paddingVertical: 6 }}
            >
              <Text style={{ color: "#1E3A8A", fontWeight: "700" }}>Cancel Edit</Text>
            </Pressable>
          </View>
        ) : null}
        <TextInput
          placeholder="Category name"
          value={newCategoryName}
          onChangeText={setNewCategoryName}
          style={{ borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 12, padding: 10, backgroundColor: "#F8FAFC" }}
        />
        <TextInput
          placeholder="Description (optional)"
          value={newCategoryDescription}
          onChangeText={setNewCategoryDescription}
          multiline
          style={{ borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 12, padding: 10, minHeight: 70, textAlignVertical: "top", backgroundColor: "#F8FAFC" }}
        />
        <TextInput
          placeholder="Image URL (auto-filled after upload)"
          value={newCategoryImageUrl}
          onChangeText={setNewCategoryImageUrl}
          autoCapitalize="none"
          style={{ borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 12, padding: 10, backgroundColor: "#F8FAFC" }}
        />
        <Pressable
          onPress={() => pickAndUploadImage("CATEGORY")}
          disabled={uploadingCategoryImage}
          style={{ backgroundColor: "#1D4ED8", borderRadius: 12, paddingVertical: 11, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 }}
        >
          <Ionicons name="cloud-upload-outline" size={16} color="white" />
          <Text style={{ color: "white", fontWeight: "800" }}>{uploadingCategoryImage ? "Uploading..." : "Upload Category Image"}</Text>
        </Pressable>
        {newCategoryImageUrl ? (
          <Image source={{ uri: newCategoryImageUrl }} style={{ width: "100%", height: 130, borderRadius: 12, backgroundColor: "#F1F5F9" }} resizeMode="cover" />
        ) : null}

        <Pressable
          onPress={onSaveCategory}
          disabled={loading}
          style={{ backgroundColor: "#0F172A", borderRadius: 12, padding: 12, alignItems: "center" }}
        >
          <Text style={{ color: "white", fontWeight: "800" }}>
            {loading ? "Saving..." : editingCategoryId ? "Update Category" : "Add Category"}
          </Text>
        </Pressable>
      </View>

      <View style={{ ...card, padding: 12, gap: 10 }}>
        <Text style={{ fontSize: 17, fontWeight: "800", color: "#0F172A" }}>Create Item</Text>
        <TextInput
          placeholder="Item name"
          value={itemName}
          onChangeText={setItemName}
          style={{ borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 12, padding: 10, backgroundColor: "#F8FAFC" }}
        />
        <TextInput
          placeholder="Description (optional)"
          value={itemDescription}
          onChangeText={setItemDescription}
          multiline
          style={{ borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 12, padding: 10, minHeight: 70, textAlignVertical: "top", backgroundColor: "#F8FAFC" }}
        />
        <Pressable
          onPress={() => setItemIsTodaySpecial((value) => !value)}
          style={{
            borderWidth: 1,
            borderColor: itemIsTodaySpecial ? "#059669" : "#CBD5E1",
            borderRadius: 12,
            paddingVertical: 10,
            paddingHorizontal: 12,
            backgroundColor: itemIsTodaySpecial ? "#ECFDF5" : "#F8FAFC"
          }}
        >
          <Text style={{ color: itemIsTodaySpecial ? "#065F46" : "#334155", fontWeight: "700" }}>
            {itemIsTodaySpecial ? "Marked as Today's Special Item" : "Mark as Today's Special Item"}
          </Text>
        </Pressable>
        <TextInput
          placeholder="Image URL (auto-filled after upload)"
          value={itemImageUrl}
          onChangeText={setItemImageUrl}
          autoCapitalize="none"
          style={{ borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 12, padding: 10, backgroundColor: "#F8FAFC" }}
        />
        <Pressable
          onPress={() => pickAndUploadImage("ITEM")}
          disabled={uploadingItemImage}
          style={{ backgroundColor: "#4338CA", borderRadius: 12, paddingVertical: 11, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 }}
        >
          <Ionicons name="image-outline" size={16} color="white" />
          <Text style={{ color: "white", fontWeight: "800" }}>{uploadingItemImage ? "Uploading..." : "Upload Item Image"}</Text>
        </Pressable>
        {itemImageUrl ? (
          <Image source={{ uri: itemImageUrl }} style={{ width: "100%", height: 130, borderRadius: 12, backgroundColor: "#F1F5F9" }} resizeMode="cover" />
        ) : null}

        <View style={{ flexDirection: "row", gap: 8 }}>
          <TextInput
            placeholder="Price"
            keyboardType="numeric"
            value={itemPrice}
            onChangeText={setItemPrice}
            style={{ flex: 1, borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 12, padding: 10, backgroundColor: "#F8FAFC" }}
          />
          <TextInput
            placeholder="Stock Qty"
            keyboardType="numeric"
            value={itemStock}
            onChangeText={setItemStock}
            style={{ flex: 1, borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 12, padding: 10, backgroundColor: "#F8FAFC" }}
          />
        </View>

        <Text style={{ color: "#334155", fontWeight: "700" }}>Select Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
          {categories.map((category) => {
            const selected = categoryId === category.id;
            return (
              <Pressable
                key={category.id}
                onPress={() => setCategoryId(category.id)}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 999,
                  backgroundColor: selected ? "#0F172A" : "#E2E8F0"
                }}
              >
                <Text style={{ color: selected ? "white" : "#0F172A", fontWeight: "700" }}>{category.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Pressable
          onPress={onCreateItem}
          disabled={loading}
          style={{ backgroundColor: "#059669", borderRadius: 12, padding: 12, alignItems: "center" }}
        >
          <Text style={{ color: "white", fontWeight: "800" }}>{loading ? "Saving..." : "Add Item"}</Text>
        </Pressable>
      </View>

      <View style={{ ...card, padding: 12, gap: 10 }}>
        <Text style={{ fontSize: 17, fontWeight: "800", color: "#0F172A" }}>Categories ({categories.length})</Text>
        {categories.length === 0 ? <Text style={{ color: "#64748B" }}>No categories yet.</Text> : null}
        {categories.map((category) => (
          <View key={category.id} style={{ borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, padding: 10, gap: 6, backgroundColor: "#F8FAFC" }}>
            <Text style={{ fontWeight: "800", color: "#0F172A" }}>{category.name}</Text>
            {category.description ? <Text style={{ color: "#475569" }}>{category.description}</Text> : null}
            {category.imageUrl ? (
              <Image source={{ uri: category.imageUrl }} style={{ width: "100%", height: 110, borderRadius: 10, backgroundColor: "#F1F5F9" }} resizeMode="cover" />
            ) : null}
            <Pressable
              onPress={() => {
                setEditingCategoryId(category.id);
                setNewCategoryName(category.name);
                setNewCategoryDescription(category.description ?? "");
                setNewCategoryImageUrl(category.imageUrl ?? "");
              }}
              style={{ borderRadius: 10, backgroundColor: "#0F172A", paddingVertical: 10, alignItems: "center" }}
            >
              <Text style={{ color: "white", fontWeight: "700" }}>Edit Category</Text>
            </Pressable>
          </View>
        ))}
      </View>

      <View style={{ ...card, padding: 12, gap: 10 }}>
        <Text style={{ fontSize: 17, fontWeight: "800", color: "#0F172A" }}>Items ({items.length})</Text>
        {items.length === 0 ? <Text style={{ color: "#64748B" }}>No items yet.</Text> : null}
        {items.map((item) => (
          <View key={item.id} style={{ borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, padding: 10, gap: 8, backgroundColor: "#F8FAFC" }}>
            {item.image ? (
              <Image source={{ uri: item.image }} style={{ width: "100%", height: 120, borderRadius: 10, backgroundColor: "#F1F5F9" }} resizeMode="cover" />
            ) : null}
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <Text style={{ fontWeight: "800", color: "#0F172A", flex: 1 }}>{item.name}</Text>
              <Text style={{ fontWeight: "800", color: "#0F172A" }}>INR {item.price.toFixed(2)}</Text>
            </View>
            <Text style={{ color: "#64748B" }}>Category: {item.categoryId ? categoryNameById.get(item.categoryId) ?? "Unknown" : "Uncategorized"}</Text>
            {item.description ? <Text style={{ color: "#475569" }}>{item.description}</Text> : null}
            <Text style={{ color: "#334155" }}>Stock: {item.stockQty}</Text>
            <View
              style={{
                alignSelf: "flex-start",
                borderRadius: 999,
                backgroundColor: item.isTodaySpecial ? "#FEF3C7" : "#E2E8F0",
                paddingHorizontal: 10,
                paddingVertical: 5
              }}
            >
              <Text style={{ color: item.isTodaySpecial ? "#92400E" : "#475569", fontWeight: "800", fontSize: 12 }}>
                {item.isTodaySpecial ? "Today's Special" : "Regular"}
              </Text>
            </View>
            <Text style={{ color: item.isAvailable ? "#059669" : "#B91C1C", fontWeight: "700" }}>
              {item.isAvailable ? "Available" : "Hidden"}
            </Text>
            <Pressable
              onPress={() => onUpdateExistingItemImage(item.id, item.name)}
              disabled={loading || uploadingItemImage}
              style={{
                borderRadius: 10,
                backgroundColor: "#1D4ED8",
                paddingVertical: 10,
                alignItems: "center",
                opacity: loading || uploadingItemImage ? 0.7 : 1
              }}
            >
              <Text style={{ color: "white", fontWeight: "700" }}>
                {uploadingItemImage ? "Uploading..." : "Update Image"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => onToggleItemTodaySpecial(item)}
              disabled={loading}
              style={{
                borderRadius: 10,
                backgroundColor: item.isTodaySpecial ? "#D97706" : "#059669",
                paddingVertical: 10,
                alignItems: "center",
                opacity: loading ? 0.7 : 1
              }}
            >
              <Text style={{ color: "white", fontWeight: "700" }}>
                {item.isTodaySpecial ? "Remove Today Special" : "Mark Today Special"}
              </Text>
            </Pressable>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={() => onToggle(item.id)}
                style={{ flex: 1, backgroundColor: "#0F172A", borderRadius: 10, paddingVertical: 10, alignItems: "center" }}
              >
                <Text style={{ color: "white", fontWeight: "700" }}>Toggle</Text>
              </Pressable>
              <Pressable
                onPress={() => onDelete(item.id)}
                style={{ flex: 1, backgroundColor: "#B91C1C", borderRadius: 10, paddingVertical: 10, alignItems: "center" }}
              >
                <Text style={{ color: "white", fontWeight: "700" }}>Delete</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
