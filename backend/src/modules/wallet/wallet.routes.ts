import { Router } from "express";
import { auth } from "../../middleware/auth.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { tenantResolver } from "../../middleware/tenantResolver.js";
import { getMyWallet, topupMyWallet } from "./wallet.controller.js";

export const walletRouter = Router();

walletRouter.get("/me", auth, tenantResolver, asyncHandler(getMyWallet));
walletRouter.post("/me/topup", auth, tenantResolver, asyncHandler(topupMyWallet));
