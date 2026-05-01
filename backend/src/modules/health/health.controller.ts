import { Request, Response } from "express";

export const healthHandler = (_req: Request, res: Response): void => {
  res.status(200).json({
    success: true,
    message: "ok",
    data: { uptime: process.uptime() }
  });
};
