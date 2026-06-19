import { useRouter, useLocalSearchParams } from "expo-router";
import { useState, useRef, useEffect } from "react";
import { Alert, Pressable, Text, TextInput, View, StyleSheet, KeyboardAvoidingView, Platform, SafeAreaView } from "react-native";
import { useAuthStore } from '../../stores/useAuthStore';
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { moderateScale, fontScale, verticalScale } from '../../utils/responsive';
import { useTheme } from '../../hooks/useTheme';

const BRAND_COLOR = "#080d2b";
const OTP_LENGTH = 6;

export default function ForgotPasswordOtpScreen() {
  const theme = useTheme();
  const { colors, isDark } = theme;
  const styles = createStyles(theme);
  const router = useRouter();
  const { method, identifier } = useLocalSearchParams<{ method: string; identifier: string }>();
  const { confirmationResult } = useAuthStore();
  
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const timeout = setTimeout(() => inputRef.current?.focus(), 500);
    return () => clearTimeout(timeout);
  }, []);

  const onVerify = async () => {
    if (code.length !== OTP_LENGTH) {
      Alert.alert("Invalid Code", "Please enter the complete 6-digit OTP.");
      return;
    }

    try {
      setLoading(true);

      if (method === "phone") {
        if (!confirmationResult) {
          Alert.alert("Error", "Authentication session missing. Please try requesting a code again.");
          return;
        }
        
        // Confirm the OTP with Firebase
        const userCredential = await confirmationResult.confirm(code.trim());
        
        if (userCredential && userCredential.user) {
          // Get the Firebase ID token to prove identity
          const idToken = await userCredential.user.getIdToken();
          
          router.replace({
            pathname: "/(auth)/set-new-password",
            params: { method, identifier, token: idToken }
          });
        } else {
          throw new Error("Failed to authenticate with Firebase.");
        }
      } else {
        // For email, we verify the OTP later alongside the new password
        router.replace({
          pathname: "/(auth)/set-new-password",
          params: { method, identifier, token: code.trim() }
        });
      }

    } catch (error) {
      Alert.alert("OTP verification failed", error instanceof Error ? error.message : "Please try again");
    } finally {
      setLoading(false);
    }
  };

  const codeArray = new Array(OTP_LENGTH).fill(0);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.content}>
        
        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={isDark ? colors.text : "#1c1c1e"} />
          </Pressable>
          <View style={styles.iconContainer}>
            <Ionicons name="chatbubble-ellipses" size={32} color="#ffffff" />
          </View>
          <Text style={styles.title}>Verify Code</Text>
          <Text style={styles.subtitle}>
            Enter the 6-digit code sent to{"\n"}
            <Text style={styles.highlightText}>{identifier}</Text>
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(300).springify()} style={styles.form}>
          
          <Pressable style={styles.otpContainer} onPress={() => inputRef.current?.focus()}>
            {codeArray.map((_, index) => {
              const digit = code[index] || "";
              const isCurrent = index === code.length;
              return (
                <View 
                  key={index} 
                  style={[
                    styles.otpBox, 
                    isCurrent && styles.otpBoxActive,
                    digit !== "" && styles.otpBoxFilled
                  ]}
                >
                  <Text style={styles.otpText}>{digit}</Text>
                </View>
              );
            })}
          </Pressable>

          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={(text) => {
              const numericText = text.replace(/[^0-9]/g, '');
              setCode(numericText.substring(0, OTP_LENGTH));
            }}
            keyboardType="number-pad"
            maxLength={OTP_LENGTH}
            style={styles.hiddenInput}
            caretHidden={true}
          />

          <Pressable
            onPress={onVerify}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && { opacity: 0.8 },
              loading && { opacity: 0.6 }
            ]}
            disabled={loading}
          >
            <Text style={styles.primaryButtonText}>
              {loading ? "Verifying..." : "Confirm Code"}
            </Text>
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(500).springify()} style={styles.footer}>
          <Text style={styles.footerText}>Didn't receive the code? </Text>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.resendLink}>Go Back</Text>
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
  highlightText: {
    color: isDark ? colors.text : BRAND_COLOR,
    fontWeight: '700',
  },
  form: {
    gap: moderateScale(24),
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: moderateScale(10),
  },
  otpBox: {
    width: moderateScale(48),
    height: moderateScale(56),
    borderRadius: moderateScale(12),
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBoxActive: {
    borderColor: isDark ? colors.primary : BRAND_COLOR,
    borderWidth: 2,
  },
  otpBoxFilled: {
    borderColor: isDark ? colors.primary : BRAND_COLOR,
  },
  otpText: {
    fontSize: fontScale(24),
    fontWeight: '700',
    color: colors.text,
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  primaryButton: {
    backgroundColor: isDark ? colors.primary : BRAND_COLOR,
    height: moderateScale(56),
    borderRadius: moderateScale(16),
    alignItems: 'center',
    justifyContent: 'center',
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
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: verticalScale(32),
  },
  footerText: {
    color: colors.textMuted,
    fontSize: fontScale(15),
  },
  resendLink: {
    color: isDark ? colors.text : BRAND_COLOR,
    fontSize: fontScale(15),
    fontWeight: '700',
  }
});
