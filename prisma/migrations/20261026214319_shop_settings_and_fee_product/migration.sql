-- AlterTable
ALTER TABLE "FeeRule" ADD COLUMN "productId" TEXT;

-- CreateTable
CREATE TABLE "ShopSettings" (
    "shop" TEXT NOT NULL PRIMARY KEY,
    "cartTransformId" TEXT,
    "updatedAt" DATETIME NOT NULL
);
