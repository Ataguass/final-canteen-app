import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { useAuth } from "../../hooks/useAuth";
import { authService } from "../../services/authService";

export default function RegisterScreen() {
  const router = useRouter();
  const { setPendingRegistration } = useAuth();
  const [schoolCode, setSchoolCode] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const sendOtp = async () => {
    try {
      setLoading(true);
      const tenant = await authService.resolveTenant(schoolCode.trim());
      const otpResponse = await authService.requestOtp(tenant.data.id, phone.trim());
      setPendingRegistration({
        tenantId: tenant.data.id,
        name: name.trim(),
        phone: phone.trim(),
        password,
        rollNumber: rollNumber.trim() || undefined
      });
      if (otpResponse.data?.code) {
        Alert.alert("Dev OTP", `Use this OTP: ${otpResponse.data.code}`);
      }
      router.push("/(auth)/otp");
    } catch (error) {
      Alert.alert("OTP request failed", error instanceof Error ? error.message : "Please try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 20, gap: 10 }}>
      <Text style={{ fontSize: 24, fontWeight: "700" }}>Student Registration</Text>
      <TextInput
        placeholder="School Code or Slug"
        value={schoolCode}
        onChangeText={setSchoolCode}
        style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 12 }}
      />
      <TextInput
        placeholder="Name"
        value={name}
        onChangeText={setName}
        style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 12 }}
      />
      <TextInput
        placeholder="Phone"
        value={phone}
        onChangeText={setPhone}
        style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 12 }}
      />
      <TextInput
        placeholder="Roll Number (optional)"
        value={rollNumber}
        onChangeText={setRollNumber}
        style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 12 }}
      />
      <TextInput
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 12 }}
      />
      <Pressable
        onPress={sendOtp}
        style={{ backgroundColor: "#FF6B35", padding: 14, borderRadius: 10, marginTop: 8 }}
        disabled={loading}
      >
        <Text style={{ color: "white", textAlign: "center", fontWeight: "700" }}>
          {loading ? "Sending OTP..." : "Send OTP"}
        </Text>
      </Pressable>
    </View>
  );
}
