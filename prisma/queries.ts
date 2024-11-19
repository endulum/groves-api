import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

import { client } from './client';
import * as fakes from './fakes';

// finding a thing

export async function findUser(find: { username?: string; id?: number }) {
  return client.user.findFirst({
    where: {
      OR: [
        { id: Object.is(find.id, NaN) ? 0 : find.id },
        { username: find.username ?? '' },
      ],
    },
  });
}

export async function findCommunity(find: { urlName?: string; id?: number }) {
  return client.community.findFirst({
    where: {
      OR: [
        { id: Object.is(find.id, NaN) ? 0 : find.id },
        { urlName: find.urlName ?? '' },
      ],
    },
    include: { admin: true },
  });
}

export async function findPost(id: string) {
  return client.post.findUnique({
    where: { id },
    include: {
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
      replies: true,
    },
    omit: {
      authorId: true,
      communityId: true,
    },
  });
}

// middleware-specific

// community.isMod, community.promote, community.demote
export async function findCommMods(commId: number) {
  return client.user.findMany({
    where: {
      OR: [
        { communitiesModeratorOf: { some: { id: commId } } },
        { communitiesAdminOf: { some: { id: commId } } },
      ],
    },
    select: {
      id: true,
      username: true,
    },
  });
}

// community.follow
export async function findCommFollowers(commId: number) {
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

// route-specific

// POST /signup
export async function createUser(username: string, password?: string) {
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password ?? 'password', salt);
  const user = await client.user.create({
    data: {
      username,
      password: hashedPassword,
    },
  });
  return user.id;
}

// POST /login
export async function comparePassword(
  userData: string | { password: string }, // can be a username or whole user object
  password: string,
) {
  let user: { password: string } | null = null;
  if (typeof userData === 'string') {
    user = await client.user.findUnique({
      where: { username: userData },
    });
    if (!user) return false;
  } else user = userData;
  const match = await bcrypt.compare(password, user.password);
  return match;
}

// PUT /me
export async function updateUser(
  find: { username?: string; id?: number },
  body: Record<string, string>,
) {
  const data: Record<string, string> = {
    username: body.username,
    bio: body.bio,
  };

  if ('password' in body && body.password !== '') {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(body.password, salt);
    data.password = hashedPassword;
  }

  await client.user.update({
    where: find.username ? { username: find.username } : { id: find.id },
    data,
  });
}

// GET /communities
export async function searchCommunities(opts: {
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

// POST /communities
export async function createCommunity({
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

// PUT /community/:communityUrlOrId
export async function editCommunity(
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

export async function editCommunityWiki(
  commId: number,
  content: string | null,
) {
  await client.community.update({
    where: { id: commId },
    data: { wiki: content },
  });
}

// POST /community/:communityUrlOrId/promote
export async function promoteModerator(commId: number, userId: number) {
  await client.community.update({
    where: { id: commId },
    data: {
      moderators: {
        connect: { id: userId },
      },
    },
  });
  // todo: record action
}

// POST /community/:communityUrlOrId/demote
export async function demoteModerator(commId: number, userId: number) {
  await client.community.update({
    where: { id: commId },
    data: {
      moderators: {
        disconnect: { id: userId },
      },
    },
  });
  // todo: record action
}

// POST /community/:communityUrlOrId/follow
export async function followCommunity(
  commId: number,
  userId: number,
  follow: 'true' | 'false',
) {
  const followers = await findCommFollowers(commId);
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

// POST /community/:communityUrlOrId/freeze
export async function freezeCommunity(
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

// POST /community/:communityId/posts
export async function createPost(
  communityId: number,
  authorId: number,
  body: { title: string; content: string },
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
  return post.id;
  // todo: record action
}

// PUT /post/:postId
export async function editPost(
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

// POST /post/:postId/freeze
export async function freezePost(
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

export async function hidePost(
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

// testing-specific

// truncating User also truncates Post, Community, and Action
// truncating Community also truncates Post and Action
export async function truncateTable(tableName: string) {
  const query = `TRUNCATE TABLE "${tableName}" RESTART IDENTITY CASCADE`;
  await client.$queryRaw`${Prisma.raw(query)}`;
}

const testPassword = async () => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash('password', salt);
};

export async function createAdmin() {
  // ONLY the admin account is allowed to take #1.
  const firstUser = await client.user.findUnique({
    where: { id: 1 },
  });

  if (firstUser !== null) {
    if (firstUser.username === 'admin' && firstUser.role === 'ADMIN')
      return firstUser; // do nothing if an admin already exists

    await client.user.deleteMany({
      where: { OR: [{ username: 'admin' }, { role: 'ADMIN' }] },
    }); // erase any "partial" admins just in case

    // increment existing user ids by 1
    const usersToUpdate = await client.user.findMany({
      orderBy: { id: 'desc' },
    });

    await client.$transaction([
      ...usersToUpdate.map((row) =>
        client.user.update({
          where: { id: row.id },
          data: { id: { increment: 1 } },
        }),
      ),
    ]);
  }

  const admin = await client.user.create({
    data: {
      username: 'admin',
      password: await testPassword(),
      role: 'ADMIN',
      id: 1,
    },
  });

  // since the id is manually set, we need to prevent unique constraint error
  await client.$executeRawUnsafe(
    'SELECT setval(pg_get_serial_sequence(\'"User"\', \'id\'), coalesce(max(id)+1, 1), false) FROM "User";',
  );
  // https://github.com/prisma/prisma/discussions/5256#discussioncomment-1191352

  return admin;
}

export async function createBulkUsers(userData: Array<fakes.BulkUserData>) {
  const userIds: number[] = [];
  const password = await testPassword();
  await Promise.all(
    userData.map(async (ud) => {
      const user = await client.user.create({
        data: {
          username: ud.username,
          bio: ud.bio ?? null,
          password,
        },
      });
      userIds.push(user.id);
    }),
  );
  return userIds;
}

export async function createBulkCommunities(
  communityData: Array<fakes.BulkCommunityData>,
  adminId: number,
) {
  const communityIds: number[] = [];
  await Promise.all(
    communityData.map(async (cd) => {
      const community = await client.community.create({
        data: {
          urlName: cd.urlName,
          canonicalName: cd.canonicalName,
          description: `For fans of ${cd.canonicalName}`,
          status: cd.status,
          created: cd.date ?? new Date(),
          lastActivity: cd.date ?? new Date(),
          adminId,
        },
      });
      communityIds.push(community.id);
    }),
  );
  return communityIds;
}

export async function createBulkPosts(
  postData: Array<fakes.BulkPostData>,
  communityId: number | number[],
  authorId: number | number[],
) {
  const postIds: string[] = [];
  await Promise.all(
    postData.map(async (pd) => {
      const post = await client.post.create({
        data: {
          title: pd.title,
          content: pd.content,
          communityId:
            typeof communityId === 'number'
              ? communityId
              : communityId[Math.floor(Math.random() * communityId.length)],
          authorId:
            typeof authorId === 'number'
              ? authorId
              : authorId[Math.floor(Math.random() * authorId.length)],
        },
      });
      postIds.push(post.id);
    }),
  );
  return postIds;
}

export async function distributeCommFollowers(
  commId: number,
  userIds: number[],
) {
  await client.community.update({
    where: { id: commId },
    data: {
      followers: { connect: [...userIds].map((id) => ({ id })) },
    },
  });
}

export async function distributeCommModerators(
  commId: number,
  userIds: number[],
) {
  await client.community.update({
    where: { id: commId },
    data: {
      moderators: { connect: [...userIds].map((id) => ({ id })) },
    },
  });
}
