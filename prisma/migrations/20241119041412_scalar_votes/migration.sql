/*
  Warnings:

  - You are about to drop the column `downvotes` on the `Post` table. All the data in the column will be lost.
  - You are about to drop the column `upvotes` on the `Post` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Post" DROP COLUMN "downvotes",
DROP COLUMN "upvotes";

-- CreateTable
CREATE TABLE "_postUpvotes" (
    "A" TEXT NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "_postDownvotes" (
    "A" TEXT NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_postUpvotes_AB_unique" ON "_postUpvotes"("A", "B");

-- CreateIndex
CREATE INDEX "_postUpvotes_B_index" ON "_postUpvotes"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_postDownvotes_AB_unique" ON "_postDownvotes"("A", "B");

-- CreateIndex
CREATE INDEX "_postDownvotes_B_index" ON "_postDownvotes"("B");

-- AddForeignKey
ALTER TABLE "_postUpvotes" ADD CONSTRAINT "_postUpvotes_A_fkey" FOREIGN KEY ("A") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_postUpvotes" ADD CONSTRAINT "_postUpvotes_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_postDownvotes" ADD CONSTRAINT "_postDownvotes_A_fkey" FOREIGN KEY ("A") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_postDownvotes" ADD CONSTRAINT "_postDownvotes_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
