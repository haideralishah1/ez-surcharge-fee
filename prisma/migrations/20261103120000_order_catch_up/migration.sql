-- AlterTable
ALTER TABLE "FeeOrderUsage" ADD COLUMN "dispatchedAt" DATETIME;
ALTER TABLE "ShopSettings" ADD COLUMN "orderCatchUpAt" DATETIME;

-- Orders recorded before this migration already went through the integrations.
UPDATE "FeeOrderUsage" SET "dispatchedAt" = "createdAt";
