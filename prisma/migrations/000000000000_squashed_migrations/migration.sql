-- CreateEnum
CREATE TYPE "Role" AS ENUM ('BASIC', 'ADMIN');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(32) NOT NULL,
    "password" VARCHAR NOT NULL,
    "joined" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bio" VARCHAR(256),
    "role" "Role" NOT NULL DEFAULT 'BASIC',

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Community" (
    "id" SERIAL NOT NULL,
    "urlName" VARCHAR(32) NOT NULL,
    "canonicalName" VARCHAR(64) NOT NULL,
    "description" VARCHAR(256),
    "wiki" TEXT,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readonly" BOOLEAN NOT NULL DEFAULT false,
    "adminId" INTEGER NOT NULL,

    CONSTRAINT "Community_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(64) NOT NULL,
    "content" TEXT NOT NULL,
    "datePosted" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastEdited" TIMESTAMP(3),
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "readonly" BOOLEAN NOT NULL DEFAULT false,
    "authorId" INTEGER NOT NULL,
    "communityId" INTEGER NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reply" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "datePosted" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "authorId" INTEGER NOT NULL,
    "postId" TEXT NOT NULL,
    "parentId" TEXT,

    CONSTRAINT "Reply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Action" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activity" TEXT NOT NULL,
    "communityId" INTEGER NOT NULL,

    CONSTRAINT "Action_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_communityFollowers" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "_communityModerators" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

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

-- CreateTable
CREATE TABLE "_replyUpvotes" (
    "A" TEXT NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "_replyDownvotes" (
    "A" TEXT NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Community_urlName_key" ON "Community"("urlName");

-- CreateIndex
CREATE UNIQUE INDEX "_communityFollowers_AB_unique" ON "_communityFollowers"("A", "B");

-- CreateIndex
CREATE INDEX "_communityFollowers_B_index" ON "_communityFollowers"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_communityModerators_AB_unique" ON "_communityModerators"("A", "B");

-- CreateIndex
CREATE INDEX "_communityModerators_B_index" ON "_communityModerators"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_postUpvotes_AB_unique" ON "_postUpvotes"("A", "B");

-- CreateIndex
CREATE INDEX "_postUpvotes_B_index" ON "_postUpvotes"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_postDownvotes_AB_unique" ON "_postDownvotes"("A", "B");

-- CreateIndex
CREATE INDEX "_postDownvotes_B_index" ON "_postDownvotes"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_replyUpvotes_AB_unique" ON "_replyUpvotes"("A", "B");

-- CreateIndex
CREATE INDEX "_replyUpvotes_B_index" ON "_replyUpvotes"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_replyDownvotes_AB_unique" ON "_replyDownvotes"("A", "B");

-- CreateIndex
CREATE INDEX "_replyDownvotes_B_index" ON "_replyDownvotes"("B");

-- AddForeignKey
ALTER TABLE "Community" ADD CONSTRAINT "Community_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reply" ADD CONSTRAINT "Reply_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reply" ADD CONSTRAINT "Reply_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reply" ADD CONSTRAINT "Reply_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Reply"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_communityFollowers" ADD CONSTRAINT "_communityFollowers_A_fkey" FOREIGN KEY ("A") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_communityFollowers" ADD CONSTRAINT "_communityFollowers_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_communityModerators" ADD CONSTRAINT "_communityModerators_A_fkey" FOREIGN KEY ("A") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_communityModerators" ADD CONSTRAINT "_communityModerators_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_postUpvotes" ADD CONSTRAINT "_postUpvotes_A_fkey" FOREIGN KEY ("A") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_postUpvotes" ADD CONSTRAINT "_postUpvotes_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_postDownvotes" ADD CONSTRAINT "_postDownvotes_A_fkey" FOREIGN KEY ("A") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_postDownvotes" ADD CONSTRAINT "_postDownvotes_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_replyUpvotes" ADD CONSTRAINT "_replyUpvotes_A_fkey" FOREIGN KEY ("A") REFERENCES "Reply"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_replyUpvotes" ADD CONSTRAINT "_replyUpvotes_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_replyDownvotes" ADD CONSTRAINT "_replyDownvotes_A_fkey" FOREIGN KEY ("A") REFERENCES "Reply"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_replyDownvotes" ADD CONSTRAINT "_replyDownvotes_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PostRating
CREATE OR REPLACE VIEW "PostRating" AS SELECT
  "votedPosts".id as "postId", 
  "votedPosts".upvotes as upvotes, 
  "votedPosts".downvotes as downvotes,
  (upvotes - downvotes) as "topScore",
  (CASE WHEN (downvotes = 0 AND upvotes = 0) THEN 0 ELSE (
  	TRUNC(((upvotes + 1.9208) / (upvotes + downvotes) - 1.96 * SQRT(
    	(upvotes * downvotes) / (upvotes + downvotes) + 0.9604
  	) / (upvotes + downvotes)) / (1 + 3.8416 / (upvotes + downvotes))::numeric, 3)
  ) END) AS "bestScore",
  TRUNC((
    (CASE WHEN ((upvotes - downvotes) > 0) THEN 1 WHEN (upvotes - downvotes) < 0 THEN -1 ELSE 0 END) 
    * LOG(GREATEST(ABS((upvotes - downvotes)), 1)) 
    + ((EXTRACT(EPOCH FROM NOW())) / 100000)
  )::numeric, 3) AS "hotScore",
  (CASE WHEN (downvotes = 0 AND upvotes = 0) THEN 0 ELSE (
  	TRUNC(POWER((upvotes + downvotes), (
    	CASE WHEN (upvotes > downvotes) 
    	THEN CAST(downvotes AS DECIMAL)/upvotes 
    	ELSE CAST(upvotes AS DECIMAL)/downvotes 
    	END
  	))::numeric, 3)
  ) END) AS "controversyScore"
FROM (
  SELECT "Post".*, COALESCE(ups, 0) AS upvotes, COALESCE(downs, 0) AS downvotes
  FROM "Post"
    LEFT JOIN (
      SELECT "Post"."id" AS "id", COUNT("_postUpvotes"."B") AS "ups"
		  FROM "_postUpvotes" 
		  JOIN "Post" ON "_postUpvotes"."A" = "Post"."id"
		  GROUP BY "Post"."id"
    ) AS u ON u.id = "Post".id
    LEFT JOIN (
      SELECT "Post"."id" AS "id", COUNT("_postDownvotes"."B") AS "downs"
		  FROM "_postDownvotes" 
		  JOIN "Post" ON "_postDownvotes"."A" = "Post"."id"
		  GROUP BY "Post"."id"
    ) AS d ON d.id = "Post".id
) AS "votedPosts";

-- ReplyRating
CREATE OR REPLACE VIEW "ReplyRating" AS SELECT
  "votedReplies".id as "replyId", 
  "votedReplies".upvotes as upvotes, 
  "votedReplies".downvotes as downvotes,
  (upvotes - downvotes) as "topScore",
  (CASE WHEN (downvotes = 0 AND upvotes = 0) THEN 0 ELSE (
  	TRUNC(((upvotes + 1.9208) / (upvotes + downvotes) - 1.96 * SQRT(
    	(upvotes * downvotes) / (upvotes + downvotes) + 0.9604
  	) / (upvotes + downvotes)) / (1 + 3.8416 / (upvotes + downvotes))::numeric, 3)
  ) END) AS "bestScore",
  TRUNC((
    (CASE WHEN ((upvotes - downvotes) > 0) THEN 1 WHEN (upvotes - downvotes) < 0 THEN -1 ELSE 0 END) 
    * LOG(GREATEST(ABS((upvotes - downvotes)), 1)) 
    + ((EXTRACT(EPOCH FROM NOW())) / 100000)
  )::numeric, 3) AS "hotScore",
  (CASE WHEN (downvotes = 0 AND upvotes = 0) THEN 0 ELSE (
  	TRUNC(POWER((upvotes + downvotes), (
    	CASE WHEN (upvotes > downvotes) 
    	THEN CAST(downvotes AS DECIMAL)/upvotes 
    	ELSE CAST(upvotes AS DECIMAL)/downvotes 
    	END
  	))::numeric, 3)
  ) END) AS "controversyScore"
FROM (
  SELECT "Reply".*, COALESCE(ups, 0) AS upvotes, COALESCE(downs, 0) AS downvotes
  FROM "Reply"
    LEFT JOIN (
      SELECT "Reply"."id" AS "id", COUNT("_replyUpvotes"."B") AS "ups"
		  FROM "_replyUpvotes" 
		  JOIN "Reply" ON "_replyUpvotes"."A" = "Reply"."id"
		  GROUP BY "Reply"."id"
    ) AS u ON u.id = "Reply".id
    LEFT JOIN (
      SELECT "Reply"."id" AS "id", COUNT("_replyDownvotes"."B") AS "downs"
		  FROM "_replyDownvotes" 
		  JOIN "Reply" ON "_replyDownvotes"."A" = "Reply"."id"
		  GROUP BY "Reply"."id"
    ) AS d ON d.id = "Reply".id
) AS "votedReplies";