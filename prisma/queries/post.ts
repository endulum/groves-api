import { Prisma } from '@prisma/client';

import { client } from '../client';
import * as actionQueries from './action';
import { paginatedResults } from './helpers/paginatedResults';
import { getPageUrls } from './helpers/getPageUrls';

export async function find(id: string) {
  return client.post.findUnique({
    where: { id },
    include: {
      upvotes: { select: { id: true } },
      downvotes: { select: { id: true } },
      author: {
        select: {
          id: true,
          username: true,
        },
      },
      community: {
        select: {
          id: true,
          urlName: true,
          canonicalName: true,
        },
      },
      _count: {
        select: {
          upvotes: true,
          downvotes: true,
          replies: true,
        },
      },
    },
    omit: {
      authorId: true,
      communityId: true,
    },
  });
}

export async function search(
  communityUrl: string,
  paginationParams: {
    before?: string;
    after?: string;
    take: number;
  },
  searchParams: {
    title: string;
    sort: string;
    includeFrozen: string;
  },
) {
  const orderBy: Prisma.PostOrderByWithRelationInput[] = [{ id: 'desc' }];
  switch (searchParams.sort) {
    case 'newest':
      orderBy.unshift({ datePosted: 'desc' });
      break;
    case 'replies':
      orderBy.unshift({ replies: { _count: 'desc' } });
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

  const {
    results: posts,
    nextCursor,
    prevCursor,
  } = await paginatedResults<string>(paginationParams, async (params) =>
    client.post.findMany({
      where: {
        ...(!(searchParams.includeFrozen === 'true') && { readonly: false }),
        title: { contains: searchParams.title ?? '' },
        community: { urlName: communityUrl },
      },
      orderBy,
      select: {
        id: true,
        title: true,
        datePosted: true,
        author: { select: { id: true, username: true } },
        _count: { select: { replies: true, upvotes: true, downvotes: true } },
      },
      ...params,
    }),
  );

  const { nextPage, prevPage } = getPageUrls(
    nextCursor?.toString(),
    prevCursor?.toString(),
    {
      ...searchParams,
      take: paginationParams.take.toString(),
      ...(searchParams.includeFrozen === 'true' && { includeFrozen: 'true' }),
    },
    `/community/${communityUrl}/posts`,
  );

  return { posts, links: { nextPage, prevPage } };
}

export async function create(
  communityId: number,
  authorId: number,
  body: {
    title: string;
    content: string;
  },
) {
  const { id } = await client.post.create({
    data: {
      ...body,
      communityId,
      authorId,
    },
  });

  await client.community.update({
    where: { id: communityId },
    data: {
      lastActivity: new Date(),
    },
  });

  await actionQueries.create({
    actorId: authorId,
    communityId,
    type: 'Post_Create',
    actedId: id,
  });

  return id;
}

export async function edit(
  postId: string,
  body: { title: string; content: string },
) {
  const { authorId, communityId } = await client.post.update({
    where: { id: postId },
    data: {
      ...body,
      lastEdited: new Date(),
    },
  });

  await actionQueries.create({
    actorId: authorId,
    communityId,
    type: 'Post_Edit',
    actedId: postId,
  });
}

export async function didUserVote(postId: string, userId: number) {
  const user = await client.user.findUnique({
    where: {
      id: userId,
      OR: [
        { postsUpvoted: { some: { id: postId } } },
        { postsDownvoted: { some: { id: postId } } },
      ],
    },
  });
  return user !== null;
}

export async function vote(
  postId: string,
  userId: number,
  type: 'upvote' | 'downvote',
  action: 'add' | 'remove',
) {
  if (type === 'upvote') {
    await client.post.update({
      where: { id: postId },
      data: {
        upvotes:
          action === 'add'
            ? { connect: { id: userId } }
            : { disconnect: { id: userId } },
      },
    });
  } else if (type === 'downvote') {
    await client.post.update({
      where: { id: postId },
      data: {
        downvotes:
          action === 'add'
            ? { connect: { id: userId } }
            : { disconnect: { id: userId } },
      },
    });
  }
}

export async function toggleReadonly(
  id: string,
  readonly: 'true' | 'false',
  modId: number,
) {
  if (readonly === 'true') {
    const { communityId } = await client.post.update({
      where: { id },
      data: { readonly: true },
    });

    await actionQueries.create({
      actorId: modId,
      communityId,
      type: 'Post_Freeze',
      actedId: id,
    });
  }
  if (readonly === 'false') {
    const { communityId } = await client.post.update({
      where: { id },
      data: { readonly: false },
    });

    await actionQueries.create({
      actorId: modId,
      communityId,
      type: 'Post_Unfreeze',
      actedId: id,
    });
  }
}

// max two pinned posts allowed per comm
export async function togglePinned(
  id: string,
  pinned: 'true' | 'false',
  modId: number,
) {
  if (pinned === 'true') {
    const { communityId } = await client.post.update({
      where: { id },
      data: { pinned: true },
    });

    await actionQueries.create({
      actorId: modId,
      communityId,
      type: 'Post_Pin',
      actedId: id,
    });
  }
  if (pinned === 'false') {
    const { communityId } = await client.post.update({
      where: { id },
      data: { pinned: false },
    });

    await actionQueries.create({
      actorId: modId,
      communityId,
      type: 'Post_Unpin',
      actedId: id,
    });
  }
}

export async function findPinned(communityId: number) {
  return await client.post.findMany({
    where: {
      communityId,
      pinned: true,
    },
    include: {
      upvotes: { select: { id: true } },
      downvotes: { select: { id: true } },
      author: {
        select: {
          id: true,
          username: true,
        },
      },
      community: {
        select: {
          id: true,
          urlName: true,
          canonicalName: true,
        },
      },
      _count: {
        select: {
          upvotes: true,
          downvotes: true,
          replies: true,
        },
      },
    },
    omit: {
      authorId: true,
      communityId: true,
    },
  });
}
