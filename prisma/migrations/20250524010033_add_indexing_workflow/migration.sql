/*
  Warnings:

  - Added the required column `blockchain` to the `ArtworkIndex` table without a default value. This is not possible if the table is not empty.
  - Added the required column `contractAddress` to the `ArtworkIndex` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dataSource` to the `ArtworkIndex` table without a default value. This is not possible if the table is not empty.
  - Added the required column `normalizedData` to the `ArtworkIndex` table without a default value. This is not possible if the table is not empty.
  - Added the required column `rawResponse` to the `ArtworkIndex` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tokenId` to the `ArtworkIndex` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Artwork" ADD COLUMN     "artifactUri" TEXT,
ADD COLUMN     "creatorAddress" TEXT,
ADD COLUMN     "displayUri" TEXT,
ADD COLUMN     "externalUrl" TEXT,
ADD COLUMN     "isDisabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isNsfw" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isSuspicious" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastSyncedAt" TIMESTAMP(3),
ADD COLUMN     "metadataUrl" TEXT,
ADD COLUMN     "owners" JSONB,
ADD COLUMN     "rarity" JSONB,
ADD COLUMN     "resolvedArtist" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "supply" INTEGER,
ADD COLUMN     "thumbnailUri" TEXT;

-- Step 1: Add new columns as nullable to ArtworkIndex
ALTER TABLE "ArtworkIndex" ADD COLUMN     "blockchain" TEXT,
ADD COLUMN     "contractAddress" TEXT,
ADD COLUMN     "dataSource" TEXT,
ADD COLUMN     "importAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "importErrors" JSONB,
ADD COLUMN     "importStatus" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN     "lastImportAttempt" TIMESTAMP(3),
ADD COLUMN     "normalizedData" JSONB,
ADD COLUMN     "rawResponse" JSONB,
ADD COLUMN     "tokenId" TEXT;

-- Step 2: Update existing records with default values based on linked artwork data
-- Update blockchain from linked artwork records
UPDATE "ArtworkIndex" 
SET "blockchain" = COALESCE(
  (SELECT "blockchain" FROM "Artwork" WHERE "Artwork"."id" = "ArtworkIndex"."artworkId"),
  'ethereum'
)
WHERE "blockchain" IS NULL;

-- Update contractAddress from linked artwork records  
UPDATE "ArtworkIndex"
SET "contractAddress" = COALESCE(
  (SELECT "contractAddr" FROM "Artwork" WHERE "Artwork"."id" = "ArtworkIndex"."artworkId"),
  'unknown'
)
WHERE "contractAddress" IS NULL;

-- Update tokenId from linked artwork records
UPDATE "ArtworkIndex"
SET "tokenId" = COALESCE(
  (SELECT "tokenID" FROM "Artwork" WHERE "Artwork"."id" = "ArtworkIndex"."artworkId"),
  'unknown'
)
WHERE "tokenId" IS NULL;

-- Set default dataSource for existing records
UPDATE "ArtworkIndex" 
SET "dataSource" = 'legacy'
WHERE "dataSource" IS NULL;

-- Set default rawResponse for existing records (use existing indexedData)
UPDATE "ArtworkIndex"
SET "rawResponse" = COALESCE("indexedData", '{}')
WHERE "rawResponse" IS NULL;

-- Set default normalizedData for existing records
UPDATE "ArtworkIndex"
SET "normalizedData" = '{}'
WHERE "normalizedData" IS NULL;

-- Step 3: Make required columns NOT NULL now that they have values
ALTER TABLE "ArtworkIndex" ALTER COLUMN "blockchain" SET NOT NULL;
ALTER TABLE "ArtworkIndex" ALTER COLUMN "contractAddress" SET NOT NULL;
ALTER TABLE "ArtworkIndex" ALTER COLUMN "dataSource" SET NOT NULL;
ALTER TABLE "ArtworkIndex" ALTER COLUMN "rawResponse" SET NOT NULL;
ALTER TABLE "ArtworkIndex" ALTER COLUMN "normalizedData" SET NOT NULL;
ALTER TABLE "ArtworkIndex" ALTER COLUMN "tokenId" SET NOT NULL;

-- CreateTable
CREATE TABLE "CreatorAddress" (
    "id" SERIAL NOT NULL,
    "address" TEXT NOT NULL,
    "blockchain" TEXT NOT NULL,
    "artistId" INTEGER,
    "resolvedAt" TIMESTAMP(3),
    "resolutionSource" TEXT,
    "ensName" TEXT,
    "displayName" TEXT,
    "profileData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionMapping" (
    "id" SERIAL NOT NULL,
    "collectionId" INTEGER NOT NULL,
    "externalId" TEXT NOT NULL,
    "dataSource" TEXT NOT NULL,
    "blockchain" TEXT,
    "resolvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectionMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreatorAddress_artistId_idx" ON "CreatorAddress"("artistId");

-- CreateIndex
CREATE INDEX "CreatorAddress_blockchain_idx" ON "CreatorAddress"("blockchain");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorAddress_address_blockchain_key" ON "CreatorAddress"("address", "blockchain");

-- CreateIndex
CREATE INDEX "CollectionMapping_collectionId_idx" ON "CollectionMapping"("collectionId");

-- CreateIndex
CREATE INDEX "CollectionMapping_dataSource_blockchain_idx" ON "CollectionMapping"("dataSource", "blockchain");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionMapping_externalId_dataSource_blockchain_key" ON "CollectionMapping"("externalId", "dataSource", "blockchain");

-- CreateIndex
CREATE INDEX "ArtworkIndex_blockchain_dataSource_idx" ON "ArtworkIndex"("blockchain", "dataSource");

-- CreateIndex
CREATE INDEX "ArtworkIndex_importStatus_idx" ON "ArtworkIndex"("importStatus");

-- CreateIndex
CREATE INDEX "ArtworkIndex_contractAddress_tokenId_idx" ON "ArtworkIndex"("contractAddress", "tokenId");

-- AddForeignKey
ALTER TABLE "CreatorAddress" ADD CONSTRAINT "CreatorAddress_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionMapping" ADD CONSTRAINT "CollectionMapping_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
