import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { client } from './client';
import * as fakes from './fakes';

// finding a thing

export async function findUser(
  find: { username?: string, id?: number },
  attributes: Record<string, unknown> = {},
) {
  return client.user.findFirst({
    where: {
      OR: [
        { id: Object.is(find.id, NaN) ? 0 : find.id },
        { username: find.username ?? '' },
      ],
    },
    ...attributes,
  });
}

export async function findCommunity(
  find: { urlName?: string, id?: number },
  attributes: Record<string, unknown> = {},
) {
  return client.community.findFirst({
    where: {
      OR: [
        { id: Object.is(find.id, NaN) ? 0 : find.id },
        { urlName: find.urlName ?? '' },
      ],
    },
    ...attributes,
  });
}

export async function findPost(
  id: string,
  attributes: Record<string, unknown> = {},
) {
  return client.post.findUnique({
    where: { id },
    ...attributes,
  });
}

// route-specific

// POST /signup
export async function createUser(username: string, password: string) {
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  await client.user.create({
    data: {
      username,
      password: hashedPassword,
    },
  });
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

// POST /me
export async function updateUser(
  find: { username?: string, id?: number },
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
    where: find.username
      ? { username: find.username }
      : { id: find.id },
    data,
  });
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
    if (
      firstUser.username === 'admin'
      && firstUser.role === 'ADMIN'
    ) return firstUser; // do nothing if an admin already exists

    await client.user.deleteMany({
      where: { OR: [{ username: 'admin' }, { role: 'ADMIN' }] },
    }); // erase any "partial" admins just in case

    // increment existing user ids by 1
    const usersToUpdate = await client.user.findMany({
      orderBy: { id: 'desc' },
    });

    await client.$transaction([
      ...usersToUpdate.map((row) => client.user.update({
        where: { id: row.id },
        data: { id: { increment: 1 } },
      })),
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

export async function createBulkUsers(
  userData: Array<fakes.BulkUserData>,
) {
  const userIds: number[] = [];
  await Promise.all(userData.map(async (ud) => {
    const user = await client.user.create({
      data: {
        username: ud.username,
        bio: ud.bio ?? null,
        password: await testPassword(),
      },
    });
    userIds.push(user.id);
  }));
  return userIds;
}

export async function createBulkCommunities(
  communityData: Array<fakes.BulkCommunityData>,
  adminId: number,
) {
  const communityIds: number[] = [];
  await Promise.all(communityData.map(async (cd) => {
    const community = await client.community.create({
      data: {
        urlName: cd.urlName,
        canonicalName: cd.canonicalName,
        adminId,
      },
    });
    communityIds.push(community.id);
  }));
  return communityIds;
}

export async function createBulkPosts(
  postData: Array<fakes.BulkPostData>,
  communityId: number,
  authorId: number,
) {
  const postIds: string[] = [];
  await Promise.all(postData.map(async (pd) => {
    const post = await client.post.create({
      data: {
        title: pd.title,
        content: pd.content,
        communityId,
        authorId,
      },
    });
    postIds.push(post.id);
  }));
  return postIds;
}
