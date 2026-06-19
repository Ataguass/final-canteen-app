import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, Text, View, StyleSheet, KeyboardAvoidingView, Platform, SafeAreaView, Image } from "react-native";
import { useAuthStore } from '../../stores/useAuthStore';
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { moderateScale, fontScale, verticalScale, scale, isTablet, gridColumns } from '../../utils/responsive';
import { useTheme } from '../../hooks/useTheme';
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, LoginFormData } from "../../schemas/auth";
import { InputField } from "../../components/ui/InputField";

const BRAND_COLOR = "#080d2b";

export default function LoginScreen() {
  const theme = useTheme();
  const { colors, isDark } = theme;
  const styles = createStyles(theme);
  const router = useRouter();
  const { login } = useAuthStore();
  
  const [loading, setLoading] = useState(false);
  const [isAdminLogin, setIsAdminLogin] = useState(false);

  const { control, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      phone: "",
      rollNumber: "",
      password: ""
    }
  });

  const onLogin = async (data: LoginFormData) => {
    if (!isAdminLogin && !data.rollNumber) {
      Alert.alert("Missing Fields", "Please enter your roll number.");
      return;
    }
    
    try {
      setLoading(true);
      await login(data.phone.trim(), isAdminLogin ? undefined : data.rollNumber?.trim(), data.password, isAdminLogin);
      router.replace("/");
    } catch (error) {
      Alert.alert("Login failed", error instanceof Error ? error.message : "Please try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.content}
      >
        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.header}>
          <View style={styles.logoContainer}>
            <Image 
              source={require("../../assets/images/canteen_logo_final.png")} 
              style={{ width: "100%", height: "100%", borderRadius: moderateScale(24) }} 
              resizeMode="contain" 
            />
          </View>
          <Text style={styles.title}>{isAdminLogin ? "Staff Portal" : "Welcome Back"}</Text>
          <Text style={styles.subtitle}>
            {isAdminLogin ? "Sign in to manage operations." : "Sign in to manage your canteen life."}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(300).springify()} style={styles.form}>
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

          {!isAdminLogin && (
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
          )}

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

          <Pressable onPress={() => router.push("/(auth)/forgot-password")} style={styles.forgotPassword}>
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </Pressable>

          <Pressable
            onPress={handleSubmit(onLogin)}
            style={({ pressed }) => [
              styles.loginButton,
              pressed && { opacity: 0.8 },
              loading && { opacity: 0.6 }
            ]}
            disabled={loading}
          >
            <Text style={styles.loginButtonText}>
              {loading ? "Signing in..." : "Sign In"}
            </Text>
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(500).springify()} style={styles.footer}>
          {!isAdminLogin && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: verticalScale(16) }}>
              <Text style={styles.footerText}>New student? </Text>
              <Link href="/(auth)/register" asChild>
                <Pressable>
                  <Text style={styles.registerLink}>Register here</Text>
                </Pressable>
              </Link>
            </View>
          )}
          <Pressable onPress={() => setIsAdminLogin(!isAdminLogin)}>
            <Text style={[styles.footerText, { color: colors.textMuted, fontWeight: '600' }]}>
              {isAdminLogin ? "Switch to Student Login" : "Staff Login"}
            </Text>
          </Pressable>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = ({ colors, isDark }: { colors: any, isDark: boolean }) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: moderateScale(24),
  },
  header: {
    alignItems: 'center',
    marginBottom: verticalScale(40),
  },
  logoContainer: {
    width: moderateScale(80),
    height: moderateScale(80),
    backgroundColor: colors.card,
    borderRadius: moderateScale(24),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: verticalScale(24),
    elevation: 8,
    shadowColor: isDark ? colors.text : BRAND_COLOR,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: moderateScale(16),
    overflow: 'hidden'
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
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: verticalScale(8),
  },
  forgotPasswordText: {
    color: isDark ? colors.text : BRAND_COLOR,
    fontSize: fontScale(14),
    fontWeight: '600',
  },
  loginButton: {
    backgroundColor: isDark ? colors.primary : BRAND_COLOR,
    height: moderateScale(56),
    borderRadius: moderateScale(16),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: verticalScale(8),
    elevation: 8,
    shadowColor: isDark ? colors.primary : BRAND_COLOR,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: moderateScale(16),
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: fontScale(16),
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: verticalScale(32),
  },
  footerText: {
    color: colors.textMuted,
    fontSize: fontScale(15),
  },
  registerLink: {
    color: isDark ? colors.text : BRAND_COLOR,
    fontSize: fontScale(15),
    fontWeight: '700',
  }
});
