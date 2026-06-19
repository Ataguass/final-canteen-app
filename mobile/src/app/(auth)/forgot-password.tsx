import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, Text, TextInput, View, StyleSheet, KeyboardAvoidingView, Platform, SafeAreaView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import auth from "@react-native-firebase/auth";
import { useAuthStore } from "../../stores/useAuthStore";
import { authService } from "../../services/authService";
import { moderateScale, fontScale, verticalScale } from '../../utils/responsive';
import { useTheme } from '../../hooks/useTheme';

const BRAND_COLOR = "#080d2b";

export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const { colors, isDark } = theme;
  const styles = createStyles(theme);
  const router = useRouter();
  const { setConfirmationResult } = useAuthStore();
  
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);

  const onResetPassword = async () => {
    if (!identifier) {
      Alert.alert("Missing Field", "Please enter your email or phone number.");
      return;
    }

    const trimmed = identifier.trim();
    const isEmail = trimmed.includes("@");

    try {
      setLoading(true);
      
      if (isEmail) {
        // Email reset flow
        await authService.forgotPassword({ identifier: trimmed, method: "email" });
        router.push({
          pathname: "/(auth)/forgot-password-otp",
          params: { method: "email", identifier: trimmed }
        });
      } else {
        // Phone reset flow
        let formattedPhone = trimmed.replace(/\s+/g, "");
        if (!formattedPhone.startsWith("+")) {
          formattedPhone = `+91${formattedPhone}`; 
        }

        const confirmation = await auth().signInWithPhoneNumber(formattedPhone);
        setConfirmationResult(confirmation);
        
        router.push({
          pathname: "/(auth)/forgot-password-otp",
          params: { method: "phone", identifier: formattedPhone }
        });
      }
    } catch (error) {
      Alert.alert("Request failed", error instanceof Error ? error.message : "Please try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.content}>
        
        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={isDark ? colors.text : "#1c1c1e"} />
          </Pressable>
          <View style={styles.iconContainer}>
            <Ionicons name="lock-open" size={32} color="#ffffff" />
          </View>
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>Enter your phone number or email to receive a reset code.</Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(300).springify()} style={styles.form}>
          <View style={styles.inputContainer}>
            <Ionicons name="person-outline" size={20} color="#8e8e93" style={styles.inputIcon} />
            <TextInput
              placeholder="Phone or Email"
              placeholderTextColor="#8e8e93"
              value={identifier}
              onChangeText={setIdentifier}
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
            />
          </View>

          <Pressable
            onPress={onResetPassword}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && { opacity: 0.8 },
              loading && { opacity: 0.6 }
            ]}
            disabled={loading}
          >
            <Text style={styles.primaryButtonText}>
              {loading ? "Sending..." : "Send Reset Code"}
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
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 0,
    padding: moderateScale(8),
  },
  iconContainer: {
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
    lineHeight: 24,
    paddingHorizontal: moderateScale(20),
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
  primaryButton: {
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
  primaryButtonText: {
    color: '#ffffff',
    fontSize: fontScale(16),
    fontWeight: '700',
  }
});
