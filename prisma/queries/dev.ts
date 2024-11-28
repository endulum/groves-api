import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

import { client } from '../client';
import * as fakes from '../fakes';

// queries solely for development use, such as testing.

const testPassword = async () => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash('password', salt);
};

export async function truncateTable(tableName: string) {
  const query = `TRUNCATE TABLE "${tableName}" RESTART IDENTITY CASCADE`;
  await client.$queryRaw`${Prisma.raw(query)}`;
}

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

export async function distributeVotes(
  {
    type,
    id,
    upvoterIds,
    downvoterIds,
  }: {
    type: 'post' | 'reply';
    id: string;
    upvoterIds: number[];
    downvoterIds: number[];
  },
  // postId: string,
  // upvoterIds: number[],
  // downvoterIds: number[],
) {
  // todo: upvoters and downvoters should have no overlap.
  // test against this.
  if (upvoterIds.length > 0) {
    if (type === 'post')
      await client.post.update({
        where: { id },
        data: {
          upvotes: { connect: upvoterIds.map((id) => ({ id })) },
        },
      });
    else if (type === 'reply')
      await client.reply.update({
        where: { id },
        data: {
          upvotes: { connect: upvoterIds.map((id) => ({ id })) },
        },
      });
  }
  if (downvoterIds.length > 0) {
    if (type === 'post')
      await client.post.update({
        where: { id },
        data: {
          downvotes: { connect: downvoterIds.map((id) => ({ id })) },
        },
      });
    else if (type === 'reply')
      await client.reply.update({
        where: { id },
        data: {
          downvotes: { connect: downvoterIds.map((id) => ({ id })) },
        },
      });
  }
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

export async function createBulkReplies(
  replyData: Array<fakes.BulkReplyData>,
  postId: string | string[],
  authorId: number | number[],
) {
  const replyIds: string[] = [];
  await Promise.all(
    replyData.map(async (rd) => {
      const reply = await client.reply.create({
        data: {
          content: rd.content,
          postId:
            typeof postId === 'string'
              ? postId
              : postId[Math.floor(Math.random() * postId.length)],
          authorId:
            typeof authorId === 'number'
              ? authorId
              : authorId[Math.floor(Math.random() * authorId.length)],
        },
      });
      replyIds.push(reply.id);
    }),
  );
  return replyIds;
}
