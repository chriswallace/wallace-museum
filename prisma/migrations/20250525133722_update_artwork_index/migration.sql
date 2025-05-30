-- AlterTable
ALTER TABLE "ArtworkIndex" ADD COLUMN     "artistUsername" TEXT,
ADD COLUMN     "artistWalletAddress" TEXT,
ADD COLUMN     "tokenMetadata" JSONB,
ADD COLUMN     "tokenName" TEXT,
ADD COLUMN     "tokenThumbnail" TEXT;

-- CreateIndex
CREATE INDEX "ArtworkIndex_tokenName_idx" ON "ArtworkIndex"("tokenName");

-- CreateIndex
CREATE INDEX "ArtworkIndex_artistWalletAddress_idx" ON "ArtworkIndex"("artistWalletAddress");

-- CreateIndex
CREATE INDEX "ArtworkIndex_artistUsername_idx" ON "ArtworkIndex"("artistUsername");
