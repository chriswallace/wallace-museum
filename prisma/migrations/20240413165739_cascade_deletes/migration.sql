-- DropForeignKey
ALTER TABLE "ArtistCollections" DROP CONSTRAINT "ArtistCollections_collectionId_fkey";

-- AddForeignKey
ALTER TABLE "ArtistCollections" ADD CONSTRAINT "ArtistCollections_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
