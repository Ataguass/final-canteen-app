import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, Text, TextInput, View, StyleSheet, KeyboardAvoidingView, Platform, SafeAreaView, Image } from "react-native";
import { useAuth } from "../../hooks/useAuth";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";

const BRAND_COLOR = "#080d2b";

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
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
              style={{ width: "100%", height: "100%", borderRadius: 24 }} 
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
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <Text style={styles.footerText}>New student? </Text>
              <Link href="/(auth)/register" asChild>
                <Pressable>
                  <Text style={styles.registerLink}>Register here</Text>
                </Pressable>
              </Link>
            </View>
          )}
          <Pressable onPress={() => setIsAdminLogin(!isAdminLogin)}>
            <Text style={[styles.footerText, { color: '#8e8e93', fontWeight: '600' }]}>
              {isAdminLogin ? "Switch to Student Login" : "Staff Login"}
            </Text>
          </Pressable>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafbfc',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 80,
    height: 80,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    elevation: 8,
    shadowColor: BRAND_COLOR,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    overflow: 'hidden'
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1c1c1e',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#8e8e93',
    textAlign: 'center',
  },
  form: {
    gap: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e5ea',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1c1c1e',
    height: '100%',
  },
  eyeIcon: {
    padding: 8,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 8,
  },
  forgotPasswordText: {
    color: BRAND_COLOR,
    fontSize: 14,
    fontWeight: '600',
  },
  loginButton: {
    backgroundColor: BRAND_COLOR,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    elevation: 8,
    shadowColor: BRAND_COLOR,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
  },
  footerText: {
    color: '#8e8e93',
    fontSize: 15,
  },
  registerLink: {
    color: BRAND_COLOR,
    fontSize: 15,
    fontWeight: '700',
  }
});
