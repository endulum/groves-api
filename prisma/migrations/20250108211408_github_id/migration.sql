-- AlterTable
ALTER TABLE "User" ADD COLUMN     "githubId" INTEGER,
ALTER COLUMN "password" DROP NOT NULL;
