import { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/appError.js";

export const errorHandler = (
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({ success: false, message: error.message });
    return;
  }

  console.error("[errorHandler] Unhandled error:", error);
  res.status(500).json({
    success: false,
    message: "Internal server error"
  });
};
