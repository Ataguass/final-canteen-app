import auth from "@react-native-firebase/auth";
import { Link, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, Text, View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Modal, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from '../../stores/useAuthStore';
import { authService } from "../../services/authService";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { moderateScale, fontScale, verticalScale, scale, isTablet, gridColumns } from '../../utils/responsive';
import { useTheme } from '../../hooks/useTheme';
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, RegisterFormData } from "../../schemas/auth";
import { InputField } from "../../components/ui/InputField";

const BRAND_COLOR = "#080d2b";

type Tenant = { id: string; name: string; slug: string; logo?: string | null };

export default function RegisterScreen() {
  const theme = useTheme();
  const { colors, isDark } = theme;
  const styles = createStyles(theme);
  const router = useRouter();
  const { setPendingRegistration, setConfirmationResult } = useAuthStore();
  
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [showTenantModal, setShowTenantModal] = useState(false);

  const { control, handleSubmit, formState: { errors }, setValue, watch } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      tenantId: "",
      name: "",
      email: "",
      phone: "",
      rollNumber: "",
      password: ""
    }
  });

  const [loading, setLoading] = useState(false);
  const selectedTenantId = watch("tenantId");

  useEffect(() => {
    const fetchTenants = async () => {
      try {
        const response = await authService.listTenants();
        if (response.data) setTenants(response.data);
      } catch (error) {
        console.error("Failed to fetch schools:", error);
      }
    };
    fetchTenants();
  }, []);

  const onRegister = async (data: RegisterFormData) => {
    try {
      setLoading(true);
      // Trigger Firebase Phone Authentication
      // Ensure phone number starts with country code (e.g., +91 for India)
      let formattedPhone = data.phone.replace(/\s+/g, "");
      if (!formattedPhone.startsWith("+")) {
        // Default to +91 if no country code provided, but you can adjust this logic based on target region
        formattedPhone = `+91${formattedPhone}`; 
      }

      const confirmation = await auth().signInWithPhoneNumber(formattedPhone);
      setConfirmationResult(confirmation);
      
      setPendingRegistration({
        tenantId: data.tenantId,
        name: data.name.trim(),
        email: data.email.trim(),
        phone: formattedPhone,
        password: data.password,
        rollNumber: data.rollNumber.trim()
      });

      router.push("/(auth)/otp");
    } catch (error) {
      Alert.alert("Registration failed", error instanceof Error ? error.message : "Please try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={isDark ? colors.text : "#1c1c1e"} />
            </Pressable>
            <View style={styles.logoContainer}>
              <Ionicons name="person-add" size={32} color="#ffffff" />
            </View>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join your campus canteen network.</Text>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(300).springify()} style={styles.form}>
            
            {/* School Selector */}
            <View>
              <Pressable style={styles.inputContainer} onPress={() => setShowTenantModal(true)}>
                <Ionicons name="business-outline" size={20} color="#8e8e93" style={styles.inputIcon} />
                <Text style={[styles.inputText, !selectedTenant && { color: colors.textMuted }]}>
                  {selectedTenant ? selectedTenant.name : "Select your School"}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#8e8e93" />
              </Pressable>
              {errors.tenantId && <Text style={[styles.errorText, { color: colors.danger }]}>{errors.tenantId.message}</Text>}
            </View>

            {/* Name Input */}
            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
                <InputField
                  leftIcon="person-outline"
                  placeholder="Full Name"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={error?.message}
                />
              )}
            />

            {/* Email Input */}
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
                <InputField
                  leftIcon="mail-outline"
                  placeholder="Email Address"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={error?.message}
                />
              )}
            />

            {/* Phone Input */}
            <Controller
              control={control}
              name="phone"
              render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
                <InputField
                  leftIcon="call-outline"
                  placeholder="Phone Number"
                  keyboardType="phone-pad"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={error?.message}
                />
              )}
            />

            {/* Roll Number Input */}
            <Controller
              control={control}
              name="rollNumber"
              render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
                <InputField
                  leftIcon="id-card-outline"
                  placeholder="Roll Number"
                  autoCapitalize="characters"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={error?.message}
                />
              )}
            />

            {/* Password Input */}
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
                <InputField
                  leftIcon="lock-closed-outline"
                  placeholder="Password"
                  isPassword={true}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={error?.message}
                />
              )}
            />

            <Pressable
              onPress={handleSubmit(onRegister)}
              style={({ pressed }) => [
                styles.registerButton,
                pressed && { opacity: 0.8 },
                loading && { opacity: 0.6 }
              ]}
              disabled={loading}
            >
              <Text style={styles.registerButtonText}>
                {loading ? "Please wait..." : "Continue"}
              </Text>
            </Pressable>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(500).springify()} style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href="/(auth)/login" asChild>
              <Pressable>
                <Text style={styles.loginLink}>Sign in</Text>
              </Pressable>
            </Link>
          </Animated.View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* School Selection Modal */}
      <Modal visible={showTenantModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select School</Text>
              <Pressable onPress={() => setShowTenantModal(false)} style={styles.closeModalButton}>
                <Ionicons name="close" size={24} color={isDark ? colors.text : "#1c1c1e"} />
              </Pressable>
            </View>
            <FlatList
              data={tenants}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.tenantOption, selectedTenant?.id === item.id && styles.tenantOptionSelected]}
                  onPress={() => {
                    setSelectedTenant(item);
                    setValue("tenantId", item.id, { shouldValidate: true });
                    setShowTenantModal(false);
                  }}
                >
                  <Ionicons 
                    name="school" 
                    size={24} 
                    color={selectedTenant?.id === item.id ? (isDark ? colors.primary : BRAND_COLOR) : "#8e8e93"} 
                    style={{ marginRight: moderateScale(16) }}
                  />
                  <Text style={[styles.tenantOptionText, selectedTenant?.id === item.id && styles.tenantOptionTextSelected]}>
                    {item.name}
                  </Text>
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No schools found.</Text>
              }
            />
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const createStyles = ({ colors, isDark }: { colors: any, isDark: boolean }) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: moderateScale(24),
    paddingTop: verticalScale(40),
    paddingBottom: verticalScale(40),
  },
  header: {
    alignItems: 'center',
    marginBottom: verticalScale(40),
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 0,
    padding: moderateScale(8),
  },
  logoContainer: {
    width: moderateScale(64),
    height: moderateScale(64),
    backgroundColor: BRAND_COLOR,
    borderRadius: moderateScale(20),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: verticalScale(20),
    elevation: 8,
    shadowColor: isDark ? colors.text : BRAND_COLOR,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: moderateScale(16),
  },
  title: {
    fontSize: fontScale(28),
    fontWeight: '800',
    color: colors.text,
    marginBottom: verticalScale(8),
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: fontScale(16),
    color: colors.textMuted,
    textAlign: 'center',
  },
  form: {
    gap: moderateScale(16),
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: moderateScale(16),
    paddingHorizontal: moderateScale(16),
    height: moderateScale(56),
  },
  inputIcon: {
    marginRight: moderateScale(12),
  },
  inputText: {
    flex: 1,
    fontSize: fontScale(16),
    color: colors.text,
  },
  errorText: {
    fontSize: 12,
    marginTop: 6,
    fontWeight: '500',
  },
  registerButton: {
    backgroundColor: isDark ? colors.primary : BRAND_COLOR,
    height: moderateScale(56),
    borderRadius: moderateScale(16),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: verticalScale(16),
    elevation: 8,
    shadowColor: isDark ? colors.primary : BRAND_COLOR,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: moderateScale(16),
  },
  registerButtonText: {
    color: '#ffffff',
    fontSize: fontScale(16),
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: verticalScale(32),
  },
  footerText: {
    color: colors.textMuted,
    fontSize: fontScale(15),
  },
  loginLink: {
    color: isDark ? colors.text : BRAND_COLOR,
    fontSize: fontScale(15),
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: moderateScale(24),
    borderTopRightRadius: moderateScale(24),
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: moderateScale(24),
    paddingVertical: moderateScale(20),
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceAlt,
  },
  modalTitle: {
    fontSize: fontScale(20),
    fontWeight: '700',
    color: colors.text,
  },
  closeModalButton: {
    padding: moderateScale(4),
  },
  tenantOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: moderateScale(16),
    paddingHorizontal: moderateScale(8),
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceAlt,
  },
  tenantOptionSelected: {
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(8, 13, 43, 0.04)',
    borderRadius: moderateScale(12),
  },
  tenantOptionText: {
    fontSize: fontScale(16),
    color: colors.text,
    fontWeight: '500',
  },
  tenantOptionTextSelected: {
    color: isDark ? colors.primary : BRAND_COLOR,
    fontWeight: '700',
  },
  emptyText: {
    textAlign: 'center',
    color: colors.textMuted,
    padding: moderateScale(24),
  }
});
