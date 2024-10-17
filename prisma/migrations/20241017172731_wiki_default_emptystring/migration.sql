/*
  Warnings:

  - Made the column `wiki` on table `Community` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Community" ALTER COLUMN "wiki" SET NOT NULL,
ALTER COLUMN "wiki" SET DEFAULT '';
