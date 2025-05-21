-- AlterTable
ALTER TABLE "Collection" ADD COLUMN     "bannerImageUrl" TEXT,
ADD COLUMN     "chainIdentifier" TEXT,
ADD COLUMN     "contractAddresses" JSONB,
ADD COLUMN     "discordUrl" TEXT,
ADD COLUMN     "fees" JSONB,
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "lastSyncedAt" TIMESTAMP(3),
ADD COLUMN     "mediumUrl" TEXT,
ADD COLUMN     "projectUrl" TEXT,
ADD COLUMN     "safelistStatus" TEXT,
ADD COLUMN     "telegramUrl" TEXT,
ADD COLUMN     "websiteUrl" TEXT;
