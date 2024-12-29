import { ActionType } from '@prisma/client';
import { client } from '../client';

export async function create({
  actorId,
  communityId,
  type,
  actedId,
}: {
  actorId: number;
  communityId: number;
  type: ActionType;
  actedId?: number | string;
}) {
  return await client.action.create({
    data: {
      actorId,
      communityId,
      type,
      ...(type.startsWith('User') && { userId: actedId as number }),
      ...(type.startsWith('Post') && { postId: actedId as string }),
      ...(type.startsWith('Reply') && { replyId: actedId as string }),
    },
  });
}

function isValidActionType(type: string): type is ActionType {
  return Object.values(ActionType).includes(type as ActionType);
}

function isValidAction(type: string) {
  return ['Community', 'User', 'Post', 'Reply'].includes(type);
}

export async function search(
  communityId: number,
  opts: {
    before?: number; // cursor for paging backwards
    after?: number; // cursor for paging forwards
    take: number; // page size
    type?: string;
  },
) {
  const cursor = opts.after ?? opts.before;
  const direction = opts.after ? 'forward' : opts.before ? 'backward' : 'none';

  const actions = await client.action.findMany({
    where: {
      communityId,
      ...(opts.type && {
        ...(isValidActionType(opts.type)
          ? { type: opts.type as ActionType }
          : isValidAction(opts.type)
            ? {
                ...(opts.type === 'Community' && {
                  userId: null,
                  postId: null,
                  replyId: null,
                }),
                ...(opts.type === 'User' && {
                  userId: { not: null },
                  postId: null,
                  replyId: null,
                }),
                ...(opts.type === 'Post' && {
                  userId: null,
                  postId: { not: null },
                  replyId: null,
                }),
                ...(opts.type === 'Reply' && {
                  userId: null,
                  postId: null,
                  replyId: { not: null },
                }),
              }
            : {}),
      }),
    },
    orderBy: [{ date: 'desc' }, { id: 'desc' }],
    select: {
      id: true,
      date: true,
      actor: { select: { id: true, username: true } },
      type: true,
      user: { select: { id: true, username: true } },
      post: { select: { id: true, title: true } },
      reply: {
        select: { id: true, post: { select: { id: true, title: true } } },
      },
    },
    cursor: cursor ? { id: cursor } : undefined,
    skip: direction === 'none' ? undefined : 1,
    take: (direction === 'backward' ? -1 : 1) * (opts.take + 1),
  });

  const results =
    direction === 'backward'
      ? actions.slice(-opts.take)
      : actions.slice(0, opts.take);

  const hasMore = actions.length > opts.take;

  const nextCursor =
    direction === 'backward' || hasMore ? results.at(-1)?.id : null;
  const prevCursor =
    direction === 'forward' || (direction === 'backward' && hasMore)
      ? results.at(0)?.id
      : null;

  return { results, nextCursor, prevCursor };
}

export async function getForUser(
  userId: number,
  opts: {
    before?: number; // cursor for paging backwards
    after?: number; // cursor for paging forwards
    take: number; // page size
  },
) {
  const cursor = opts.after ?? opts.before;
  const direction = opts.after ? 'forward' : opts.before ? 'backward' : 'none';

  const actions = await client.action.findMany({
    where: {
      actorId: userId,
      OR: [{ postId: { not: null } }, { replyId: { not: null } }],
    },
    orderBy: [{ date: 'desc' }, { id: 'desc' }],
    select: {
      id: true,
      date: true,
      type: true,
      community: {
        select: {
          id: true,
          urlName: true,
          canonicalName: true,
        },
      },
      post: {
        select: {
          id: true,
          title: true,
          content: true,
        },
      },
      reply: {
        select: {
          id: true,
          post: {
            select: {
              id: true,
              title: true,
            },
          },
          content: true,
        },
      },
    },
    cursor: cursor ? { id: cursor } : undefined,
    skip: direction === 'none' ? undefined : 1,
    take: (direction === 'backward' ? -1 : 1) * (opts.take + 1),
  });

  const results =
    direction === 'backward'
      ? actions.slice(-opts.take)
      : actions.slice(0, opts.take);

  const hasMore = actions.length > opts.take;

  const nextCursor =
    direction === 'backward' || hasMore ? results.at(-1)?.id : null;
  const prevCursor =
    direction === 'forward' || (direction === 'backward' && hasMore)
      ? results.at(0)?.id
      : null;

  return { results, nextCursor, prevCursor };
}
