/*
  Warnings:

  - You are about to drop the column `artifactUri` on the `Artwork` table. All the data in the column will be lost.
  - You are about to drop the column `dimensions` on the `Artwork` table. All the data in the column will be lost.
  - You are about to drop the column `displayUri` on the `Artwork` table. All the data in the column will be lost.
  - You are about to drop the column `display_animation_url` on the `Artwork` table. All the data in the column will be lost.
  - You are about to drop the column `display_image_url` on the `Artwork` table. All the data in the column will be lost.
  - You are about to drop the column `duration` on the `Artwork` table. All the data in the column will be lost.
  - You are about to drop the column `fileSize` on the `Artwork` table. All the data in the column will be lost.
  - You are about to drop the column `isDisabled` on the `Artwork` table. All the data in the column will be lost.
  - You are about to drop the column `isNsfw` on the `Artwork` table. All the data in the column will be lost.
  - You are about to drop the column `isSuspicious` on the `Artwork` table. All the data in the column will be lost.
  - You are about to drop the column `resolvedArtist` on the `Artwork` table. All the data in the column will be lost.
  - You are about to drop the column `supply` on the `Artwork` table. All the data in the column will be lost.
  - You are about to drop the column `thumbnailUri` on the `Artwork` table. All the data in the column will be lost.
  - You are about to drop the `ArtistArtworks` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ArtistCollections` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_ArtistToCollection` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ArtistArtworks" DROP CONSTRAINT "ArtistArtworks_artistId_fkey";

-- DropForeignKey
ALTER TABLE "ArtistArtworks" DROP CONSTRAINT "ArtistArtworks_artworkId_fkey";

-- DropForeignKey
ALTER TABLE "ArtistCollections" DROP CONSTRAINT "ArtistCollections_artistId_fkey";

-- DropForeignKey
ALTER TABLE "ArtistCollections" DROP CONSTRAINT "ArtistCollections_collectionId_fkey";

-- DropForeignKey
ALTER TABLE "_ArtistToCollection" DROP CONSTRAINT "_ArtistToCollection_A_fkey";

-- DropForeignKey
ALTER TABLE "_ArtistToCollection" DROP CONSTRAINT "_ArtistToCollection_B_fkey";

-- AlterTable
ALTER TABLE "Artwork" DROP COLUMN "artifactUri",
DROP COLUMN "dimensions",
DROP COLUMN "displayUri",
DROP COLUMN "display_animation_url",
DROP COLUMN "display_image_url",
DROP COLUMN "duration",
DROP COLUMN "fileSize",
DROP COLUMN "isDisabled",
DROP COLUMN "isNsfw",
DROP COLUMN "isSuspicious",
DROP COLUMN "resolvedArtist",
DROP COLUMN "supply",
DROP COLUMN "thumbnailUri",
ADD COLUMN     "creatorAddressId" INTEGER;

-- AlterTable
ALTER TABLE "Collection" ADD COLUMN     "originatingCreatorAddressId" INTEGER;

-- DropTable
DROP TABLE "ArtistArtworks";

-- DropTable
DROP TABLE "ArtistCollections";

-- DropTable
DROP TABLE "_ArtistToCollection";

-- CreateIndex
CREATE INDEX "Artwork_creatorAddressId_idx" ON "Artwork"("creatorAddressId");

-- CreateIndex
CREATE INDEX "Artwork_creatorAddress_blockchain_idx" ON "Artwork"("creatorAddress", "blockchain");

-- CreateIndex
CREATE INDEX "Collection_originatingCreatorAddressId_idx" ON "Collection"("originatingCreatorAddressId");

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_originatingCreatorAddressId_fkey" FOREIGN KEY ("originatingCreatorAddressId") REFERENCES "CreatorAddress"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artwork" ADD CONSTRAINT "Artwork_creatorAddressId_fkey" FOREIGN KEY ("creatorAddressId") REFERENCES "CreatorAddress"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add primaryCreatorAddressId to Artist
ALTER TABLE "Artist" ADD COLUMN "primaryCreatorAddressId" INTEGER;
ALTER TABLE "Artist" ADD CONSTRAINT "Artist_primaryCreatorAddressId_fkey" FOREIGN KEY ("primaryCreatorAddressId") REFERENCES "CreatorAddress"("id") ON DELETE SET NULL ON UPDATE CASCADE;
