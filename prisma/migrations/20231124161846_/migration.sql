/*
  Warnings:

  - You are about to drop the column `artworkId` on the `ArtistCollections` table. All the data in the column will be lost.
  - Added the required column `collectionId` to the `Artwork` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "ArtistCollections" DROP CONSTRAINT "ArtistCollections_artworkId_fkey";

-- AlterTable
ALTER TABLE "ArtistCollections" DROP COLUMN "artworkId";

-- AlterTable
ALTER TABLE "Artwork" ADD COLUMN     "collectionId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "Artwork" ADD CONSTRAINT "Artwork_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
