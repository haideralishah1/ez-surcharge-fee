-- CreateTable
CREATE TABLE "ApiCredential" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "tokenHash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" DATETIME,
    "revokedAt" DATETIME
);

-- CreateIndex
CREATE UNIQUE INDEX "ApiCredential_tokenHash_key" ON "ApiCredential"("tokenHash");

-- CreateIndex
CREATE INDEX "ApiCredential_shop_idx" ON "ApiCredential"("shop");

-- CreateIndex
CREATE INDEX "ApiCredential_prefix_idx" ON "ApiCredential"("prefix");

