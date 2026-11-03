-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FeeOrderUsage" (
    "orderId" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "ruleIds" TEXT NOT NULL DEFAULT '[]',
    "feeTotal" REAL NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT '',
    "breakdown" TEXT NOT NULL DEFAULT '{}',
    "orderName" TEXT NOT NULL DEFAULT '',
    "orderCreatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_FeeOrderUsage" ("createdAt", "month", "orderId", "ruleIds", "shop") SELECT "createdAt", "month", "orderId", "ruleIds", "shop" FROM "FeeOrderUsage";
DROP TABLE "FeeOrderUsage";
ALTER TABLE "new_FeeOrderUsage" RENAME TO "FeeOrderUsage";
CREATE INDEX "FeeOrderUsage_shop_month_idx" ON "FeeOrderUsage"("shop", "month");
CREATE INDEX "FeeOrderUsage_shop_orderCreatedAt_idx" ON "FeeOrderUsage"("shop", "orderCreatedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

