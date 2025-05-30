/*
  Warnings:

  - You are about to drop the column `importAttempts` on the `ArtworkIndex` table. All the data in the column will be lost.
  - You are about to drop the column `importErrors` on the `ArtworkIndex` table. All the data in the column will be lost.
  - You are about to drop the column `lastImportAttempt` on the `ArtworkIndex` table. All the data in the column will be lost.
  - You are about to drop the column `originatingCreatorAddressId` on the `Collection` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Settings` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Settings` table. All the data in the column will be lost.
  - You are about to drop the `ArtistAddress` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CreatorAddress` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_ArtworkCreatorAddresses` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[contractAddress,tokenId]` on the table `ArtworkIndex` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `Artist` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "ArtistAddress" DROP CONSTRAINT "ArtistAddress_artistId_fkey";

-- DropForeignKey
ALTER TABLE "ArtworkIndex" DROP CONSTRAINT "ArtworkIndex_artworkId_fkey";

-- DropForeignKey
ALTER TABLE "Collection" DROP CONSTRAINT "Collection_originatingCreatorAddressId_fkey";

-- DropForeignKey
ALTER TABLE "CreatorAddress" DROP CONSTRAINT "CreatorAddress_artistId_fkey";

-- DropForeignKey
ALTER TABLE "_ArtworkCreatorAddresses" DROP CONSTRAINT "_ArtworkCreatorAddresses_A_fkey";

-- DropForeignKey
ALTER TABLE "_ArtworkCreatorAddresses" DROP CONSTRAINT "_ArtworkCreatorAddresses_B_fkey";

-- DropIndex
DROP INDEX "ArtworkIndex_artistUsername_idx";

-- DropIndex
DROP INDEX "ArtworkIndex_artworkId_idx";

-- DropIndex
DROP INDEX "ArtworkIndex_blockchain_dataSource_idx";

-- DropIndex
DROP INDEX "ArtworkIndex_contractAddress_tokenId_idx";

-- DropIndex
DROP INDEX "ArtworkIndex_nftUid_idx";

-- DropIndex
DROP INDEX "ArtworkIndex_tokenName_idx";

-- DropIndex
DROP INDEX "Collection_originatingCreatorAddressId_idx";

-- DropIndex
DROP INDEX "Session_userId_idx";

-- AlterTable
ALTER TABLE "Artist" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "displayName" TEXT,
ADD COLUMN     "ensName" TEXT,
ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "profileData" JSONB,
ADD COLUMN     "profileUrl" TEXT,
ADD COLUMN     "resolutionSource" TEXT,
ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "socialLinks" JSONB,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "ArtworkIndex" DROP COLUMN "importAttempts",
DROP COLUMN "importErrors",
DROP COLUMN "lastImportAttempt",
ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "lastAttempt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "indexedData" SET DEFAULT '{}',
ALTER COLUMN "normalizedData" SET DEFAULT '{}',
ALTER COLUMN "rawResponse" SET DEFAULT '{}';

-- AlterTable
ALTER TABLE "Collection" DROP COLUMN "originatingCreatorAddressId",
ADD COLUMN     "originatingWalletAddressId" INTEGER;

-- AlterTable
ALTER TABLE "Settings" DROP COLUMN "createdAt",
DROP COLUMN "updatedAt",
ALTER COLUMN "value" SET DATA TYPE TEXT;

-- DropTable
DROP TABLE "ArtistAddress";

-- DropTable
DROP TABLE "CreatorAddress";

-- DropTable
DROP TABLE "_ArtworkCreatorAddresses";

-- CreateTable
CREATE TABLE "WalletAddress" (
    "id" SERIAL NOT NULL,
    "address" TEXT NOT NULL,
    "blockchain" TEXT NOT NULL,
    "artistId" INTEGER,
    "lastIndexed" TIMESTAMP(3),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ArtworkWalletAddresses" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE INDEX "WalletAddress_artistId_idx" ON "WalletAddress"("artistId");

-- CreateIndex
CREATE INDEX "WalletAddress_blockchain_idx" ON "WalletAddress"("blockchain");

-- CreateIndex
CREATE INDEX "WalletAddress_lastIndexed_idx" ON "WalletAddress"("lastIndexed");

-- CreateIndex
CREATE UNIQUE INDEX "WalletAddress_address_blockchain_key" ON "WalletAddress"("address", "blockchain");

-- CreateIndex
CREATE UNIQUE INDEX "_ArtworkWalletAddresses_AB_unique" ON "_ArtworkWalletAddresses"("A", "B");

-- CreateIndex
CREATE INDEX "_ArtworkWalletAddresses_B_index" ON "_ArtworkWalletAddresses"("B");

-- CreateIndex
CREATE INDEX "ArtworkIndex_blockchain_idx" ON "ArtworkIndex"("blockchain");

-- CreateIndex
CREATE INDEX "ArtworkIndex_dataSource_idx" ON "ArtworkIndex"("dataSource");

-- CreateIndex
CREATE UNIQUE INDEX "ArtworkIndex_contractAddress_tokenId_key" ON "ArtworkIndex"("contractAddress", "tokenId");

-- CreateIndex
CREATE INDEX "Collection_originatingWalletAddressId_idx" ON "Collection"("originatingWalletAddressId");

-- AddForeignKey
ALTER TABLE "WalletAddress" ADD CONSTRAINT "WalletAddress_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_originatingWalletAddressId_fkey" FOREIGN KEY ("originatingWalletAddressId") REFERENCES "WalletAddress"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtworkIndex" ADD CONSTRAINT "ArtworkIndex_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ArtworkWalletAddresses" ADD CONSTRAINT "_ArtworkWalletAddresses_A_fkey" FOREIGN KEY ("A") REFERENCES "Artwork"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ArtworkWalletAddresses" ADD CONSTRAINT "_ArtworkWalletAddresses_B_fkey" FOREIGN KEY ("B") REFERENCES "WalletAddress"("id") ON DELETE CASCADE ON UPDATE CASCADE;
