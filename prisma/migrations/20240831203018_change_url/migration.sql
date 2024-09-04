/*
  Warnings:

  - You are about to drop the column `image` on the `Artwork` table. All the data in the column will be lost.
  - You are about to drop the column `liveUri` on the `Artwork` table. All the data in the column will be lost.
  - You are about to drop the column `video` on the `Artwork` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Artwork" DROP COLUMN "image",
DROP COLUMN "liveUri",
DROP COLUMN "video",
ADD COLUMN     "animation_url" TEXT,
ADD COLUMN     "image_url" TEXT;
