-- CreateTable
CREATE TABLE "ReferencePhoto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ClothingItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "imageFile" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "storeName" TEXT,
    "price" TEXT,
    "currency" TEXT,
    "slot" TEXT NOT NULL,
    "color" TEXT,
    "liked" BOOLEAN,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Outfit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "coverImage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "OutfitItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "outfitId" TEXT NOT NULL,
    "clothingId" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    CONSTRAINT "OutfitItem_outfitId_fkey" FOREIGN KEY ("outfitId") REFERENCES "Outfit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OutfitItem_clothingId_fkey" FOREIGN KEY ("clothingId") REFERENCES "ClothingItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TryOnResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "resultImage" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "clothingId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "durationMs" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TryOnResult_referenceId_fkey" FOREIGN KEY ("referenceId") REFERENCES "ReferencePhoto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TryOnResult_clothingId_fkey" FOREIGN KEY ("clothingId") REFERENCES "ClothingItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "OutfitItem_outfitId_slot_key" ON "OutfitItem"("outfitId", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "TryOnResult_cacheKey_key" ON "TryOnResult"("cacheKey");
