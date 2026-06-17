import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { login, refreshToken, registerStudent } from "./auth.controller.js";

export const authRouter = Router();

authRouter.post("/register/student", asyncHandler(registerStudent));
authRouter.post("/login", asyncHandler(login));
authRouter.post("/refresh-token", asyncHandler(refreshToken));
