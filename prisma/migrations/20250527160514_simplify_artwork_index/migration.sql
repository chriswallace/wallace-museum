/*
  Warnings:

  - You are about to drop the column `artistUsername` on the `ArtworkIndex` table. All the data in the column will be lost.
  - You are about to drop the column `artistWalletAddress` on the `ArtworkIndex` table. All the data in the column will be lost.
  - You are about to drop the column `tokenMetadata` on the `ArtworkIndex` table. All the data in the column will be lost.
  - You are about to drop the column `tokenName` on the `ArtworkIndex` table. All the data in the column will be lost.
  - You are about to drop the column `tokenThumbnail` on the `ArtworkIndex` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "ArtworkIndex_artistWalletAddress_idx";

-- AlterTable
ALTER TABLE "ArtworkIndex" DROP COLUMN "artistUsername",
DROP COLUMN "artistWalletAddress",
DROP COLUMN "tokenMetadata",
DROP COLUMN "tokenName",
DROP COLUMN "tokenThumbnail";
