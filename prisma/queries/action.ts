import { type ActionType } from '@prisma/client';
import { client } from '../client';

export async function create({
  userId,
  communityId,
  objectId,
  type,
}: {
  userId: number;
  communityId: number;
  type: ActionType;
  objectId: string | null;
}) {
  return await client.action.create({
    data: {
      actorId: userId,
      communityId,
      actionObjectId: objectId,
      actionType: type,
    },
  });
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
        actionType: opts.type as ActionType,
      }),
    },
    orderBy: { date: 'desc' },
    select: {
      id: true,
      date: true,
      actor: {
        select: {
          id: true,
          username: true,
        },
      },
      actionType: true,
      actionObjectId: true,
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
