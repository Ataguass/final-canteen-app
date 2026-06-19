import { Ionicons } from "@expo/vector-icons";
import { useState, useEffect } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useAuthStore } from '../../../stores/useAuthStore';
import { tenantService } from "../../../services/tenantService";
import { authService } from "../../../services/authService";
import { useTheme } from '../../../hooks/useTheme';
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { tenantCreateSchema, TenantCreateFormData } from "../../../schemas/admin";
import { InputField } from "../../../components/ui/InputField";
import Animated, { FadeInUp } from "react-native-reanimated";

export default function SchoolsScreen() {
  const theme = useTheme();
  const { colors, isDark } = theme;
  const { user, accessToken } = useAuthStore();
  
  const cardShadow = {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    backgroundColor: colors.card,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3
  } as const;

  const [creating, setCreating] = useState(false);
  const [schools, setSchools] = useState<any[]>([]);
  const [loadingSchools, setLoadingSchools] = useState(true);

  const fetchSchools = async () => {
    try {
      setLoadingSchools(true);
      const res = await authService.listTenants();
      if (res.success) {
        setSchools(res.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSchools(false);
    }
  };

  useEffect(() => {
    fetchSchools();
  }, []);

  const { control, handleSubmit, reset } = useForm<TenantCreateFormData>({
    resolver: zodResolver(tenantCreateSchema),
    defaultValues: {
      name: "",
      slug: "",
      schoolCode: "",
      adminName: "",
      adminPhone: "",
      adminPassword: ""
    }
  });

  const onCreate = async (data: TenantCreateFormData) => {
    if (!accessToken) return;

    try {
      setCreating(true);
      await tenantService.createTenantByAdmin(accessToken, {
        name: data.name.trim(),
        slug: data.slug.trim().toLowerCase(),
        schoolCode: data.schoolCode?.trim().toUpperCase() || undefined,
        adminName: data.adminName.trim(),
        adminPhone: data.adminPhone.trim(),
        adminPassword: data.adminPassword.trim()
      });
      reset();
      Alert.alert("Success", "School and Initial Admin created successfully!");
      fetchSchools();
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Could not create school");
    } finally {
      setCreating(false);
    }
  };

  if (user?.role !== "SUPER_ADMIN") {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}>
        <Text style={{ color: colors.text }}>Super Admin access required.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }}>
      
      <Animated.View entering={FadeInUp.delay(100).springify()} style={{ ...cardShadow, padding: 20, gap: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <View style={{ backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : "#EFF6FF", padding: 10, borderRadius: 12 }}>
            <Ionicons name="business" size={24} color={isDark ? '#60A5FA' : "#2563EB"} />
          </View>
          <View>
            <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>Add New School</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>Create a new tenant workspace</Text>
          </View>
        </View>

        <View style={{ gap: 12 }}>
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>1. School Details</Text>
          
          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
              <InputField
                placeholder="School Name (e.g. Engineering College)"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={error?.message}
              />
            )}
          />

          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Controller
                control={control}
                name="slug"
                render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
                  <InputField
                    placeholder="URL Slug (e.g. eng-college)"
                    value={value}
                    onChangeText={(val) => onChange(val.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    onBlur={onBlur}
                    error={error?.message}
                  />
                )}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Controller
                control={control}
                name="schoolCode"
                render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
                  <InputField
                    placeholder="Code (Optional)"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={error?.message}
                  />
                )}
              />
            </View>
          </View>

          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15, marginTop: 12 }}>2. Initial Admin Account</Text>
          
          <Controller
            control={control}
            name="adminName"
            render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
              <InputField
                placeholder="Admin Full Name"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={error?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="adminPhone"
            render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
              <InputField
                placeholder="Admin Phone Number"
                keyboardType="phone-pad"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={error?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="adminPassword"
            render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
              <InputField
                placeholder="Initial Password"
                secureTextEntry
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={error?.message}
              />
            )}
          />

          <Pressable
            onPress={handleSubmit(onCreate)}
            disabled={creating}
            style={{ backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 8 }}
          >
            <Text style={{ color: "white", fontWeight: "800", fontSize: 15 }}>
              {creating ? "Creating School..." : "Create School & Admin"}
            </Text>
          </Pressable>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(200).springify()} style={{ ...cardShadow, padding: 20, gap: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <View style={{ backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : "#D1FAE5", padding: 10, borderRadius: 12 }}>
            <Ionicons name="list" size={24} color={isDark ? '#34D399' : "#059669"} />
          </View>
          <View>
            <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>Registered Schools</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>All active tenant workspaces</Text>
          </View>
        </View>

        {loadingSchools ? (
          <Text style={{ color: colors.textSecondary, textAlign: 'center', marginVertical: 20 }}>Loading schools...</Text>
        ) : schools.length === 0 ? (
          <Text style={{ color: colors.textSecondary, textAlign: 'center', marginVertical: 20 }}>No schools found.</Text>
        ) : (
          <View style={{ gap: 12 }}>
            {schools.map((school, index) => (
              <View key={school.id || index} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: index === schools.length - 1 ? 0 : 1, borderBottomColor: colors.border }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{school.name}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>Slug: {school.slug} {school.schoolCode ? `• Code: ${school.schoolCode}` : ''}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </Animated.View>
    </ScrollView>
  );
}
