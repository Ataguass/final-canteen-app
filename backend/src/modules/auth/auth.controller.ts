import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Request, Response } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../../config/database.js";
import { env } from "../../config/env.js";
import { redis } from "../../config/redis.js";
import { AppError } from "../../utils/appError.js";

const accessExpiresIn = env.jwtAccessTtl as jwt.SignOptions["expiresIn"];
const refreshExpiresIn = env.jwtRefreshTtl as jwt.SignOptions["expiresIn"];

const accessTokenFor = (user: { id: string; role: Role; tenantId: string }): string =>
  jwt.sign({ sub: user.id, role: user.role, tenantId: user.tenantId }, env.jwtAccessSecret, {
    expiresIn: accessExpiresIn
  });

const refreshTokenFor = (user: { id: string; role: Role; tenantId: string }): string =>
  jwt.sign({ sub: user.id, role: user.role, tenantId: user.tenantId }, env.jwtRefreshSecret, {
    expiresIn: refreshExpiresIn
  });

const otpKey = (tenantId: string, phone: string): string => `otp:${tenantId}:${phone}`;
const otpVerifiedKey = (tenantId: string, phone: string): string => `otp_verified:${tenantId}:${phone}`;

export const requestOtp = async (req: Request, res: Response): Promise<void> => {
  const { tenantId, phone } = req.body as { tenantId: string; phone: string };

  if (!tenantId || !phone) {
    throw new AppError("tenantId and phone are required", 400);
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    throw new AppError("Tenant not found", 404);
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  await redis.set(otpKey(tenantId, phone), code, "EX", env.otpTtlSeconds);

  res.status(200).json({
    success: true,
    message: "OTP sent",
    data: {
      expiresIn: env.otpTtlSeconds,
      // Keep dev OTP visible for testing until SMS provider is integrated.
      ...(env.nodeEnv === "development" ? { code } : {})
    }
  });
};

export const verifyOtp = async (req: Request, res: Response): Promise<void> => {
  const { tenantId, phone, code } = req.body as { tenantId: string; phone: string; code: string };

  if (!tenantId || !phone || !code) {
    throw new AppError("tenantId, phone and code are required", 400);
  }

  const stored = await redis.get(otpKey(tenantId, phone));
  if (!stored || stored !== code) {
    throw new AppError("Invalid or expired OTP", 401);
  }

  await redis.del(otpKey(tenantId, phone));
  await redis.set(otpVerifiedKey(tenantId, phone), "1", "EX", 600);

  res.status(200).json({ success: true, message: "OTP verified" });
};

export const registerStudent = async (req: Request, res: Response): Promise<void> => {
  const { name, phone, password, rollNumber, tenantId } = req.body as {
    name: string;
    phone: string;
    password: string;
    rollNumber?: string;
    tenantId: string;
  };

  if (!name || !phone || !password || !tenantId) {
    throw new AppError("name, phone, password, tenantId are required", 400);
  }

  const otpVerified = await redis.get(otpVerifiedKey(tenantId, phone));
  if (!otpVerified) {
    throw new AppError("OTP verification required", 401);
  }

  const existing = await prisma.user.findFirst({ where: { tenantId, phone } });
  if (existing) {
    throw new AppError("User already exists with this phone", 409);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      tenantId,
      name,
      phone,
      passwordHash,
      rollNumber,
      role: Role.STUDENT,
      isApproved: true
    }
  });

  await redis.del(otpVerifiedKey(tenantId, phone));

  res.status(201).json({
    success: true,
    data: {
      user,
      accessToken: accessTokenFor(user),
      refreshToken: refreshTokenFor(user)
    }
  });
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const { tenantId, phone, email, password } = req.body as {
    tenantId: string;
    phone?: string;
    email?: string;
    password: string;
  };

  if (!tenantId || !password || (!phone && !email)) {
    throw new AppError("tenantId and password with phone/email are required", 400);
  }

  const user = await prisma.user.findFirst({
    where: {
      tenantId,
      ...(phone ? { phone } : { email })
    }
  });

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

export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  const { refreshToken: token } = req.body as { refreshToken: string };
  if (!token) {
    throw new AppError("refreshToken is required", 400);
  }

  const payload = jwt.verify(token, env.jwtRefreshSecret) as {
    sub: string;
    role: Role;
    tenantId: string;
  };

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
