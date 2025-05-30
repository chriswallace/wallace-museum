/*
  Warnings:

  - You are about to drop the column `primaryCreatorAddressId` on the `Artist` table. All the data in the column will be lost.
  - You are about to drop the column `animation_url` on the `Artwork` table. All the data in the column will be lost.
  - You are about to drop the column `contractAddr` on the `Artwork` table. All the data in the column will be lost.
  - You are about to drop the column `contractAlias` on the `Artwork` table. All the data in the column will be lost.
  - You are about to drop the column `creatorAddress` on the `Artwork` table. All the data in the column will be lost.
  - You are about to drop the column `creatorAddressId` on the `Artwork` table. All the data in the column will be lost.
  - You are about to drop the column `curatorNotes` on the `Artwork` table. All the data in the column will be lost.
  - You are about to drop the column `enabled` on the `Artwork` table. All the data in the column will be lost.
  - You are about to drop the column `externalUrl` on the `Artwork` table. All the data in the column will be lost.
  - You are about to drop the column `image_url` on the `Artwork` table. All the data in the column will be lost.
  - You are about to drop the column `lastSyncedAt` on the `Artwork` table. All the data in the column will be lost.
  - You are about to drop the column `mediaMetadata` on the `Artwork` table. All the data in the column will be lost.
  - You are about to drop the column `owners` on the `Artwork` table. All the data in the column will be lost.
  - You are about to drop the column `rarity` on the `Artwork` table. All the data in the column will be lost.
  - You are about to drop the column `tags` on the `Artwork` table. All the data in the column will be lost.
  - You are about to drop the column `tokenID` on the `Artwork` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[uid]` on the table `Artwork` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tokenStandard,contractAddress,tokenId]` on the table `Artwork` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Artist" DROP CONSTRAINT "Artist_primaryCreatorAddressId_fkey";

-- DropForeignKey
ALTER TABLE "Artwork" DROP CONSTRAINT "Artwork_creatorAddressId_fkey";

-- DropIndex
DROP INDEX "Artwork_creatorAddressId_idx";

-- DropIndex
DROP INDEX "Artwork_creatorAddress_blockchain_idx";

-- DropIndex
DROP INDEX "Artwork_tokenID_contractAddr_key";

-- AlterTable
ALTER TABLE "Artist" DROP COLUMN "primaryCreatorAddressId",
ADD COLUMN     "description" TEXT,
ADD COLUMN     "username" TEXT;

-- AlterTable
ALTER TABLE "Artwork" DROP COLUMN "animation_url",
DROP COLUMN "contractAddr",
DROP COLUMN "contractAlias",
DROP COLUMN "creatorAddress",
DROP COLUMN "creatorAddressId",
DROP COLUMN "curatorNotes",
DROP COLUMN "enabled",
DROP COLUMN "externalUrl",
DROP COLUMN "image_url",
DROP COLUMN "lastSyncedAt",
DROP COLUMN "mediaMetadata",
DROP COLUMN "owners",
DROP COLUMN "rarity",
DROP COLUMN "tags",
DROP COLUMN "tokenID",
ADD COLUMN     "animationUrl" TEXT,
ADD COLUMN     "contractAddress" TEXT,
ADD COLUMN     "dimensions" JSONB,
ADD COLUMN     "features" JSONB,
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "supply" INTEGER,
ADD COLUMN     "thumbnailUrl" TEXT,
ADD COLUMN     "tokenId" TEXT,
ADD COLUMN     "uid" TEXT;

-- CreateTable
CREATE TABLE "_ArtistCollections" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "_ArtworkCreatorAddresses" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_ArtistCollections_AB_unique" ON "_ArtistCollections"("A", "B");

-- CreateIndex
CREATE INDEX "_ArtistCollections_B_index" ON "_ArtistCollections"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_ArtworkCreatorAddresses_AB_unique" ON "_ArtworkCreatorAddresses"("A", "B");

-- CreateIndex
CREATE INDEX "_ArtworkCreatorAddresses_B_index" ON "_ArtworkCreatorAddresses"("B");

-- CreateIndex
CREATE UNIQUE INDEX "Artwork_uid_key" ON "Artwork"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "Artwork_tokenStandard_contractAddress_tokenId_key" ON "Artwork"("tokenStandard", "contractAddress", "tokenId");

-- AddForeignKey
ALTER TABLE "_ArtistCollections" ADD CONSTRAINT "_ArtistCollections_A_fkey" FOREIGN KEY ("A") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ArtistCollections" ADD CONSTRAINT "_ArtistCollections_B_fkey" FOREIGN KEY ("B") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ArtworkCreatorAddresses" ADD CONSTRAINT "_ArtworkCreatorAddresses_A_fkey" FOREIGN KEY ("A") REFERENCES "Artwork"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ArtworkCreatorAddresses" ADD CONSTRAINT "_ArtworkCreatorAddresses_B_fkey" FOREIGN KEY ("B") REFERENCES "CreatorAddress"("id") ON DELETE CASCADE ON UPDATE CASCADE;
