import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

import { client } from '../client';

export async function find({
  id,
  username,
  githubId,
}: {
  id?: number;
  username?: string;
  githubId?: number;
}) {
  const OR: Prisma.UserWhereInput[] = [];
  if (id && !Object.is(id, NaN)) OR.push({ id });
  if (username) OR.push({ username });
  if (githubId) OR.push({ githubId });
  return client.user.findFirst({
    where: { OR },
    include: {
      _count: {
        select: {
          posts: true,
          replies: true,
        },
      },
    },
  });
}

export async function create({
  username,
  password,
  githubId,
}: {
  username: string;
  password?: string;
  githubId?: number;
}) {
  if (password) {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password ?? 'password', salt);
    const { id } = await client.user.create({
      data: { username, password: hashedPassword },
    });
    return id;
  } else if (githubId) {
    const { id } = await client.user.create({
      data: { username, githubId },
    });
    return id;
  }
}

export async function comparePassword({
  userData,
  password,
}: {
  userData: string | { password: string | null };
  password: string;
}) {
  let user: { password: string | null } | null = null;
  if (typeof userData === 'string') {
    user = await client.user.findUnique({
      where: { username: userData },
    });
    if (!user) return false;
  } else user = userData;
  // some user entries have nulled passwords if they auth'd with gh.
  // prevent those from being logged into with the regular password method.
  if (!user.password) return false;
  const match = await bcrypt.compare(password, user.password);
  return match;
}

export async function update({
  userData,
  body,
}: {
  userData: { username?: string; id?: number };
  body: { username?: string; password?: string; bio?: string };
}) {
  const data: Record<string, string | null> = {
    username: body.username ?? null,
    bio: body.bio ?? null,
  };
  if (body.password) {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(body.password, salt);
    data.password = hashedPassword;
  }
  await client.user.update({
    where: userData.username
      ? { username: userData.username }
      : { id: userData.id },
    data,
  });
}
