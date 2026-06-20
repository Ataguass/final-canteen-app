import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { prisma } from "../../config/database.js";
import { env } from "../../config/env.js";
import { uploadStringToCloudinary } from "../../utils/cloudinary.js";
import { AppError } from "../../utils/appError.js";
const normalizeSchoolCode = (value) => value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "");
const randomSchoolCode = () => `SCH${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
const INVOICE_LOGO_ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);
const INVOICE_SETTINGS_SELECT = {
    id: true,
    name: true,
    logo: true,
    invoiceLogoUrl: true,
    invoiceShowLogo: true,
    invoiceShowSchoolName: true,
    invoiceShowOrderNumber: true,
    invoiceShowDate: true,
    invoiceShowCashier: true,
    invoiceShowPaymentDetails: true,
    invoiceShowTaxBreakup: true,
    invoiceShowNotes: true,
    invoiceFooterNote: true
};
const FEATURE_SETTINGS_SELECT = {
    id: true,
    name: true,
    todaySpecialsEnabled: true
};
const parseBase64ImageDataUrl = (dataUrl) => {
    const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\r\n]+)$/);
    if (!match) {
        return null;
    }
    return {
        mimeType: match[1].toLowerCase(),
        base64: match[2].replace(/\s+/g, "")
    };
};
const ensureUniqueSchoolCode = async (requested) => {
    if (requested) {
        const normalized = normalizeSchoolCode(requested);
        if (!normalized) {
            throw new AppError("schoolCode must contain alphanumeric characters", 400);
        }
        const existing = await prisma.tenant.findUnique({ where: { schoolCode: normalized } });
        if (existing) {
            throw new AppError("School code already exists", 409);
        }
        return normalized;
    }
    for (let attempt = 0; attempt < 10; attempt += 1) {
        const generated = randomSchoolCode();
        const existing = await prisma.tenant.findUnique({ where: { schoolCode: generated } });
        if (!existing) {
            return generated;
        }
    }
    throw new AppError("Failed to generate unique school code", 500);
};
export const createTenant = async (req, res) => {
    const platformKey = req.header("x-platform-key");
    if (platformKey !== env.superAdminBootstrapKey) {
        throw new AppError("Invalid platform key", 401);
    }
    const { name, slug, schoolCode, adminName, adminPhone, adminPassword } = req.body;
    if (!name || !slug || !adminName || !adminPhone || !adminPassword) {
        throw new AppError("name, slug, adminName, adminPhone, adminPassword are required", 400);
    }
    const existing = await prisma.tenant.findUnique({ where: { slug } });
    if (existing) {
        throw new AppError("Tenant slug already exists", 409);
    }
    const finalSchoolCode = await ensureUniqueSchoolCode(schoolCode);
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    const tenant = await prisma.tenant.create({
        data: {
            name,
            slug,
            schoolCode: finalSchoolCode,
            users: {
                create: {
                    name: adminName,
                    phone: adminPhone,
                    passwordHash,
                    role: Role.ADMIN,
                    isApproved: true
                }
            }
        },
        include: {
            users: {
                select: {
                    id: true,
                    name: true,
                    phone: true,
                    role: true
                }
            }
        }
    });
    res.status(201).json({ success: true, data: tenant });
};
export const createTenantFromDashboard = async (req, res) => {
    const { name, slug, schoolCode, adminName, adminPhone, adminPassword } = req.body;
    if (!name || !slug || !adminName || !adminPhone || !adminPassword) {
        throw new AppError("name, slug, adminName, adminPhone, adminPassword are required", 400);
    }
    const existing = await prisma.tenant.findUnique({ where: { slug } });
    if (existing) {
        throw new AppError("Tenant slug already exists", 409);
    }
    const finalSchoolCode = await ensureUniqueSchoolCode(schoolCode);
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    const tenant = await prisma.tenant.create({
        data: {
            name,
            slug,
            schoolCode: finalSchoolCode,
            users: {
                create: {
                    name: adminName,
                    phone: adminPhone,
                    passwordHash,
                    role: Role.ADMIN,
                    isApproved: true
                }
            }
        },
        include: {
            users: {
                select: {
                    id: true,
                    name: true,
                    phone: true,
                    role: true
                }
            }
        }
    });
    res.status(201).json({ success: true, data: tenant });
};
export const createTenantAdmin = async (req, res) => {
    const { name, slug, schoolCode, adminName, adminPhone, adminPassword } = req.body;
    if (!name || !slug || !adminName || !adminPhone || !adminPassword) {
        throw new AppError("name, slug, adminName, adminPhone, adminPassword are required", 400);
    }
    const existing = await prisma.tenant.findUnique({ where: { slug } });
    if (existing) {
        throw new AppError("Tenant slug already exists", 409);
    }
    const finalSchoolCode = await ensureUniqueSchoolCode(schoolCode);
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    const tenant = await prisma.tenant.create({
        data: {
            name,
            slug,
            schoolCode: finalSchoolCode,
            users: {
                create: {
                    name: adminName,
                    phone: adminPhone,
                    passwordHash,
                    role: Role.ADMIN,
                    isApproved: true
                }
            }
        },
        include: {
            users: {
                select: {
                    id: true,
                    name: true,
                    phone: true,
                    role: true
                }
            }
        }
    });
    res.status(201).json({ success: true, data: tenant });
};
export const listTenants = async (req, res) => {
    const tenants = await prisma.tenant.findMany({
        where: { slug: { not: "main" } },
        orderBy: { createdAt: "desc" },
        select: {
            id: true,
            name: true,
            slug: true,
            schoolCode: true,
            primaryColor: true,
            currency: true,
            taxPercent: true,
            createdAt: true,
            users: {
                where: { role: "ADMIN" },
                select: {
                    id: true,
                    name: true,
                    phone: true,
                    isActive: true
                }
            }
        }
    });
    res.status(200).json({ success: true, data: tenants });
};
export const resolveTenant = async (req, res) => {
    const codeRaw = String(req.query.code ?? "").trim();
    if (!codeRaw) {
        throw new AppError("code query param is required", 400);
    }
    const normalized = normalizeSchoolCode(codeRaw);
    const tenant = await prisma.tenant.findFirst({
        where: {
            slug: { not: "main" },
            OR: [
                { schoolCode: normalized || "__NO_MATCH__" },
                { slug: { equals: codeRaw.toLowerCase(), mode: "insensitive" } }
            ]
        },
        select: {
            id: true,
            name: true,
            slug: true,
            schoolCode: true,
            primaryColor: true,
            currency: true
        }
    });
    if (!tenant) {
        throw new AppError("Tenant not found", 404);
    }
    res.status(200).json({ success: true, data: tenant });
};
export const getInvoiceSettings = async (req, res) => {
    const tenantId = req.tenantId;
    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: INVOICE_SETTINGS_SELECT
    });
    if (!tenant) {
        throw new AppError("Tenant not found", 404);
    }
    res.status(200).json({ success: true, data: tenant });
};
export const updateInvoiceSettings = async (req, res) => {
    const tenantId = req.tenantId;
    const { invoiceLogoUrl, invoiceShowLogo, invoiceShowSchoolName, invoiceShowOrderNumber, invoiceShowDate, invoiceShowCashier, invoiceShowPaymentDetails, invoiceShowTaxBreakup, invoiceShowNotes, invoiceFooterNote } = req.body;
    const updated = await prisma.tenant.update({
        where: { id: tenantId },
        data: {
            invoiceLogoUrl: invoiceLogoUrl === undefined ? undefined : invoiceLogoUrl?.trim() ? invoiceLogoUrl.trim() : null,
            invoiceShowLogo,
            invoiceShowSchoolName,
            invoiceShowOrderNumber,
            invoiceShowDate,
            invoiceShowCashier,
            invoiceShowPaymentDetails,
            invoiceShowTaxBreakup,
            invoiceShowNotes,
            invoiceFooterNote: invoiceFooterNote === undefined
                ? undefined
                : invoiceFooterNote?.trim()
                    ? invoiceFooterNote.trim()
                    : null
        },
        select: INVOICE_SETTINGS_SELECT
    });
    res.status(200).json({ success: true, data: updated });
};
export const uploadInvoiceLogo = async (req, res) => {
    const tenantId = req.tenantId;
    const { dataUrl } = req.body;
    if (!dataUrl || typeof dataUrl !== "string") {
        throw new AppError("dataUrl is required", 400);
    }
    const parsed = parseBase64ImageDataUrl(dataUrl.trim());
    if (!parsed || !INVOICE_LOGO_ALLOWED_MIME.has(parsed.mimeType)) {
        throw new AppError("Invalid image type. Allowed: PNG, JPG, JPEG, WEBP", 400);
    }
    let imageBuffer;
    try {
        imageBuffer = Buffer.from(parsed.base64, "base64");
    }
    catch {
        throw new AppError("Invalid base64 image data", 400);
    }
    if (!imageBuffer.length) {
        throw new AppError("Image file is empty", 400);
    }
    if (imageBuffer.byteLength > env.invoiceLogoMaxBytes) {
        throw new AppError(`Image too large. Max ${(env.invoiceLogoMaxBytes / (1024 * 1024)).toFixed(2)} MB`, 400);
    }
    const upload = await uploadStringToCloudinary({
        file: dataUrl.trim(),
        resourceType: "image",
        folder: `tenants/${tenantId}`,
        publicId: "invoice-logo",
        overwrite: true
    });
    const updated = await prisma.tenant.update({
        where: { id: tenantId },
        data: { invoiceLogoUrl: upload.secureUrl, invoiceShowLogo: true },
        select: INVOICE_SETTINGS_SELECT
    });
    res.status(200).json({ success: true, data: updated });
};
export const removeInvoiceLogo = async (req, res) => {
    const tenantId = req.tenantId;
    const updated = await prisma.tenant.update({
        where: { id: tenantId },
        data: { invoiceLogoUrl: null },
        select: INVOICE_SETTINGS_SELECT
    });
    res.status(200).json({ success: true, data: updated });
};
export const getFeatureSettings = async (req, res) => {
    const tenantId = req.tenantId;
    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: FEATURE_SETTINGS_SELECT
    });
    if (!tenant) {
        throw new AppError("Tenant not found", 404);
    }
    res.status(200).json({ success: true, data: tenant });
};
export const updateFeatureSettings = async (req, res) => {
    const tenantId = req.tenantId;
    const { todaySpecialsEnabled } = req.body;
    const updated = await prisma.tenant.update({
        where: { id: tenantId },
        data: {
            todaySpecialsEnabled
        },
        select: FEATURE_SETTINGS_SELECT
    });
    res.status(200).json({ success: true, data: updated });
};
export const getGlobalStats = async (req, res) => {
    const totalSchools = await prisma.tenant.count({
        where: { slug: { not: "main" } }
    });
    const totalAdmins = await prisma.user.count({
        where: { role: Role.ADMIN }
    });
    const totalStudents = await prisma.user.count({
        where: { role: Role.STUDENT }
    });
    // Calculate total revenue across all completed orders across all tenants
    const aggregateResult = await prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: { status: "COMPLETED" }
    });
    res.status(200).json({
        success: true,
        data: {
            totalSchools,
            totalAdmins,
            totalStudents,
            totalRevenue: aggregateResult._sum.totalAmount || 0
        }
    });
};
