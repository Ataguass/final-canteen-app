import { Redirect } from "expo-router";
import { useAuthStore } from '../stores/useAuthStore';

export default function Index() {
  const { user } = useAuthStore();

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
    return <Redirect href="/(admin)/dashboard" />;
  }

  return <Redirect href="/(student)/dashboard" />;
}
