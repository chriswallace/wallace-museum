/*
  Warnings:

  - You are about to drop the `CollectionMapping` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "CollectionMapping" DROP CONSTRAINT "CollectionMapping_collectionId_fkey";

-- DropTable
DROP TABLE "CollectionMapping";
