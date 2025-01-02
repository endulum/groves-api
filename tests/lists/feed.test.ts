import { assertCode, req, token } from '../helpers';
import { seed } from '../../prisma/seed';
import { assertPagination } from './_listHelpers';
import { follow } from '../../prisma/queries/community';

let adminToken: string = '';
const comms: number[] = [];

beforeAll(async () => {
  const { commIds } = await seed({
    userCount: 10,
    comms: { count: 10 },
    posts: { perComm: { min: 10, max: 10 } },
    // total: 110 content
    replies: { perPost: { min: 10, max: 10 } },
  });
  adminToken = await token(1);
  comms.push(...commIds);
});

describe('GET /all', () => {
  test('get all posts from all communities', async () => {
    const response = await req('GET /all');
    assertCode(response, 200);
    // sorted by date
    expect(
      response.body.posts.sort(
        (a: { date: string }, b: { date: string }) =>
          Date.parse(b.date) - Date.parse(a.date),
      ),
    ).toEqual(response.body.posts);
  });

  test('pagination', async () => {
    await assertPagination({
      url: '/all',
      resultsProperty: 'posts',
      resultsPerPage: 20,
      resultsTotal: 100,
    });
  });
});

describe('GET /feed', () => {
  const followingComms: number[] = [];
  beforeAll(async () => {
    // have admin follow some comms
    followingComms.push(...comms.slice(0, 4));
    await Promise.all(
      followingComms.map(async (commId) => {
        await follow(commId, 1, 'true');
      }),
    );
  });

  test('get all posts from followed communities', async () => {
    const response = await req(`GET /feed`, adminToken);
    assertCode(response, 200);
    expect(
      response.body.posts.every((post: { community: { id: number } }) =>
        followingComms.includes(post.community.id),
      ),
    ).toBeTruthy();
  });
});
