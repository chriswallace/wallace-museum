/*
  Warnings:

  - Added the required column `artistId` to the `Artwork` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Artwork" ADD COLUMN     "artistId" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "_ArtistToCollection" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_ArtistToCollection_AB_unique" ON "_ArtistToCollection"("A", "B");

-- CreateIndex
CREATE INDEX "_ArtistToCollection_B_index" ON "_ArtistToCollection"("B");

-- AddForeignKey
ALTER TABLE "Artwork" ADD CONSTRAINT "Artwork_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ArtistToCollection" ADD CONSTRAINT "_ArtistToCollection_A_fkey" FOREIGN KEY ("A") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ArtistToCollection" ADD CONSTRAINT "_ArtistToCollection_B_fkey" FOREIGN KEY ("B") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
