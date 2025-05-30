-- AlterTable
ALTER TABLE "Artwork" ADD COLUMN     "display_animation_url" TEXT,
ADD COLUMN     "display_image_url" TEXT,
ADD COLUMN     "duration" DOUBLE PRECISION,
ADD COLUMN     "fileSize" INTEGER,
ADD COLUMN     "mediaMetadata" JSONB;
