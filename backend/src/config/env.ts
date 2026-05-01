import dotenv from "dotenv";

dotenv.config();

const getEnv = (key: string, fallback?: string): string => {
  const value = process.env[key] ?? fallback;
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
};

const getOptionalEnv = (key: string): string | undefined => {
  const value = process.env[key];
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(getEnv("PORT", "4000")),
  databaseUrl: getEnv("DATABASE_URL"),
  redisUrl: getEnv("REDIS_URL"),
  invoiceLogoMaxBytes: Number(getEnv("INVOICE_LOGO_MAX_BYTES", "1048576")),
  bannerImageMaxBytes: Number(getEnv("BANNER_IMAGE_MAX_BYTES", "2097152")),
  menuImageMaxBytes: Number(getEnv("MENU_IMAGE_MAX_BYTES", "2097152")),
  communityImageMaxBytes: Number(getEnv("COMMUNITY_IMAGE_MAX_BYTES", "2097152")),
  communityVideoMaxBytes: Number(getEnv("COMMUNITY_VIDEO_MAX_BYTES", "15728640")),
  cloudinaryCloudName: getOptionalEnv("CLOUDINARY_CLOUD_NAME"),
  cloudinaryApiKey: getOptionalEnv("CLOUDINARY_API_KEY"),
  cloudinaryApiSecret: getOptionalEnv("CLOUDINARY_API_SECRET"),
  cloudinaryFolder: getOptionalEnv("CLOUDINARY_FOLDER") ?? "canteen",
  jwtAccessSecret: getEnv("JWT_ACCESS_SECRET"),
  jwtRefreshSecret: getEnv("JWT_REFRESH_SECRET"),
  jwtAccessTtl: getEnv("JWT_ACCESS_TTL", "15m"),
  jwtRefreshTtl: getEnv("JWT_REFRESH_TTL", "7d"),
  otpTtlSeconds: Number(getEnv("OTP_TTL_SECONDS", "300")),
  superAdminBootstrapKey: getEnv("SUPER_ADMIN_BOOTSTRAP_KEY", "change_me_bootstrap_key")
};
