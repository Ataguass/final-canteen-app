import { useRouter } from "expo-router";
import { useState, useRef, useEffect } from "react";
import { Alert, Pressable, Text, TextInput, View, StyleSheet, KeyboardAvoidingView, Platform, SafeAreaView } from "react-native";
import { useAuth } from "../../hooks/useAuth";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { moderateScale, fontScale, verticalScale, scale, isTablet, gridColumns } from '../../utils/responsive';

const BRAND_COLOR = "#080d2b";
const OTP_LENGTH = 6;

export default function OtpScreen() {
  const router = useRouter();
  const { pendingRegistration, registerAfterOtp, confirmationResult } = useAuth();
  
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    // Auto focus the hidden input when screen mounts
    const timeout = setTimeout(() => inputRef.current?.focus(), 500);
    return () => clearTimeout(timeout);
  }, []);

  const onVerify = async () => {
    if (code.length !== OTP_LENGTH) {
      Alert.alert("Invalid Code", "Please enter the complete 6-digit OTP.");
      return;
    }

    if (!confirmationResult) {
      Alert.alert("Error", "Authentication session missing. Please try registering again.");
      return;
    }

    try {
      setLoading(true);
      // Confirm the OTP with Firebase
      const userCredential = await confirmationResult.confirm(code.trim());
      
      if (userCredential && userCredential.user) {
        // Get the Firebase ID token
        const idToken = await userCredential.user.getIdToken();
        
        // Pass the token to the backend to complete registration
        await registerAfterOtp(idToken);
        router.replace("/");
      } else {
        throw new Error("Failed to authenticate with Firebase.");
      }
    } catch (error) {
      Alert.alert("OTP verification failed", error instanceof Error ? error.message : "Please try again");
    } finally {
      setLoading(false);
    }
  };

  if (!pendingRegistration) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>Session Expired</Text>
          <Text style={styles.subtitle}>Your registration session has expired. Please go back and try again.</Text>
          <Pressable onPress={() => router.replace("/(auth)/register")} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Back to Registration</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Generate an array for the OTP visual blocks
  const codeArray = new Array(OTP_LENGTH).fill(0);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.content}>
        
        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1c1c1e" />
          </Pressable>
          <View style={styles.iconContainer}>
            <Ionicons name="chatbubble-ellipses" size={32} color="#ffffff" />
          </View>
          <Text style={styles.title}>Verify Phone</Text>
          <Text style={styles.subtitle}>
            Enter the 6-digit code sent to{"\n"}
            <Text style={styles.highlightText}>{pendingRegistration.phone}</Text>
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

          {/* Hidden input for handling the actual keyboard input seamlessly */}
          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={(text) => {
              // Ensure we only keep numeric characters and respect max length
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafbfc',
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
    shadowColor: BRAND_COLOR,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: moderateScale(16),
  },
  title: {
    fontSize: fontScale(28),
    fontWeight: '800',
    color: '#1c1c1e',
    marginBottom: verticalScale(8),
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: fontScale(16),
    color: '#8e8e93',
    textAlign: 'center',
    lineHeight: 24,
  },
  highlightText: {
    color: BRAND_COLOR,
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
    width: moderateScale(45),
    height: moderateScale(55),
    borderRadius: moderateScale(12),
    borderWidth: 1.5,
    borderColor: '#e5e5ea',
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  otpBoxActive: {
    borderColor: BRAND_COLOR,
    backgroundColor: 'rgba(8, 13, 43, 0.02)',
  },
  otpBoxFilled: {
    borderColor: BRAND_COLOR,
    backgroundColor: '#ffffff',
  },
  otpText: {
    fontSize: fontScale(24),
    fontWeight: '700',
    color: '#1c1c1e',
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  primaryButton: {
    backgroundColor: BRAND_COLOR,
    height: moderateScale(56),
    borderRadius: moderateScale(16),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: verticalScale(8),
    elevation: 8,
    shadowColor: BRAND_COLOR,
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
    justifyContent: 'center',
    marginTop: verticalScale(32),
  },
  footerText: {
    color: '#8e8e93',
    fontSize: fontScale(15),
  },
  resendLink: {
    color: BRAND_COLOR,
    fontSize: fontScale(15),
    fontWeight: '700',
  }
});
