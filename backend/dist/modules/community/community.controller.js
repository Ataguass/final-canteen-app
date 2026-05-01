import { CommunityMediaType } from "@prisma/client";
import { env } from "../../config/env.js";
import { prisma } from "../../config/database.js";
import { uploadBufferToCloudinary } from "../../utils/cloudinary.js";
import { AppError } from "../../utils/appError.js";
const COMMUNITY_MEDIA_EXTENSION_BY_MIME = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
    "video/x-m4v": "m4v"
};
const getMediaTypeFromMime = (mimeType) => {
    const mime = mimeType.toLowerCase();
    if (mime.startsWith("image/"))
        return CommunityMediaType.IMAGE;
    if (mime.startsWith("video/"))
        return CommunityMediaType.VIDEO;
    return null;
};
const normalizeMediaFields = (mediaUrl, mediaType) => {
    if (mediaUrl === undefined && mediaType === undefined) {
        return {};
    }
    if (mediaUrl === null || mediaUrl?.trim() === "") {
        if (mediaType !== null && mediaType !== undefined) {
            throw new AppError("mediaType must be null when mediaUrl is empty", 400);
        }
        return { mediaUrl: null, mediaType: null };
    }
    if (!mediaType) {
        throw new AppError("mediaType is required when mediaUrl is provided", 400);
    }
    const cleanUrl = (mediaUrl ?? "").trim();
    return { mediaUrl: cleanUrl, mediaType };
};
const communitySelect = {
    id: true,
    tenantId: true,
    authorUserId: true,
    title: true,
    body: true,
    mediaUrl: true,
    mediaType: true,
    isPinned: true,
    isVisible: true,
    createdAt: true,
    updatedAt: true,
    author: {
        select: {
            id: true,
            name: true,
            role: true
        }
    }
};
const isCommunityManager = (role) => role === "ADMIN" || role === "SUPER_ADMIN" || role === "TEACHER";
export const listCommunityPosts = async (req, res) => {
    const tenantId = req.tenantId;
    const includeHidden = req.query.includeHidden === "true" && isCommunityManager(req.user?.role);
    const limitRaw = Number(req.query.limit ?? 100);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 300) : 100;
    const posts = await prisma.communityPost.findMany({
        where: {
            tenantId,
            ...(includeHidden ? {} : { isVisible: true })
        },
        select: communitySelect,
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
        take: limit
    });
    res.status(200).json({ success: true, data: posts });
};
export const createCommunityPost = async (req, res) => {
    const tenantId = req.tenantId;
    const { title, body, mediaUrl, mediaType, isPinned = false, isVisible = true } = req.body;
    if (!title?.trim() || !body?.trim()) {
        throw new AppError("title and body are required", 400);
    }
    const post = await prisma.communityPost.create({
        data: {
            tenantId,
            authorUserId: req.user?.sub,
            title: title.trim(),
            body: body.trim(),
            ...normalizeMediaFields(mediaUrl, mediaType),
            isPinned,
            isVisible
        },
        select: communitySelect
    });
    res.status(201).json({ success: true, data: post });
};
export const updateCommunityPost = async (req, res) => {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const { title, body, mediaUrl, mediaType, isPinned, isVisible } = req.body;
    const existing = await prisma.communityPost.findFirst({ where: { id, tenantId } });
    if (!existing) {
        throw new AppError("Community post not found", 404);
    }
    const updated = await prisma.communityPost.update({
        where: { id },
        data: {
            title: title === undefined ? undefined : title.trim(),
            body: body === undefined ? undefined : body.trim(),
            ...normalizeMediaFields(mediaUrl, mediaType),
            isPinned,
            isVisible
        },
        select: communitySelect
    });
    res.status(200).json({ success: true, data: updated });
};
export const toggleCommunityPin = async (req, res) => {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const existing = await prisma.communityPost.findFirst({ where: { id, tenantId } });
    if (!existing) {
        throw new AppError("Community post not found", 404);
    }
    const updated = await prisma.communityPost.update({
        where: { id },
        data: { isPinned: !existing.isPinned },
        select: communitySelect
    });
    res.status(200).json({ success: true, data: updated });
};
export const toggleCommunityVisibility = async (req, res) => {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const existing = await prisma.communityPost.findFirst({ where: { id, tenantId } });
    if (!existing) {
        throw new AppError("Community post not found", 404);
    }
    const updated = await prisma.communityPost.update({
        where: { id },
        data: { isVisible: !existing.isVisible },
        select: communitySelect
    });
    res.status(200).json({ success: true, data: updated });
};
export const deleteCommunityPost = async (req, res) => {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const existing = await prisma.communityPost.findFirst({ where: { id, tenantId } });
    if (!existing) {
        throw new AppError("Community post not found", 404);
    }
    await prisma.communityPost.delete({ where: { id } });
    res.status(204).send();
};
export const uploadCommunityMedia = async (req, res) => {
    const tenantId = req.tenantId;
    const file = req.file;
    if (!file) {
        throw new AppError("file is required", 400);
    }
    const mediaType = getMediaTypeFromMime(file.mimetype);
    if (!mediaType) {
        throw new AppError("Unsupported file type. Upload image or video only.", 400);
    }
    const maxBytes = mediaType === CommunityMediaType.IMAGE ? env.communityImageMaxBytes : env.communityVideoMaxBytes;
    if (file.size > maxBytes) {
        throw new AppError(`${mediaType === CommunityMediaType.IMAGE ? "Image" : "Video"} too large. Max ${(maxBytes /
            (1024 * 1024)).toFixed(2)} MB`, 400);
    }
    const extension = COMMUNITY_MEDIA_EXTENSION_BY_MIME[file.mimetype.toLowerCase()] ?? "bin";
    const fileName = `community-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
    const resourceType = mediaType === CommunityMediaType.VIDEO ? "video" : "image";
    const upload = await uploadBufferToCloudinary({
        buffer: file.buffer,
        mimeType: file.mimetype,
        fileName,
        resourceType,
        folder: `tenants/${tenantId}/community`
    });
    res.status(200).json({
        success: true,
        data: {
            mediaUrl: upload.secureUrl,
            mediaType
        }
    });
};
