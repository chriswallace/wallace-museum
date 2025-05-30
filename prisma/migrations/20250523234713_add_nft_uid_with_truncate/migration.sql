/*
  Warnings:

  - A unique constraint covering the columns `[nftUid]` on the table `ArtworkIndex` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `nftUid` to the `ArtworkIndex` table without a default value. This is not possible if the table is not empty.

*/

-- Truncate existing data to allow adding the required column
TRUNCATE TABLE "ArtworkIndex" RESTART IDENTITY CASCADE;

-- AlterTable
ALTER TABLE "ArtworkIndex" ADD COLUMN     "nftUid" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ArtworkIndex_nftUid_key" ON "ArtworkIndex"("nftUid");

-- CreateIndex
CREATE INDEX "ArtworkIndex_nftUid_idx" ON "ArtworkIndex"("nftUid");
