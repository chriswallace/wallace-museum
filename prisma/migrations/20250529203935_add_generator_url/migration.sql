/*
  Warnings:

  - You are about to drop the column `originatingWalletAddressId` on the `Collection` table. All the data in the column will be lost.
  - You are about to drop the `WalletAddress` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_ArtworkWalletAddresses` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Collection" DROP CONSTRAINT "Collection_originatingWalletAddressId_fkey";

-- DropForeignKey
ALTER TABLE "WalletAddress" DROP CONSTRAINT "WalletAddress_artistId_fkey";

-- DropForeignKey
ALTER TABLE "_ArtworkWalletAddresses" DROP CONSTRAINT "_ArtworkWalletAddresses_A_fkey";

-- DropForeignKey
ALTER TABLE "_ArtworkWalletAddresses" DROP CONSTRAINT "_ArtworkWalletAddresses_B_fkey";

-- DropIndex
DROP INDEX "Collection_originatingWalletAddressId_idx";

-- AlterTable
ALTER TABLE "Artist" ADD COLUMN     "walletAddresses" JSONB;

-- AlterTable
ALTER TABLE "Artwork" ADD COLUMN     "generatorUrl" TEXT;

-- AlterTable
ALTER TABLE "Collection" DROP COLUMN "originatingWalletAddressId";

-- DropTable
DROP TABLE "WalletAddress";

-- DropTable
DROP TABLE "_ArtworkWalletAddresses";

-- CreateTable
CREATE TABLE "_ArtistArtworks" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_ArtistArtworks_AB_unique" ON "_ArtistArtworks"("A", "B");

-- CreateIndex
CREATE INDEX "_ArtistArtworks_B_index" ON "_ArtistArtworks"("B");

-- AddForeignKey
ALTER TABLE "_ArtistArtworks" ADD CONSTRAINT "_ArtistArtworks_A_fkey" FOREIGN KEY ("A") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ArtistArtworks" ADD CONSTRAINT "_ArtistArtworks_B_fkey" FOREIGN KEY ("B") REFERENCES "Artwork"("id") ON DELETE CASCADE ON UPDATE CASCADE;
