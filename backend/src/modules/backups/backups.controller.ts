import { OrderStatus, PaymentMethod, PaymentStatus, Role, StockMovementType } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { Request, Response } from "express";
import { prisma } from "../../config/database.js";
import { AppError } from "../../utils/appError.js";

const BACKUP_VERSION = 1;
const BACKUP_ID_REGEX = /^backup-\d{8}-\d{6}-[a-z0-9]{6}\.json$/;
const ORDER_STATUS_SET = new Set(Object.values(OrderStatus));
const PAYMENT_METHOD_SET = new Set(Object.values(PaymentMethod));
const PAYMENT_STATUS_SET = new Set(Object.values(PaymentStatus));
const STOCK_MOVEMENT_SET = new Set(Object.values(StockMovementType));

type TenantBackupV1 = {
  version: 1;
  createdAt: string;
  tenantId: string;
  tenant: {
    name: string;
    slug: string;
    schoolCode: string | null;
    logo: string | null;
    primaryColor: string;
    currency: string;
    taxPercent: number;
    invoiceLogoUrl: string | null;
    invoiceShowLogo: boolean;
    invoiceShowSchoolName: boolean;
    invoiceShowOrderNumber: boolean;
    invoiceShowDate: boolean;
    invoiceShowCashier: boolean;
    invoiceShowPaymentDetails: boolean;
    invoiceShowTaxBreakup: boolean;
    invoiceShowNotes: boolean;
    invoiceFooterNote: string | null;
    todaySpecialsEnabled?: boolean;
  };
  users: Array<{
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    passwordHash: string;
    role: Role;
    rollNumber: string | null;
    isActive: boolean;
    isApproved: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
  categories: Array<{
    id: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
    isTodaySpecial?: boolean;
    sortOrder: number;
    isActive: boolean;
    createdAt: string;
  }>;
  menuItems: Array<{
    id: string;
    categoryId: string;
    name: string;
    description: string | null;
    image: string | null;
    price: number;
    stockQty: number;
    lowStockThreshold: number;
    isAvailable: boolean;
    isTodaySpecial?: boolean;
    prepTimeMinutes: number;
    isVeg: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
  banners: Array<{
    id: string;
    title: string;
    imageUrl: string;
    actionUrl: string | null;
    sortOrder: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
  communityPosts: Array<{
    id: string;
    authorUserId: string | null;
    title: string;
    body: string;
    mediaUrl: string | null;
    mediaType: "IMAGE" | "VIDEO" | null;
    isPinned: boolean;
    isVisible: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
  orders: Array<{
    id: string;
    orderNumber: string;
    userId: string | null;
    status: string;
    subtotal: number;
    taxAmount: number;
    totalAmount: number;
    paymentMethod: string;
    paymentStatus: string;
    createdAt: string;
    updatedAt: string;
  }>;
  orderItems: Array<{
    id: string;
    orderId: string;
    menuItemId: string;
    name: string;
    price: number;
    quantity: number;
    note: string | null;
  }>;
  stockMovements: Array<{
    id: string;
    menuItemId: string;
    actorUserId: string | null;
    changeType: string;
    delta: number;
    previousQty: number;
    newQty: number;
    note: string | null;
    createdAt: string;
  }>;
};

const backupRootDir = path.resolve(process.cwd(), "backups");

const toIsoString = (value: Date): string => value.toISOString();

const parseDate = (value: string): Date => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError("Backup contains invalid date values", 400);
  }
  return parsed;
};

const parseOrderStatus = (value: string): OrderStatus => {
  if (!ORDER_STATUS_SET.has(value as OrderStatus)) {
    throw new AppError(`Invalid order status in backup: ${value}`, 400);
  }
  return value as OrderStatus;
};

const parsePaymentMethod = (value: string): PaymentMethod => {
  if (!PAYMENT_METHOD_SET.has(value as PaymentMethod)) {
    throw new AppError(`Invalid payment method in backup: ${value}`, 400);
  }
  return value as PaymentMethod;
};

const parsePaymentStatus = (value: string): PaymentStatus => {
  if (!PAYMENT_STATUS_SET.has(value as PaymentStatus)) {
    throw new AppError(`Invalid payment status in backup: ${value}`, 400);
  }
  return value as PaymentStatus;
};

const parseStockMovementType = (value: string): StockMovementType => {
  if (!STOCK_MOVEMENT_SET.has(value as StockMovementType)) {
    throw new AppError(`Invalid stock movement type in backup: ${value}`, 400);
  }
  return value as StockMovementType;
};

const crc32Table = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let current = index;
    for (let bit = 0; bit < 8; bit += 1) {
      current = (current & 1) !== 0 ? 0xedb88320 ^ (current >>> 1) : current >>> 1;
    }
    table[index] = current >>> 0;
  }
  return table;
})();

const crc32 = (buffer: Buffer): number => {
  let current = 0xffffffff;
  for (let index = 0; index < buffer.length; index += 1) {
    current = crc32Table[(current ^ buffer[index]) & 0xff] ^ (current >>> 8);
  }
  return (current ^ 0xffffffff) >>> 0;
};

const toDosTimeDate = (date: Date): { dosTime: number; dosDate: number } => {
  const safeDate = new Date(date);
  if (Number.isNaN(safeDate.getTime())) {
    return { dosTime: 0, dosDate: 0 };
  }
  const year = Math.max(1980, safeDate.getFullYear());
  const month = safeDate.getMonth() + 1;
  const day = safeDate.getDate();
  const hours = safeDate.getHours();
  const minutes = safeDate.getMinutes();
  const seconds = Math.floor(safeDate.getSeconds() / 2);
  const dosTime = (hours << 11) | (minutes << 5) | seconds;
  const dosDate = ((year - 1980) << 9) | (month << 5) | day;
  return { dosTime, dosDate };
};

const buildSingleFileZip = (entryFileName: string, content: Buffer, modifiedAt: Date): Buffer => {
  const fileNameBytes = Buffer.from(entryFileName, "utf8");
  const compressedSize = content.length;
  const uncompressedSize = content.length;
  const checksum = crc32(content);
  const { dosTime, dosDate } = toDosTimeDate(modifiedAt);

  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(0, 6);
  localHeader.writeUInt16LE(0, 8);
  localHeader.writeUInt16LE(dosTime, 10);
  localHeader.writeUInt16LE(dosDate, 12);
  localHeader.writeUInt32LE(checksum, 14);
  localHeader.writeUInt32LE(compressedSize, 18);
  localHeader.writeUInt32LE(uncompressedSize, 22);
  localHeader.writeUInt16LE(fileNameBytes.length, 26);
  localHeader.writeUInt16LE(0, 28);

  const centralDirectoryHeader = Buffer.alloc(46);
  centralDirectoryHeader.writeUInt32LE(0x02014b50, 0);
  centralDirectoryHeader.writeUInt16LE(20, 4);
  centralDirectoryHeader.writeUInt16LE(20, 6);
  centralDirectoryHeader.writeUInt16LE(0, 8);
  centralDirectoryHeader.writeUInt16LE(0, 10);
  centralDirectoryHeader.writeUInt16LE(dosTime, 12);
  centralDirectoryHeader.writeUInt16LE(dosDate, 14);
  centralDirectoryHeader.writeUInt32LE(checksum, 16);
  centralDirectoryHeader.writeUInt32LE(compressedSize, 20);
  centralDirectoryHeader.writeUInt32LE(uncompressedSize, 24);
  centralDirectoryHeader.writeUInt16LE(fileNameBytes.length, 28);
  centralDirectoryHeader.writeUInt16LE(0, 30);
  centralDirectoryHeader.writeUInt16LE(0, 32);
  centralDirectoryHeader.writeUInt16LE(0, 34);
  centralDirectoryHeader.writeUInt16LE(0, 36);
  centralDirectoryHeader.writeUInt32LE(0, 38);
  centralDirectoryHeader.writeUInt32LE(0, 42);

  const centralDirectoryOffset = localHeader.length + fileNameBytes.length + content.length;
  const centralDirectorySize = centralDirectoryHeader.length + fileNameBytes.length;

  const endOfCentralDirectory = Buffer.alloc(22);
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(0, 4);
  endOfCentralDirectory.writeUInt16LE(0, 6);
  endOfCentralDirectory.writeUInt16LE(1, 8);
  endOfCentralDirectory.writeUInt16LE(1, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectorySize, 12);
  endOfCentralDirectory.writeUInt32LE(centralDirectoryOffset, 16);
  endOfCentralDirectory.writeUInt16LE(0, 20);

  return Buffer.concat([
    localHeader,
    fileNameBytes,
    content,
    centralDirectoryHeader,
    fileNameBytes,
    endOfCentralDirectory
  ]);
};

const getTenantBackupDir = (tenantId: string): string => path.join(backupRootDir, tenantId);

const ensureTenantBackupDir = async (tenantId: string): Promise<string> => {
  const dir = getTenantBackupDir(tenantId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
};

const buildBackupId = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const random = randomBytes(3).toString("hex");
  return `backup-${y}${m}${d}-${hh}${mm}${ss}-${random}.json`;
};

const assertBackupId = (backupId: string): string => {
  const trimmed = backupId.trim();
  if (!BACKUP_ID_REGEX.test(trimmed)) {
    throw new AppError("Invalid backup id", 400);
  }
  return trimmed;
};

const readBackupFile = async (tenantId: string, backupIdRaw: string): Promise<TenantBackupV1> => {
  const backupId = assertBackupId(backupIdRaw);
  const filePath = path.join(getTenantBackupDir(tenantId), backupId);
  let raw = "";
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new AppError("Backup not found", 404);
    }
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AppError("Backup file is corrupted", 400);
  }

  if (!parsed || typeof parsed !== "object") {
    throw new AppError("Invalid backup file format", 400);
  }

  const data = parsed as Partial<TenantBackupV1>;
  if (data.version !== BACKUP_VERSION) {
    throw new AppError("Unsupported backup version", 400);
  }
  if (data.tenantId !== tenantId) {
    throw new AppError("Backup tenant mismatch", 400);
  }

  const requiredLists: Array<keyof TenantBackupV1> = [
    "users",
    "categories",
    "menuItems",
    "banners",
    "communityPosts",
    "orders",
    "orderItems",
    "stockMovements"
  ];

  for (const key of requiredLists) {
    if (!Array.isArray(data[key])) {
      throw new AppError(`Backup is missing ${String(key)}`, 400);
    }
  }

  if (!data.tenant || typeof data.tenant !== "object") {
    throw new AppError("Backup is missing tenant settings", 400);
  }

  return data as TenantBackupV1;
};

const serializeBackupPayload = (payload: TenantBackupV1): string => `${JSON.stringify(payload, null, 2)}\n`;

const buildCounts = (backup: TenantBackupV1) => ({
  users: backup.users.length,
  categories: backup.categories.length,
  menuItems: backup.menuItems.length,
  banners: backup.banners.length,
  communityPosts: backup.communityPosts.length,
  orders: backup.orders.length,
  orderItems: backup.orderItems.length,
  stockMovements: backup.stockMovements.length
});

export const listBackups = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId as string;
  const dir = await ensureTenantBackupDir(tenantId);
  const files = await fs.readdir(dir, { withFileTypes: true });

  const backups = await Promise.all(
    files
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map(async (entry) => {
        const filePath = path.join(dir, entry.name);
        const stat = await fs.stat(filePath);
        return {
          id: entry.name,
          sizeBytes: stat.size,
          createdAt: stat.birthtime.toISOString(),
          updatedAt: stat.mtime.toISOString()
        };
      })
  );

  backups.sort((a, b) => Number(new Date(b.createdAt)) - Number(new Date(a.createdAt)));
  res.status(200).json({ success: true, data: backups });
};

export const createBackup = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId as string;

  const [tenant, users, categories, menuItems, banners, communityPosts, orders, orderItems, stockMovements] =
    await Promise.all([
      prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          name: true,
          slug: true,
          schoolCode: true,
          logo: true,
          primaryColor: true,
          currency: true,
          taxPercent: true,
          invoiceLogoUrl: true,
          invoiceShowLogo: true,
          invoiceShowSchoolName: true,
          invoiceShowOrderNumber: true,
          invoiceShowDate: true,
          invoiceShowCashier: true,
          invoiceShowPaymentDetails: true,
          invoiceShowTaxBreakup: true,
          invoiceShowNotes: true,
          invoiceFooterNote: true,
          todaySpecialsEnabled: true
        }
      }),
      prisma.user.findMany({
        where: { tenantId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          passwordHash: true,
          role: true,
          rollNumber: true,
          isActive: true,
          isApproved: true,
          createdAt: true,
          updatedAt: true
        }
      }),
      prisma.category.findMany({
        where: { tenantId },
        select: {
          id: true,
          name: true,
          description: true,
          imageUrl: true,
          isTodaySpecial: true,
          sortOrder: true,
          isActive: true,
          createdAt: true
        }
      }),
      prisma.menuItem.findMany({
        where: { tenantId },
        select: {
          id: true,
          categoryId: true,
          name: true,
          description: true,
          image: true,
          price: true,
          stockQty: true,
          lowStockThreshold: true,
          isAvailable: true,
          isTodaySpecial: true,
          prepTimeMinutes: true,
          isVeg: true,
          createdAt: true,
          updatedAt: true
        }
      }),
      prisma.banner.findMany({
        where: { tenantId },
        select: {
          id: true,
          title: true,
          imageUrl: true,
          actionUrl: true,
          sortOrder: true,
          isActive: true,
          createdAt: true,
          updatedAt: true
        }
      }),
      prisma.communityPost.findMany({
        where: { tenantId },
        select: {
          id: true,
          authorUserId: true,
          title: true,
          body: true,
          mediaUrl: true,
          mediaType: true,
          isPinned: true,
          isVisible: true,
          createdAt: true,
          updatedAt: true
        }
      }),
      prisma.order.findMany({
        where: { tenantId },
        select: {
          id: true,
          orderNumber: true,
          userId: true,
          status: true,
          subtotal: true,
          taxAmount: true,
          totalAmount: true,
          paymentMethod: true,
          paymentStatus: true,
          createdAt: true,
          updatedAt: true
        }
      }),
      prisma.orderItem.findMany({
        where: { order: { tenantId } },
        select: {
          id: true,
          orderId: true,
          menuItemId: true,
          name: true,
          price: true,
          quantity: true,
          note: true
        }
      }),
      prisma.stockMovement.findMany({
        where: { tenantId },
        select: {
          id: true,
          menuItemId: true,
          actorUserId: true,
          changeType: true,
          delta: true,
          previousQty: true,
          newQty: true,
          note: true,
          createdAt: true
        }
      })
    ]);

  if (!tenant) {
    throw new AppError("Tenant not found", 404);
  }

  const backup: TenantBackupV1 = {
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    tenantId,
    tenant,
    users: users.map((entry) => ({
      ...entry,
      createdAt: toIsoString(entry.createdAt),
      updatedAt: toIsoString(entry.updatedAt)
    })),
    categories: categories.map((entry) => ({
      ...entry,
      createdAt: toIsoString(entry.createdAt)
    })),
    menuItems: menuItems.map((entry) => ({
      ...entry,
      createdAt: toIsoString(entry.createdAt),
      updatedAt: toIsoString(entry.updatedAt)
    })),
    banners: banners.map((entry) => ({
      ...entry,
      createdAt: toIsoString(entry.createdAt),
      updatedAt: toIsoString(entry.updatedAt)
    })),
    communityPosts: communityPosts.map((entry) => ({
      ...entry,
      mediaType: entry.mediaType ?? null,
      createdAt: toIsoString(entry.createdAt),
      updatedAt: toIsoString(entry.updatedAt)
    })),
    orders: orders.map((entry) => ({
      ...entry,
      status: entry.status,
      paymentMethod: entry.paymentMethod,
      paymentStatus: entry.paymentStatus,
      createdAt: toIsoString(entry.createdAt),
      updatedAt: toIsoString(entry.updatedAt)
    })),
    orderItems,
    stockMovements: stockMovements.map((entry) => ({
      ...entry,
      changeType: entry.changeType,
      createdAt: toIsoString(entry.createdAt)
    }))
  };

  const backupId = buildBackupId();
  const dir = await ensureTenantBackupDir(tenantId);
  const filePath = path.join(dir, backupId);
  const content = serializeBackupPayload(backup);
  await fs.writeFile(filePath, content, "utf8");

  res.status(201).json({
    success: true,
    data: {
      id: backupId,
      createdAt: backup.createdAt,
      sizeBytes: Buffer.byteLength(content, "utf8"),
      counts: buildCounts(backup)
    }
  });
};

export const restoreBackup = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId as string;
  const requesterUserId = req.user?.sub ?? "";
  const { backupId } = req.body as { backupId?: string };

  if (!backupId || typeof backupId !== "string") {
    throw new AppError("backupId is required", 400);
  }

  const backup = await readBackupFile(tenantId, backupId);

  if (
    !backup.users.some(
      (entry) => entry.id === requesterUserId && (entry.role === Role.ADMIN || entry.role === Role.SUPER_ADMIN)
    )
  ) {
    throw new AppError(
      "Safety check failed: this backup does not contain your current admin account. Use a backup created after your account was created.",
      400
    );
  }

  if (!backup.users.some((entry) => entry.role === Role.ADMIN || entry.role === Role.SUPER_ADMIN)) {
    throw new AppError("Backup must contain at least one admin account", 400);
  }

  const categoryIds = new Set(backup.categories.map((entry) => entry.id));
  const validMenuItems = backup.menuItems.filter((entry) => categoryIds.has(entry.categoryId));
  const menuItemIds = new Set(validMenuItems.map((entry) => entry.id));
  const restoredUsers = backup.users;
  const userIds = new Set(restoredUsers.map((entry) => entry.id));
  const validOrders = backup.orders.map((entry) => ({
    ...entry,
    userId: entry.userId && userIds.has(entry.userId) ? entry.userId : null
  }));
  const orderIds = new Set(validOrders.map((entry) => entry.id));
  const validOrderItems = backup.orderItems.filter(
    (entry) => orderIds.has(entry.orderId) && menuItemIds.has(entry.menuItemId)
  );
  const validStockMovements = backup.stockMovements
    .filter((entry) => menuItemIds.has(entry.menuItemId))
    .map((entry) => ({
      ...entry,
      actorUserId: entry.actorUserId && userIds.has(entry.actorUserId) ? entry.actorUserId : null
    }));
  const validCommunityPosts = backup.communityPosts.map((entry) => ({
    ...entry,
    authorUserId: entry.authorUserId && userIds.has(entry.authorUserId) ? entry.authorUserId : null
  }));

  await prisma.$transaction(async (tx) => {
    const existingOrderIds = (
      await tx.order.findMany({
        where: { tenantId },
        select: { id: true }
      })
    ).map((entry) => entry.id);

    if (existingOrderIds.length) {
      await tx.orderItem.deleteMany({
        where: { orderId: { in: existingOrderIds } }
      });
    }

    await tx.order.deleteMany({ where: { tenantId } });
    await tx.stockMovement.deleteMany({ where: { tenantId } });
    await tx.communityPost.deleteMany({ where: { tenantId } });
    await tx.banner.deleteMany({ where: { tenantId } });
    await tx.menuItem.deleteMany({ where: { tenantId } });
    await tx.category.deleteMany({ where: { tenantId } });
    await tx.user.deleteMany({ where: { tenantId } });

    await tx.tenant.update({
      where: { id: tenantId },
      data: {
        name: backup.tenant.name,
        logo: backup.tenant.logo,
        primaryColor: backup.tenant.primaryColor,
        currency: backup.tenant.currency,
        taxPercent: backup.tenant.taxPercent,
        invoiceLogoUrl: backup.tenant.invoiceLogoUrl,
        invoiceShowLogo: backup.tenant.invoiceShowLogo,
        invoiceShowSchoolName: backup.tenant.invoiceShowSchoolName,
        invoiceShowOrderNumber: backup.tenant.invoiceShowOrderNumber,
        invoiceShowDate: backup.tenant.invoiceShowDate,
        invoiceShowCashier: backup.tenant.invoiceShowCashier,
        invoiceShowPaymentDetails: backup.tenant.invoiceShowPaymentDetails,
        invoiceShowTaxBreakup: backup.tenant.invoiceShowTaxBreakup,
        invoiceShowNotes: backup.tenant.invoiceShowNotes,
        invoiceFooterNote: backup.tenant.invoiceFooterNote,
        todaySpecialsEnabled: backup.tenant.todaySpecialsEnabled ?? true
      }
    });

    if (restoredUsers.length) {
      await tx.user.createMany({
        data: restoredUsers.map((entry) => ({
          id: entry.id,
          tenantId,
          name: entry.name,
          email: entry.email,
          phone: entry.phone,
          passwordHash: entry.passwordHash,
          role: entry.role,
          rollNumber: entry.rollNumber,
          isActive: entry.isActive,
          isApproved: entry.isApproved,
          createdAt: parseDate(entry.createdAt),
          updatedAt: parseDate(entry.updatedAt)
        }))
      });
    }

    if (backup.categories.length) {
      await tx.category.createMany({
        data: backup.categories.map((entry) => ({
          id: entry.id,
          tenantId,
          name: entry.name,
          description: entry.description,
          imageUrl: entry.imageUrl,
          isTodaySpecial: entry.isTodaySpecial ?? false,
          sortOrder: entry.sortOrder,
          isActive: entry.isActive,
          createdAt: parseDate(entry.createdAt)
        }))
      });
    }

    if (validMenuItems.length) {
      await tx.menuItem.createMany({
        data: validMenuItems.map((entry) => ({
          id: entry.id,
          tenantId,
          categoryId: entry.categoryId,
          name: entry.name,
          description: entry.description,
          image: entry.image,
          price: entry.price,
          stockQty: entry.stockQty,
          lowStockThreshold: entry.lowStockThreshold,
          isAvailable: entry.isAvailable,
          isTodaySpecial: entry.isTodaySpecial ?? false,
          prepTimeMinutes: entry.prepTimeMinutes,
          isVeg: entry.isVeg,
          createdAt: parseDate(entry.createdAt),
          updatedAt: parseDate(entry.updatedAt)
        }))
      });
    }

    if (backup.banners.length) {
      await tx.banner.createMany({
        data: backup.banners.map((entry) => ({
          id: entry.id,
          tenantId,
          title: entry.title,
          imageUrl: entry.imageUrl,
          actionUrl: entry.actionUrl,
          sortOrder: entry.sortOrder,
          isActive: entry.isActive,
          createdAt: parseDate(entry.createdAt),
          updatedAt: parseDate(entry.updatedAt)
        }))
      });
    }

    if (validCommunityPosts.length) {
      await tx.communityPost.createMany({
        data: validCommunityPosts.map((entry) => ({
          id: entry.id,
          tenantId,
          authorUserId: entry.authorUserId,
          title: entry.title,
          body: entry.body,
          mediaUrl: entry.mediaUrl,
          mediaType: entry.mediaType,
          isPinned: entry.isPinned,
          isVisible: entry.isVisible,
          createdAt: parseDate(entry.createdAt),
          updatedAt: parseDate(entry.updatedAt)
        }))
      });
    }

    if (validOrders.length) {
      await tx.order.createMany({
        data: validOrders.map((entry) => ({
          id: entry.id,
          tenantId,
          orderNumber: entry.orderNumber,
          userId: entry.userId,
          status: parseOrderStatus(entry.status),
          subtotal: entry.subtotal,
          taxAmount: entry.taxAmount,
          totalAmount: entry.totalAmount,
          paymentMethod: parsePaymentMethod(entry.paymentMethod),
          paymentStatus: parsePaymentStatus(entry.paymentStatus),
          createdAt: parseDate(entry.createdAt),
          updatedAt: parseDate(entry.updatedAt)
        }))
      });
    }

    if (validOrderItems.length) {
      await tx.orderItem.createMany({
        data: validOrderItems
      });
    }

    if (validStockMovements.length) {
      await tx.stockMovement.createMany({
        data: validStockMovements.map((entry) => ({
          id: entry.id,
          tenantId,
          menuItemId: entry.menuItemId,
          actorUserId: entry.actorUserId,
          changeType: parseStockMovementType(entry.changeType),
          delta: entry.delta,
          previousQty: entry.previousQty,
          newQty: entry.newQty,
          note: entry.note,
          createdAt: parseDate(entry.createdAt)
        }))
      });
    }
  });

  res.status(200).json({
    success: true,
    message: "Backup restored successfully",
    data: {
      restoredFrom: backupId,
      counts: {
        users: restoredUsers.length,
        categories: backup.categories.length,
        menuItems: validMenuItems.length,
        banners: backup.banners.length,
        communityPosts: validCommunityPosts.length,
        orders: validOrders.length,
        orderItems: validOrderItems.length,
        stockMovements: validStockMovements.length
      }
    }
  });
};

export const deleteBackup = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId as string;
  const backupId = assertBackupId(String(req.params.backupId ?? ""));
  const filePath = path.join(getTenantBackupDir(tenantId), backupId);

  try {
    await fs.unlink(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new AppError("Backup not found", 404);
    }
    throw error;
  }

  res.status(200).json({ success: true, message: "Backup deleted" });
};

export const downloadBackup = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId as string;
  const backupId = assertBackupId(String(req.params.backupId ?? ""));
  const requestedFormat = String(req.query.format ?? "zip").toLowerCase();
  const format = requestedFormat === "json" ? "json" : "zip";

  const filePath = path.join(getTenantBackupDir(tenantId), backupId);
  let raw: Buffer;
  let stat;
  try {
    [raw, stat] = await Promise.all([fs.readFile(filePath), fs.stat(filePath)]);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new AppError("Backup not found", 404);
    }
    throw error;
  }

  res.setHeader("Cache-Control", "no-store");

  if (format === "json") {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=\"${backupId}\"`);
    res.status(200).send(raw);
    return;
  }

  const zipEntryName = backupId;
  const archiveName = backupId.replace(/\.json$/i, ".zip");
  const zipBuffer = buildSingleFileZip(zipEntryName, raw, stat.mtime ?? new Date());
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename=\"${archiveName}\"`);
  res.status(200).send(zipBuffer);
};
