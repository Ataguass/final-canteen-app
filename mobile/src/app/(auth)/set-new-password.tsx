import { useRouter, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, Text, View, StyleSheet, KeyboardAvoidingView, Platform, SafeAreaView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { authService } from "../../services/authService";
import { moderateScale, fontScale, verticalScale } from '../../utils/responsive';
import { useTheme } from '../../hooks/useTheme';
import { InputField } from "../../components/ui/InputField";

const BRAND_COLOR = "#080d2b";

export default function SetNewPasswordScreen() {
  const theme = useTheme();
  const { colors, isDark } = theme;
  const styles = createStyles(theme);
  const router = useRouter();
  
  const { method, identifier, token } = useLocalSearchParams<{ method: "email" | "phone"; identifier: string; token: string }>();
  
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert("Missing Field", "Please fill out both password fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Passwords Mismatch", "The passwords you entered do not match.");
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert("Weak Password", "Password must be at least 6 characters long.");
      return;
    }

    try {
      setLoading(true);
      
      await authService.resetPassword({
        identifier,
        method,
        token,
        newPassword
      });

      Alert.alert("Success", "Your password has been successfully reset. You can now log in.", [
        { text: "OK", onPress: () => router.replace("/(auth)/login") }
      ]);
    } catch (error) {
      Alert.alert("Reset failed", error instanceof Error ? error.message : "Please try again.");
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
            <Ionicons name="key" size={32} color="#ffffff" />
          </View>
          <Text style={styles.title}>Set New Password</Text>
          <Text style={styles.subtitle}>Create a new password for your account.</Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(300).springify()} style={styles.form}>
          <InputField
            leftIcon="lock-closed-outline"
            placeholder="New Password"
            isPassword={true}
            value={newPassword}
            onChangeText={setNewPassword}
          />

          <InputField
            leftIcon="lock-closed-outline"
            placeholder="Confirm Password"
            isPassword={true}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />

          <Pressable
            onPress={onSubmit}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && { opacity: 0.8 },
              loading && { opacity: 0.6 }
            ]}
            disabled={loading}
          >
            <Text style={styles.primaryButtonText}>
              {loading ? "Updating..." : "Update Password"}
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
