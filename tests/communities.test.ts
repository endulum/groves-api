import * as helpers from './helpers';
import * as devQueries from '../prisma/queries/dev';
import * as userQueries from '../prisma/queries/user';
import * as commQueries from '../prisma/queries/community';
import { populate } from '../prisma/populate';

describe('search communities', () => {
  const commCount = 100;

  beforeAll(async () => {
    await populate({
      userCount: 250,
      commCount,
      postCount: 1000,
      followers: {
        max: 250,
      },
    });
  });

  test('GET /communities - shows max 15 communities by activity descending, by default', async () => {
    const response = await helpers.req('GET', '/communities');
    // console.dir(response.body, { depth: null });
    helpers.check(response, 200);
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
    const response = await helpers.req('GET', `/communities?take=${commCount}`);
    helpers.check(response, 200);
    expect(response.body.communities.length).toBe(commCount);
  });

  test('GET /communities - query "name" works', async () => {
    const response = await helpers.req('GET', '/communities?name=soup');
    helpers.check(response, 200);
    expect(
      response.body.communities.filter(
        (comm: { urlName: string; canonicalName: string }) =>
          comm.urlName.includes('soup') ||
          comm.canonicalName.toLocaleLowerCase().includes('soup'),
      ),
    ).toEqual(response.body.communities);
  });

  test('GET /communities - query "sort" works', async () => {
    // followers
    let response = await helpers.req('GET', '/communities?sort=followers');
    expect(
      [...response.body.communities].sort(
        (
          comm_a: { _count: { followers: number } },
          comm_b: { _count: { followers: number } },
        ) => comm_b._count.followers - comm_a._count.followers,
      ),
    ).toEqual(response.body.communities);
    // activity
    response = await helpers.req('GET', '/communities?sort=activity');
    expect(
      [...response.body.communities].sort(
        (comm_a: { lastActivity: string }, comm_b: { lastActivity: string }) =>
          Date.parse(comm_b.lastActivity) - Date.parse(comm_a.lastActivity),
      ),
    ).toEqual(response.body.communities);
    // posts
    response = await helpers.req('GET', '/communities?sort=posts');
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
    await helpers.testPaginationStability({
      url: '/communities',
      resultsName: 'communities',
      contentCount: commCount,
      resultsLength: 15,
    });
  });

  test('GET /communities - pagination maintains other queries', async () => {
    await helpers.testPaginationStability({
      url: '/communities?take=10&sort=followers',
      resultsName: 'communities',
      contentCount: commCount,
      resultsLength: 10,
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

describe('create, see, and edit a community', () => {
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
    { urlName: '12345' },
    { canonicalName: 'a' },
    { canonicalName: Array(1000).fill('A').join('') },
    { description: Array(1000).fill('A').join('') },
  ];

  beforeAll(async () => {
    await devQueries.truncateTable('User');
    await devQueries.createAdmin();
    await commQueries.create({
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
    helpers.check(response, 401, 'Please log in.');
  });

  test('POST /communities - 400 if errors', async () => {
    await Promise.all(
      wrongInputsArray.map(async (wrongInputs) => {
        const response = await helpers.req(
          'POST',
          '/communities',
          { ...correctInputs, ...wrongInputs },
          await helpers.getToken('admin'),
        );
        helpers.check(response, 400);
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
      await helpers.getToken('admin'),
    );
    helpers.check(response, 200);
    const newCommunity = await commQueries.find({
      urlName: correctInputs.urlName,
    });
    expect(newCommunity).toBeDefined();
  });

  test('GET /community/:community - 404 if community not found', async () => {
    const response = await helpers.req('GET', '/community/owo');
    helpers.check(response, 404, 'Community could not be found.');
  });

  test('GET /community/:community - 200 and community details', async () => {
    const response = await helpers.req('GET', '/community/askgroves');
    // console.dir(response.body, { depth: null });
    helpers.check(response, 200);
  });

  test('PUT /community/:community - 401 if not logged in', async () => {
    const response = await helpers.req(
      'PUT',
      `/community/${correctInputs.urlName}`,
      correctInputs,
      null,
    );
    helpers.check(response, 401, 'Please log in.');
  });

  test('PUT /community/:community - 403 if not mod', async () => {
    await userQueries.create({ username: 'basic' });
    const response = await helpers.req(
      'PUT',
      `/community/${correctInputs.urlName}`,
      correctInputs,
      await helpers.getToken('basic'),
    );
    helpers.check(
      response,
      403,
      'Only the community admin can perform this action.',
    );
  });

  test('PUT /community/:community - 400 if errors', async () => {
    await Promise.all(
      wrongInputsArray.map(async (wrongInputs) => {
        const response = await helpers.req(
          'PUT',
          `/community/${correctInputs.urlName}`,
          { ...correctInputs, ...wrongInputs },
          await helpers.getToken('admin'),
        );
        helpers.check(response, 400);
        expect(response.body).toHaveProperty('errors');
        expect(response.body.errors.length).toEqual(1);
      }),
    );
  });

  test('PUT /community/:community - 200 and edits community details', async () => {
    const response = await helpers.req(
      'PUT',
      `/community/${correctInputs.urlName}`,
      correctInputs,
      await helpers.getToken('admin'),
    );
    helpers.check(response, 200);
  });
});

describe('see and edit the wiki', () => {
  const wiki = { content: 'This is some wiki content.' };

  beforeAll(async () => {
    await devQueries.truncateTable('User');
    await devQueries.createAdmin();
    const userId = await userQueries.create({ username: 'demo-1' });
    const commId = await commQueries.create({
      urlName: 'comm',
      canonicalName: 'Community',
      description: 'This is an ordinary community.',
      adminId: 1,
    });
    await devQueries.distributeCommModerators(commId, [userId]);
    await userQueries.create({ username: 'demo-2' });
  });

  test('PUT /community/:community/wiki - 403 if not mod', async () => {
    const response = await helpers.req(
      'PUT',
      '/community/comm/wiki',
      wiki,
      await helpers.getToken('demo-2'),
    );
    helpers.check(
      response,
      403,
      'Only a community moderator can perform this action.',
    );
  });

  test('PUT /community/:community/wiki - 200 and writes wiki', async () => {
    const response = await helpers.req(
      'PUT',
      '/community/comm/wiki',
      wiki,
      await helpers.getToken('demo-1'),
    );
    helpers.check(response, 200);
    const comm = await commQueries.find({ id: 1 });
    expect(comm?.wiki).toEqual(wiki.content);
  });

  test('GET /community/:community/wiki - 200 and sees wiki', async () => {
    const response = await helpers.req('GET', '/community/comm/wiki');
    helpers.check(response, 200);
    expect(response.body).toHaveProperty('content');
    expect(response.body.content).toEqual(wiki.content);
  });

  test('PUT /community/:community/wiki - 200 and clears wiki', async () => {
    const response = await helpers.req(
      'PUT',
      '/community/comm/wiki',
      { content: null },
      await helpers.getToken('demo-1'),
    );
    helpers.check(response, 200);
    const comm = await commQueries.find({ id: 1 });
    expect(comm?.wiki).toBeNull();
  });
});

describe('follow and unfollow a community', async () => {
  let commId: number = 0;
  beforeAll(async () => {
    await devQueries.truncateTable('User');
    await devQueries.createAdmin();
    await userQueries.create({ username: 'basic' });
    commId = await commQueries.create({
      urlName: 'bestofgroves',
      canonicalName: 'Best of Groves',
      description: 'The funniest and most memorable happenings.',
      adminId: 1,
    });
  });

  test('POST /community/:community/follow - 200 and follows', async () => {
    const response = await helpers.req(
      'POST',
      '/community/bestofgroves/follow',
      { follow: true },
      await helpers.getToken('basic'),
    );
    helpers.check(response, 200);
    const followers = await commQueries.findFollowers(commId);
    expect(followers.length).toBe(1);
  });

  test('POST /community/:community/follow - 403 if trying to double follow', async () => {
    const response = await helpers.req(
      'POST',
      '/community/bestofgroves/follow',
      { follow: true },
      await helpers.getToken('basic'),
    );
    helpers.check(response, 403, 'You are already following this community.');
    const followers = await commQueries.findFollowers(commId);
    expect(followers.length).toBe(1);
  });

  test('POST /community/:community/follow - 200 and unfollows', async () => {
    const response = await helpers.req(
      'POST',
      '/community/bestofgroves/follow',
      { follow: false },
      await helpers.getToken('basic'),
    );
    helpers.check(response, 200);
    const followers = await commQueries.findFollowers(commId);
    expect(followers.length).toBe(0);
  });

  test('POST /community/:community/follow - 403 if unfollowing but never followed', async () => {
    const response = await helpers.req(
      'POST',
      '/community/bestofgroves/follow',
      { follow: false },
      await helpers.getToken('basic'),
    );
    helpers.check(response, 403, 'You are not following this community.');
    const followers = await commQueries.findFollowers(commId);
    expect(followers.length).toBe(0);
  });
});

describe('moderator promotion and demotion', async () => {
  let commId: number = 0;

  beforeAll(async () => {
    await devQueries.truncateTable('User');
    await devQueries.createAdmin();
    const userId = await userQueries.create({ username: 'demo-1' });
    commId = await commQueries.create({
      urlName: 'comm',
      canonicalName: 'Community',
      description: 'This is an ordinary community.',
      adminId: 1,
    });
    await devQueries.distributeCommModerators(commId, [userId]);
    await devQueries.createBulkUsers([
      { username: 'demo-2' },
      { username: 'demo-3' },
    ]);
  });

  // demo-1 is mod, demo-2 and demo-3 are not mods, admin wants to promote demo-2

  test('POST /community/:community/promote - 403 if not admin', async () => {
    const response = await helpers.req(
      'POST',
      '/community/comm/promote',
      { username: 'demo-2' },
      await helpers.getToken('demo-1'),
    );
    helpers.check(
      response,
      403,
      'Only the community admin can perform this action.',
    );
  });

  test('POST /community/:community/promote - 400 if errors', async () => {
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
        helpers.check(response, 400);
        expect(response.body).toHaveProperty('errors');
        expect(response.body.errors.length).toEqual(1);
      }),
    );
  });

  test('POST /community/:community/promote - 200 and adds user', async () => {
    let response = await helpers.req(
      'POST',
      '/community/comm/promote',
      { username: 'demo-2' },
      await helpers.getToken('admin'),
    );
    helpers.check(response, 200);
    response = await helpers.req('GET', '/community/comm');
    expect(
      response.body.moderators.find(
        (m: { username: string }) => m.username === 'demo-2',
      ),
    ).toBeDefined();
  });

  // demo-1 and demo-2 are mods, demo-3 is not mod, admin wants to demote demo-2

  test('POST /community/:community/demote - 403 if not admin', async () => {
    const response = await helpers.req(
      'POST',
      '/community/comm/demote',
      { username: 'demo-2' },
      await helpers.getToken('demo-2'),
    );
    helpers.check(
      response,
      403,
      'Only the community admin can perform this action.',
    );
  });

  test('POST /community/:community/demote - 400 if errors', async () => {
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
        helpers.check(response, 400);
        expect(response.body).toHaveProperty('errors');
        expect(response.body.errors.length).toEqual(1);
      }),
    );
  });

  test('POST /community/:community/demote - 200 and removes user', async () => {
    let response = await helpers.req(
      'POST',
      '/community/comm/demote',
      { username: 'demo-2' },
      await helpers.getToken('admin'),
    );
    helpers.check(response, 200);
    response = await helpers.req('GET', '/community/comm');
    expect(
      response.body.moderators.find(
        (m: { username: string }) => m.username === 'demo-2',
      ),
    ).not.toBeDefined();
  });
});

describe('freeze and unfreeze a community', async () => {
  beforeAll(async () => {
    await devQueries.truncateTable('User');
    await devQueries.createAdmin();
    await userQueries.create({ username: 'basic' });
    await commQueries.create({
      urlName: 'comm',
      canonicalName: 'Community',
      adminId: 1,
    });
  });

  test('POST /community/:community/freeze - 403 if not admin', async () => {
    const response = await helpers.req(
      'POST',
      '/community/comm/freeze',
      { freeze: true },
      await helpers.getToken('basic'),
    );
    helpers.check(
      response,
      403,
      'Only the community admin can perform this action.',
    );
  });

  test('POST /community/:community/freeze - 200 and freezes or unfreezes', async () => {
    const response = await helpers.req(
      'POST',
      '/community/comm/freeze',
      { freeze: true },
      await helpers.getToken('admin'),
    );
    helpers.check(response, 200);

    const comm = await commQueries.find({ id: 1 });
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
        helpers.check(activityResponse, 403, 'This community is frozen.');
      }),
    );
  });

  test('POST /community/:community/freeze - 200 and unfreezes', async () => {
    const response = await helpers.req(
      'POST',
      '/community/comm/freeze',
      { freeze: false },
      await helpers.getToken('admin'),
    );
    helpers.check(response, 200);
    const comm = await commQueries.find({ id: 1 });
    expect(comm?.status).not.toBe('FROZEN');
  });
});
