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
    case 'hot':
      orderBy.unshift({ rating: { hotScore: 'desc' } });
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
      orderBy.unshift({ datePosted: 'desc' });
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
    where: { id },
  });
}

export async function create(
  authorId: number,
  postId: string,
  parentId: string | null,
  content: string,
) {
  const reply = await client.reply.create({
    data: { authorId, postId, parentId, content },
  });
  return reply.id;
  // todo: record adtion
}

export async function didUserVote(replyId: string, userId: number) {
  const user = await client.user.findUnique({
    where: {
      id: userId,
      OR: [
        { repliesUpvoted: { some: { id: replyId } } },
        { repliesDownvoted: { some: { id: replyId } } },
      ],
    },
  });
  return user !== null;
}

export async function vote(
  replyId: string,
  userId: number,
  type: 'upvote' | 'downvote',
  action: 'add' | 'remove',
) {
  if (type === 'upvote') {
    await client.reply.update({
      where: { id: replyId },
      data: {
        upvotes:
          action === 'add'
            ? { connect: { id: userId } }
            : { disconnect: { id: userId } },
      },
    });
  } else if (type === 'downvote') {
    await client.reply.update({
      where: { id: replyId },
      data: {
        downvotes:
          action === 'add'
            ? { connect: { id: userId } }
            : { disconnect: { id: userId } },
      },
    });
  }
}

export async function toggleHidden(id: string, hidden: 'true' | 'false') {
  if (hidden === 'true') {
    await client.reply.update({
      where: { id },
      data: { hidden: true },
    });
  }
  if (hidden === 'false') {
    await client.reply.update({
      where: { id },
      data: { hidden: false },
    });
  }
}

/* export async function freeze(
  replyId: string,
  replyStatus: string,
  freeze: 'true' | 'false',
) {
  if (replyStatus === 'ACTIVE' && freeze === 'true') {
    await client.reply.update({
      where: { id: replyId },
      data: { status: 'FROZEN' },
    });
    // todo: record action
  } else if (replyStatus === 'FROZEN' && freeze === 'false') {
    await client.reply.update({
      where: { id: replyId },
      data: { status: 'ACTIVE' },
    });
    // todo: record action
  }
} */

/* export async function hide(
  replyId: string,
  replyStatus: string,
  hide: 'true' | 'false',
) {
  if (replyStatus === 'ACTIVE' && hide === 'true') {
    await client.reply.update({
      where: { id: replyId },
      data: { status: 'HIDDEN' },
    });
    // todo: record action
  } else if (replyStatus === 'HIDDEN' && hide === 'false') {
    await client.reply.update({
      where: { id: replyId },
      data: { status: 'ACTIVE' },
    });
    // todo: record action
  }
} */
