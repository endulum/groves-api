import request, { Response } from 'supertest';
import { faker } from '@faker-js/faker';
import bcrypt from 'bcryptjs';

import app from './app';
import prisma from '../prisma';

export async function req(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  url: string,
  form: Record<string, unknown> | null,
  token: string | null,
): Promise<Response> {
  // any way to have '.post()', '.put()', '.delete()' conditionally chained?
  // and without type errors?
  switch (method) {
    case 'POST': return request(app)
      .post(url)
      .set({ Authorization: token !== null ? `Bearer ${token}` : '' })
      .type('form')
      .send(form ?? {});
    case 'PUT': return request(app)
      .put(url)
      .set({ Authorization: token !== null ? `Bearer ${token}` : '' })
      .type('form')
      .send(form ?? {});
    case 'DELETE': return request(app)
      .delete(url)
      .set({ Authorization: token !== null ? `Bearer ${token}` : '' });
    default: return request(app)
      .get(url)
      .set({ Authorization: token !== null ? `Bearer ${token}` : '' });
  }
}

export async function getUser(username: string, password: string): Promise<{
  username: string, id: number, token: string
}> {
  const user = await prisma.user.findFirst({ where: { username } });
  if (!user) throw new Error('Given user does not exist.');
  const response = await request(app).post('/login').type('form').send({ username, password });
  if (!('body' in response) || !('token' in response.body)) throw new Error('Failed logging in this user.');
  return { username, id: user.id, token: response.body.token as string };
}

export async function createUsers(usernames: string[]) {
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash('password', salt);

  await prisma.user.createMany({
    data: [
      {
        username: 'admin',
        password: hashedPassword,
        role: 'ADMIN',
      },
      ...usernames.map((username) => ({
        username,
        password: hashedPassword,
      })),
    ],
  });
}

export async function wipeTables(tables: Array<'user' | 'session' | 'community'>) {
  if (tables.includes('community')) {
    await prisma.community.deleteMany();
    await prisma.$queryRaw`ALTER SEQUENCE "Community_id_seq" RESTART WITH 1;`;
  }
  if (tables.includes('user')) {
    await prisma.user.deleteMany();
    await prisma.$queryRaw`ALTER SEQUENCE "User_id_seq" RESTART WITH 1;`;
  }
}

const generateUsername = () => (faker.color.human().split(' ').join('-'))
  .concat('-')
  .concat(faker.animal.type().split(' ').join('-'));

export async function generateDummyUsers(amount: number)
  : Promise<Array<{ username: string, id: number }>> {
  const usernames: string[] = [];
  while (usernames.length < amount) {
    const username = generateUsername();
    if (!usernames.includes(username)) usernames.push(username);
  }
  return usernames.map((username, index) => ({ username, id: index }));
}

const generateCommunityName = (): { canonicalName: string, urlName: string } => {
  const canonicalName = faker.food.dish();
  const urlName = (
    canonicalName.toLocaleLowerCase().split(' ').join('').match(/[a-z0-9]+/g) || []
  ).join('');

  return {
    canonicalName,
    urlName,
  };
};

export async function generateDummyCommunities(amount: number)
  : Promise<Array<{ urlName: string, canonicalName: string }>> {
  const communities: Array<{ canonicalName: string, urlName: string }> = [];

  while (communities.length < amount) {
    const community = generateCommunityName();
    if (
      community.canonicalName.length <= 64
        && community.urlName.length <= 32
        && !communities.find(
          (c) => c.urlName === community.urlName,
        )
    ) {
      communities.push(community);
    }
  }
  return communities;
}
