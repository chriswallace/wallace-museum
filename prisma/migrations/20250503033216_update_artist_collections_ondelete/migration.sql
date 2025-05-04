-- DropForeignKey
ALTER TABLE "ArtistCollections" DROP CONSTRAINT "ArtistCollections_artistId_fkey";

-- AddForeignKey
ALTER TABLE "ArtistCollections" ADD CONSTRAINT "ArtistCollections_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
