import { Prisma } from '@prisma/client';
import { client } from '../client';
import { replyQueryNested } from './helpers/replyQueryNested';
import { formatReplyResults } from './helpers/formatReplyResults';

export async function getTree(opts: {
  postId: string;
  parentId?: string | null;
  cursor?: string;
  levels?: number;
  takePerLevel?: number;
  takeAtRoot?: number | null;
  sort: string;
}) {
  const levels = opts.levels ?? 3;
  const take = opts.takePerLevel ?? 3;
  const rootTake = opts.takeAtRoot ?? take;

  const orderBy: Prisma.ReplyOrderByWithRelationInput[] = [{ id: 'desc' }];
  switch (opts.sort) {
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
      postId: opts.postId,
      parentId: opts.parentId ?? null,
    },
    ...replyQueryNested({ take, levels, orderBy }),
    cursor: opts.cursor ? { id: opts.cursor } : undefined,
    take: rootTake + 1,
  });

  // const nextCursor = replies.length > rootTake ? replies.at(-1)?.id : undefined;

  // return replies.slice(0, rootTake);
  return formatReplyResults(replies.slice(0, rootTake), {
    takePerLevel: take,
    rebuiltQuery: opts.sort ? `sort=${opts.sort}` : null,
  });
}
