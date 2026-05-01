import { useCallback, useEffect, useRef } from "react";
import { useAuth } from "./useAuth";
import { useNetworkStatus } from "./useNetworkStatus";
import { offlineOrderQueue } from "../services/offlineOrderQueue";
import { orderService } from "../services/orderService";

export const useAutoOrderSync = () => {
  const { user, accessToken } = useAuth();
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
};
