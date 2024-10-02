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

export async function wipeTables(tables: Array<'user' | 'session'>) {
  if (tables.includes('user')) await prisma.user.deleteMany({});
}
