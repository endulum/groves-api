import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

import { client } from '../client';

export async function find({
  id,
  username,
}: {
  id?: number;
  username?: string;
}) {
  const OR: Prisma.UserWhereInput[] = [];
  if (id && !Object.is(id, NaN)) OR.push({ id });
  if (username) OR.push({ username });
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
}: {
  username: string;
  password?: string;
}) {
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password ?? 'password', salt);
  const { id } = await client.user.create({
    data: { username, password: hashedPassword },
  });
  return id;
}

export async function comparePassword({
  userData,
  password,
}: {
  userData: string | { password: string };
  password: string;
}) {
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
