import { Prisma } from '@prisma/client';
import { client } from '../client';
import { replyQueryNested } from './helpers/replyQueryNested';

export async function get(query: {
  postId: string;
  parentId?: string;
  cursor?: string;
  levels: number;
  takePerLevel: number;
  takeAtRoot: number | null;
  sort?: string;
  queryString: string;
}) {
  const orderBy: Prisma.ReplyOrderByWithRelationInput[] = [{ id: 'desc' }];
  switch (query.sort) {
    case 'newest':
      orderBy.unshift({ datePosted: 'desc' });
      break;
    case 'top':
      orderBy.unshift({ rating: { topScore: 'desc' } });
      break;
    case 'best':
      orderBy.unshift({ rating: { bestScore: 'desc' } });
      break;
    case 'controversial':
      orderBy.unshift({ rating: { controversyScore: 'desc' } });
      break;
    default:
      orderBy.unshift({ rating: { hotScore: 'desc' } });
  }

  const replies = await client.reply.findMany({
    where: {
      postId: query.postId,
      parentId: query.parentId ?? null,
    },
    ...replyQueryNested({
      take: query.takePerLevel,
      levels: query.levels,
      orderBy,
    }),
    cursor: query.cursor ? { id: query.cursor } : undefined,
    take: (query.takeAtRoot ?? query.takePerLevel) + 1,
  });

  const cursor =
    replies.length > (query.takeAtRoot ?? query.takePerLevel)
      ? replies.at(-1)?.id
      : undefined;

  return {
    children: replies.slice(0, query.takeAtRoot ?? query.takePerLevel),
    ...(cursor && {
      loadMoreChildren: query.parentId
        ? `/reply/${query.parentId}/replies?cursor=${cursor}${
            query.queryString ? '&' + query.queryString : ''
          }`
        : `/post/${query.postId}/replies?cursor=${cursor}${
            query.queryString ? '&' + query.queryString : ''
          }`,
    }),
  };
}

export async function find(id: string) {
  return await client.reply.findUnique({
    where: { id, status: { not: 'HIDDEN' } },
  });
}

export async function create(
  authorId: number,
  postId: string,
  parentId: string | null,
  content: string,
) {
  await client.reply.create({
    data: { authorId, postId, parentId, content },
  });
  // todo: record adtion
}
