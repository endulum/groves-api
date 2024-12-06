import { req, assertCode } from '../helpers';
import { seed } from '../../prisma/seed';
import { assertPagination } from './_listHelpers';

describe('GET /communities', () => {
  const testCommCount = 50;

  beforeAll(async () => {
    await seed({
      userCount: 250,
      comms: { count: testCommCount, followers: { max: 250 } },
      posts: { perComm: { max: 100 } },
    });
  });

  test('show max 15 communities, activity ascending by default', async () => {
    const response = await req('GET /communities');
    assertCode(response, 200);
    expect(response.body.communities).toBeDefined();
    expect(response.body.communities.length).toBe(15);
    expect(
      [...response.body.communities].sort(
        (comm_a: { lastActivity: string }, comm_b: { lastActivity: string }) =>
          Date.parse(comm_b.lastActivity) - Date.parse(comm_a.lastActivity),
      ),
    ).toEqual(response.body.communities);
  });

  describe('query params', () => {
    test('take', async () => {
      const response = await req(`GET /communities?take=${testCommCount}`);
      assertCode(response, 200);
      expect(response.body.communities.length).toBe(testCommCount);
    });

    test('name', async () => {
      const response = await req(`GET /communities?name=soup`);
      assertCode(response, 200);
      expect(
        response.body.communities.filter(
          (comm: { urlName: string; canonicalName: string }) =>
            comm.urlName.includes('soup') ||
            comm.canonicalName.toLocaleLowerCase().includes('soup'),
        ),
      ).toEqual(response.body.communities);
    });

    test('sort', async () => {
      // followers
      let response = await req('GET /communities?sort=followers');
      expect(
        [...response.body.communities].sort(
          (
            comm_a: { _count: { followers: number } },
            comm_b: { _count: { followers: number } },
          ) => comm_b._count.followers - comm_a._count.followers,
        ),
      ).toEqual(response.body.communities);
      // latest activity
      response = await req('GET /communities?sort=latest');
      expect(
        [...response.body.communities].sort(
          (
            comm_a: { lastActivity: string },
            comm_b: { lastActivity: string },
          ) =>
            Date.parse(comm_b.lastActivity) - Date.parse(comm_a.lastActivity),
        ),
      ).toEqual(response.body.communities);
      // newest created
      response = await req('GET /communities?sort=newest');
      expect(
        [...response.body.communities].sort(
          (comm_a: { created: string }, comm_b: { created: string }) =>
            Date.parse(comm_b.created) - Date.parse(comm_a.created),
        ),
      ).toEqual(response.body.communities);
    });
  });

  test('stable pagination', async () => {
    await assertPagination({
      url: '/communities',
      resultsProperty: 'communities',
      resultsTotal: testCommCount,
      resultsPerPage: 15,
    });
  });

  test('pagination preserves other queries', async () => {
    await assertPagination({
      url: '/communities?take=10&sort=followers',
      resultsProperty: 'communities',
      resultsTotal: testCommCount,
      resultsPerPage: 10,
      perPageAssertion: async (response) => {
        expect(response.body.communities.length).toBe(10);
        expect(
          [...response.body.communities].sort(
            (
              comm_a: { _count: { followers: number } },
              comm_b: { _count: { followers: number } },
            ) => comm_b._count.followers - comm_a._count.followers,
          ),
        ).toEqual(response.body.communities);
      },
    });
  });
});
