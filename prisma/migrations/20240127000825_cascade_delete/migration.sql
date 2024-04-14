-- DropForeignKey
ALTER TABLE "ArtistArtworks" DROP CONSTRAINT "ArtistArtworks_artworkId_fkey";

-- AddForeignKey
ALTER TABLE "ArtistArtworks" ADD CONSTRAINT "ArtistArtworks_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE CASCADE ON UPDATE CASCADE;
