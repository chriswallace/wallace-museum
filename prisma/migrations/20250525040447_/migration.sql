/*
  Warnings:

  - A unique constraint covering the columns `[contractAddress,tokenId]` on the table `Artwork` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Artwork_tokenStandard_contractAddress_tokenId_key";

-- CreateIndex
CREATE UNIQUE INDEX "Artwork_contractAddress_tokenId_key" ON "Artwork"("contractAddress", "tokenId");
