/*
  Warnings:

  - The values [CreateCommunity,EditCommunity,EditWiki,PromoteMod,DemoteMod,FreezeCommunity,UnfreezeCommunity,CreatePost,EditPost,FreezePost,UnfreezePost,CreateReply,HideReply,UnhideReply] on the enum `ActionType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `actionObjectId` on the `Action` table. All the data in the column will be lost.
  - You are about to drop the column `actionType` on the `Action` table. All the data in the column will be lost.
  - Added the required column `type` to the `Action` table without a default value. This is not possible if the table is not empty.

*/


-- AlterTable
ALTER TABLE "Action" DROP COLUMN "actionObjectId",
DROP COLUMN "actionType",
ADD COLUMN     "postId" TEXT,
ADD COLUMN     "replyId" TEXT,
ADD COLUMN     "type" "ActionType" NOT NULL,
ADD COLUMN     "userId" INTEGER;

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_replyId_fkey" FOREIGN KEY ("replyId") REFERENCES "Reply"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterEnum
BEGIN;
CREATE TYPE "ActionType_new" AS ENUM ('Community_Create', 'Community_Edit', 'Community_EditWiki', 'Community_Freeze', 'Community_Unfreeze', 'User_PromoteMod', 'User_DemoteMod', 'Post_Create', 'Post_Edit', 'Post_Freeze', 'Post_Unfreeze', 'Reply_Create', 'Reply_Hide', 'Reply_Unhide');
ALTER TABLE "Action" ALTER COLUMN "type" TYPE "ActionType_new" USING ("type"::text::"ActionType_new");
ALTER TYPE "ActionType" RENAME TO "ActionType_old";
ALTER TYPE "ActionType_new" RENAME TO "ActionType";
DROP TYPE "ActionType_old";
COMMIT;