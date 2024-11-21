import * as helpers from './helpers';
import * as queries from '../prisma/queries';
import { populate } from '../prisma/populate';

beforeAll(async () => {
  await queries.truncateTable('User');
  await queries.createAdmin();
  await queries.createUser('basic');
});

describe('see a community', () => {
  beforeAll(async () => {
    await queries.truncateTable('Community');
    await queries.createBulkCommunities(
      [
        {
          urlName: 'active',
          canonicalName: 'Active Community',
          description: 'You should be able to see this one.',
        },
        {
          urlName: 'hidden',
          canonicalName: 'Hidden Community',
          description:
            'Nobody should be able to see this one except for the site admin.',
          status: 'HIDDEN',
        },
      ],
      1,
    );
  });

  test('GET /community/:communityUrlOrId - 404 if community not found', async () => {
    const response = await helpers.req('GET', '/community/owo', null, null);
    expect(response.status).toEqual(404);
  });

  test('GET /community/:communityUrlOrId - 200 and community details', async () => {
    const response = await helpers.req('GET', '/community/active', null, null);
    expect(response.status).toEqual(200);
    // console.dir(response.body, { depth: null });
  });

  test('GET /community/:communityUlrOrId - 404 if community is hidden', async () => {
    let response = await helpers.req('GET', '/community/hidden', null, null);
    expect(response.status).toEqual(404);
    const token = await helpers.getToken('basic');
    response = await helpers.req('GET', '/community/hidden', null, token);
    expect(response.status).toEqual(404);
  });

  test('GET /community/:communityUrlOrId - 200 if hidden and is admin', async () => {
    const token = await helpers.getToken('admin');
    const response = await helpers.req('GET', '/community/hidden', null, token);
    expect(response.status).toEqual(200);
  });
});

describe('create and edit a community', async () => {
  const correctInputs = {
    urlName: 'askgroves',
    canonicalName: 'Ask Groves',
    description:
      'This is the place to ask and answer thought-provoking questions.',
  };

  const wrongInputsArray = [
    { urlName: '' },
    { canonicalName: '' },
    { description: '' },
    { urlName: 'a' },
    { urlName: Array(1000).fill('A').join('') },
    { urlName: '&&&' },
    { urlName: 'bestofgroves' },
    { canonicalName: 'a' },
    { canonicalName: Array(1000).fill('A').join('') },
    { description: Array(1000).fill('A').join('') },
  ];

  beforeAll(async () => {
    await queries.truncateTable('Community');
    await queries.createCommunity({
      urlName: 'bestofgroves',
      canonicalName: 'Best of Groves',
      description: 'The funniest and most memorable happenings.',
      adminId: 1,
    });
  });

  test('POST /communities - 401 if not logged in', async () => {
    const response = await helpers.req(
      'POST',
      '/communities',
      correctInputs,
      null,
    );
    expect(response.status).toBe(401);
  });

  test('POST /communities - 400 if errors', async () => {
    await Promise.all(
      wrongInputsArray.map(async (wrongInputs) => {
        const response = await helpers.req(
          'POST',
          '/communities',
          { ...correctInputs, ...wrongInputs },
          await helpers.getToken('basic'),
        );
        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('errors');
        expect(response.body.errors.length).toBe(1);
      }),
    );
  });

  test('POST /communities - 200 and new community created', async () => {
    const response = await helpers.req(
      'POST',
      '/communities',
      correctInputs,
      await helpers.getToken('basic'),
    );
    expect(response.status).toBe(200);
    const newCommunity = await queries.findCommunity({
      urlName: correctInputs.urlName,
    });
    expect(newCommunity).toBeDefined();
  });

  test('PUT /community/:communityNameOrId - 401 if not logged in', async () => {
    const response = await helpers.req(
      'PUT',
      `/community/${correctInputs.urlName}`,
      correctInputs,
      null,
    );
    expect(response.status).toBe(401);
  });

  test('PUT /community/:communityNameOrId - 403 if not mod', async () => {
    const response = await helpers.req(
      'PUT',
      `/community/${correctInputs.urlName}`,
      correctInputs,
      await helpers.getToken('admin'),
    );
    expect(response.status).toBe(403);
  });

  test('PUT /community/:communityNameOrId - 400 if errors', async () => {
    await Promise.all(
      wrongInputsArray.map(async (wrongInputs) => {
        const response = await helpers.req(
          'PUT',
          `/community/${correctInputs.urlName}`,
          { ...correctInputs, ...wrongInputs },
          await helpers.getToken('basic'),
        );
        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('errors');
        expect(response.body.errors.length).toEqual(1);
      }),
    );
  });

  test('PUT /community/:communityNameOrId - 200 and edits community details', async () => {
    const response = await helpers.req(
      'PUT',
      `/community/${correctInputs.urlName}`,
      correctInputs,
      await helpers.getToken('basic'),
    );
    expect(response.status).toBe(200);
  });
});

describe('see and edit community wiki', async () => {
  const wiki = { content: 'owo' };
  // wiki editing does not depend on other inputs, so it's its own form.
  beforeAll(async () => {
    await queries.truncateTable('User');
    await queries.createAdmin();
    const userId = await queries.createUser('demo-1');
    const commId = await queries.createCommunity({
      urlName: 'comm',
      canonicalName: 'Community',
      description: 'This is an ordinary community.',
      adminId: 1,
    });
    await queries.distributeCommModerators(commId, [userId]);
    await queries.createUser('demo-2');
  });

  test('PUT /community/communityUrlOrId/wiki - 403 if not mod', async () => {
    const response = await helpers.req(
      'PUT',
      '/community/comm/wiki',
      wiki,
      await helpers.getToken('demo-2'),
    );
    expect(response.status).toBe(403);
  });

  test('PUT /community/communityUrlOrId/wiki - 200 and writes wiki', async () => {
    const response = await helpers.req(
      'PUT',
      '/community/comm/wiki',
      wiki,
      await helpers.getToken('demo-1'),
    );
    expect(response.status).toBe(200);
    const comm = await queries.findCommunity({ id: 1 });
    expect(comm?.wiki).toEqual(wiki.content);
  });

  test('GET /community/:communityUrlOrId/wiki - 200 and sees wiki', async () => {
    const response = await helpers.req(
      'GET',
      '/community/comm/wiki',
      null,
      null,
    );
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('content');
    expect(response.body.content).toEqual(wiki.content);
  });

  test('PUT /community/communityUrlOrId/wiki - 200 and clears wiki', async () => {
    const response = await helpers.req(
      'PUT',
      '/community/comm/wiki',
      { content: null },
      await helpers.getToken('demo-1'),
    );
    expect(response.status).toBe(200);
    const comm = await queries.findCommunity({ id: 1 });
    expect(comm?.wiki).toBeNull();
  });
});

describe('moderator promotion and demotion', async () => {
  let commId: number = 0;

  beforeAll(async () => {
    await queries.truncateTable('User');
    await queries.createAdmin();
    const userId = await queries.createUser('demo-1');
    commId = await queries.createCommunity({
      urlName: 'comm',
      canonicalName: 'Community',
      description: 'This is an ordinary community.',
      adminId: 1,
    });
    await queries.distributeCommModerators(commId, [userId]);
    await queries.createBulkUsers([
      { username: 'demo-2' },
      { username: 'demo-3' },
    ]);
  });

  // demo-1 is mod, demo-2 and demo-3 are not mods, admin wants to promote demo-2

  test('POST /community/:communityUrlOrId/promote - 403 if not admin', async () => {
    const response = await helpers.req(
      'POST',
      '/community/comm/promote',
      { username: 'demo-2' },
      await helpers.getToken('demo-1'),
    );
    expect(response.status).toBe(403);
  });

  test('POST /community/:communityUrlOrId/promote - 400 if errors', async () => {
    const wrongInputArray = [
      { username: '' },
      { username: 'admin' }, // can't promote yourself
      { username: 'demo-1' }, // already a mod
      { username: 'owo' }, // user doesn't exist
    ];
    await Promise.all(
      wrongInputArray.map(async (wrongInput) => {
        const response = await helpers.req(
          'POST',
          '/community/comm/promote',
          wrongInput,
          await helpers.getToken('admin'),
        );
        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('errors');
        expect(response.body.errors.length).toEqual(1);
      }),
    );
  });

  test('POST /community/:communityUrlOrId/promote - 200 and adds user', async () => {
    const response = await helpers.req(
      'POST',
      '/community/comm/promote',
      { username: 'demo-2' },
      await helpers.getToken('admin'),
    );
    expect(response.status).toBe(200);
    const moderators = await queries.findCommMods(commId);
    expect(moderators.find((m) => m.username === 'demo-2')).toBeDefined();
  });

  test('GET /community/:communityUrlOrId - 200 and shows moderators', async () => {
    const response = await helpers.req('GET', '/community/comm', null, null);
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('moderators');
    expect(response.body.moderators.length).toBe(3);
    // console.dir(response.body, { depth: null });
  });

  // demo-1 and demo-2 are mods, demo-3 is not mod, admin wants to demote demo-2

  test('POST /community/:communityUrlOrId/demote - 403 if not admin', async () => {
    const response = await helpers.req(
      'POST',
      '/community/comm/demote',
      { username: 'demo-2' },
      await helpers.getToken('demo-2'),
    );
    expect(response.status).toBe(403);
  });

  test('POST /community/:communityUrlOrId/demote - 400 if errors', async () => {
    const wrongInputArray = [
      { username: '' },
      { username: 'admin' }, // can't demote yourself
      { username: 'demo-3' }, // not a mod
      { username: 'owo' }, // user doesn't exist
    ];
    await Promise.all(
      wrongInputArray.map(async (wrongInput) => {
        const response = await helpers.req(
          'POST',
          '/community/comm/demote',
          wrongInput,
          await helpers.getToken('admin'),
        );
        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('errors');
        expect(response.body.errors.length).toEqual(1);
      }),
    );
  });

  test('POST /community/:communityUrlOrId/demote - 200 and removes user', async () => {
    const response = await helpers.req(
      'POST',
      '/community/comm/demote',
      { username: 'demo-2' },
      await helpers.getToken('admin'),
    );
    expect(response.status).toBe(200);
    const moderators = await queries.findCommMods(commId);
    expect(moderators.find((m) => m.username === 'demo-2')).not.toBeDefined();
  });
});

describe('follow and unfollow a community', async () => {
  let commId: number = 0;
  beforeAll(async () => {
    await queries.truncateTable('User');
    await queries.createAdmin();
    await queries.createUser('basic');
    commId = await queries.createCommunity({
      urlName: 'bestofgroves',
      canonicalName: 'Best of Groves',
      description: 'The funniest and most memorable happenings.',
      adminId: 1,
    });
  });

  test('POST /community/:communityNameOrId/follow - 200 and follows', async () => {
    const response = await helpers.req(
      'POST',
      '/community/bestofgroves/follow',
      { follow: true },
      await helpers.getToken('basic'),
    );
    expect(response.status).toBe(200);
    const followers = await queries.findCommFollowers(commId);
    expect(followers.length).toBe(1);
  });

  test('POST /community/:communityNameOrId/follow - 200 and unfollows', async () => {
    const response = await helpers.req(
      'POST',
      '/community/bestofgroves/follow',
      { follow: false },
      await helpers.getToken('basic'),
    );
    expect(response.status).toBe(200);
    const followers = await queries.findCommFollowers(commId);
    expect(followers.length).toBe(0);
  });
});

describe('search communities', async () => {
  const commCount = 100;

  beforeAll(async () => {
    await populate({
      userCount: 250,
      commCount,
      postCount: 1000,
      maxRepliesPerPost: 0,
      maxVotesPerPost: 0,
      maxMods: 5,
      maxFollowers: 250,
    });
  });

  test('GET /communities - shows max 15 communities by activity descending, by default', async () => {
    const response = await helpers.req('GET', '/communities', null, null);
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('communities');
    expect(response.body.communities.length).toBe(15);
    expect(
      [...response.body.communities].sort(
        (comm_a: { lastActivity: string }, comm_b: { lastActivity: string }) =>
          Date.parse(comm_b.lastActivity) - Date.parse(comm_a.lastActivity),
      ),
    ).toEqual(response.body.communities);
  });

  test('GET /communities - query "take" works', async () => {
    const response = await helpers.req(
      'GET',
      `/communities?take=${commCount}`,
      null,
      null,
    );
    expect(response.status).toBe(200);
    expect(response.body.communities.length).toBe(commCount);
  });

  test('GET /communities - query "name" works', async () => {
    const response = await helpers.req(
      'GET',
      '/communities?name=soup&take=150',
      null,
      null,
    );
    expect(response.status).toBe(200);
    expect(
      response.body.communities.filter(
        (comm: { urlName: string; canonicalName: string }) =>
          comm.urlName.includes('soup') ||
          comm.canonicalName.toLocaleLowerCase().includes('soup'),
      ),
    ).toEqual(response.body.communities);
  });

  test('GET /communities - query "sort" works (follower count)', async () => {
    const response = await helpers.req(
      'GET',
      '/communities?sort=followers&take=150',
      null,
      null,
    );
    expect(
      [...response.body.communities].sort(
        (
          comm_a: { _count: { followers: number } },
          comm_b: { _count: { followers: number } },
        ) => comm_b._count.followers - comm_a._count.followers,
      ),
    ).toEqual(response.body.communities);
  });

  test('GET /communities - query "sort" works (activity)', async () => {
    const response = await helpers.req(
      'GET',
      '/communities?sort=activity&take=150',
      null,
      null,
    );
    expect(
      [...response.body.communities].sort(
        (comm_a: { lastActivity: string }, comm_b: { lastActivity: string }) =>
          Date.parse(comm_b.lastActivity) - Date.parse(comm_a.lastActivity),
      ),
    ).toEqual(response.body.communities);
  });

  test('GET /communities - query "sort" works (post count)', async () => {
    const response = await helpers.req(
      'GET',
      '/communities?sort=posts&take=150',
      null,
      null,
    );
    expect(
      [...response.body.communities].sort(
        (
          comm_a: { _count: { posts: number } },
          comm_b: { _count: { posts: number } },
        ) => comm_b._count.posts - comm_a._count.posts,
      ),
    ).toEqual(response.body.communities);
  });

  test('GET /communities - pagination', async () => {
    let response = await helpers.req('GET', '/communities', null, null);
    expect(response.body).toHaveProperty('links');
    expect(response.body.links.nextPage).not.toBeNull();

    // keep a record of results as we page forward
    let pageCount: number = 1;
    const results: Record<number, number[]> = {
      [pageCount]: response.body.communities.map(
        ({ id }: { id: number }) => id,
      ),
    };
    let nextPage: string = response.body.links.nextPage;
    while (nextPage !== null) {
      response = await helpers.req('GET', nextPage, null, null);
      nextPage = response.body.links.nextPage;
      pageCount++;
      results[pageCount] = response.body.communities.map(
        ({ id }: { id: number }) => id,
      );
    }

    // use record to expect a correct amount of results
    expect(
      Object.keys(results).reduce((acc: number, curr: string) => {
        return acc + results[parseInt(curr, 10)].length;
      }, 0),
    ).toEqual(commCount);
    // use record expect a correct amount of pages
    expect(pageCount).toEqual(Math.ceil(commCount / 15));

    // page backward, comparing against recorded "pages"
    let prevPage: string = response.body.links.prevPage;
    while (prevPage !== null) {
      response = await helpers.req('GET', prevPage, null, null);
      prevPage = response.body.links.prevPage;
      pageCount--;
      // expect that each "page" has the exact same results
      expect(
        response.body.communities.map(({ id }: { id: number }) => id),
      ).toEqual(results[pageCount]);
    }
  });

  test('GET /communities - pagination maintains other queries', async () => {
    let response = await helpers.req(
      'GET',
      '/communities?take=10&sort=followers',
      null,
      null,
    );
    expect(response.body).toHaveProperty('links');
    expect(response.body.links.nextPage).not.toBeNull();

    // pretty much the same as the last test except, in between pages,
    // we assert that our additional queries are actually applying
    const assertCorrectResults = () => {
      expect(response.body.communities.length).toBe(10);
      expect(
        [...response.body.communities].sort(
          (
            comm_a: { _count: { followers: number } },
            comm_b: { _count: { followers: number } },
          ) => comm_b._count.followers - comm_a._count.followers,
        ),
      ).toEqual(response.body.communities);
    };

    assertCorrectResults();

    let pageCount: number = 1;
    const results: Record<number, number[]> = {
      [pageCount]: response.body.communities.map(
        ({ id }: { id: number }) => id,
      ),
    };
    let nextPage: string = response.body.links.nextPage;
    while (nextPage !== null) {
      response = await helpers.req('GET', nextPage, null, null);
      assertCorrectResults();
      nextPage = response.body.links.nextPage;
      pageCount++;
      results[pageCount] = response.body.communities.map(
        ({ id }: { id: number }) => id,
      );
    }

    expect(
      Object.keys(results).reduce((acc: number, curr: string) => {
        return acc + results[parseInt(curr, 10)].length;
      }, 0),
    ).toEqual(commCount);
    expect(pageCount).toEqual(Math.ceil(commCount / 10));

    let prevPage: string = response.body.links.prevPage;
    while (prevPage !== null) {
      response = await helpers.req('GET', prevPage, null, null);
      assertCorrectResults();
      prevPage = response.body.links.prevPage;
      pageCount--;
      expect(
        response.body.communities.map(({ id }: { id: number }) => id),
      ).toEqual(results[pageCount]);
    }
  });
});

describe('freeze and unfreeze a community', async () => {
  beforeAll(async () => {
    await queries.truncateTable('User');
    await queries.createAdmin();
    await queries.createUser('basic');
    await queries.createCommunity({
      urlName: 'comm',
      canonicalName: 'Community',
      adminId: 1,
    });
  });

  test('POST /community/:communityId/freeze - 403 if not admin', async () => {
    const response = await helpers.req(
      'POST',
      '/community/comm/freeze',
      { freeze: true },
      await helpers.getToken('basic'),
    );
    expect(response.status).toBe(403);
  });

  test('POST /community/:communityId/freeze - 200 and freezes or unfreezes', async () => {
    const response = await helpers.req(
      'POST',
      '/community/comm/freeze',
      { freeze: true },
      await helpers.getToken('admin'),
    );
    expect(response.status).toBe(200);

    const comm = await queries.findCommunity({ id: 1 });
    expect(comm?.status).toBe('FROZEN');

    await Promise.all(
      (
        [
          // nothing is allowed to happen in a frozen community.
          { method: 'PUT', url: '/community/comm' }, // editing community detail
          { method: 'PUT', url: '/community/comm/wiki' }, // editing community wiki
          { method: 'POST', url: '/community/comm/follow' }, // following comm
          { method: 'POST', url: '/community/comm/promote' }, // promoting mod
          { method: 'POST', url: '/community/comm/demote' }, // demoting mod
        ] as Array<{ method: 'PUT' | 'POST'; url: string }>
      ).map(async (activity) => {
        const activityResponse = await helpers.req(
          activity.method,
          activity.url,
          null,
          await helpers.getToken('admin'),
        );
        expect(activityResponse.status).toBe(403);
      }),
    );
  });

  test('POST /community/:communityId/freeze - 200 and unfreezes', async () => {
    const response = await helpers.req(
      'POST',
      '/community/comm/freeze',
      { freeze: false },
      await helpers.getToken('admin'),
    );
    expect(response.status).toBe(200);
    const comm = await queries.findCommunity({ id: 1 });
    expect(comm?.status).not.toBe('FROZEN');
  });
});
