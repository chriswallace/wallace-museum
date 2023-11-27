/*
  Warnings:

  - You are about to drop the column `artistId` on the `Artwork` table. All the data in the column will be lost.
  - You are about to drop the column `collectionId` on the `Artwork` table. All the data in the column will be lost.
  - You are about to drop the `_ArtistToCollection` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Artwork" DROP CONSTRAINT "Artwork_artistId_fkey";

-- DropForeignKey
ALTER TABLE "Artwork" DROP CONSTRAINT "Artwork_collectionId_fkey";

-- DropForeignKey
ALTER TABLE "_ArtistToCollection" DROP CONSTRAINT "_ArtistToCollection_A_fkey";

-- DropForeignKey
ALTER TABLE "_ArtistToCollection" DROP CONSTRAINT "_ArtistToCollection_B_fkey";

-- AlterTable
ALTER TABLE "ArtistCollections" ADD COLUMN     "artworkId" INTEGER;

-- AlterTable
ALTER TABLE "Artwork" DROP COLUMN "artistId",
DROP COLUMN "collectionId";

-- DropTable
DROP TABLE "_ArtistToCollection";

-- AddForeignKey
ALTER TABLE "ArtistCollections" ADD CONSTRAINT "ArtistCollections_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE SET NULL ON UPDATE CASCADE;
