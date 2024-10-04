/*
  Warnings:

  - A unique constraint covering the columns `[urlName]` on the table `Community` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Community_urlName_key" ON "Community"("urlName");
