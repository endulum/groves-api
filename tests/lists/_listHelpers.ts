/* eslint-disable @typescript-eslint/no-explicit-any */
import { req } from '../helpers';
import { type Response } from 'supertest';
import wilson from 'wilson-score-interval';

export const scoreTypes: Record<string, (u: number, d: number) => number> = {
  hot: (upvotes: number, downvotes: number) => {
    const order = Math.log10(Math.max(Math.abs(upvotes - downvotes), 1));
    const sign: number =
      upvotes - downvotes > 0 ? 1 : upvotes - downvotes < 0 ? -1 : 0;
    const seconds = Date.now();
    return sign * order + seconds / 100000;
  },
  top: (upvotes: number, downvotes: number) => upvotes - downvotes,
  best: (upvotes: number, downvotes: number) => {
    if (upvotes + downvotes === 0) return 0;
    return wilson(upvotes, upvotes + downvotes);
  },
  controversial: (upvotes: number, downvotes: number) => {
    if (upvotes + downvotes === 0) return 0;
    const power =
      upvotes > downvotes ? downvotes / upvotes : upvotes / downvotes;
    return Math.pow(upvotes + downvotes, power);
  },
};

// for forward-backward pagination. additionally supply an assertion per page
export async function assertPagination({
  url,
  resultsProperty,
  resultsTotal,
  resultsPerPage,
  perPageAssertion,
}: {
  url: string;
  resultsProperty: string; // 'communities', 'posts', whatever it'll be called
  resultsTotal: number; // expected total results
  resultsPerPage: number; // expected results per page
  perPageAssertion?: (response: Response) => void; // test to run each page
}) {
  let response = await req(`GET ${url}`);
  expect(response.body).toHaveProperty(resultsProperty);
  expect(response.body).toHaveProperty('links');
  expect(response.body.links.nextPage).not.toBeNull();
  if (perPageAssertion) perPageAssertion(response);

  // keep a record of results as we page forward
  let pageCount: number = 1;
  const results: Record<number, number[]> = {
    [pageCount]: response.body[resultsProperty].map(
      ({ id }: { id: number }) => id,
    ),
  };

  // page forward, adding to the record
  let nextPage: string = response.body.links.nextPage;
  while (nextPage !== null) {
    response = await req(`GET ${nextPage}`);
    if (perPageAssertion) perPageAssertion(response);
    nextPage = response.body.links.nextPage;
    pageCount++;
    results[pageCount] = response.body[resultsProperty].map(
      ({ id }: { id: number }) => id,
    );
  }

  // use record to expect a correct amount of results
  expect(
    Object.keys(results).reduce((acc: number, curr: string) => {
      return acc + results[parseInt(curr, 10)].length;
    }, 0),
  ).toEqual(resultsTotal);

  // use record expect a correct amount of pages
  expect(pageCount).toEqual(Math.ceil(resultsTotal / resultsPerPage));

  // page backward, comparing against recorded "pages"
  let prevPage: string = response.body.links.prevPage;
  while (prevPage !== null) {
    response = await req(`GET ${prevPage}`);
    if (perPageAssertion) perPageAssertion(response);
    prevPage = response.body.links.prevPage;
    pageCount--;
    // expect that each "page" has the exact same results
    expect(
      response.body[resultsProperty].map(({ id }: { id: number }) => id),
    ).toEqual(results[pageCount]);
  }
}

// for trees of children. supply an assertion per child
export async function assertChildren(
  children: any,
  callback: (child: any) => void,
) {
  children.forEach((child: any) => {
    callback(child);
    if ('children' in child) assertChildren(child.children, callback);
  });
}
