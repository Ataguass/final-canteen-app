import { useEffect } from "react";
import { io } from "socket.io-client";
import { config } from "../constants/config";
import type { Order } from "../types";

type SocketHandlers = {
  tenantId?: string;
  userId?: string;
  onOrderNew?: (order: Order) => void;
  onOrderStatusChanged?: (order: Order) => void;
};

export const useOrderSocket = ({
  tenantId,
  userId,
  onOrderNew,
  onOrderStatusChanged
}: SocketHandlers) => {
  useEffect(() => {
    if (!tenantId) return;

    const socket = io(config.socketUrl, {
      transports: ["websocket"],
      forceNew: true
    });

    socket.on("connect", () => {
      socket.emit("join:tenant", tenantId);
      if (userId) {
        socket.emit("join:user", userId);
      }
    });

    if (onOrderNew) {
      socket.on("order:new", onOrderNew);
    }

    if (onOrderStatusChanged) {
      socket.on("order:status_changed", onOrderStatusChanged);
    }

    return () => {
      socket.disconnect();
    };
  }, [tenantId, userId, onOrderNew, onOrderStatusChanged]);
};
