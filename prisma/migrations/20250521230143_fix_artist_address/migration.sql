-- CreateTable
CREATE TABLE "ArtistAddress" (
    "id" SERIAL NOT NULL,
    "address" TEXT NOT NULL,
    "blockchain" TEXT NOT NULL,
    "artistId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArtistAddress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArtistAddress_artistId_idx" ON "ArtistAddress"("artistId");

-- CreateIndex
CREATE UNIQUE INDEX "ArtistAddress_address_blockchain_key" ON "ArtistAddress"("address", "blockchain");

-- AddForeignKey
ALTER TABLE "ArtistAddress" ADD CONSTRAINT "ArtistAddress_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
