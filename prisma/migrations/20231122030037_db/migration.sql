-- AlterTable
ALTER TABLE "Artwork" ALTER COLUMN "image" DROP NOT NULL,
ALTER COLUMN "video" DROP NOT NULL,
ALTER COLUMN "liveUri" DROP NOT NULL;