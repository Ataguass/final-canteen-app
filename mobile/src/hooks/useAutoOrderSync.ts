import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useAuthStore } from "../stores/useAuthStore";
import { useNetworkStatus } from "./useNetworkStatus";
import { offlineOrderQueue } from "../services/offlineOrderQueue";
import { orderService } from "../services/orderService";

export const useAutoOrderSync = () => {
  const { user, accessToken } = useAuthStore();
  const { isConnected } = useNetworkStatus();
  const syncingRef = useRef(false);
  const isAdminRole = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  const sync = useCallback(async () => {
    if (
      !isAdminRole ||
      !user?.tenantId ||
      !user.id ||
      !accessToken ||
      !isConnected ||
      syncingRef.current
    ) {
      return;
    }

    const queued = await offlineOrderQueue.get(user.tenantId, user.id);
    if (queued.length === 0) return;

    syncingRef.current = true;
    try {
      await orderService.syncOrders(
        accessToken,
        user.tenantId,
        queued.map((q) => ({
          items: q.items,
          paymentMethod: q.paymentMethod,
          paymentStatus: q.paymentStatus
        }))
      );
      await offlineOrderQueue.clear(user.tenantId, user.id);
    } catch {
      // Keep queue for next retry when network/service is healthy.
    } finally {
      syncingRef.current = false;
    }
  }, [isAdminRole, user?.tenantId, user?.id, accessToken, isConnected]);

  useEffect(() => {
    if (isConnected) {
      sync().catch(() => undefined);
    }
  }, [isConnected, sync]);

  // Also sync when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active" && isConnected) {
        sync().catch(() => undefined);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isConnected, sync]);
};
