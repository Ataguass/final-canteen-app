import { Role, WalletTransactionType } from "@prisma/client";
import { prisma } from "../../config/database.js";
import { AppError } from "../../utils/appError.js";
const topupEligibleRoles = new Set([Role.TEACHER, Role.STAFF]);
export const getMyWallet = async (req, res) => {
    const tenantId = req.tenantId;
    const userId = req.user?.sub;
    if (!userId) {
        throw new AppError("Unauthorized", 401);
    }
    const user = await prisma.user.findFirst({
        where: { id: userId, tenantId },
        select: { id: true, role: true, walletBalance: true }
    });
    if (!user) {
        throw new AppError("User not found", 404);
    }
    const transactions = await prisma.walletTransaction.findMany({
        where: { tenantId, userId },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
            id: true,
            amount: true,
            balanceAfter: true,
            type: true,
            note: true,
            reference: true,
            orderId: true,
            createdAt: true
        }
    });
    res.status(200).json({
        success: true,
        data: {
            userId: user.id,
            role: user.role,
            balance: user.walletBalance,
            transactions
        }
    });
};
export const topupMyWallet = async (req, res) => {
    const tenantId = req.tenantId;
    const userId = req.user?.sub;
    if (!userId) {
        throw new AppError("Unauthorized", 401);
    }
    const { amount, upiReference, note } = req.body;
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        throw new AppError("amount must be a valid number greater than 0", 400);
    }
    if (numericAmount > 50000) {
        throw new AppError("Top-up limit is 50000 per transaction", 400);
    }
    const user = await prisma.user.findFirst({
        where: { id: userId, tenantId },
        select: { id: true, role: true, isActive: true, isApproved: true, walletBalance: true }
    });
    if (!user) {
        throw new AppError("User not found", 404);
    }
    if (!user.isActive || !user.isApproved) {
        throw new AppError("Only active and approved users can top up wallet", 403);
    }
    if (!topupEligibleRoles.has(user.role)) {
        throw new AppError("Wallet top-up via UPI is enabled for teacher/staff accounts only", 403);
    }
    const cleanedReference = upiReference?.trim() || null;
    if (cleanedReference && cleanedReference.length > 64) {
        throw new AppError("upiReference is too long", 400);
    }
    const cleanedNote = note?.trim() || "Wallet top-up via UPI";
    const topup = Number(numericAmount.toFixed(2));
    const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.user.update({
            where: { id: user.id },
            data: { walletBalance: { increment: topup } },
            select: { walletBalance: true }
        });
        const transaction = await tx.walletTransaction.create({
            data: {
                tenantId,
                userId: user.id,
                amount: topup,
                balanceAfter: updated.walletBalance,
                type: WalletTransactionType.TOPUP,
                note: cleanedNote,
                reference: cleanedReference
            },
            select: {
                id: true,
                amount: true,
                balanceAfter: true,
                type: true,
                note: true,
                reference: true,
                orderId: true,
                createdAt: true
            }
        });
        return { balance: updated.walletBalance, transaction };
    });
    res.status(201).json({
        success: true,
        data: result
    });
};
