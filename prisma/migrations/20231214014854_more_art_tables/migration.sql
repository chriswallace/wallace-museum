-- AlterTable
ALTER TABLE "Artwork" ADD COLUMN     "contractAddr" TEXT,
ADD COLUMN     "contractAlias" TEXT,
ADD COLUMN     "mintDate" TIMESTAMP(3),
ADD COLUMN     "symbol" TEXT,
ADD COLUMN     "tokenID" INTEGER,
ADD COLUMN     "totalSupply" TEXT;
