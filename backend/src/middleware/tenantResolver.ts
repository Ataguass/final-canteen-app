import { NextFunction, Request, Response } from "express";
import { prisma } from "../config/database.js";
import { AppError } from "../utils/appError.js";

export const tenantResolver = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const fromHeader = req.header("x-tenant-id");
    const fromSlug = req.header("x-tenant-slug");
    let tenantId = req.user?.tenantId ?? fromHeader ?? undefined;

    if (!tenantId && fromSlug) {
      const tenant = await prisma.tenant.findUnique({
        where: { slug: fromSlug },
        select: { id: true }
      });
      tenantId = tenant?.id;
    }

    if (!tenantId) {
      throw new AppError("Tenant context is required", 400);
    }

    req.tenantId = tenantId;
    next();
  } catch (error) {
    next(error);
  }
};
