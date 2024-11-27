import { Prisma } from '@prisma/client';

import { client } from '../client';

export async function find({ id, urlName }: { id?: number; urlName?: string }) {
  const OR: Prisma.CommunityWhereInput[] = [];
  if (id && !Object.is(id, NaN)) OR.push({ id });
  if (urlName) OR.push({ urlName });
  return client.community.findFirst({
    where: { OR },
    include: {
      admin: { select: { id: true, username: true } },
      moderators: { select: { id: true, username: true } },
      // _count: { select: { followers: true, posts: true } }, // what is this for?
    },
  });
}

export async function search(opts: {
  before?: number; // cursor for paging backwards
  after?: number; // cursor for paging forwards
  take: number; // page size
  name: string;
  sort: string;
}) {
  const orderBy: Prisma.CommunityOrderByWithRelationInput[] = [{ id: 'desc' }];
  switch (opts.sort) {
    case 'followers':
      orderBy.unshift({ followers: { _count: 'desc' } });
      break;
    case 'posts':
      orderBy.unshift({ posts: { _count: 'desc' } });
      break;
    default:
      orderBy.unshift({ lastActivity: 'desc' });
  }

  const cursor = opts.after ?? opts.before;
  const direction = opts.after ? 'forward' : opts.before ? 'backward' : 'none';

  const communities = await client.community.findMany({
    where: {
      status: 'ACTIVE',
      OR: [
        { canonicalName: { contains: opts.name ?? '' } },
        { urlName: { contains: opts.name ?? '' } },
      ],
    },
    orderBy,
    select: {
      id: true,
      urlName: true,
      canonicalName: true,
      description: true,
      lastActivity: true,
      _count: {
        select: { followers: true, posts: true },
      },
    },
    cursor: cursor ? { id: cursor } : undefined,
    skip: direction === 'none' ? undefined : 1,
    take: (direction === 'backward' ? -1 : 1) * (opts.take + 1),
  });

  const results =
    direction === 'backward'
      ? communities.slice(-opts.take)
      : communities.slice(0, opts.take);

  const hasMore = communities.length > opts.take;

  const nextCursor =
    direction === 'backward' || hasMore ? results.at(-1)?.id : null;
  const prevCursor =
    direction === 'forward' || (direction === 'backward' && hasMore)
      ? results.at(0)?.id
      : null;

  return { results, nextCursor, prevCursor };
}

export async function create({
  urlName,
  canonicalName,
  description,
  adminId,
}: {
  urlName: string;
  canonicalName: string;
  description?: string;
  adminId: number;
}) {
  const { id } = await client.community.create({
    data: {
      urlName,
      canonicalName,
      description,
      adminId,
    },
  });
  // todo: record action
  return id;
}

export async function edit(
  id: number,
  {
    urlName,
    canonicalName,
    description,
  }: {
    urlName: string;
    canonicalName: string;
    description?: string;
  },
) {
  await client.community.update({
    where: { id },
    data: {
      urlName,
      canonicalName,
      description,
    },
  });
  // todo: record action
}

export async function editWiki(id: number, content: string | null) {
  await client.community.update({
    where: { id },
    data: { wiki: content },
  });
  // todo: record action
}

export async function findFollowers(commId: number) {
  return client.user.findMany({
    where: {
      communitiesFollowing: { some: { id: commId } },
    },
    select: {
      id: true,
      username: true,
    },
  });
}

export async function follow(
  commId: number,
  userId: number,
  follow: 'true' | 'false',
) {
  const followers = await findFollowers(commId);
  if (follow === 'true' && !followers.find(({ id }) => id === userId)) {
    await client.community.update({
      where: { id: commId },
      data: { followers: { connect: { id: userId } } },
    });
  }
  if (follow === 'false' && followers.find(({ id }) => id === userId)) {
    await client.community.update({
      where: { id: commId },
      data: { followers: { disconnect: { id: userId } } },
    });
  }
}

export async function promoteModerator(id: number, userId: number) {
  await client.community.update({
    where: { id },
    data: {
      moderators: {
        connect: { id: userId },
      },
    },
  });
  // todo: record action
}

export async function demoteModerator(id: number, userId: number) {
  await client.community.update({
    where: { id },
    data: {
      moderators: {
        disconnect: { id: userId },
      },
    },
  });
  // todo: record action
}

export async function freeze(
  commId: number,
  commStatus: 'ACTIVE' | 'FROZEN',
  freeze: 'true' | 'false',
) {
  if (commStatus === 'ACTIVE' && freeze === 'true') {
    await client.community.update({
      where: { id: commId },
      data: { status: 'FROZEN' },
    });
    // todo: record action
  } else if (commStatus === 'FROZEN' && freeze === 'false') {
    await client.community.update({
      where: { id: commId },
      data: { status: 'ACTIVE' },
    });
    // todo: record action
  }
}
