/*
  Warnings:

  - You are about to alter the column `bio` on the `User` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(256)`.

*/
-- AlterTable
ALTER TABLE "Community" ALTER COLUMN "description" DROP NOT NULL,
ALTER COLUMN "wiki" DROP NOT NULL,
ALTER COLUMN "wiki" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "bio" SET DATA TYPE VARCHAR(256);
