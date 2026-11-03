-- CreateTable
CREATE TABLE "IntegrationConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "secrets" TEXT NOT NULL DEFAULT '',
    "settings" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'not_connected',
    "lastError" TEXT NOT NULL DEFAULT '',
    "lastTestedAt" DATETIME,
    "lastSyncAt" DATETIME,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationConnection_shop_key_key" ON "IntegrationConnection"("shop", "key");

