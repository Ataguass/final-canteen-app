import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "../utils/appError.js";
export const auth = (req, _res, next) => {
    const header = req.header("authorization");
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) {
        throw new AppError("Unauthorized", 401);
    }
    try {
        const decoded = jwt.verify(token, env.jwtAccessSecret);
        req.user = decoded;
        req.tenantId = decoded.tenantId;
        next();
    }
    catch {
        throw new AppError("Unauthorized", 401);
    }
};
