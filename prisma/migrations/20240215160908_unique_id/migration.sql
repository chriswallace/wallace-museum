/*
  Warnings:

  - A unique constraint covering the columns `[tokenID,contractAddr]` on the table `Artwork` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Artwork_tokenID_contractAddr_key" ON "Artwork"("tokenID", "contractAddr");
