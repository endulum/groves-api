/* eslint-disable @typescript-eslint/no-explicit-any */
import { req, assertCode, token } from '../helpers';
import { assertChildren, scoreTypes } from './_listHelpers';
import { seed } from '../../prisma/seed';
import {
  createBulkRepliesEvenly,
  spreadVotesToReplies,
} from '../../prisma/queries/dev';

// get all children in an array - use its length to test correct child count
const gatherChildrenIds = (children: any): string[] => {
  const ids: string[] = [];
  children.forEach((child: any) => {
    ids.push(child.id);
    if ('children' in child) {
      ids.push(...gatherChildrenIds(child.children));
    }
  });
  return ids;
};

// check that the properties `loadMoreChildren` and `loadChildren`
// show only when they need to
const overflowAssertion = (child: any) => {
  if ('children' in child) {
    if (child.children.length < child._count.children)
      expect(child).toHaveProperty('loadMoreChildren');
    else expect(child).not.toHaveProperty('loadMoreChildren');
  } else {
    if (child._count.children > 0) expect(child).toHaveProperty('loadChildren');
    else expect(child).not.toHaveProperty('loadChildren');
  }
};

let postId: string = '';

describe('GET /post/:post/replies', () => {
  const replyIds: string[] = [];
  const users: number[] = [];

  beforeAll(async () => {
    const { userIds, postIds } = await seed({
      userCount: 100,
      comms: { count: 1 },
      posts: { perComm: { min: 1, max: 1 } },
    });
    postId = postIds[0];
    // create an even tree of replies for one post that goes four levels deep and has four replies per level
    // 4 + 4^2 + 4^3 + 4^4 + 4^5 = 1364 replies on this post
    replyIds.push(
      ...(await createBulkRepliesEvenly({
        postId,
        levels: 4,
        repliesPerLevel: 4,
      })),
    );
    users.push(...userIds);
  });

  test('3 levels with 3 replies per level sorted by latest, by default', async () => {
    const response = await req(`GET /post/${postId}/replies`);
    assertCode(response, 200);
    // assert correct default amount
    // 3 + 3^2 + 3^3 + 3^4 = 120 max replies shown with defaults
    const ids = gatherChildrenIds(response.body.children);
    expect(ids.length).toBe(120);
    expect(new Set(ids).size).toBe(ids.length); // all unique
    // assert correct default sort
    assertChildren(response.body.children, overflowAssertion);
    assertChildren(response.body.children, (child) => {
      if ('children' in child) {
        expect(
          [...child.children].sort(
            (
              reply_a: { datePosted: string },
              reply_b: { datePosted: string },
            ) =>
              Date.parse(reply_b.datePosted) - Date.parse(reply_a.datePosted),
          ),
        ).toEqual(child.children);
      }
    });
    // assert that we can expand more
    expect(response.body).toHaveProperty('loadMoreChildren');
  });

  describe('query params', () => {
    test('takePerLevel', async () => {
      const response = await req(`GET /post/${postId}/replies?takePerLevel=4`);
      assertCode(response, 200);
      // 4 + 4^2 + 4^3 + 4^4 = 340 replies
      const ids = gatherChildrenIds(response.body.children);
      expect(ids.length).toBe(340);
    });

    test('levels', async () => {
      const response = await req(`GET /post/${postId}/replies?levels=4`);
      assertCode(response, 200);
      // 3 + 3^2 + 3^3 + 3^4 + 3^5 = 363 replies
      const ids = gatherChildrenIds(response.body.children);
      expect(ids.length).toBe(363);
    });

    test('sort', async () => {
      await spreadVotesToReplies(replyIds, users);
      await Promise.all(
        ['hot', 'top', 'best', 'controversial'].map(async (scoreName) => {
          const response = await req(
            `GET /post/${postId}/replies?sort=${scoreName}`,
          );
          assertCode(response, 200);
          const score = scoreTypes[scoreName];
          assertChildren(response.body.children, (child) => {
            if ('children' in child) {
              expect(
                [...child.children].sort(
                  (
                    reply_a: { _count: { upvotes: number; downvotes: number } },
                    reply_b: { _count: { upvotes: number; downvotes: number } },
                  ) =>
                    score(reply_b._count.upvotes, reply_b._count.downvotes) -
                    score(reply_a._count.upvotes, reply_a._count.downvotes),
                ),
              ).toEqual(child.children);
            }
          });
        }),
      );
    });
  });

  test('expansion preserves other queries', async () => {
    const response = await req(
      `GET /post/${postId}/replies?levels=2&takePerLevel=2&sort=top`,
    );
    assertCode(response, 200);
    assertChildren(response.body.children, overflowAssertion);
    assertChildren(response.body.children, (child) => {
      if ('loadMoreChildren' in child)
        expect(child.loadMoreChildren).toContain(
          'levels=2&takePerLevel=2&sort=top',
        );
      if ('loadChildren' in child)
        expect(child.loadChildren).toContain(
          'levels=2&takePerLevel=2&sort=top',
        );
      if ('children' in child) {
        expect(
          [...child.children]
            .map((c: { _count: { upvotes: number; downvotes: number } }) => ({
              upvotes: c._count.upvotes,
              downvotes: c._count.downvotes,
            }))
            .sort(
              (reply_a, reply_b) =>
                scoreTypes.top(reply_b.upvotes, reply_b.downvotes) -
                scoreTypes.top(reply_a.upvotes, reply_a.downvotes),
            ),
        ).toEqual(
          child.children.map(
            (c: { _count: { upvotes: number; downvotes: number } }) => ({
              upvotes: c._count.upvotes,
              downvotes: c._count.downvotes,
            }),
          ),
        );
      }
    });
  });

  test("reflects auth user's vote if present", async () => {
    // without auth user
    let response = await req(`GET /post/${postId}/replies`);
    assertCode(response, 200);
    assertChildren(response.body.children, (child) => {
      expect(child.voted).toBeNull();
    });
    // with auth user
    const targetUserToken = await token(users[0]);
    response = await req(`GET /post/${postId}/replies`, targetUserToken);
    assertCode(response, 200);
    assertChildren(response.body.children, (child) => {
      expect(child.voted).not.toBeNull();
      expect(child.voted).toHaveProperty('upvoted');
      expect(child.voted).toHaveProperty('downvoted');
    });
  });
});

describe('GET /reply/:reply/replies', () => {
  test('chow children of a reply', async () => {
    let response = await req(`GET /post/${postId}/replies`);
    assertCode(response, 200);
    const ids = gatherChildrenIds(response.body.children);

    // target the first reply in the last layer
    const loadChildrenLink =
      response.body.children[0].children[0].children[0].children[0]
        .loadChildren;

    response = await req(`GET ${loadChildrenLink}`);
    assertCode(response, 200);
    // none of the children rendered should be in ids
    response.body.children.forEach((child: any) => {
      expect(ids.find((id) => id === child.id)).toBeFalsy();
    });
    assertChildren(response.body.children, overflowAssertion);
  });

  test('expand children of a reply', async () => {
    let response = await req(`GET /post/${postId}/replies`);
    assertCode(response, 200);
    const ids = gatherChildrenIds(response.body.children);

    // target the first reply in the second layer
    const target = response.body.children[0].children[0].children[0];
    const targetIds = gatherChildrenIds(target.children);

    const loadMoreChildrenLink = target.loadMoreChildren;
    response = await req(`GET ${loadMoreChildrenLink}&levels=0`); // we'll only check 0th level here
    assertCode(response, 200);
    const foundIds = gatherChildrenIds(response.body.children);
    expect(foundIds.length + targetIds.length).toBe(target._count.children);

    // these found ids shouldn't have already been found
    foundIds.forEach((child: any) => {
      expect(targetIds.find((id) => id === child)).toBeFalsy();
    });
    foundIds.forEach((child: any) => {
      expect(ids.find((id) => id === child)).toBeFalsy();
    });
  });
});
