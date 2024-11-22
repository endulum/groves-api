import request, { Response } from 'supertest';
import jwt from 'jsonwebtoken';

import app from './app';
import { client } from '../prisma/client';

export async function req(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  url: string,
  form?: Record<string, unknown> | null,
  token?: string | null,
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

export async function getToken(userInfo: string | number): Promise<string> {
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

  if (!process.env.TOKEN_SECRET)
    throw new Error('Token secret is not defined.');

  const token = jwt.sign(
    { user: user.username, id: user.id },
    process.env.TOKEN_SECRET,
  );

  return token;
}

export async function testPaginationStability({
  url,
  resultsName,
  contentCount,
  resultsLength,
  perPageAssertion,
}: {
  url: string;
  resultsName: string; // 'communities', 'posts', whatever it'll be called
  contentCount: number; // expected total results
  resultsLength: number; // expected results per page
  perPageAssertion?: (response: Response) => void; // test to run each page
}) {
  let response = await req('GET', url);
  expect(response.body).toHaveProperty(resultsName);
  expect(response.body).toHaveProperty('links');
  expect(response.body.links.nextPage).not.toBeNull();
  if (perPageAssertion) perPageAssertion(response);
  // keep a record of results as we page forward
  let pageCount: number = 1;
  const results: Record<number, number[]> = {
    [pageCount]: response.body[resultsName].map(({ id }: { id: number }) => id),
  };
  let nextPage: string = response.body.links.nextPage;
  while (nextPage !== null) {
    response = await req('GET', nextPage);
    if (perPageAssertion) perPageAssertion(response);
    nextPage = response.body.links.nextPage;
    pageCount++;
    results[pageCount] = response.body[resultsName].map(
      ({ id }: { id: number }) => id,
    );
  }
  // use record to expect a correct amount of results
  expect(
    Object.keys(results).reduce((acc: number, curr: string) => {
      return acc + results[parseInt(curr, 10)].length;
    }, 0),
  ).toEqual(contentCount);
  // use record expect a correct amount of pages
  expect(pageCount).toEqual(Math.ceil(contentCount / resultsLength));
  // page backward, comparing against recorded "pages"
  let prevPage: string = response.body.links.prevPage;
  while (prevPage !== null) {
    response = await req('GET', prevPage);
    if (perPageAssertion) perPageAssertion(response);
    prevPage = response.body.links.prevPage;
    pageCount--;
    // expect that each "page" has the exact same results
    expect(
      response.body[resultsName].map(({ id }: { id: number }) => id),
    ).toEqual(results[pageCount]);
  }
}
