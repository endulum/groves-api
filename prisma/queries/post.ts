import { Prisma } from '@prisma/client';

import { client } from '../client';

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

export async function search(opts: {
  before?: string;
  after?: string;
  take: number;
  title: string;
  sort: string;
}) {
  const orderBy: Prisma.PostOrderByWithRelationInput[] = [{ id: 'desc' }];
  switch (opts.sort) {
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

  const cursor = opts.after ?? opts.before;
  const direction = opts.after ? 'forward' : opts.before ? 'backward' : 'none';

  const posts = await client.post.findMany({
    where: {
      status: 'ACTIVE',
      title: { contains: opts.title ?? '' },
    },
    orderBy,
    select: {
      id: true,
      title: true,
      datePosted: true,
      author: { select: { id: true, username: true } },
      _count: { select: { replies: true, upvotes: true, downvotes: true } },
    },
    cursor: cursor ? { id: cursor } : undefined,
    skip: direction === 'none' ? undefined : 1,
    take: (direction === 'backward' ? -1 : 1) * (opts.take + 1),
  });

  const results =
    direction === 'backward'
      ? posts.slice(-opts.take)
      : posts.slice(0, opts.take);

  const hasMore = posts.length > opts.take;

  const nextCursor =
    direction === 'backward' || hasMore ? results.at(-1)?.id : null;
  const prevCursor =
    direction === 'forward' || (direction === 'backward' && hasMore)
      ? results.at(0)?.id
      : null;

  return { results, nextCursor, prevCursor };
}

export async function create(
  communityId: number,
  authorId: number,
  body: {
    title: string;
    content: string;
    status?: 'ACTIVE' | 'HIDDEN' | 'FROZEN';
  },
) {
  const post = await client.post.create({
    data: {
      ...body,
      communityId,
      authorId,
    },
    include: {
      community: true,
      author: true,
    },
  });

  await client.community.update({
    where: { id: communityId },
    data: {
      lastActivity: new Date(),
    },
  });

  return post.id;
  // todo: record action
}

export async function edit(
  postId: string,
  body: { title: string; content: string },
) {
  await client.post.update({
    where: { id: postId },
    data: {
      ...body,
      lastEdited: new Date(),
    },
  });
  // todo: record action
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
  voteType: 'upvote' | 'downvote',
  vote: 'true' | 'false',
) {
  if (voteType === 'upvote') {
    await client.post.update({
      where: { id: postId },
      data: {
        upvotes:
          vote === 'true'
            ? { connect: { id: userId } }
            : { disconnect: { id: userId } },
      },
    });
  } else if (voteType === 'downvote') {
    await client.post.update({
      where: { id: postId },
      data: {
        downvotes:
          vote === 'true'
            ? { connect: { id: userId } }
            : { disconnect: { id: userId } },
      },
    });
  }
}

export async function freeze(
  postId: string,
  postStatus: string,
  freeze: 'true' | 'false',
) {
  if (postStatus === 'ACTIVE' && freeze === 'true') {
    await client.post.update({
      where: { id: postId },
      data: { status: 'FROZEN' },
    });
    // todo: record action
  } else if (postStatus === 'FROZEN' && freeze === 'false') {
    await client.post.update({
      where: { id: postId },
      data: { status: 'ACTIVE' },
    });
    // todo: record action
  }
}

export async function hide(
  postId: string,
  postStatus: string,
  hide: 'true' | 'false',
) {
  if (postStatus === 'ACTIVE' && hide === 'true') {
    await client.post.update({
      where: { id: postId },
      data: { status: 'HIDDEN' },
    });
    // todo: record action
  } else if (postStatus === 'HIDDEN' && hide === 'false') {
    await client.post.update({
      where: { id: postId },
      data: { status: 'ACTIVE' },
    });
    // todo: record action
  }
}