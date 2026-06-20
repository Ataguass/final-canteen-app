import { createServer } from "node:http";
import { app } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./config/database.js";
import { redis } from "./config/redis.js";
import { initSocket } from "./config/socket.js";
const server = createServer(app);
initSocket(server);
const start = async () => {
    try {
        await prisma.$connect();
        await redis.connect();
        server.listen(env.port, "0.0.0.0", () => {
            console.log(`API listening on port ${env.port}`);
        });
    }
    catch (error) {
        console.error("Failed to start server", error);
        process.exit(1);
    }
};
start();
