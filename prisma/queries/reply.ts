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
}) {
  const levels = opts.levels ?? 3;
  const take = opts.takePerLevel ?? 3;
  const rootTake = opts.takeAtRoot ?? take;

  const replies = await client.reply.findMany({
    where: {
      postId: opts.postId,
      parentId: opts.parentId ?? null,
    },
    ...replyQueryNested({ take, levels }),
    cursor: opts.cursor ? { id: opts.cursor } : undefined,
    take: rootTake + 1,
  });

  // const nextCursor = replies.length > rootTake ? replies.at(-1)?.id : undefined;

  // return replies.slice(0, rootTake);
  return formatReplyResults(replies.slice(0, rootTake), {
    takePerLevel: take,
    rebuiltQuery: 'owo=uwu',
  });
}
