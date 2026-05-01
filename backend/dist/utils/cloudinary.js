import { env } from "../config/env.js";
import { AppError } from "./appError.js";
const normalizeFolderSegment = (value) => value
    .trim()
    .replace(/\\/g, "/")
    .replace(/\/{2,}/g, "/")
    .replace(/^\/+|\/+$/g, "");
const getCloudinaryConfig = () => {
    const cloudName = env.cloudinaryCloudName;
    const apiKey = env.cloudinaryApiKey;
    const apiSecret = env.cloudinaryApiSecret;
    if (!cloudName || !apiKey || !apiSecret) {
        throw new AppError("Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.", 500);
    }
    return { cloudName, apiKey, apiSecret };
};
const getAuthHeader = (apiKey, apiSecret) => `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}`;
const buildFolder = (folder) => {
    const base = normalizeFolderSegment(env.cloudinaryFolder);
    const target = folder ? normalizeFolderSegment(folder) : "";
    const combined = [base, target].filter(Boolean).join("/");
    return combined || undefined;
};
const uploadForm = async (form, resourceType) => {
    const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
        method: "POST",
        headers: {
            Authorization: getAuthHeader(apiKey, apiSecret)
        },
        body: form
    });
    const json = (await response.json().catch(() => ({})));
    if (!response.ok || !json.secure_url || !json.public_id) {
        throw new AppError(json.error?.message ?? "Cloudinary upload failed", response.status || 500);
    }
    return { secureUrl: json.secure_url, publicId: json.public_id };
};
const applyCommonParams = (form, options) => {
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
export const uploadStringToCloudinary = async (input) => {
    const form = new FormData();
    form.append("file", input.file);
    applyCommonParams(form, input);
    return uploadForm(form, input.resourceType ?? "image");
};
export const uploadBufferToCloudinary = async (input) => {
    const form = new FormData();
    form.append("file", new Blob([input.buffer], { type: input.mimeType }), input.fileName);
    applyCommonParams(form, input);
    return uploadForm(form, input.resourceType ?? "image");
};
