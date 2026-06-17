import { Redirect, Stack, useSegments } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAutoOrderSync } from "../hooks/useAutoOrderSync";
import { AuthProvider, useAuth } from "../hooks/useAuth";
import { CartProvider } from "../hooks/useCart";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { ThemeProvider } from "../hooks/useTheme";
import { useEffect, useState, createContext, useContext } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { usePushNotifications } from "../hooks/usePushNotifications";

export const OnboardingContext = createContext<{
  hasSeenOnboarding: boolean | null;
  completeOnboarding: () => Promise<void>;
}>({
  hasSeenOnboarding: null,
  completeOnboarding: async () => {},
});

const GuardedStack = () => {
  const { user, isHydrated } = useAuth();
  const { hasSeenOnboarding } = useContext(OnboardingContext);
  useAutoOrderSync();
  usePushNotifications();
  const segments = useSegments();
  const inAuth = segments[0] === "(auth)";
  const inAdmin = segments[0] === "(admin)";
  const inStudent = segments[0] === "(student)";
  const inOnboarding = segments[0] === "(onboarding)";

  if (!isHydrated || hasSeenOnboarding === null) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color="#ff6b00" />
      </View>
    );
  }

  // 1. Force onboarding if not seen (even if logged in)
  if (!hasSeenOnboarding && !inOnboarding) {
    return <Redirect href="/(onboarding)/welcome" />;
  }

  // 2. Prevent returning to onboarding once seen
  if (hasSeenOnboarding && inOnboarding) {
    if (user) {
      const isAdminRole = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
      return <Redirect href={isAdminRole ? "/(admin)/dashboard" : "/(student)/dashboard"} />;
    }
    return <Redirect href="/(auth)/login" />;
  }

  // 3. Normal auth guard
  if (!user && !inAuth && !inOnboarding) {
    return <Redirect href="/(auth)/login" />;
  }

  // 4. Role-based routing
  if (user) {
    const isAdminRole = user.role === "ADMIN" || user.role === "SUPER_ADMIN";

    if (!isAdminRole && inAdmin) {
      return <Redirect href="/(student)/dashboard" />;
    }

    if (isAdminRole && inStudent) {
      return <Redirect href="/(admin)/dashboard" />;
    }

    if (inAuth) {
      return <Redirect href={isAdminRole ? "/(admin)/dashboard" : "/(student)/dashboard"} />;
    }
  }

  return <Stack screenOptions={{ headerShown: false }} />;
};

import { ToastProvider } from "../components/Toast";

export default function RootLayout() {
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem("has_seen_onboarding").then((val) => {
      setHasSeenOnboarding(val === "true");
    });
  }, []);

  const completeOnboarding = async () => {
    await AsyncStorage.setItem("has_seen_onboarding", "true");
    setHasSeenOnboarding(true);
  };

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <OnboardingContext.Provider value={{ hasSeenOnboarding, completeOnboarding }}>
            <AuthProvider>
              <CartProvider>
                <GuardedStack />
              </CartProvider>
            </AuthProvider>
          </OnboardingContext.Provider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
