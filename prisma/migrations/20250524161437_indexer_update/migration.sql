-- AlterTable
ALTER TABLE "Collection" ADD COLUMN     "artBlocksProjectId" INTEGER,
ADD COLUMN     "collectionCreator" TEXT,
ADD COLUMN     "curatorAddress" TEXT,
ADD COLUMN     "currentSupply" INTEGER,
ADD COLUMN     "externalCollectionId" TEXT,
ADD COLUMN     "floorPrice" DOUBLE PRECISION,
ADD COLUMN     "fxhashProjectId" INTEGER,
ADD COLUMN     "isGenerativeArt" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isSharedContract" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mintEndDate" TIMESTAMP(3),
ADD COLUMN     "mintStartDate" TIMESTAMP(3),
ADD COLUMN     "parentContract" TEXT,
ADD COLUMN     "projectNumber" INTEGER,
ADD COLUMN     "totalSupply" INTEGER,
ADD COLUMN     "volumeTraded" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "CreatorAddress" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "profileUrl" TEXT,
ADD COLUMN     "socialLinks" JSONB,
ADD COLUMN     "username" TEXT;

-- CreateIndex
CREATE INDEX "Collection_parentContract_idx" ON "Collection"("parentContract");

-- CreateIndex
CREATE INDEX "Collection_isGenerativeArt_idx" ON "Collection"("isGenerativeArt");

-- CreateIndex
CREATE INDEX "Collection_projectNumber_idx" ON "Collection"("projectNumber");

-- CreateIndex
CREATE INDEX "Collection_curatorAddress_idx" ON "Collection"("curatorAddress");

-- CreateIndex
CREATE INDEX "CreatorAddress_username_idx" ON "CreatorAddress"("username");
