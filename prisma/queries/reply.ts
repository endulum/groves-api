import { Prisma } from '@prisma/client';
import { client } from '../client';
import { replyQueryNested } from './helpers/replyQueryNested';
import * as actionQueries from './action';

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

export async function getOne(id: string) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { orderBy, take, ...query } = replyQueryNested({
    take: 0,
    levels: 0,
  });
  return await client.reply.findUnique({
    where: { id },
    ...query,
  });
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
    select: {
      id: true,
      parentId: true,
      post: {
        select: {
          id: true,
          communityId: true,
        },
      },
      author: { select: { id: true, username: true } },
      datePosted: true,
      content: true,
      hidden: true,
      _count: {
        select: {
          children: true,
          upvotes: true,
          downvotes: true,
        },
      },
    },
  });

  await actionQueries.create({
    userId: authorId,
    communityId: reply.post.communityId,
    type: 'CreateReply',
    objectId: reply.id,
  });

  return reply;
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

export async function toggleHidden(
  replyId: string,
  hidden: 'true' | 'false',
  modId: number,
) {
  if (hidden === 'true') {
    const { id, post } = await client.reply.update({
      where: { id: replyId },
      data: { hidden: true },
      select: {
        id: true,
        post: {
          select: {
            communityId: true,
          },
        },
      },
    });

    await actionQueries.create({
      userId: modId,
      communityId: post.communityId,
      type: 'HideReply',
      objectId: id,
    });
  }
  if (hidden === 'false') {
    const { id, post } = await client.reply.update({
      where: { id: replyId },
      data: { hidden: false },
      select: {
        id: true,
        post: {
          select: {
            communityId: true,
          },
        },
      },
    });

    await actionQueries.create({
      userId: modId,
      communityId: post.communityId,
      type: 'UnhideReply',
      objectId: id,
    });
  }
}
