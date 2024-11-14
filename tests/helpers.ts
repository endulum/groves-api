import request, { Response } from 'supertest';
import jwt from 'jsonwebtoken';

import app from './app';
import { client } from '../prisma/client';

export async function req(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  url: string,
  form: Record<string, unknown> | null,
  token: string | null,
): Promise<Response> {
  // any way to have '.post()', '.put()', '.delete()' conditionally chained?
  // and without type errors?
  switch (method) {
    case 'POST':
      return request(app)
        .post(url)
        .set({ Authorization: token !== null ? `Bearer ${token}` : '' })
        .type('form')
        .send(form ?? {});
    case 'PUT':
      return request(app)
        .put(url)
        .set({ Authorization: token !== null ? `Bearer ${token}` : '' })
        .type('form')
        .send(form ?? {});
    case 'DELETE':
      return request(app)
        .delete(url)
        .set({ Authorization: token !== null ? `Bearer ${token}` : '' });
    default:
      return request(app)
        .get(url)
        .set({ Authorization: token !== null ? `Bearer ${token}` : '' });
  }
}

export async function getToken(username: string): Promise<string> {
  const user = await client.user.findFirst({ where: { username } });

  if (!user) {
    console.error(
      `Given user ${username} does not exist. Users that exist: `,
      (await client.user.findMany()).map((u) => u.username),
    );
    throw new Error(`Given user ${username} does not exist.`);
  }

  if (!process.env.TOKEN_SECRET)
    throw new Error('Token secret is not defined.');

  const token = jwt.sign({ username, id: user.id }, process.env.TOKEN_SECRET);

  return token;
}
