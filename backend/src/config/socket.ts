import { Server as HttpServer } from "node:http";
import { Server } from "socket.io";

let io: Server | null = null;

export const initSocket = (server: HttpServer): Server => {
  io = new Server(server, {
    cors: { origin: "*" }
  });

  io.on("connection", (socket) => {
    socket.on("join:tenant", (tenantId: string) => {
      if (tenantId) {
        socket.join(`tenant:${tenantId}`);
      }
    });

    socket.on("join:user", (userId: string) => {
      if (userId) {
        socket.join(`user:${userId}`);
      }
    });
  });

  return io;
};

export const getIo = (): Server => {
  if (!io) {
    throw new Error("Socket.io has not been initialized.");
  }
  return io;
};
