-- DropForeignKey
ALTER TABLE "Artwork" DROP CONSTRAINT "Artwork_collectionId_fkey";

-- AlterTable
ALTER TABLE "Artwork" ALTER COLUMN "collectionId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Artwork" ADD CONSTRAINT "Artwork_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
