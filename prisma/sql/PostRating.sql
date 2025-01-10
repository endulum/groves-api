

-- PostRating.sql
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
 
-- https://github.com/reddit-archive/reddit/blob/master/r2/r2/lib/db/_sorts.pyx
-- https://old.reddit.com/r/graphql/comments/oczbkb/how_can_i_sort_items_by_custom_value_in_prisma/
-- https://www.evanmiller.org/how-not-to-sort-by-average-rating.html
-- https://www.prisma.io/docs/orm/prisma-migrate/workflows/unsupported-database-features#customize-a-migration-to-include-an-unsupported-feature