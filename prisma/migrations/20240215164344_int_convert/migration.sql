/*
  Warnings:

  - The `totalSupply` column on the `Artwork` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Artwork" DROP COLUMN "totalSupply",
ADD COLUMN     "totalSupply" INTEGER;
