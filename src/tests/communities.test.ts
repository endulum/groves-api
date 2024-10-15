import * as helpers from '../test_helpers/helpers';
import prisma from '../prisma';

beforeAll(async () => {
  await helpers.wipeTables(['user', 'community']);
  await helpers.createUsers(['demo-1', 'demo-2', 'demo-3', 'demo-4']);
});

afterAll(async () => {
  await helpers.wipeTables(['user', 'community']);
});

describe('create and edit a community', () => {
  const correctInputs = {
    urlName: 'askgroves',
    canonicalName: 'Ask Groves',
    description: 'This is the place to ask and answer thought-provoking questions.',
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
    await prisma.community.create({
      data: {
        urlName: 'bestofgroves',
        canonicalName: 'Best of Groves',
        description: 'The funniest and most memorable happenings.',
        adminId: 1,
      },
    });
  });

  afterAll(async () => { await helpers.wipeTables(['community']); });

  test('POST /communities - 401 if not logged in', async () => {
    const response = await helpers.req('POST', '/communities', correctInputs, null);
    expect(response.status).toBe(401);
  });

  test('POST /communities - 400 if errors', async () => {
    const user = await helpers.getUser('demo-1', 'password');
    await Promise.all(wrongInputsArray.map(async (wrongInputs) => {
      const response = await helpers.req('POST', '/communities', { ...correctInputs, ...wrongInputs }, user.token);
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors.length).toBe(1);
    }));
  });

  test('POST /communities - 200 and new community created', async () => {
    const user = await helpers.getUser('demo-1', 'password');
    const response = await helpers.req('POST', '/communities', correctInputs, user.token);
    expect(response.status).toBe(200);
    const newCommunity = await prisma.community.findUnique({
      where: { urlName: correctInputs.urlName },
    });
    expect(newCommunity).toBeDefined();
  });

  test('PUT /community/:communityNameOrId - 401 if not logged in', async () => {
    const response = await helpers.req('PUT', `/community/${correctInputs.urlName}`, correctInputs, null);
    expect(response.status).toBe(401);
  });

  test('PUT /community/:communityNameOrId - 403 if not mod', async () => {
    const user = await helpers.getUser('demo-2', 'password');
    const response = await helpers.req('PUT', `/community/${correctInputs.urlName}`, correctInputs, user.token);
    expect(response.status).toBe(403);
  });

  // todo: 403 if frozen and not admin, 403 if hidden and not site admin

  test('PUT /community/:communityNameOrId - 400 if errors', async () => {
    const user = await helpers.getUser('demo-1', 'password');
    await Promise.all(wrongInputsArray.map(async (wrongInputs) => {
      const response = await helpers.req('PUT', `/community/${correctInputs.urlName}`, { ...correctInputs, ...wrongInputs }, user.token);
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors.length).toEqual(1);
    }));
  });

  test('PUT /community/:communityNameOrId - 200 and edits community details', async () => {
    const user = await helpers.getUser('demo-1', 'password');
    const response = await helpers.req('PUT', `/community/${correctInputs.urlName}`, correctInputs, user.token);
    expect(response.status).toBe(200);
  });
});

describe('see communities', () => {
  beforeAll(async () => {
    await prisma.community.createMany({
      data: [
        {
          urlName: 'active',
          canonicalName: 'Active Community',
          description: 'You should be able to see this one.',
          adminId: 2,
        }, {
          urlName: 'frozen',
          canonicalName: 'Frozen Community',
          description: 'You should not be able to see this one in global view.',
          adminId: 2,
          status: 'FROZEN',
        }, {
          urlName: 'hidden',
          canonicalName: 'Hidden Community',
          description: 'Nobody should be able to see this one except for the site admin.',
          adminId: 2,
          status: 'HIDDEN',
        },
      ],
    });
  });

  afterAll(async () => { await helpers.wipeTables(['community']); });

  test('GET /communities - show only "active" communities', async () => {
    const response = await helpers.req('GET', '/communities', null, null);
    expect(response.status).toBe(200);
    response.body.communities.forEach((community: { status: string }) => {
      expect(community.status).toEqual('ACTIVE');
    });
    // console.dir(response.body, { depth: null });
  });

  test('GET /community/:communityNameOrId - 404 if community not found', async () => {
    const response = await helpers.req('GET', '/community/owo', null, null);
    expect(response.status).toEqual(404);
  });

  test('GET /community/:communityNameOrId - 404 if community is hidden', async () => {
    const response = await helpers.req('GET', '/community/hidden', null, null);
    expect(response.status).toEqual(404);
  });

  test('GET /community/:communityNameOrId - 200 and community details', async () => {
    const response = await helpers.req('GET', '/community/active', null, null);
    expect(response.status).toEqual(200);
    // console.dir(response.body, { depth: null });
  });

  test('GET /community/:communityNameOrId - 200 if hidden and viewer is site admin', async () => {
    const siteAdmin = await helpers.getUser('admin', 'password');
    const response = await helpers.req('GET', '/community/hidden', null, siteAdmin.token);
    expect(response.status).toEqual(200);
  });
});

describe('follow communities', () => {
  beforeAll(async () => {
    await prisma.community.create({
      data: {
        urlName: 'bestofgroves',
        canonicalName: 'Best of Groves',
        description: 'The funniest and most memorable happenings.',
        adminId: 1,
      },
    });
  });

  afterAll(async () => { await helpers.wipeTables(['community']); });

  test('POST /community/:communityNameOrId/follow - 200 and follows', async () => {
    const { token } = await helpers.getUser('admin', 'password');
    const response = await helpers.req('POST', '/community/bestofgroves/follow', { follow: true }, token);
    expect(response.status).toBe(200);
    const community = await prisma.community.findUnique({
      where: { urlName: 'bestofgroves' },
      include: { followers: true },
    });
    expect(community?.followers.length).toBe(1);
  });

  test('POST /community/:communityNameOrId/follow - 200 and unfollows', async () => {
    const { token } = await helpers.getUser('admin', 'password');
    const response = await helpers.req('POST', '/community/bestofgroves/follow', { follow: false }, token);
    expect(response.status).toBe(200);
    const community = await prisma.community.findUnique({
      where: { urlName: 'bestofgroves' },
      include: { followers: true },
    });
    expect(community?.followers.length).toBe(0);
  });
});

describe('community administration and moderation', () => {
  beforeAll(async () => {
    await prisma.community.create({
      data: {
        urlName: 'comm',
        canonicalName: 'Community',
        description: 'This is an ordinary community.',
        adminId: 2, // demo-1
        moderators: {
          connect: { id: 3 }, // demo-2
        },
      },
    });
  });

  afterAll(async () => { await helpers.wipeTables(['community']); });

  test('POST /community/:communityNameOrId/promote - 403 if not admin of community', async () => {
    const user = await helpers.getUser('demo-3', 'password');
    const response = await helpers.req('POST', '/community/comm/promote', { username: 'demo-3' }, user.token);
    expect(response.status).toBe(403);
  });

  test('POST /community/:communityNameOrId/promote - 400 if errors', async () => {
    const wrongInputArray = [
      { username: '' },
      { username: 'demo-1' },
      { username: 'demo-2' }, // intended error: is already a mod
      { username: 'owo' },
    ];

    const user = await helpers.getUser('demo-1', 'password');
    await Promise.all(wrongInputArray.map(async (wrongInput) => {
      const response = await helpers.req('POST', '/community/comm/promote', wrongInput, user.token);
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors.length).toEqual(1);
    }));
  });

  test('POST /community/:communityNameOrId/promote - 200 and adds user to community moderators', async () => {
    const user = await helpers.getUser('demo-1', 'password');
    const response = await helpers.req('POST', '/community/comm/promote', { username: 'demo-3' }, user.token);
    expect(response.status).toBe(200);

    const thisCommunity = await prisma.community.findUnique({
      where: { urlName: 'comm' },
      include: { moderators: true },
    });
    expect(thisCommunity?.moderators.map((c) => c.username)).toEqual(['demo-2', 'demo-3']);
  });

  test('POST /community/:communityNameOrId/demote - 403 if not admin of community', async () => {
    const user = await helpers.getUser('demo-4', 'password');
    const response = await helpers.req('POST', '/community/comm/demote', { username: 'demo-3' }, user.token);
    expect(response.status).toBe(403);
  });

  test('POST /community/:communityNameOrId/demote - 400 if errors', async () => {
    const wrongInputArray = [
      { username: '' },
      { username: 'demo-1' },
      { username: 'demo-4' }, // intended error: is not a mod
      { username: 'owo' },
    ];

    const user = await helpers.getUser('demo-1', 'password');
    await Promise.all(wrongInputArray.map(async (wrongInput) => {
      const response = await helpers.req('POST', '/community/comm/demote', wrongInput, user.token);
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors.length).toEqual(1);
    }));
  });

  test('POST /community/:communityNameOrId/demote - 200 and removes user from community moderators', async () => {
    const user = await helpers.getUser('demo-1', 'password');
    const response = await helpers.req('POST', '/community/comm/demote', { username: 'demo-3' }, user.token);
    expect(response.status).toBe(200);

    const thisCommunity = await prisma.community.findUnique({
      where: { urlName: 'comm' },
      include: { moderators: true },
    });
    expect(thisCommunity?.moderators.map((c) => c.username)).toEqual(['demo-2']);
  });
});

// todo: prevent passwords from showing up...
