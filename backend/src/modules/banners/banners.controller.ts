import { Request, Response } from "express";
import { env } from "../../config/env.js";
import { prisma } from "../../config/database.js";
import { uploadStringToCloudinary } from "../../utils/cloudinary.js";
import { AppError } from "../../utils/appError.js";

const BANNER_ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

const parseBase64ImageDataUrl = (
  dataUrl: string
): { mimeType: string; base64: string } | null => {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\r\n]+)$/);
  if (!match) {
    return null;
  }
  return {
    mimeType: match[1].toLowerCase(),
    base64: match[2].replace(/\s+/g, "")
  };
};

export const listBanners = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId as string;
  const includeInactive = req.query.includeInactive === "true";

  const banners = await prisma.banner.findMany({
    where: includeInactive ? { tenantId } : { tenantId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }]
  });

  res.status(200).json({ success: true, data: banners });
};

export const createBanner = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId as string;
  const { title, imageUrl, actionUrl, sortOrder = 0, isActive = true } = req.body as {
    title?: string;
    imageUrl?: string;
    actionUrl?: string | null;
    sortOrder?: number;
    isActive?: boolean;
  };

  if (!title?.trim() || !imageUrl?.trim()) {
    throw new AppError("title and imageUrl are required", 400);
  }

  const banner = await prisma.banner.create({
    data: {
      tenantId,
      title: title.trim(),
      imageUrl: imageUrl.trim(),
      actionUrl: actionUrl?.trim() ? actionUrl.trim() : null,
      sortOrder: Number.isFinite(sortOrder) ? Math.floor(sortOrder) : 0,
      isActive
    }
  });

  res.status(201).json({ success: true, data: banner });
};

export const updateBanner = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId as string;
  const { id } = req.params;
  const { title, imageUrl, actionUrl, sortOrder, isActive } = req.body as {
    title?: string;
    imageUrl?: string;
    actionUrl?: string | null;
    sortOrder?: number;
    isActive?: boolean;
  };

  const existing = await prisma.banner.findFirst({ where: { id, tenantId } });
  if (!existing) {
    throw new AppError("Banner not found", 404);
  }

  const updated = await prisma.banner.update({
    where: { id },
    data: {
      title: title === undefined ? undefined : title.trim(),
      imageUrl: imageUrl === undefined ? undefined : imageUrl.trim(),
      actionUrl: actionUrl === undefined ? undefined : actionUrl?.trim() ? actionUrl.trim() : null,
      sortOrder: sortOrder === undefined ? undefined : Math.floor(sortOrder),
      isActive
    }
  });

  res.status(200).json({ success: true, data: updated });
};

export const toggleBanner = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId as string;
  const { id } = req.params;
  const existing = await prisma.banner.findFirst({ where: { id, tenantId } });
  if (!existing) {
    throw new AppError("Banner not found", 404);
  }

  const updated = await prisma.banner.update({
    where: { id },
    data: { isActive: !existing.isActive }
  });

  res.status(200).json({ success: true, data: updated });
};

export const deleteBanner = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId as string;
  const { id } = req.params;
  const existing = await prisma.banner.findFirst({ where: { id, tenantId } });
  if (!existing) {
    throw new AppError("Banner not found", 404);
  }

  await prisma.banner.delete({ where: { id } });
  res.status(204).send();
};

export const uploadBannerImage = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId as string;
  const { dataUrl } = req.body as { dataUrl?: string };

  if (!dataUrl || typeof dataUrl !== "string") {
    throw new AppError("dataUrl is required", 400);
  }

  const parsed = parseBase64ImageDataUrl(dataUrl.trim());
  if (!parsed || !BANNER_ALLOWED_MIME.has(parsed.mimeType)) {
    throw new AppError("Invalid image type. Allowed: PNG, JPG, JPEG, WEBP", 400);
  }

  let imageBuffer: Buffer;
  try {
    imageBuffer = Buffer.from(parsed.base64, "base64");
  } catch {
    throw new AppError("Invalid base64 image data", 400);
  }

  if (!imageBuffer.length) {
    throw new AppError("Image file is empty", 400);
  }

  if (imageBuffer.byteLength > env.bannerImageMaxBytes) {
    throw new AppError(
      `Image too large. Max ${(env.bannerImageMaxBytes / (1024 * 1024)).toFixed(2)} MB`,
      400
    );
  }

  const publicId = `banner-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const upload = await uploadStringToCloudinary({
    file: dataUrl.trim(),
    resourceType: "image",
    folder: `tenants/${tenantId}/banners`,
    publicId
  });

  res.status(200).json({
    success: true,
    data: {
      imageUrl: upload.secureUrl
    }
  });
};
