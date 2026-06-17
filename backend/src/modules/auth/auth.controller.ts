import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Request, Response } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../../config/database.js";
import { env } from "../../config/env.js";
import { firebaseAdmin } from "../../config/firebase.js";
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



export const registerStudent = async (req: Request, res: Response): Promise<void> => {
  const { name, email, firebaseIdToken, password, rollNumber, tenantId } = req.body as {
    name: string;
    email: string;
    firebaseIdToken: string;
    password: string;
    rollNumber?: string;
    tenantId: string;
  };

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
  } catch (error) {
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

export const login = async (req: Request, res: Response): Promise<void> => {
  const { phone, rollNumber, password, isAdminLogin } = req.body as {
    phone: string;
    rollNumber?: string;
    password: string;
    isAdminLogin?: boolean;
  };

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
  } else {
    user = await prisma.user.findFirst({
      where: {
        phone,
        rollNumber: rollNumber!
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
