import cors from "cors";
import express from "express";
import morgan from "morgan";
import path from "node:path";
import { backupsRouter } from "./modules/backups/backups.routes.js";
import { bannersRouter } from "./modules/banners/banners.routes.js";
import { communityRouter } from "./modules/community/community.routes.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { menuRouter } from "./modules/menu/menu.routes.js";
import { ordersRouter } from "./modules/orders/orders.routes.js";
import { tenantsRouter } from "./modules/tenants/tenants.routes.js";
import { usersRouter } from "./modules/users/users.routes.js";
import { walletRouter } from "./modules/wallet/wallet.routes.js";
export const app = express();
// Mobile clients currently expect JSON bodies on every successful menu request.
// Disable ETag-based 304 responses to avoid empty-body fetch failures.
app.set("etag", false);
app.use(cors());
app.use(express.json({ limit: "3mb" }));
app.use(morgan("dev"));
app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));
app.get("/", (_req, res) => {
    res.json({ success: true, message: "Canteen API running" });
});
app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/tenants", tenantsRouter);
app.use("/api/menu", menuRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/users", usersRouter);
app.use("/api/wallet", walletRouter);
app.use("/api/banners", bannersRouter);
app.use("/api/community", communityRouter);
app.use("/api/backups", backupsRouter);
app.use(errorHandler);
