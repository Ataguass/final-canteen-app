import { Redirect } from "expo-router";
import { useAuth } from "../hooks/useAuth";

export default function Index() {
  const { user } = useAuth();

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
    return <Redirect href="/(admin)/dashboard" />;
  }

  return <Redirect href="/(student)/dashboard" />;
}
