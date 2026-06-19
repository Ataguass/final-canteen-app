import { Ionicons } from "@expo/vector-icons";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Image, Pressable, ScrollView, Text, View, Switch, TextInput } from "react-native";
import { useAuthStore } from '../../../stores/useAuthStore';
import { Category } from "../../../types";
import { MenuItem } from "../../../types";
import { menuService } from "../../../services/menuService";
import { tenantService } from "../../../services/tenantService";
import { useTheme } from '../../../hooks/useTheme';
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { categorySchema, CategoryFormData, menuItemSchema, MenuItemFormData } from "../../../schemas/menu";
import { InputField } from "../../../components/ui/InputField";
import Animated, { FadeInUp } from "react-native-reanimated";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_WIDTH = 1280;
const MAX_IMAGE_HEIGHT = 1280;
const estimateBase64Bytes = (base64: string): number => Math.floor((base64.length * 3) / 4);


export default function Screen() {
  const theme = useTheme();
  const { colors, isDark } = theme;
  const scrollViewRef = useRef<ScrollView>(null);
  
  const card = {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.card,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  } as const;
  const { user, accessToken } = useAuthStore();
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);

  const { control: categoryControl, handleSubmit: handleCategorySubmit, reset: resetCategory, formState: { errors: categoryErrors }, setValue: setCategoryValue } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: "", description: "", imageUrl: "" }
  });

  const { control: itemControl, handleSubmit: handleItemSubmit, reset: resetItem, formState: { errors: itemErrors }, setValue: setItemValue, watch: watchItem } = useForm<MenuItemFormData>({
    resolver: zodResolver(menuItemSchema),
    defaultValues: { categoryId: "", name: "", description: "", price: 0, stockQty: 0, image: "", isTodaySpecial: false }
  });

  const itemCategoryId = watchItem("categoryId");
  const itemIsTodaySpecial = watchItem("isTodaySpecial");
  
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
    if (!itemCategoryId && categoryRes.data.length > 0) {
      setItemValue("categoryId", categoryRes.data[0].id);
    }
  }, [user?.tenantId, accessToken, itemCategoryId]);

  useEffect(() => {
    loadData().catch((error: unknown) => {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to load menu data");
    });
  }, [loadData]);

  const resetCategoryForm = () => {
    resetCategory({ name: "", description: "", imageUrl: "" });
    setEditingCategoryId(null);
  };

  const resetItemForm = () => {
    resetItem({ categoryId: itemCategoryId, name: "", description: "", price: 0, stockQty: 0, image: "", isTodaySpecial: false });
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
      setCategoryValue("imageUrl", imageUrl, { shouldValidate: true });
    } else {
      setItemValue("image", imageUrl, { shouldValidate: true });
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

  const onSaveCategory = async (data: CategoryFormData) => {
    if (!user?.tenantId || !accessToken) return;

    try {
      setLoading(true);
      if (editingCategoryId) {
        await menuService.updateCategory(accessToken, user.tenantId, editingCategoryId, {
          name: data.name.trim(),
          description: data.description?.trim() || null,
          imageUrl: data.imageUrl?.trim() || null
        });
      } else {
        await menuService.createCategory(accessToken, user.tenantId, {
          name: data.name.trim(),
          description: data.description?.trim() || undefined,
          imageUrl: data.imageUrl?.trim() || undefined
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

  const onCreateItem = async (data: any) => {
    if (!user?.tenantId || !accessToken) return;

    try {
      setLoading(true);
      await menuService.createItem(accessToken, user.tenantId, {
        categoryId: data.categoryId,
        name: data.name.trim(),
        description: data.description?.trim() || undefined,
        image: data.image?.trim() || undefined,
        price: data.price,
        stockQty: data.stockQty,
        isTodaySpecial: data.isTodaySpecial
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
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}>
        <Text style={{ color: colors.text }}>Admin access required.</Text>
      </View>
    );
  }

  return (
    <ScrollView ref={scrollViewRef} style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}>


      <Animated.View entering={FadeInUp.delay(100).springify()} style={{ ...card, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>Today's Specials Feature</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
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
            backgroundColor: todaySpecialsEnabled ? colors.primary : colors.surfaceAlt
          }}
        >
          <Text style={{ color: todaySpecialsEnabled ? "white" : colors.textSecondary, fontWeight: "800", fontSize: 13 }}>
            {todaySpecialsEnabled ? "Enabled" : "Disabled"}
          </Text>
        </Pressable>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(150).springify()} style={{ ...card, padding: 16, gap: 12 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>Category Details</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Create or edit a category</Text>
          </View>
          {editingCategoryId ? (
            <Pressable onPress={resetCategoryForm} style={{ borderRadius: 999, backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : "#FEE2E2", paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ color: isDark ? '#FCA5A5' : "#DC2626", fontWeight: "700", fontSize: 11 }}>Cancel Edit</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1, gap: 8 }}>
            <Controller
              control={categoryControl}
              name="name"
              render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
                <InputField
                  placeholder="Category Name"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={error?.message}
                />
              )}
            />
            <Controller
              control={categoryControl}
              name="description"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  placeholder="Description (optional)"
                  placeholderTextColor={colors.textSecondary}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  multiline
                  style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, height: 60, textAlignVertical: "top", backgroundColor: colors.surfaceAlt, fontSize: 14, color: colors.text }}
                />
              )}
            />
          </View>

          <View style={{ width: 120 }}>
            {categoryControl._defaultValues.imageUrl || watchItem("image") ? (
              <View style={{ borderRadius: 10, overflow: "hidden", borderWidth: 1, borderColor: colors.border, width: 120, height: 67 }}>
                <Controller 
                  control={categoryControl}
                  name="imageUrl"
                  render={({ field: { value } }) => (
                    value ? <Image source={{ uri: value }} style={{ width: "100%", height: "100%", backgroundColor: colors.surfaceAlt }} resizeMode="cover" /> : <View/>
                  )}
                />
                <Pressable onPress={() => pickAndUploadImage("CATEGORY")} disabled={uploadingCategoryImage} style={{ position: "absolute", bottom: 4, right: 4, backgroundColor: "rgba(15, 23, 42, 0.7)", borderRadius: 999, padding: 4 }}>
                  <Ionicons name="camera" size={14} color="white" />
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={() => pickAndUploadImage("CATEGORY")}
                disabled={uploadingCategoryImage}
                style={{ width: 120, height: 67, backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : "#EFF6FF", borderWidth: 1, borderColor: isDark ? '#3B82F6' : "#BFDBFE", borderStyle: "dashed", borderRadius: 10, alignItems: "center", justifyContent: "center", gap: 4 }}
              >
                <Ionicons name="cloud-upload" size={18} color={isDark ? '#60A5FA' : "#1D4ED8"} />
                <Text style={{ color: isDark ? '#60A5FA' : "#1D4ED8", fontWeight: "700", fontSize: 11, textAlign: "center" }}>{uploadingCategoryImage ? "..." : "Banner\n(16:9)"}</Text>
              </Pressable>
            )}
            
            <Pressable
              onPress={handleCategorySubmit(onSaveCategory)}
              disabled={loading}
              style={{ backgroundColor: isDark ? colors.text : "#0F172A", borderRadius: 10, paddingVertical: 10, alignItems: "center", marginTop: "auto" }}
            >
              <Text style={{ color: isDark ? colors.background : "white", fontWeight: "800", fontSize: 13 }}>
                {loading ? "..." : editingCategoryId ? "Update" : "Add"}
              </Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(200).springify()} style={{ ...card, padding: 16, gap: 12 }}>
        <View>
          <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>Item Details</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Add a new food or beverage item</Text>
        </View>

        <View style={{ gap: 8 }}>
          <Controller
            control={itemControl}
            name="name"
            render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
              <InputField
                placeholder="Item Name (e.g. Classic Cheeseburger)"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={error?.message}
              />
            )}
          />
          <Controller
            control={itemControl}
            name="description"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                placeholder="Description (optional)"
                placeholderTextColor={colors.textSecondary}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                multiline
                style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, height: 60, textAlignVertical: "top", backgroundColor: colors.surfaceAlt, fontSize: 14, color: colors.text }}
              />
            )}
          />
        </View>

        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1, gap: 8 }}>
            <Controller
              control={itemControl}
              name="price"
              render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
                <InputField
                  placeholder="Price (INR)"
                  keyboardType="numeric"
                  value={value?.toString() || ""}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={error?.message}
                />
              )}
            />
            <Controller
              control={itemControl}
              name="stockQty"
              render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
                <InputField
                  placeholder="Stock Qty"
                  keyboardType="numeric"
                  value={value?.toString() || ""}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={error?.message}
                />
              )}
            />
          </View>

          <View style={{ width: 90 }}>
            {itemControl._defaultValues.image || watchItem("image") ? (
              <View style={{ position: "relative", borderRadius: 10, overflow: "hidden", borderWidth: 1, borderColor: colors.border, width: 90, height: 90 }}>
                <Controller
                  control={itemControl}
                  name="image"
                  render={({ field: { value } }) => (
                    value ? <Image source={{ uri: value }} style={{ width: "100%", height: "100%", backgroundColor: colors.surfaceAlt }} resizeMode="cover" /> : <View/>
                  )}
                />
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
                style={{ width: 90, height: 90, backgroundColor: isDark ? 'rgba(34, 197, 94, 0.1)' : "#F0FDF4", borderWidth: 1, borderColor: isDark ? '#22C55E' : "#BBF7D0", borderStyle: "dashed", borderRadius: 10, alignItems: "center", justifyContent: "center", gap: 4 }}
              >
                <Ionicons name="image-outline" size={20} color={isDark ? '#4ADE80' : "#16A34A"} />
                <Text style={{ color: isDark ? '#4ADE80' : "#16A34A", fontWeight: "700", fontSize: 10, textAlign: "center" }}>{uploadingItemImage ? "..." : "Photo\n(1:1)"}</Text>
              </Pressable>
            )}
          </View>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ color: colors.textSecondary, fontWeight: "700", fontSize: 13 }}>Mark as Today's Special</Text>
          <Pressable
            onPress={() => setItemValue("isTodaySpecial", !itemIsTodaySpecial, { shouldValidate: true })}
            style={{
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: 999,
              backgroundColor: itemIsTodaySpecial ? (isDark ? 'rgba(16, 185, 129, 0.15)' : "#ECFDF5") : colors.surfaceAlt,
              borderWidth: 1,
              borderColor: itemIsTodaySpecial ? (isDark ? '#34D399' : "#059669") : colors.border,
              flexDirection: "row",
              alignItems: "center",
              gap: 6
            }}
          >
            <Ionicons name={itemIsTodaySpecial ? "star" : "star-outline"} size={16} color={itemIsTodaySpecial ? (isDark ? '#34D399' : "#059669") : colors.textSecondary} />
            <Text style={{ color: itemIsTodaySpecial ? (isDark ? '#6EE7B7' : "#065F46") : colors.textSecondary, fontWeight: "700", fontSize: 13 }}>
              {itemIsTodaySpecial ? "Yes" : "No"}
            </Text>
          </Pressable>
        </View>

        <View style={{ gap: 8 }}>
          <Text style={{ color: colors.textSecondary, fontWeight: "700", fontSize: 13, marginLeft: 4 }}>Select Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
            {categories.map((category) => {
              const selected = itemCategoryId === category.id;
              return (
                <Pressable
                  key={category.id}
                  onPress={() => setItemValue("categoryId", category.id, { shouldValidate: true })}
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 16,
                    borderRadius: 999,
                    backgroundColor: selected ? colors.primary : colors.surfaceAlt
                  }}
                >
                  <Text style={{ color: selected ? "white" : colors.textSecondary, fontWeight: "700" }}>{category.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <Pressable
          onPress={handleItemSubmit(onCreateItem)}
          disabled={loading}
          style={{ backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: 4 }}
        >
          <Text style={{ color: "white", fontWeight: "800", fontSize: 14 }}>{loading ? "Saving..." : "Add New Item"}</Text>
        </Pressable>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(250).springify()} style={{ ...card, padding: 20, gap: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>Categories ({categories.length})</Text>
        {categories.length === 0 ? <Text style={{ color: colors.textSecondary }}>No categories yet.</Text> : null}
        {categories.map((category) => (
          <View key={category.id} style={{ borderRadius: 12, overflow: "hidden", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2, flexDirection: "row", alignItems: "center" }}>
            {category.imageUrl ? (
              <Image source={{ uri: category.imageUrl }} style={{ width: 120, height: 67, backgroundColor: colors.surfaceAlt }} resizeMode="cover" />
            ) : (
              <View style={{ width: 120, height: 67, backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="image-outline" size={24} color={colors.textSecondary} />
              </View>
            )}
            <View style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 8, gap: 4 }}>
              <Text style={{ fontWeight: "800", color: colors.text, fontSize: 15 }} numberOfLines={1}>{category.name}</Text>
              {category.description ? <Text style={{ color: colors.textSecondary, fontSize: 12 }} numberOfLines={1}>{category.description}</Text> : null}
            </View>
            <Pressable
              onPress={() => {
                setEditingCategoryId(category.id);
                setCategoryValue("name", category.name);
                setCategoryValue("description", category.description ?? "");
                setCategoryValue("imageUrl", category.imageUrl ?? "");
                scrollViewRef.current?.scrollTo({ y: 0, animated: true });
              }}
              style={{ padding: 12, borderLeftWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt, alignSelf: "stretch", justifyContent: "center" }}
            >
              <Ionicons name="create-outline" size={20} color={colors.primary} />
            </Pressable>
          </View>
        ))}
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(300).springify()} style={{ ...card, padding: 20, gap: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>Menu Items ({items.length})</Text>
        {items.length === 0 ? <Text style={{ color: colors.textSecondary }}>No items yet.</Text> : null}
        {items.map((item) => (
          <View key={item.id} style={{ borderRadius: 16, overflow: "hidden", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 }}>
            <View style={{ flexDirection: "row", padding: 12, gap: 12 }}>
              {item.image ? (
                <Image source={{ uri: item.image }} style={{ width: 100, height: 100, borderRadius: 12, backgroundColor: colors.surfaceAlt }} resizeMode="cover" />
              ) : (
                <View style={{ width: 100, height: 100, borderRadius: 12, backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="fast-food-outline" size={32} color={colors.textSecondary} />
                </View>
              )}
              
              <View style={{ flex: 1, justifyContent: "center", gap: 4 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <Text style={{ fontWeight: "800", color: colors.text, fontSize: 16, flex: 1 }} numberOfLines={2}>{item.name}</Text>
                  <Text style={{ fontWeight: "800", color: colors.text, fontSize: 16 }}>₹ {item.price.toFixed(2)}</Text>
                </View>
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{item.categoryId ? categoryNameById.get(item.categoryId) ?? "Unknown" : "Uncategorized"}</Text>
                {item.description ? <Text style={{ color: colors.textSecondary, fontSize: 13 }} numberOfLines={1}>{item.description}</Text> : null}
                
                <View style={{ flexDirection: "row", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                  <View style={{ backgroundColor: colors.surfaceAlt, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                    <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: "700" }}>Stock: {item.stockQty}</Text>
                  </View>
                  <View style={{ backgroundColor: item.isAvailable ? (isDark ? 'rgba(34, 197, 94, 0.15)' : "#DCFCE7") : (isDark ? 'rgba(239, 68, 68, 0.15)' : "#FEE2E2"), paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                    <Text style={{ color: item.isAvailable ? (isDark ? '#4ADE80' : "#16A34A") : (isDark ? '#FCA5A5' : "#DC2626"), fontSize: 11, fontWeight: "700" }}>{item.isAvailable ? "Available" : "Hidden"}</Text>
                  </View>
                  {item.isTodaySpecial && (
                    <View style={{ backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : "#FEF3C7", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                      <Text style={{ color: isDark ? '#FCD34D' : "#D97706", fontSize: 11, fontWeight: "700" }}>Today's Special</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            <View style={{ flexDirection: "row", borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt }}>
              <Pressable onPress={() => onUpdateExistingItemImage(item.id, item.name)} style={{ flex: 1, paddingVertical: 12, alignItems: "center", borderRightWidth: 1, borderColor: colors.border, opacity: loading || uploadingItemImage ? 0.5 : 1 }}>
                <Ionicons name="camera-outline" size={20} color={colors.primary} />
              </Pressable>
              <Pressable onPress={() => onToggleItemTodaySpecial(item)} style={{ flex: 1, paddingVertical: 12, alignItems: "center", borderRightWidth: 1, borderColor: colors.border, opacity: loading ? 0.5 : 1 }}>
                <Ionicons name={item.isTodaySpecial ? "star" : "star-outline"} size={20} color={item.isTodaySpecial ? (isDark ? '#FCD34D' : "#D97706") : colors.textSecondary} />
              </Pressable>
              <Pressable onPress={() => onToggle(item.id)} style={{ flex: 1, paddingVertical: 12, alignItems: "center", borderRightWidth: 1, borderColor: colors.border }}>
                <Ionicons name={item.isAvailable ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textSecondary} />
              </Pressable>
              <Pressable onPress={() => onDelete(item.id)} style={{ flex: 1, paddingVertical: 12, alignItems: "center" }}>
                <Ionicons name="trash-outline" size={20} color={isDark ? '#F87171' : "#DC2626"} />
              </Pressable>
            </View>
          </View>
        ))}
      </Animated.View>
    </ScrollView>
  );
}
