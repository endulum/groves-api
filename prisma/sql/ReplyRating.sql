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