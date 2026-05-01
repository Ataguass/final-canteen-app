import { Router } from "express";
import multer from "multer";
import { env } from "../../config/env.js";
import { auth } from "../../middleware/auth.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { roleGuard } from "../../middleware/roleGuard.js";
import { tenantResolver } from "../../middleware/tenantResolver.js";
import {
  createCommunityPost,
  deleteCommunityPost,
  listCommunityPosts,
  toggleCommunityPin,
  toggleCommunityVisibility,
  uploadCommunityMedia,
  updateCommunityPost
} from "./community.controller.js";

export const communityRouter = Router();
const communityUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.communityVideoMaxBytes }
});

communityRouter.get("/posts", auth, tenantResolver, asyncHandler(listCommunityPosts));
communityRouter.post(
  "/upload-media",
  auth,
  tenantResolver,
  roleGuard("ADMIN", "SUPER_ADMIN", "TEACHER"),
  communityUpload.single("file"),
  asyncHandler(uploadCommunityMedia)
);
communityRouter.post(
  "/posts",
  auth,
  tenantResolver,
  roleGuard("ADMIN", "SUPER_ADMIN", "TEACHER"),
  asyncHandler(createCommunityPost)
);
communityRouter.patch(
  "/posts/:id",
  auth,
  tenantResolver,
  roleGuard("ADMIN", "SUPER_ADMIN", "TEACHER"),
  asyncHandler(updateCommunityPost)
);
communityRouter.patch(
  "/posts/:id/pin",
  auth,
  tenantResolver,
  roleGuard("ADMIN", "SUPER_ADMIN", "TEACHER"),
  asyncHandler(toggleCommunityPin)
);
communityRouter.patch(
  "/posts/:id/visibility",
  auth,
  tenantResolver,
  roleGuard("ADMIN", "SUPER_ADMIN", "TEACHER"),
  asyncHandler(toggleCommunityVisibility)
);
communityRouter.delete(
  "/posts/:id",
  auth,
  tenantResolver,
  roleGuard("ADMIN", "SUPER_ADMIN", "TEACHER"),
  asyncHandler(deleteCommunityPost)
);
