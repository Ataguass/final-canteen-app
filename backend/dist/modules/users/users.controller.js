import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { prisma } from "../../config/database.js";
import { AppError } from "../../utils/appError.js";
const manageableRoles = [Role.TEACHER, Role.STAFF];
const bulkImportLimit = 200;
const parseManageableRole = (value) => {
    const normalized = (value ?? "").trim().toUpperCase();
    if (normalized === Role.TEACHER)
        return Role.TEACHER;
    if (normalized === Role.STAFF)
        return Role.STAFF;
    return null;
};
const toPublicUser = (user) => ({
    id: user.id,
    name: user.name,
    phone: user.phone,
    role: user.role,
    isActive: user.isActive,
    isApproved: user.isApproved,
    createdAt: user.createdAt
});
const toSelfUser = (user) => ({
    id: user.id,
    tenantId: user.tenantId,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    rollNumber: user.rollNumber,
    isActive: user.isActive,
    isApproved: user.isApproved,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
});
export const getMyProfile = async (req, res) => {
    const tenantId = req.tenantId;
    const userId = req.user?.sub;
    if (!userId) {
        throw new AppError("Unauthorized", 401);
    }
    const user = await prisma.user.findFirst({
        where: { id: userId, tenantId },
        select: {
            id: true,
            tenantId: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            rollNumber: true,
            isActive: true,
            isApproved: true,
            createdAt: true,
            updatedAt: true
        }
    });
    if (!user) {
        throw new AppError("User not found", 404);
    }
    res.status(200).json({ success: true, data: toSelfUser(user) });
};
export const updateMyProfile = async (req, res) => {
    const tenantId = req.tenantId;
    const userId = req.user?.sub;
    if (!userId) {
        throw new AppError("Unauthorized", 401);
    }
    const { name, phone, email, rollNumber } = req.body;
    if (name === undefined && phone === undefined && email === undefined && rollNumber === undefined) {
        throw new AppError("At least one field (name, phone, email, rollNumber) is required", 400);
    }
    const current = await prisma.user.findFirst({
        where: { id: userId, tenantId },
        select: {
            id: true,
            tenantId: true,
            name: true,
            email: true,
            phone: true,
            rollNumber: true
        }
    });
    if (!current) {
        throw new AppError("User not found", 404);
    }
    const nextName = name !== undefined ? name.trim() : current.name;
    const nextPhone = phone !== undefined ? phone.trim() : current.phone;
    const nextEmail = email !== undefined ? (email.trim() ? email.trim().toLowerCase() : null) : current.email;
    const nextRollNumber = rollNumber !== undefined ? (rollNumber.trim() ? rollNumber.trim() : null) : current.rollNumber;
    if (!nextName) {
        throw new AppError("name cannot be empty", 400);
    }
    if (!nextPhone) {
        throw new AppError("phone cannot be empty", 400);
    }
    const phoneConflict = await prisma.user.findFirst({
        where: { tenantId, phone: nextPhone, id: { not: userId } },
        select: { id: true }
    });
    if (phoneConflict) {
        throw new AppError("User already exists with this phone", 409);
    }
    if (nextEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
        throw new AppError("Invalid email format", 400);
    }
    if (nextEmail) {
        const emailConflict = await prisma.user.findFirst({
            where: { tenantId, email: nextEmail, id: { not: userId } },
            select: { id: true }
        });
        if (emailConflict) {
            throw new AppError("User already exists with this email", 409);
        }
    }
    if (nextRollNumber) {
        const rollConflict = await prisma.user.findFirst({
            where: { tenantId, rollNumber: nextRollNumber, id: { not: userId } },
            select: { id: true }
        });
        if (rollConflict) {
            throw new AppError("Roll number already exists", 409);
        }
    }
    const updated = await prisma.user.update({
        where: { id: userId },
        data: {
            name: nextName,
            phone: nextPhone,
            email: nextEmail,
            rollNumber: nextRollNumber
        },
        select: {
            id: true,
            tenantId: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            rollNumber: true,
            isActive: true,
            isApproved: true,
            createdAt: true,
            updatedAt: true
        }
    });
    res.status(200).json({ success: true, data: toSelfUser(updated) });
};
export const updateMyPassword = async (req, res) => {
    const tenantId = req.tenantId;
    const userId = req.user?.sub;
    if (!userId) {
        throw new AppError("Unauthorized", 401);
    }
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
        throw new AppError("currentPassword and newPassword are required", 400);
    }
    if (newPassword.trim().length < 6) {
        throw new AppError("newPassword must be at least 6 characters", 400);
    }
    const user = await prisma.user.findFirst({
        where: { id: userId, tenantId },
        select: { id: true, passwordHash: true }
    });
    if (!user) {
        throw new AppError("User not found", 404);
    }
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
        throw new AppError("Current password is incorrect", 401);
    }
    const passwordHash = await bcrypt.hash(newPassword.trim(), 10);
    await prisma.user.update({
        where: { id: userId },
        data: { passwordHash }
    });
    res.status(200).json({ success: true, message: "Password updated successfully" });
};
export const updatePushToken = async (req, res) => {
    const tenantId = req.tenantId;
    const userId = req.user?.sub;
    if (!userId) {
        throw new AppError("Unauthorized", 401);
    }
    const { pushToken } = req.body;
    // pushToken can be null if user revokes permission
    await prisma.user.update({
        where: { id: userId, tenantId },
        data: { pushToken: pushToken || null }
    });
    res.status(200).json({ success: true, message: "Push token updated successfully" });
};
export const listUsers = async (req, res) => {
    const tenantId = req.tenantId;
    const users = await prisma.user.findMany({
        where: { tenantId, role: { in: manageableRoles } },
        orderBy: { createdAt: "desc" },
        select: {
            id: true,
            name: true,
            phone: true,
            role: true,
            isActive: true,
            isApproved: true,
            createdAt: true
        }
    });
    res.status(200).json({ success: true, data: users.map(toPublicUser) });
};
export const createUser = async (req, res) => {
    const tenantId = req.tenantId;
    const { name, phone, password, role, isApproved = true } = req.body;
    if (!name || !phone || !password || !role) {
        throw new AppError("name, phone, password and role are required", 400);
    }
    if (role !== Role.TEACHER && role !== Role.STAFF) {
        throw new AppError("Only TEACHER or STAFF can be created from this screen", 400);
    }
    const existing = await prisma.user.findFirst({ where: { tenantId, phone } });
    if (existing) {
        throw new AppError("User already exists with this phone", 409);
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
        data: {
            tenantId,
            name: name.trim(),
            phone: phone.trim(),
            passwordHash,
            role,
            isApproved: Boolean(isApproved),
            isActive: true
        },
        select: {
            id: true,
            name: true,
            phone: true,
            role: true,
            isActive: true,
            isApproved: true,
            createdAt: true
        }
    });
    res.status(201).json({ success: true, data: toPublicUser(user) });
};
export const bulkImportUsers = async (req, res) => {
    const tenantId = req.tenantId;
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
        throw new AppError("rows array is required", 400);
    }
    if (rows.length > bulkImportLimit) {
        throw new AppError(`Maximum ${bulkImportLimit} rows allowed per import`, 400);
    }
    const errors = [];
    const prepared = [];
    const inputPhoneSet = new Set();
    rows.forEach((entry, index) => {
        const rowNumber = index + 1;
        const name = (entry.name ?? "").trim();
        const phone = (entry.phone ?? "").trim();
        const password = (entry.password ?? "").trim();
        const role = parseManageableRole(entry.role);
        const isApproved = typeof entry.isApproved === "boolean" ? entry.isApproved : true;
        if (!name) {
            errors.push({ rowNumber, phone: phone || null, reason: "Name is required" });
            return;
        }
        if (!phone) {
            errors.push({ rowNumber, phone: null, reason: "Phone is required" });
            return;
        }
        if (inputPhoneSet.has(phone)) {
            errors.push({ rowNumber, phone, reason: "Duplicate phone in import file" });
            return;
        }
        inputPhoneSet.add(phone);
        if (!password || password.length < 6) {
            errors.push({ rowNumber, phone, reason: "Password must be at least 6 characters" });
            return;
        }
        if (!role) {
            errors.push({ rowNumber, phone, reason: "Role must be TEACHER or STAFF" });
            return;
        }
        prepared.push({ rowNumber, name, phone, password, role, isApproved });
    });
    const existingUsers = prepared.length
        ? await prisma.user.findMany({
            where: { tenantId, phone: { in: prepared.map((item) => item.phone) } },
            select: { phone: true }
        })
        : [];
    const existingPhoneSet = new Set(existingUsers.map((item) => item.phone).filter(Boolean));
    const createdUsers = [];
    for (const row of prepared) {
        if (existingPhoneSet.has(row.phone)) {
            errors.push({ rowNumber: row.rowNumber, phone: row.phone, reason: "User already exists with this phone" });
            continue;
        }
        try {
            const passwordHash = await bcrypt.hash(row.password, 10);
            const created = await prisma.user.create({
                data: {
                    tenantId,
                    name: row.name,
                    phone: row.phone,
                    passwordHash,
                    role: row.role,
                    isApproved: row.isApproved,
                    isActive: true
                },
                select: {
                    id: true,
                    name: true,
                    phone: true,
                    role: true,
                    isActive: true,
                    isApproved: true,
                    createdAt: true
                }
            });
            createdUsers.push(toPublicUser(created));
        }
        catch (error) {
            const reason = error instanceof Error ? error.message : "Failed to create user";
            errors.push({ rowNumber: row.rowNumber, phone: row.phone, reason });
        }
    }
    res.status(201).json({
        success: true,
        data: {
            totalRows: rows.length,
            createdCount: createdUsers.length,
            failedCount: errors.length,
            skippedCount: Math.max(0, rows.length - createdUsers.length - errors.length),
            createdUsers,
            errors: errors.sort((a, b) => a.rowNumber - b.rowNumber)
        }
    });
};
export const updateUserApproval = async (req, res) => {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const { isApproved } = req.body;
    if (typeof isApproved !== "boolean") {
        throw new AppError("isApproved boolean is required", 400);
    }
    const user = await prisma.user.findFirst({
        where: { id, tenantId, role: { in: manageableRoles } }
    });
    if (!user) {
        throw new AppError("User not found", 404);
    }
    const updated = await prisma.user.update({
        where: { id },
        data: { isApproved },
        select: {
            id: true,
            name: true,
            phone: true,
            role: true,
            isActive: true,
            isApproved: true,
            createdAt: true
        }
    });
    res.status(200).json({ success: true, data: toPublicUser(updated) });
};
export const updateUserActive = async (req, res) => {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const { isActive } = req.body;
    if (typeof isActive !== "boolean") {
        throw new AppError("isActive boolean is required", 400);
    }
    const user = await prisma.user.findFirst({
        where: { id, tenantId, role: { in: manageableRoles } }
    });
    if (!user) {
        throw new AppError("User not found", 404);
    }
    const updated = await prisma.user.update({
        where: { id },
        data: { isActive },
        select: {
            id: true,
            name: true,
            phone: true,
            role: true,
            isActive: true,
            isApproved: true,
            createdAt: true
        }
    });
    res.status(200).json({ success: true, data: toPublicUser(updated) });
};
export const updateUserPassword = async (req, res) => {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const { password } = req.body;
    if (!password || password.trim().length < 6) {
        throw new AppError("password with minimum 6 characters is required", 400);
    }
    const user = await prisma.user.findFirst({
        where: { id, tenantId, role: { in: manageableRoles } }
    });
    if (!user) {
        throw new AppError("User not found", 404);
    }
    const passwordHash = await bcrypt.hash(password.trim(), 10);
    const updated = await prisma.user.update({
        where: { id },
        data: { passwordHash },
        select: {
            id: true,
            name: true,
            phone: true,
            role: true,
            isActive: true,
            isApproved: true,
            createdAt: true
        }
    });
    res.status(200).json({ success: true, data: toPublicUser(updated) });
};
export const topupUserWallet = async (req, res) => {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const { amount, note } = req.body;
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        throw new AppError("amount must be a valid number greater than 0", 400);
    }
    if (numericAmount > 50000) {
        throw new AppError("Top-up limit is ₹50,000 per transaction", 400);
    }
    const user = await prisma.user.findFirst({
        where: { id, tenantId, role: { in: manageableRoles } },
        select: { id: true, name: true, walletBalance: true, isActive: true, isApproved: true }
    });
    if (!user)
        throw new AppError("User not found", 404);
    if (!user.isActive || !user.isApproved)
        throw new AppError("User is inactive or unapproved", 403);
    const topup = Number(numericAmount.toFixed(2));
    const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.user.update({
            where: { id },
            data: { walletBalance: { increment: topup } },
            select: { walletBalance: true }
        });
        await tx.walletTransaction.create({
            data: {
                tenantId,
                userId: id,
                amount: topup,
                balanceAfter: updated.walletBalance,
                type: "TOPUP",
                note: note?.trim() || `Admin top-up of ₹${topup}`
            }
        });
        return { balance: updated.walletBalance };
    });
    res.status(200).json({ success: true, data: { userId: id, name: user.name, ...result } });
};
export const getUserWalletBalance = async (req, res) => {
    const tenantId = req.tenantId;
    const users = await prisma.user.findMany({
        where: { tenantId, role: { in: manageableRoles }, isActive: true },
        select: { id: true, name: true, phone: true, role: true, walletBalance: true },
        orderBy: { name: "asc" }
    });
    res.status(200).json({ success: true, data: users });
};
