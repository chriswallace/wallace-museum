-- This is an empty migration.

-- Drop the indexedData column from ArtworkIndex table
ALTER TABLE "ArtworkIndex" DROP COLUMN IF EXISTS "indexedData";