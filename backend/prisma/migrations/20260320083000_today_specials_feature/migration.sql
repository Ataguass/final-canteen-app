-- AlterTable
ALTER TABLE "Tenant"
ADD COLUMN "todaySpecialsEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Category"
ADD COLUMN "isTodaySpecial" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "MenuItem"
ADD COLUMN "isTodaySpecial" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Category_tenantId_isTodaySpecial_isActive_idx" ON "Category"("tenantId", "isTodaySpecial", "isActive");

-- CreateIndex
CREATE INDEX "MenuItem_tenantId_isTodaySpecial_isAvailable_idx" ON "MenuItem"("tenantId", "isTodaySpecial", "isAvailable");
