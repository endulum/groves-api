import { req, assertCode } from '../helpers';
import { seed } from '../../prisma/seed';
import { assertPagination, scoreTypes } from './_listHelpers';
import * as postqueries from '../../prisma/queries/post';

const postIds: string[] = [];

describe('GET /community/:community/posts', () => {
  const testPostCount = 50;
  let commId: number = 0;

  beforeAll(async () => {
    const { commIds, postIds: seedPostIds } = await seed({
      logging: false,
      userCount: 200,
      comms: { count: 1 },
      posts: {
        perComm: { min: testPostCount, max: testPostCount },
        votesPer: { max: 250 },
      },
      replies: { perPost: { max: 50 } },
    });
    commId = commIds[0];
    postIds.push(...seedPostIds);
  });

  test('show max 20 posts, activity descending by default', async () => {
    const response = await req(`GET /community/${commId}/posts`);
    assertCode(response, 200);
    expect(response.body.posts).toBeDefined();
    expect(response.body.posts.length).toBe(20);
    expect(
      [...response.body.posts].sort(
        (
          post_a: { _count: { upvotes: number; downvotes: number } },
          post_b: { _count: { upvotes: number; downvotes: number } },
        ) =>
          scoreTypes.hot(post_b._count.upvotes, post_b._count.downvotes) -
          scoreTypes.hot(post_a._count.upvotes, post_a._count.downvotes),
      ),
    ).toEqual(response.body.posts);
  });

  describe('query params', () => {
    test('take', async () => {
      const response = await req(`GET /community/${commId}/posts?take=30`);
      assertCode(response, 200);
      expect(response.body.posts.length).toBe(30);
    });

    test('title', async () => {
      const response = await req(`GET /community/${commId}/posts?title=um`);
      assertCode(response, 200);
      expect(
        response.body.posts.filter((post: { title: string }) =>
          post.title.includes('um'),
        ),
      ).toEqual(response.body.posts);
    });

    test('sort', async () => {
      // scores
      await Promise.all(
        ['hot', 'top', 'best', 'controversial'].map(async (scoreName) => {
          const response = await req(
            `GET /community/${commId}/posts?sort=${scoreName}`,
          );
          assertCode(response, 200);
          const score = scoreTypes[scoreName];
          expect(
            [...response.body.posts].sort(
              (
                post_a: { _count: { upvotes: number; downvotes: number } },
                post_b: { _count: { upvotes: number; downvotes: number } },
              ) =>
                score(post_b._count.upvotes, post_b._count.downvotes) -
                score(post_a._count.upvotes, post_a._count.downvotes),
            ),
          ).toEqual(response.body.posts);
        }),
      );

      // newest
      let response = await req(`GET /community/${commId}/posts?sort=newest`);
      expect(
        [...response.body.posts].sort(
          (post_a: { datePosted: string }, post_b: { datePosted: string }) =>
            Date.parse(post_b.datePosted) - Date.parse(post_a.datePosted),
        ),
      ).toEqual(response.body.posts);

      // replies
      response = await req(`GET /community/${commId}/posts?sort=replies`);
      expect(
        [...response.body.posts].sort(
          (
            post_a: { _count: { replies: number } },
            post_b: { _count: { replies: number } },
          ) => post_b._count.replies - post_a._count.replies,
        ),
      ).toEqual(response.body.posts);
    });

    test('includeFrozen', async () => {
      // make half of all posts readonly
      await Promise.all(
        postIds
          .sort(() => 0.5 - Math.random())
          .slice(0, 24)
          .map(async (postId) => {
            await postqueries.toggleReadonly(postId, 'true', 1);
          }),
      );

      const response = await req(
        `GET /community/${commId}/posts?includeFrozen=true`,
      );
      assertCode(response, 200);
      expect(
        response.body.posts.every(
          (post: { readonly: boolean }) => post.readonly === false,
        ),
      ).toBeFalsy();

      // switch back
      await Promise.all(
        postIds.slice(0, 24).map(async (postId) => {
          await postqueries.toggleReadonly(postId, 'false', 1);
        }),
      );
    });
  });

  test('pagination', async () => {
    await assertPagination({
      url: `/community/${commId}/posts`,
      resultsProperty: 'posts',
      resultsTotal: testPostCount,
      resultsPerPage: 20,
    });
  });

  test('pagination maintains other queries', async () => {
    await assertPagination({
      url: `/community/${commId}/posts?take=10&sort=best`,
      resultsProperty: 'posts',
      resultsTotal: testPostCount,
      resultsPerPage: 10,
      perPageAssertion: (response) => {
        expect(response.body.posts.length).toBe(10);
        expect(
          [...response.body.posts].sort(
            (
              post_a: { _count: { upvotes: number; downvotes: number } },
              post_b: { _count: { upvotes: number; downvotes: number } },
            ) =>
              scoreTypes.best(post_b._count.upvotes, post_b._count.downvotes) -
              scoreTypes.best(post_a._count.upvotes, post_a._count.downvotes),
          ),
        ).toEqual(response.body.posts);
      },
    });
  });
});
