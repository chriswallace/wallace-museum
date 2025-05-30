-- DropForeignKey
ALTER TABLE "WalletAddress" DROP CONSTRAINT "WalletAddress_artistId_fkey";

-- AlterTable
ALTER TABLE "WalletAddress" ALTER COLUMN "artistId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "WalletAddress" ADD CONSTRAINT "WalletAddress_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE SET NULL ON UPDATE CASCADE;
