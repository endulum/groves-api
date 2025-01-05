import { client } from '../client';
import { paginatedResults } from './helpers/paginatedResults';
import { getPageUrls } from './helpers/getPageUrls';

export async function get(
  paginationParams: {
    before?: string;
    after?: string;
    take: number;
  },
  userId?: number,
) {
  const {
    results: posts,
    nextCursor,
    prevCursor,
  } = await paginatedResults<string>(paginationParams, async (params) =>
    client.post.findMany({
      orderBy: [{ datePosted: 'desc' }, { id: 'desc' }],
      where: {
        ...(userId && {
          authorId: { not: userId },
          community: {
            followers: {
              some: {
                id: userId,
              },
            },
          },
        }),
      },
      select: {
        id: true,
        title: true,
        datePosted: true,
        content: true,
        author: { select: { id: true, username: true } },
        community: { select: { id: true, urlName: true, canonicalName: true } },
        _count: { select: { replies: true, upvotes: true, downvotes: true } },
      },
      ...params,
    }),
  );

  const { nextPage, prevPage } = getPageUrls(
    nextCursor?.toString(),
    prevCursor?.toString(),
    { take: paginationParams.take.toString() },
    userId ? `/feed` : `/all`,
  );

  return { posts, links: { nextPage, prevPage } };
}
