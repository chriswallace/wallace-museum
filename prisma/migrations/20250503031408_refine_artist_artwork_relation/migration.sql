/*
  Warnings:

  - You are about to drop the column `artistId` on the `Artwork` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "ArtistArtworks" DROP CONSTRAINT "ArtistArtworks_artistId_fkey";

-- DropForeignKey
ALTER TABLE "ArtistArtworks" DROP CONSTRAINT "ArtistArtworks_artworkId_fkey";

-- AlterTable
ALTER TABLE "Artwork" DROP COLUMN IF EXISTS "artistId";

-- AddForeignKey
ALTER TABLE "ArtistArtworks" ADD CONSTRAINT "ArtistArtworks_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtistArtworks" ADD CONSTRAINT "ArtistArtworks_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE CASCADE ON UPDATE CASCADE;
