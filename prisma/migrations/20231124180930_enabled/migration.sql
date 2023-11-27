/*
  Warnings:

  - Added the required column `enabled` to the `Artwork` table without a default value. This is not possible if the table is not empty.
  - Added the required column `enabled` to the `Collection` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Artwork" ADD COLUMN     "enabled" BOOLEAN NOT NULL;

-- AlterTable
ALTER TABLE "Collection" ADD COLUMN     "enabled" BOOLEAN NOT NULL;
