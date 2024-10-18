/*
  Warnings:

  - Made the column `lastActivity` on table `Community` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Community" ALTER COLUMN "lastActivity" SET NOT NULL,
ALTER COLUMN "lastActivity" SET DEFAULT CURRENT_TIMESTAMP;
