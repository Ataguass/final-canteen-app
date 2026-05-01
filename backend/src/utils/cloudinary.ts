import { env } from "../config/env.js";
import { AppError } from "./appError.js";

type CloudinaryResourceType = "image" | "video" | "raw";

type UploadStringInput = {
  file: string;
  resourceType?: CloudinaryResourceType;
  folder?: string;
  publicId?: string;
  overwrite?: boolean;
};

type UploadBufferInput = {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  resourceType?: CloudinaryResourceType;
  folder?: string;
  publicId?: string;
  overwrite?: boolean;
};

type CloudinaryUploadResponse = {
  secure_url?: string;
  public_id?: string;
  error?: { message?: string };
};

const normalizeFolderSegment = (value: string): string =>
  value
    .trim()
    .replace(/\\/g, "/")
    .replace(/\/{2,}/g, "/")
    .replace(/^\/+|\/+$/g, "");

const getCloudinaryConfig = (): { cloudName: string; apiKey: string; apiSecret: string } => {
  const cloudName = env.cloudinaryCloudName;
  const apiKey = env.cloudinaryApiKey;
  const apiSecret = env.cloudinaryApiSecret;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new AppError(
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.",
      500
    );
  }
  return { cloudName, apiKey, apiSecret };
};

const getAuthHeader = (apiKey: string, apiSecret: string): string =>
  `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}`;

const buildFolder = (folder?: string): string | undefined => {
  const base = normalizeFolderSegment(env.cloudinaryFolder);
  const target = folder ? normalizeFolderSegment(folder) : "";
  const combined = [base, target].filter(Boolean).join("/");
  return combined || undefined;
};

const uploadForm = async (
  form: FormData,
  resourceType: CloudinaryResourceType
): Promise<{ secureUrl: string; publicId: string }> => {
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
    {
      method: "POST",
      headers: {
        Authorization: getAuthHeader(apiKey, apiSecret)
      },
      body: form
    }
  );

  const json = (await response.json().catch(() => ({}))) as CloudinaryUploadResponse;
  if (!response.ok || !json.secure_url || !json.public_id) {
    throw new AppError(json.error?.message ?? "Cloudinary upload failed", response.status || 500);
  }

  return { secureUrl: json.secure_url, publicId: json.public_id };
};

const applyCommonParams = (
  form: FormData,
  options: {
    folder?: string;
    publicId?: string;
    overwrite?: boolean;
  }
): void => {
  const folder = buildFolder(options.folder);
  if (folder) {
    form.append("folder", folder);
  }
  if (options.publicId?.trim()) {
    form.append("public_id", options.publicId.trim());
  }
  if (options.overwrite !== undefined) {
    form.append("overwrite", options.overwrite ? "true" : "false");
  }
};

export const uploadStringToCloudinary = async (
  input: UploadStringInput
): Promise<{ secureUrl: string; publicId: string }> => {
  const form = new FormData();
  form.append("file", input.file);
  applyCommonParams(form, input);
  return uploadForm(form, input.resourceType ?? "image");
};

export const uploadBufferToCloudinary = async (
  input: UploadBufferInput
): Promise<{ secureUrl: string; publicId: string }> => {
  const form = new FormData();
  form.append("file", new Blob([input.buffer], { type: input.mimeType }), input.fileName);
  applyCommonParams(form, input);
  return uploadForm(form, input.resourceType ?? "image");
};

