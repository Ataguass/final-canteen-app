import { Server } from "socket.io";
let io = null;
export const initSocket = (server) => {
    io = new Server(server, {
        cors: { origin: "*" }
    });
    io.on("connection", (socket) => {
        socket.on("join:tenant", (tenantId) => {
            if (tenantId) {
                socket.join(`tenant:${tenantId}`);
            }
        });
        socket.on("join:user", (userId) => {
            if (userId) {
                socket.join(`user:${userId}`);
            }
        });
    });
    return io;
};
export const getIo = () => {
    if (!io) {
        throw new Error("Socket.io has not been initialized.");
    }
    return io;
};
