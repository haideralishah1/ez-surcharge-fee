-- CreateTable
CREATE TABLE "FeeRule" (
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
    "variantId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "FeeRule_shop_idx" ON "FeeRule"("shop");
