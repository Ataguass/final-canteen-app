import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "../utils/appError.js";

export type AuthPayload = {
  sub: string;
  role: string;
  tenantId: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
      tenantId?: string;
    }
  }
}

export const auth = (req: Request, _res: Response, next: NextFunction): void => {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    throw new AppError("Unauthorized", 401);
  }

  try {
    const decoded = jwt.verify(token, env.jwtAccessSecret) as AuthPayload;
    req.user = decoded;
    req.tenantId = decoded.tenantId;
    next();
  } catch {
    throw new AppError("Unauthorized", 401);
  }
};
