import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { useAuth } from "../../hooks/useAuth";

export default function OtpScreen() {
  const router = useRouter();
  const { pendingRegistration, registerAfterOtp } = useAuth();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const onVerify = async () => {
    try {
      setLoading(true);
      await registerAfterOtp(code.trim());
      router.replace("/");
    } catch (error) {
      Alert.alert("OTP verification failed", error instanceof Error ? error.message : "Please try again");
    } finally {
      setLoading(false);
    }
  };

  if (!pendingRegistration) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 20 }}>
        <Text>Registration session expired. Please register again.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 20, gap: 10 }}>
      <Text style={{ fontSize: 24, fontWeight: "700" }}>Verify OTP</Text>
      <Text>Enter the OTP sent to {pendingRegistration.phone}</Text>
      <TextInput
        placeholder="6-digit OTP"
        keyboardType="number-pad"
        value={code}
        onChangeText={setCode}
        style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 12 }}
      />
      <Pressable
        onPress={onVerify}
        style={{ backgroundColor: "#FF6B35", padding: 14, borderRadius: 10, marginTop: 8 }}
        disabled={loading}
      >
        <Text style={{ color: "white", textAlign: "center", fontWeight: "700" }}>
          {loading ? "Verifying..." : "Verify OTP"}
        </Text>
      </Pressable>
    </View>
  );
}
