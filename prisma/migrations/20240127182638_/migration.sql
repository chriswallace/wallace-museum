/*
  Warnings:

  - You are about to drop the column `blockchain` on the `Collection` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Artwork" ADD COLUMN     "blockchain" TEXT,
ADD COLUMN     "curatorNotes" TEXT;

-- AlterTable
ALTER TABLE "Collection" DROP COLUMN "blockchain";
