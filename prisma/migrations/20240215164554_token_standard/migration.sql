/*
  Warnings:

  - You are about to drop the column `symbol` on the `Artwork` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Artwork" DROP COLUMN "symbol",
ADD COLUMN     "tokenStandard" TEXT;
