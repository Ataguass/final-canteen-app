import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { useAuth } from "../../hooks/useAuth";
import { authService } from "../../services/authService";

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [schoolCode, setSchoolCode] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    try {
      setLoading(true);
      const resolved = await authService.resolveTenant(schoolCode.trim());
      await login(resolved.data.id, phone.trim(), password);
      router.replace("/");
    } catch (error) {
      Alert.alert("Login failed", error instanceof Error ? error.message : "Please try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 20, gap: 10 }}>
      <Text style={{ fontSize: 24, fontWeight: "700" }}>Login</Text>
      <TextInput
        placeholder="School Code or Slug"
        value={schoolCode}
        onChangeText={setSchoolCode}
        style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 12 }}
      />
      <TextInput
        placeholder="Phone"
        value={phone}
        onChangeText={setPhone}
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
        onPress={onLogin}
        style={{ backgroundColor: "#FF6B35", padding: 14, borderRadius: 10, marginTop: 8 }}
        disabled={loading}
      >
        <Text style={{ color: "white", textAlign: "center", fontWeight: "700" }}>
          {loading ? "Logging in..." : "Login"}
        </Text>
      </Pressable>
      <Link href="/(auth)/register" style={{ marginTop: 8 }}>
        New student? Register here
      </Link>
    </View>
  );
}
