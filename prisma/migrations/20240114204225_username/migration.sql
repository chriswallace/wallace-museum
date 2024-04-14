/*
  Warnings:

  - You are about to drop the column `name` on the `AdminUser` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "AdminUser" DROP COLUMN "name",
ADD COLUMN     "username" TEXT;
