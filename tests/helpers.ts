/* eslint-disable no-console */
import request, { Response } from 'supertest';
import jwt from 'jsonwebtoken';

import { client } from '../prisma/client';
import app from './app';

/*
  shortening for full object log
*/
export function logBody(response: Response) {
  console.dir(response.body, { depth: null });
}

/*
  shorter way of invoking request
*/
export async function req(
  endpoint: string,
  token?: string | null,
  form?: Record<string, unknown> | null,
): Promise<Response> {
  // any way to have '.post()', '.put()', '.delete()' conditionally chained?
  // and without type errors?
  const method = endpoint.split(' ')[0];
  const url = endpoint.split(' ')[1];
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

/*
  shorter way of checking response code and text at once
*/
export function assertCode(
  response: Response,
  expectedCode: number,
  expectedText?: string,
) {
  if (expectedText) {
    expect({
      code: response.status,
      text: response.text,
    }).toEqual({ code: expectedCode, text: expectedText });
  } else {
    try {
      expect(response.status).toBe(expectedCode);
    } catch {
      throw {
        wanted: { code: expectedCode, text: expectedText ?? '' },
        received: { code: response.status, text: response.text },
        // deliberately differently named from 'expected' and 'actual' properties
        // because those show up as stringified, more difficult for me to read
      };
    }
  }
}

/*
  for form routes, loop through incorrect inputs and ensure they're caught
*/
export async function assertInputErrors({
  reqArgs,
  correctInputs,
  wrongInputs,
  singleErrorOnly,
}: {
  reqArgs: [string, string | null];
  correctInputs: Record<string, string>;
  wrongInputs: Array<Record<string, string | undefined>>;
  singleErrorOnly?: boolean;
}) {
  await Promise.all(
    wrongInputs.map(async (wrong) => {
      const response = await req(...reqArgs, { ...correctInputs, ...wrong });
      try {
        assertCode(response, 400);
        expect(response.body).toHaveProperty('errors');
      } catch (e) {
        // if a wrong input goes through, show the form that was sent
        console.log({ ...correctInputs, ...wrong });
        throw e;
      }

      if (singleErrorOnly)
        try {
          expect(response.body.errors.length).toBe(1);
        } catch (e) {
          console.dir(response.body.errors, { depth: null });
          throw e;
        }
    }),
  );
}

/*
  quickly generate a token for a user
*/
export async function token(userInfo: string | number): Promise<string> {
  const user = await client.user.findFirst({
    where:
      typeof userInfo === 'string' ? { username: userInfo } : { id: userInfo },
  });

  if (!user) {
    console.error(
      `Given user ${userInfo} does not exist. Users that exist: `,
      (await client.user.findMany()).map((u) => u.username),
    );
    throw new Error(`Given user ${userInfo} does not exist.`);
  }

  if (!process.env.JWT_SECRET) throw new Error('Token secret is not defined.');

  const token = jwt.sign(
    { user: user.username, id: user.id },
    process.env.JWT_SECRET,
  );

  return token;
}
