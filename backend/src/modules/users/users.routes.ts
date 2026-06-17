import { Router } from "express";
import { auth } from "../../middleware/auth.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { roleGuard } from "../../middleware/roleGuard.js";
import { tenantResolver } from "../../middleware/tenantResolver.js";
import {
  bulkImportUsers,
  createUser,
  getMyProfile,
  getUserWalletBalance,
  listUsers,
  topupUserWallet,
  updateMyPassword,
  updateMyProfile,
  updateUserActive,
  updateUserApproval,
  updateUserPassword
} from "./users.controller.js";

export const usersRouter = Router();

usersRouter.get("/me", auth, tenantResolver, asyncHandler(getMyProfile));
usersRouter.patch("/me", auth, tenantResolver, asyncHandler(updateMyProfile));
usersRouter.patch("/me/password", auth, tenantResolver, asyncHandler(updateMyPassword));

usersRouter.get("/", auth, tenantResolver, roleGuard("ADMIN", "SUPER_ADMIN"), asyncHandler(listUsers));
usersRouter.post("/", auth, tenantResolver, roleGuard("ADMIN", "SUPER_ADMIN"), asyncHandler(createUser));
usersRouter.post("/import", auth, tenantResolver, roleGuard("ADMIN", "SUPER_ADMIN"), asyncHandler(bulkImportUsers));
usersRouter.patch(
  "/:id/approval",
  auth,
  tenantResolver,
  roleGuard("ADMIN", "SUPER_ADMIN"),
  asyncHandler(updateUserApproval)
);
usersRouter.patch(
  "/:id/active",
  auth,
  tenantResolver,
  roleGuard("ADMIN", "SUPER_ADMIN"),
  asyncHandler(updateUserActive)
);
usersRouter.patch(
  "/:id/password",
  auth,
  tenantResolver,
  roleGuard("ADMIN", "SUPER_ADMIN"),
  asyncHandler(updateUserPassword)
);

usersRouter.get("/wallets", auth, tenantResolver, roleGuard("ADMIN", "SUPER_ADMIN"), asyncHandler(getUserWalletBalance));
usersRouter.patch("/:id/wallet-topup", auth, tenantResolver, roleGuard("ADMIN", "SUPER_ADMIN"), asyncHandler(topupUserWallet));
