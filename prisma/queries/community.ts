import { Prisma } from '@prisma/client';

import { client } from '../client';
import * as actionQueries from './action';

import { paginatedResults } from './helpers/paginatedResults';
import { getPageUrls } from './helpers/getPageUrls';

export async function find({ id, urlName }: { id?: number; urlName?: string }) {
  const OR: Prisma.CommunityWhereInput[] = [];
  if (id && !Object.is(id, NaN)) OR.push({ id });
  if (urlName) OR.push({ urlName });
  return client.community.findFirst({
    where: { OR },
    include: {
      admin: { select: { id: true, username: true } },
      moderators: { select: { id: true, username: true } },
      _count: { select: { followers: true, posts: true } },
    },
  });
}

export async function search(
  paginationParams: {
    before?: number;
    after?: number;
    take: number;
  },
  searchParams: {
    name: string;
    sort: string;
  },
) {
  const orderBy: Prisma.CommunityOrderByWithRelationInput[] = [{ id: 'desc' }];
  switch (searchParams.sort) {
    case 'followers':
      orderBy.unshift({ followers: { _count: 'desc' } });
      break;
    case 'posts':
      orderBy.unshift({ posts: { _count: 'desc' } });
      break;
    default:
      orderBy.unshift({ lastActivity: 'desc' });
  }

  const {
    results: communities,
    nextCursor,
    prevCursor,
  } = await paginatedResults<number>(paginationParams, async (params) =>
    client.community.findMany({
      ...params,
      where: {
        readonly: false,
        OR: [
          { canonicalName: { contains: searchParams.name ?? '' } },
          { urlName: { contains: searchParams.name ?? '' } },
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
    }),
  );

  const { nextPage, prevPage } = getPageUrls(
    nextCursor?.toString(),
    prevCursor?.toString(),
    {
      ...searchParams,
      take: paginationParams.take.toString(),
    },
    `/communities`,
  );

  return { communities, links: { nextPage, prevPage } };
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

  await actionQueries.create({
    actorId: adminId,
    communityId: id,
    type: 'Community_Create',
  });

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
  const { adminId } = await client.community.update({
    where: { id },
    data: {
      urlName,
      canonicalName,
      description,
    },
  });

  await actionQueries.create({
    actorId: adminId,
    communityId: id,
    type: 'Community_Edit',
  });
}

export async function editWiki(
  id: number,
  content: string | null,
  editorId: number,
) {
  await client.community.update({
    where: { id },
    data: { wiki: content },
  });

  await actionQueries.create({
    actorId: editorId,
    communityId: id,
    type: 'Community_EditWiki',
  });
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
  const { adminId } = await client.community.update({
    where: { id },
    data: {
      moderators: {
        connect: { id: userId },
      },
    },
  });

  await actionQueries.create({
    actorId: adminId,
    communityId: id,
    type: 'User_PromoteMod',
    actedId: userId,
  });
}

export async function demoteModerator(id: number, userId: number) {
  const { adminId } = await client.community.update({
    where: { id },
    data: {
      moderators: {
        disconnect: { id: userId },
      },
    },
  });

  await actionQueries.create({
    actorId: adminId,
    communityId: id,
    type: 'User_DemoteMod',
    actedId: userId,
  });
}

export async function changeAdmin(id: number, userId: number) {
  const { adminId } = await client.community.update({
    where: { id },
    data: {
      adminId: userId,
      moderators: {
        disconnect: { id: userId },
      },
    },
  });

  await actionQueries.create({
    actorId: adminId,
    communityId: id,
    type: 'User_ChangeAdmin',
    actedId: userId,
  });
}

export async function toggleReadonly(id: number, readonly: 'true' | 'false') {
  if (readonly === 'true') {
    const { adminId } = await client.community.update({
      where: { id },
      data: { readonly: true },
    });

    await actionQueries.create({
      actorId: adminId,
      communityId: id,
      type: 'Community_Freeze',
    });
  }
  if (readonly === 'false') {
    const { adminId } = await client.community.update({
      where: { id },
      data: { readonly: false },
    });

    await actionQueries.create({
      actorId: adminId,
      communityId: id,
      type: 'Community_Unfreeze',
    });
  }
}
