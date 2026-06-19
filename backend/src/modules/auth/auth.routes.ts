import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { login, refreshToken, registerStudent, forgotPassword, resetPassword } from "./auth.controller.js";

export const authRouter = Router();

authRouter.post("/register/student", asyncHandler(registerStudent));
authRouter.post("/login", asyncHandler(login));
authRouter.post("/refresh-token", asyncHandler(refreshToken));
authRouter.post("/forgot-password", asyncHandler(forgotPassword));
authRouter.post("/reset-password", asyncHandler(resetPassword));
