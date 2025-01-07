import { ActionType } from '@prisma/client';
import { client } from '../client';
import { paginatedResults } from './helpers/paginatedResults';
import { getPageUrls } from './helpers/getPageUrls';

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

export async function getForCommunity(
  communityId: number,
  paginationParams: {
    before?: number;
    after?: number;
    take: number;
  },
  searchParams: {
    type?: string;
  },
) {
  const {
    results: actions,
    nextCursor,
    prevCursor,
  } = await paginatedResults<number>(paginationParams, async (params) =>
    client.action.findMany({
      where: {
        communityId,
        ...(searchParams.type && {
          ...(isValidActionType(searchParams.type)
            ? { type: searchParams.type as ActionType }
            : isValidAction(searchParams.type)
              ? {
                  ...(searchParams.type === 'Community' && {
                    userId: null,
                    postId: null,
                    replyId: null,
                  }),
                  ...(searchParams.type === 'User' && {
                    userId: { not: null },
                    postId: null,
                    replyId: null,
                  }),
                  ...(searchParams.type === 'Post' && {
                    userId: null,
                    postId: { not: null },
                    replyId: null,
                  }),
                  ...(searchParams.type === 'Reply' && {
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
      ...params,
    }),
  );

  const { nextPage, prevPage } = getPageUrls(
    nextCursor?.toString(),
    prevCursor?.toString(),
    searchParams,
    `/community/${communityId}/actions`,
  );

  return { actions, links: { nextPage, prevPage } };
}

export async function getForUser(
  userId: number,
  paginationParams: {
    before?: number;
    after?: number;
    take: number;
  },
) {
  const {
    results: actions,
    nextCursor,
    prevCursor,
  } = await paginatedResults<number>(paginationParams, async (params) =>
    client.action.findMany({
      where: {
        actorId: userId,
        OR: [{ type: 'Post_Create' }, { type: 'Reply_Create' }],
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
            _count: {
              select: {
                upvotes: true,
                downvotes: true,
              },
            },
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
            _count: {
              select: {
                upvotes: true,
                downvotes: true,
              },
            },
          },
        },
      },
      ...params,
    }),
  );

  const { nextPage, prevPage } = getPageUrls(
    nextCursor?.toString(),
    prevCursor?.toString(),
    {},
    `/user/${userId}/actions`,
  );

  return { actions, links: { nextPage, prevPage } };
}
