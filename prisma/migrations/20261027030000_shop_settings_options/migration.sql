-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ShopSettings" (
    "shop" TEXT NOT NULL PRIMARY KEY,
    "cartTransformId" TEXT,
    "validationId" TEXT,
    "defaultOrderTag" TEXT NOT NULL DEFAULT '',
    "autoFulfillFees" BOOLEAN NOT NULL DEFAULT false,
    "blockOnFailure" BOOLEAN NOT NULL DEFAULT false,
    "guardEnabled" BOOLEAN NOT NULL DEFAULT true,
    "showFeesBlock" BOOLEAN NOT NULL DEFAULT true,
    "showAcceptance" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" TEXT NOT NULL DEFAULT 'CART',
    "checkoutText" TEXT NOT NULL DEFAULT '{}',
    "translations" TEXT NOT NULL DEFAULT '{}',
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_ShopSettings" ("cartTransformId", "shop", "updatedAt", "validationId") SELECT "cartTransformId", "shop", "updatedAt", "validationId" FROM "ShopSettings";
DROP TABLE "ShopSettings";
ALTER TABLE "new_ShopSettings" RENAME TO "ShopSettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

