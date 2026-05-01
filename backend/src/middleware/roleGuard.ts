import { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/appError.js";

export const roleGuard = (...roles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new AppError("Forbidden", 403);
    }
    next();
  };
};
