import request, { Response } from 'supertest';
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

export async function getUser(username: string, password: string):
Promise<{ username: string, id: number, token: string }> {
  const user = await prisma.user.findFirst({ where: { username } });
  if (!user) throw new Error('Given user does not exist.');
  const response = await request(app).post('/login').type('form').send({ username, password });
  if (!('body' in response) || !('token' in response.body)) throw new Error('Failed logging in this user.');
  return { username, id: user.id, token: response.body.token as string };
}

export async function createUsers() {
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASS as string, salt);
  await prisma.user.createMany({
    data: [
      {
        username: 'admin',
        password: hashedPassword,
        id: 1,
        role: 'ADMIN',
      }, {
        username: 'basic',
        password: hashedPassword,
        id: 2,
        role: 'BASIC',
      },
    ],
  });
}

export async function wipeTables(tables: Array<'user' | 'session' | 'community'>) {
  if (tables.includes('community')) await prisma.community.deleteMany();
  if (tables.includes('user')) await prisma.user.deleteMany();
}

export async function createDummyCommunities() {
  await Promise.all([
    {
      urlName: 'askgroves',
      canonicalName: 'Ask Groves',
      description: 'This is the place to ask and answer thought-provoking questions.',
    }, {
      urlName: 'nostupidquestions',
      canonicalName: 'No Stupid Questions',
      description: 'Ask away!',
    }, {
      urlName: 'damnthatsinteresting',
      canonicalName: 'Damn, that\'s interesting!',
      description: 'For the most interesting things on the internet',
    }, {
      urlName: 'gaming',
      canonicalName: 'Gaming',
      description: 'The number one gaming forum on the Internet.',
    }, {
      urlName: 'worldnews',
      canonicalName: 'World News',
      description: 'A place for major news from around the world, excluding US-internal news.',
    }, {
      urlName: 'frozen',
      canonicalName: 'Frozen',
      description: 'You shouldn\'t see this one in global search!',
    }, {
      urlName: 'hidden',
      canonicalName: 'Hidden',
      description: 'You shouldn\'t see this one!',
    },
  ].map(async (community, index) => {
    await prisma.community.create({
      data: {
        urlName: community.urlName,
        canonicalName: community.canonicalName,
        description: community.description,
        // eslint-disable-next-line no-nested-ternary
        status: index === 5 ? 'FROZEN' : index === 6 ? 'HIDDEN' : 'ACTIVE',
        adminId: 1,
      },
    });
  }));
}
