import asyncHandler from 'express-async-handler';
import * as feedQueries from '../../prisma/queries/feed';

export const get = asyncHandler(async (req, res) => {
  const { before, after, take } = req.query as Record<
    string,
    string | undefined
  >;

  const { posts, links } = await feedQueries.get(
    {
      before: before ?? undefined,
      after: after ?? undefined,
      take: take ? (parseInt(take, 10) ?? 20) : 20,
    },
    req.user ? req.user.id : undefined,
  );

  res.json({ posts, links });
});
