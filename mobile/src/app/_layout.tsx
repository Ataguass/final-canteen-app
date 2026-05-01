import { Redirect, Stack, useSegments } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAutoOrderSync } from "../hooks/useAutoOrderSync";
import { AuthProvider, useAuth } from "../hooks/useAuth";
import { CartProvider } from "../hooks/useCart";

const GuardedStack = () => {
  const { user, isHydrated } = useAuth();
  useAutoOrderSync();
  const segments = useSegments();
  const inAuth = segments[0] === "(auth)";
  const inAdmin = segments[0] === "(admin)";
  const inStudent = segments[0] === "(student)";

  if (!isHydrated) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!user && !inAuth) {
    return <Redirect href="/(auth)/login" />;
  }

  if (user) {
    const isAdminRole = user.role === "ADMIN" || user.role === "SUPER_ADMIN";

    if (!isAdminRole && inAdmin) {
      return <Redirect href="/(student)/dashboard" />;
    }

    if (isAdminRole && inStudent) {
      return <Redirect href="/(admin)/dashboard" />;
    }
  }

  if (user && inAuth) {
    if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
      return <Redirect href="/(admin)/dashboard" />;
    }
    return <Redirect href="/(student)/dashboard" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
};

export default function RootLayout() {
  return (
    <AuthProvider>
      <CartProvider>
        <GuardedStack />
      </CartProvider>
    </AuthProvider>
  );
}
