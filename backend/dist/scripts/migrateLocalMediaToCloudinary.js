import fs from "node:fs/promises";
import path from "node:path";
import { CommunityMediaType } from "@prisma/client";
import { prisma } from "../config/database.js";
import { uploadBufferToCloudinary } from "../utils/cloudinary.js";
const MIME_BY_EXT = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".m4v": "video/x-m4v"
};
const isLocalUploadUrl = (value) => Boolean(value && value.includes("/uploads/"));
const toLocalFilePath = (value) => {
    const clean = value.trim();
    if (!clean)
        return null;
    let pathname = clean;
    if (/^https?:\/\//i.test(clean)) {
        try {
            pathname = new URL(clean).pathname;
        }
        catch {
            return null;
        }
    }
    const marker = "/uploads/";
    const index = pathname.indexOf(marker);
    if (index < 0)
        return null;
    const relative = decodeURIComponent(pathname.slice(index + marker.length));
    if (!relative || relative.includes(".."))
        return null;
    return path.resolve(process.cwd(), "uploads", relative);
};
const guessMimeType = (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    return MIME_BY_EXT[ext] ?? "application/octet-stream";
};
const uploadLocalFile = async (filePath, folder, resourceType) => {
    const exists = await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false);
    if (!exists)
        return null;
    const buffer = await fs.readFile(filePath);
    const fileName = path.basename(filePath);
    const mimeType = guessMimeType(filePath);
    const uploaded = await uploadBufferToCloudinary({
        buffer,
        mimeType,
        fileName,
        resourceType,
        folder
    });
    return uploaded.secureUrl;
};
const migrateTenantInvoiceLogos = async () => {
    const tenants = await prisma.tenant.findMany({
        where: { invoiceLogoUrl: { not: null } },
        select: { id: true, invoiceLogoUrl: true }
    });
    let changed = 0;
    for (const tenant of tenants) {
        if (!isLocalUploadUrl(tenant.invoiceLogoUrl))
            continue;
        const filePath = toLocalFilePath(tenant.invoiceLogoUrl);
        if (!filePath)
            continue;
        const uploaded = await uploadLocalFile(filePath, `tenants/${tenant.id}`, "image");
        if (!uploaded)
            continue;
        await prisma.tenant.update({
            where: { id: tenant.id },
            data: { invoiceLogoUrl: uploaded }
        });
        changed += 1;
    }
    return changed;
};
const migrateBanners = async () => {
    const banners = await prisma.banner.findMany({
        where: { imageUrl: { contains: "/uploads/" } },
        select: { id: true, tenantId: true, imageUrl: true }
    });
    let changed = 0;
    for (const banner of banners) {
        const filePath = toLocalFilePath(banner.imageUrl);
        if (!filePath)
            continue;
        const uploaded = await uploadLocalFile(filePath, `tenants/${banner.tenantId}/banners`, "image");
        if (!uploaded)
            continue;
        await prisma.banner.update({
            where: { id: banner.id },
            data: { imageUrl: uploaded }
        });
        changed += 1;
    }
    return changed;
};
const migrateCommunityMedia = async () => {
    const posts = await prisma.communityPost.findMany({
        where: { mediaUrl: { contains: "/uploads/" } },
        select: { id: true, tenantId: true, mediaUrl: true, mediaType: true }
    });
    let changed = 0;
    for (const post of posts) {
        if (!post.mediaUrl)
            continue;
        const filePath = toLocalFilePath(post.mediaUrl);
        if (!filePath)
            continue;
        const resourceType = post.mediaType === CommunityMediaType.VIDEO ? "video" : "image";
        const uploaded = await uploadLocalFile(filePath, `tenants/${post.tenantId}/community`, resourceType);
        if (!uploaded)
            continue;
        await prisma.communityPost.update({
            where: { id: post.id },
            data: { mediaUrl: uploaded }
        });
        changed += 1;
    }
    return changed;
};
const migrateMenuItems = async () => {
    const items = await prisma.menuItem.findMany({
        where: { image: { contains: "/uploads/" } },
        select: { id: true, tenantId: true, image: true }
    });
    let changed = 0;
    for (const item of items) {
        if (!item.image)
            continue;
        const filePath = toLocalFilePath(item.image);
        if (!filePath)
            continue;
        const uploaded = await uploadLocalFile(filePath, `tenants/${item.tenantId}/menu/items`, "image");
        if (!uploaded)
            continue;
        await prisma.menuItem.update({
            where: { id: item.id },
            data: { image: uploaded }
        });
        changed += 1;
    }
    return changed;
};
const migrateCategories = async () => {
    const categories = await prisma.category.findMany({
        where: { imageUrl: { contains: "/uploads/" } },
        select: { id: true, tenantId: true, imageUrl: true }
    });
    let changed = 0;
    for (const category of categories) {
        if (!category.imageUrl)
            continue;
        const filePath = toLocalFilePath(category.imageUrl);
        if (!filePath)
            continue;
        const uploaded = await uploadLocalFile(filePath, `tenants/${category.tenantId}/menu/categories`, "image");
        if (!uploaded)
            continue;
        await prisma.category.update({
            where: { id: category.id },
            data: { imageUrl: uploaded }
        });
        changed += 1;
    }
    return changed;
};
const run = async () => {
    console.log("Starting local-media -> Cloudinary migration...");
    const invoice = await migrateTenantInvoiceLogos();
    const banners = await migrateBanners();
    const community = await migrateCommunityMedia();
    const menuItems = await migrateMenuItems();
    const categories = await migrateCategories();
    console.log("Migration complete.");
    console.log(JSON.stringify({
        invoiceLogosMigrated: invoice,
        bannersMigrated: banners,
        communityMediaMigrated: community,
        menuItemsMigrated: menuItems,
        categoriesMigrated: categories
    }, null, 2));
};
run()
    .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
