/*
  Warnings:

  - You are about to drop the column `artistId` on the `Artwork` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "ArtistArtworks" DROP CONSTRAINT "ArtistArtworks_artistId_fkey";

-- DropForeignKey
ALTER TABLE "Artwork" DROP CONSTRAINT "Artwork_artistId_fkey";

-- AlterTable
ALTER TABLE "Artwork" DROP COLUMN "artistId";

-- AddForeignKey
ALTER TABLE "ArtistArtworks" ADD CONSTRAINT "ArtistArtworks_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
