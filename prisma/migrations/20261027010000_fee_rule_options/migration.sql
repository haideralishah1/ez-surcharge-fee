-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FeeRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT false,
    "type" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "scope" TEXT NOT NULL,
    "requirement" TEXT NOT NULL DEFAULT 'OPTIONAL',
    "channels" TEXT NOT NULL DEFAULT '["ONLINE_STORE"]',
    "conditions" TEXT NOT NULL DEFAULT '{}',
    "icon" TEXT NOT NULL DEFAULT 'order-fee',
    "frequency" TEXT NOT NULL DEFAULT 'PER_UNIT',
    "minCharge" REAL,
    "maxCharge" REAL,
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "matchMode" TEXT NOT NULL DEFAULT 'ALL_PRODUCTS',
    "scheduleEnabled" BOOLEAN NOT NULL DEFAULT false,
    "weekdays" TEXT NOT NULL DEFAULT '[]',
    "startDate" TEXT,
    "endDate" TEXT,
    "countryMode" TEXT NOT NULL DEFAULT 'ALL',
    "marketHandles" TEXT NOT NULL DEFAULT '[]',
    "shopperNote" TEXT NOT NULL DEFAULT '',
    "productId" TEXT,
    "variantId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_FeeRule" ("active", "amount", "channels", "conditions", "createdAt", "description", "id", "name", "productId", "requirement", "scope", "shop", "type", "updatedAt", "variantId") SELECT "active", "amount", "channels", "conditions", "createdAt", "description", "id", "name", "productId", "requirement", "scope", "shop", "type", "updatedAt", "variantId" FROM "FeeRule";
DROP TABLE "FeeRule";
ALTER TABLE "new_FeeRule" RENAME TO "FeeRule";
CREATE INDEX "FeeRule_shop_idx" ON "FeeRule"("shop");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

