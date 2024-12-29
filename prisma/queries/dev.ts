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
  const users: Array<{ username: string; id: number }> = [];
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
      users.push({ username: user.username, id: user.id });
    }),
  );
  return users;
}

export async function createBulkCommunities(
  communityData: Array<fakes.BulkCommunityData>,
  adminId: number,
) {
  const communityIds: number[] = [];
  await Promise.all(
    communityData.map(async (cd) => {
      const { id } = await client.community.create({
        data: {
          urlName: cd.urlName,
          canonicalName: cd.canonicalName,
          description: `For fans of ${cd.canonicalName}`,
          created: cd.date ?? new Date(),
          lastActivity: cd.date ?? new Date(),
          adminId,
        },
      });
      await client.action.create({
        data: {
          date: cd.date ?? new Date(),
          actorId: adminId,
          type: 'Community_Create',
          communityId: id,
        },
      });
      communityIds.push(id);
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
      const author =
        typeof authorId === 'number'
          ? authorId
          : authorId[Math.floor(Math.random() * authorId.length)];
      const community =
        typeof communityId === 'number'
          ? communityId
          : communityId[Math.floor(Math.random() * communityId.length)];
      const { id } = await client.post.create({
        data: {
          title: pd.title,
          content: pd.content,
          datePosted: pd.date,
          communityId: community,
          authorId: author,
        },
      });
      await client.action.create({
        data: {
          date: pd.date ?? new Date(),
          actorId: author,
          type: 'Post_Create',
          postId: id,
          communityId: community,
        },
      });
      postIds.push(id);
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
  const replies = replyData.sort(
    (a, b) => Date.parse(a.date.toString()) - Date.parse(b.date.toString()),
  );
  const parentIds: Array<null | string> = [null];
  for (const reply of replies) {
    const post =
      typeof postId === 'string'
        ? postId
        : postId[Math.floor(Math.random() * postId.length)];
    const author =
      typeof authorId === 'number'
        ? authorId
        : authorId[Math.floor(Math.random() * authorId.length)];
    const { id, post: p } = await client.reply.create({
      data: {
        content: reply.content,
        datePosted: reply.date,
        postId: post,
        authorId: author,
        parentId: parentIds[Math.floor(Math.random() * parentIds.length)],
      },
      select: {
        id: true,
        post: {
          select: {
            communityId: true,
          },
        },
      },
    });
    await client.action.create({
      data: {
        actorId: author,
        type: 'Reply_Create',
        replyId: id,
        postId: post,
        communityId: p.communityId,
        date: reply.date ?? new Date(),
      },
    });
    replyIds.push(id);
    parentIds.push(id);
  }
  return replyIds;
}

export async function createBulkRepliesEvenly(opts: {
  postId: string;
  levels: number;
  repliesPerLevel: number;
  repliesFirstLevel?: number;
  callbackToRepliesPerLevel?: (repliesPerLevel: number) => number;
}) {
  await truncateTable('Reply');
  let repliesPerLevel = opts.repliesPerLevel;
  let steps = opts.levels;
  const queue: Array<null | string> = [null];
  const replyIds: string[] = [];
  while (steps > -1) {
    const thisLevelReplyIds: string[] = [];
    const thisLevelReplyCount =
      steps === opts.levels && opts.repliesFirstLevel !== undefined
        ? opts.repliesFirstLevel
        : repliesPerLevel;
    while (queue.length > 0) {
      const parentId = queue.pop();
      for (let i = 0; i < thisLevelReplyCount; i++) {
        const reply = await client.reply.create({
          data: {
            parentId,
            postId: opts.postId,
            authorId: 1,
            content: 'Lorem ipsum dolor sit amet...',
            datePosted: fakes.randDate(),
          },
        });
        thisLevelReplyIds.push(reply.id);
        replyIds.push(reply.id);
      }
    }
    queue.push(...thisLevelReplyIds);
    if (opts.callbackToRepliesPerLevel)
      repliesPerLevel = opts.callbackToRepliesPerLevel(repliesPerLevel);
    steps--;
  }
  return replyIds;
}

export async function spreadVotesToReplies(
  replyIds: string[],
  userIds: number[],
) {
  await Promise.all(
    replyIds.map(async (id) => {
      const totalVotes = Math.floor(Math.random() * userIds.length);
      const votingUsers = [...userIds]
        .sort(() => 0.5 - Math.random())
        .slice(0, Math.floor(Math.random() * totalVotes));
      const middle = Math.floor(Math.random() * votingUsers.length);
      const upvoterIds = votingUsers.slice(0, middle);
      const downvoterIds = votingUsers.slice(middle + 1, votingUsers.length);
      await distributeVotes({
        type: 'reply',
        id,
        upvoterIds,
        downvoterIds,
      });
    }),
  );
}
