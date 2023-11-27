/*
  Warnings:

  - Made the column `image` on table `Artwork` required. This step will fail if there are existing NULL values in that column.
  - Made the column `video` on table `Artwork` required. This step will fail if there are existing NULL values in that column.
  - Made the column `liveUri` on table `Artwork` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Artwork" ALTER COLUMN "image" SET NOT NULL,
ALTER COLUMN "video" SET NOT NULL,
ALTER COLUMN "liveUri" SET NOT NULL;
