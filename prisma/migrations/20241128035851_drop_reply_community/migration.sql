/*
  Warnings:

  - You are about to drop the column `communityId` on the `Reply` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Reply" DROP CONSTRAINT "Reply_communityId_fkey";

-- AlterTable
ALTER TABLE "Reply" DROP COLUMN "communityId";
