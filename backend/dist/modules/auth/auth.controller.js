import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import { prisma } from "../../config/database.js";
import { env } from "../../config/env.js";
import { firebaseAdmin } from "../../config/firebase.js";
import { redis } from "../../config/redis.js";
import { AppError } from "../../utils/appError.js";
const accessExpiresIn = env.jwtAccessTtl;
const refreshExpiresIn = env.jwtRefreshTtl;
const accessTokenFor = (user) => jwt.sign({ sub: user.id, role: user.role, tenantId: user.tenantId }, env.jwtAccessSecret, {
    expiresIn: accessExpiresIn
});
const refreshTokenFor = (user) => jwt.sign({ sub: user.id, role: user.role, tenantId: user.tenantId }, env.jwtRefreshSecret, {
    expiresIn: refreshExpiresIn
});
const otpKey = (tenantId, phone) => `otp:${tenantId}:${phone}`;
const otpVerifiedKey = (tenantId, phone) => `otp_verified:${tenantId}:${phone}`;
export const registerStudent = async (req, res) => {
    const { name, email, firebaseIdToken, password, rollNumber, tenantId } = req.body;
    if (!name || !email || !firebaseIdToken || !password || !tenantId || !rollNumber) {
        throw new AppError("name, email, firebaseIdToken, rollNumber, password, tenantId are required", 400);
    }
    let phone = "";
    try {
        const decodedToken = await firebaseAdmin.auth().verifyIdToken(firebaseIdToken);
        if (!decodedToken.phone_number) {
            throw new AppError("Firebase token does not contain a verified phone number", 400);
        }
        // phone_number usually comes with country code, e.g., +91...
        // You might want to parse/normalize it here, but we will store it as is for now.
        phone = decodedToken.phone_number;
    }
    catch (error) {
        throw new AppError("Invalid or expired Firebase ID token", 401);
    }
    const existing = await prisma.user.findFirst({
        where: {
            OR: [
                { tenantId, phone },
                { tenantId, email }
            ]
        }
    });
    if (existing) {
        throw new AppError("User already exists with this phone or email", 409);
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
        data: {
            tenantId,
            name,
            email,
            phone,
            passwordHash,
            rollNumber,
            role: Role.STUDENT,
            isApproved: true
        }
    });
    res.status(201).json({
        success: true,
        data: {
            user,
            accessToken: accessTokenFor(user),
            refreshToken: refreshTokenFor(user)
        }
    });
};
export const login = async (req, res) => {
    const { phone, rollNumber, password, isAdminLogin } = req.body;
    if (!phone || !password) {
        throw new AppError("phone and password are required", 400);
    }
    if (!isAdminLogin && !rollNumber) {
        throw new AppError("rollNumber is required for student login", 400);
    }
    let user;
    if (isAdminLogin) {
        user = await prisma.user.findFirst({
            where: {
                phone,
                role: { in: [Role.SUPER_ADMIN, Role.ADMIN, Role.STAFF, Role.TEACHER] }
            }
        });
    }
    else {
        user = await prisma.user.findFirst({
            where: {
                phone,
                rollNumber: rollNumber
            }
        });
    }
    if (!user) {
        throw new AppError("Invalid credentials", 401);
    }
    if (!user.isActive) {
        throw new AppError("Account is inactive", 403);
    }
    if ((user.role === Role.TEACHER || user.role === Role.STAFF) && !user.isApproved) {
        throw new AppError("Account pending admin approval", 403);
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
        throw new AppError("Invalid credentials", 401);
    }
    res.status(200).json({
        success: true,
        data: {
            user,
            accessToken: accessTokenFor(user),
            refreshToken: refreshTokenFor(user)
        }
    });
};
export const refreshToken = async (req, res) => {
    const { refreshToken: token } = req.body;
    if (!token) {
        throw new AppError("refreshToken is required", 400);
    }
    const payload = jwt.verify(token, env.jwtRefreshSecret);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
        throw new AppError("Invalid token", 401);
    }
    res.status(200).json({
        success: true,
        data: {
            accessToken: accessTokenFor(user)
        }
    });
};
export const forgotPassword = async (req, res) => {
    const { identifier, method } = req.body;
    if (!identifier || !method) {
        throw new AppError("identifier and method are required", 400);
    }
    if (method === "email") {
        // Check if user exists
        const user = await prisma.user.findFirst({ where: { email: identifier.trim() } });
        if (!user) {
            // Return 200 anyway to prevent email enumeration
            res.status(200).json({ success: true, message: "If this email exists, an OTP was sent." });
            return;
        }
        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        // Store in Redis with 10 minute TTL
        const redisKey = `password_reset_otp:${identifier.trim().toLowerCase()}`;
        await redis.setex(redisKey, 600, otp);
        // Mock sending email
        console.log(`\n\n==============================================`);
        console.log(`✉️ MOCK EMAIL SENT`);
        console.log(`To: ${identifier}`);
        console.log(`Subject: Password Reset OTP`);
        console.log(`OTP Code: ${otp}`);
        console.log(`==============================================\n\n`);
        res.status(200).json({ success: true, message: "If this email exists, an OTP was sent." });
        return;
    }
    else if (method === "phone") {
        // For phone, the client directly uses Firebase to get OTP
        res.status(200).json({ success: true, message: "Proceed with Firebase phone verification" });
        return;
    }
    throw new AppError("Invalid method", 400);
};
export const resetPassword = async (req, res) => {
    const { identifier, token, newPassword, method } = req.body;
    if (!identifier || !token || !newPassword || !method) {
        throw new AppError("identifier, token, newPassword, and method are required", 400);
    }
    let user;
    if (method === "email") {
        const redisKey = `password_reset_otp:${identifier.trim().toLowerCase()}`;
        const storedOtp = await redis.get(redisKey);
        if (!storedOtp || storedOtp !== token.trim()) {
            throw new AppError("Invalid or expired OTP", 400);
        }
        user = await prisma.user.findFirst({ where: { email: identifier.trim() } });
        if (!user) {
            throw new AppError("User not found", 404);
        }
        // OTP used, delete it
        await redis.del(redisKey);
    }
    else if (method === "phone") {
        try {
            const decodedToken = await firebaseAdmin.auth().verifyIdToken(token);
            // Ensure phone from token matches the requested identifier
            if (!decodedToken.phone_number || decodedToken.phone_number !== identifier.trim()) {
                throw new AppError("Phone number mismatch", 400);
            }
        }
        catch (error) {
            throw new AppError("Invalid or expired Firebase ID token", 401);
        }
        user = await prisma.user.findFirst({ where: { phone: identifier.trim() } });
        if (!user) {
            throw new AppError("User not found", 404);
        }
    }
    else {
        throw new AppError("Invalid method", 400);
    }
    // Update password
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash }
    });
    res.status(200).json({ success: true, message: "Password updated successfully" });
};
