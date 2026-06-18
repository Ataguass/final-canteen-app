import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, Text, TextInput, View, StyleSheet, KeyboardAvoidingView, Platform, SafeAreaView, Image } from "react-native";
import { useAuthStore } from '../../stores/useAuthStore';
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { moderateScale, fontScale, verticalScale, scale, isTablet, gridColumns } from '../../utils/responsive';
import { useTheme } from '../../hooks/useTheme';

const BRAND_COLOR = "#080d2b";

export default function LoginScreen() {
  const theme = useTheme();
  const { colors, isDark } = theme;
  const styles = createStyles(theme);
  const router = useRouter();
  const { login } = useAuthStore();
  const [phone, setPhone] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isAdminLogin, setIsAdminLogin] = useState(false);

  const onLogin = async () => {
    if (!phone || (!isAdminLogin && !rollNumber) || !password) {
      Alert.alert("Missing Fields", "Please fill in all fields.");
      return;
    }
    
    try {
      setLoading(true);
      await login(phone.trim(), isAdminLogin ? undefined : rollNumber.trim(), password, isAdminLogin);
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
          <View style={styles.inputContainer}>
            <Ionicons name="call-outline" size={20} color="#8e8e93" style={styles.inputIcon} />
            <TextInput
              placeholder="Phone Number"
              placeholderTextColor="#8e8e93"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              style={styles.input}
            />
          </View>

          {!isAdminLogin && (
            <View style={styles.inputContainer}>
              <Ionicons name="id-card-outline" size={20} color="#8e8e93" style={styles.inputIcon} />
              <TextInput
                placeholder="Roll Number"
                placeholderTextColor="#8e8e93"
                value={rollNumber}
                onChangeText={setRollNumber}
                autoCapitalize="characters"
                style={styles.input}
              />
            </View>
          )}

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#8e8e93" style={styles.inputIcon} />
            <TextInput
              placeholder="Password"
              placeholderTextColor="#8e8e93"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              style={styles.input}
            />
            <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
              <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#8e8e93" />
            </Pressable>
          </View>

          <Pressable onPress={() => router.push("/(auth)/forgot-password")} style={styles.forgotPassword}>
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </Pressable>

          <Pressable
            onPress={onLogin}
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
  input: {
    flex: 1,
    fontSize: fontScale(16),
    color: colors.text,
    height: '100%',
  },
  eyeIcon: {
    padding: moderateScale(8),
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
