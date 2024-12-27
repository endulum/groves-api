/*
  Warnings:

  - You are about to drop the column `activity` on the `Action` table. All the data in the column will be lost.
  - Added the required column `actionType` to the `Action` table without a default value. This is not possible if the table is not empty.
  - Added the required column `actorId` to the `Action` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('CreateCommunity', 'EditCommunity', 'EditWiki', 'PromoteMod', 'DemoteMod', 'FreezeCommunity', 'UnfreezeCommunity', 'CreatePost', 'EditPost', 'FreezePost', 'UnfreezePost', 'CreateReply', 'HideReply', 'UnhideReply');

-- AlterTable
ALTER TABLE "Action" DROP COLUMN "activity",
ADD COLUMN     "actionObjectId" TEXT,
ADD COLUMN     "actionType" "ActionType" NOT NULL,
ADD COLUMN     "actorId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
