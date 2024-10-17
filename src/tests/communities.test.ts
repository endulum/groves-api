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

  // afterAll(async () => { await helpers.wipeTables(['community']); });

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
    await helpers.wipeTables(['community']);
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

  // afterAll(async () => { await helpers.wipeTables(['community']); });

  test('GET /communities - show only "active" communities', async () => {
    const response = await helpers.req('GET', '/communities', null, null);
    expect(response.status).toBe(200);
    expect(response.body.communities.length).toBe(1);
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

describe('search communities', () => {
  beforeAll(async () => {
    await helpers.wipeTables(['community', 'user']);
  });

  afterEach(async () => {
    await helpers.wipeTables(['community', 'user', 'post']);
  });

  async function generateContent(
    userCount: number,
    commCount: number,
    postCount: number,
  ) {
    const users = await helpers.generateDummyUsers(userCount);
    if (users.length > 0) {
      await prisma.user.createMany({
        data: users.map((user) => ({
          username: user.username,
          password: 'password',
        })),
      });
    }
    const communities = await helpers.generateDummyCommunities(commCount);
    if (communities.length > 0) {
      await prisma.community.createMany({
        data: communities.map((community) => ({
          urlName: community.urlName,
          canonicalName: community.canonicalName,
          description: `For fans of ${community.canonicalName}`,
          adminId: 1,
        })),
      });
    }
    const posts = await helpers.generateDummyPosts(postCount);
    if (posts.length > 0) {
      await prisma.post.createMany({
        data: posts.map((post) => ({
          title: post.title,
          content: post.content,
          authorId: Math.ceil(Math.random() * 100),
          communityId: Math.ceil(Math.random() * 20),
        })),
      });
    }
    return { users, communities };
  }

  test('GET /communities - query "page"=<any pos int> works', async () => {
    await generateContent(1, 100, 0);

    let response = await helpers.req('GET', '/communities', null, null); // automatically first page
    expect(response.status).toBe(200);
    expect(response.body.page).toBe(1);
    expect(response.body.pages).toBe(5);
    expect(response.body.communities.length).toBe(20);

    const defaultCommunities = response.body.communities;

    response = await helpers.req('GET', '/communities?page=2', null, null); // second page
    expect(response.status).toBe(200);
    expect(response.body.page).toBe(2);
    expect(response.body.pages).toBe(5);
    expect(response.body.communities.length).toBe(20);
    expect(response.body.communities.every(
      (
        comm: { urlName: string },
        i: number,
      ) => comm.urlName !== defaultCommunities[i].urlName,
    )).toBeTruthy();

    response = await helpers.req('GET', '/communities?page=20', null, null); // out of bounds page
    expect(response.status).toBe(200);
    expect(response.body.page).toBe(20);
    expect(response.body.pages).toBe(5);
    expect(response.body.communities.length).toBe(0);
  });

  test('GET /communities - query "name"=<any string> works', async () => {
    await generateContent(1, 100, 0);

    const response = await helpers.req('GET', '/communities?name=soup', null, null);
    expect(response.status).toBe(200);
    expect(response.body.communities.filter(
      (
        comm: { urlName: string, canonicalName: string },
      ) => comm.urlName.includes('soup') || comm.canonicalName.toLocaleLowerCase().includes('soup'),
    )).toEqual(response.body.communities);
  });

  test('GET /communities - query "sort=followers" works', async () => {
    const { users, communities } = await generateContent(100, 20, 0);

    await Promise.all(communities.map(async (community) => {
      const followerCount = Math.ceil(Math.random() * 100);
      await prisma.community.update({
        where: { urlName: community.urlName },
        data: {
          followers: {
            connect: [...users]
              .sort(() => 0.5 - Math.random())
              .slice(0, followerCount)
              .map((user) => ({ id: user.id })),
          },
        },
      });
    }));

    const response = await helpers.req('GET', '/communities?sort=followers', null, null);
    expect(response.status).toBe(200);
    expect([...response.body.communities].sort(
      (
        comm_a: { _count: { followers: number } },
        comm_b: { _count: { followers: number } },
      ) => comm_b._count.followers - comm_a._count.followers,
    )).toEqual(response.body.communities);
  });

  test('GET /communities - query "sort=posts" works', async () => {
    await generateContent(100, 20, 0);

    const response = await helpers.req('GET', '/communities?sort=posts', null, null);
    expect(response.status).toBe(200);
    expect([...response.body.communities].sort(
      (
        comm_a: { _count: { posts: number } },
        comm_b: { _count: { posts: number } },
      ) => comm_b._count.posts - comm_a._count.posts,
    )).toEqual(response.body.communities);
  });

  test('GET /communities - query "sort=activity" works', async () => {
    await generateContent(1, 0, 0);

    const communities = [
      { urlName: 'comm-a', canonicalName: 'Comm A' },
      { urlName: 'comm-b', canonicalName: 'Comm B' },
      { urlName: 'comm-c', canonicalName: 'Comm C' },
      { urlName: 'comm-D', canonicalName: 'Comm D' },
    ].sort(() => 0.5 - Math.random());

    function yesterday(days: number): Date {
      const date = new Date();
      date.setDate(date.getDate() - days);
      return date;
    }

    await prisma.community.createMany({
      data: communities.map((comm, index) => ({
        urlName: comm.urlName,
        canonicalName: comm.canonicalName,
        description: 'owo',
        adminId: 1,
        lastActivity: yesterday(index),
      })),
    });

    const response = await helpers.req('GET', '/communities?sort=activity', null, null);
    expect(response.status).toBe(200);
    expect([...response.body.communities].sort(
      (
        comm_a: { lastActivity: string },
        comm_b: { lastActivity: string },
      ) => Date.parse(comm_b.lastActivity) - Date.parse(comm_a.lastActivity),
    )).toEqual(response.body.communities);
  });

  // test('GET /communities - query "page"=<any number> works', async () => {
  //   await generateContent(1, 100, 0);
  //   const response = await helpers.req('GET', '/communities?page=2', null, null);
  //   expect(response.status).toBe(200);
  //   expect(response.body.communities.length).toBe(20);
  // });
});

describe('follow communities', () => {
  beforeAll(async () => {
    await helpers.wipeTables(['post', 'community', 'user']);
    await helpers.createUsers(['demo-1', 'demo-2', 'demo-3', 'demo-4']);
    await prisma.community.create({
      data: {
        urlName: 'bestofgroves',
        canonicalName: 'Best of Groves',
        description: 'The funniest and most memorable happenings.',
        adminId: 1,
      },
    });
  });

  // afterAll(async () => { await helpers.wipeTables(['community']); });

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
    await helpers.wipeTables(['community']);
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

  // afterAll(async () => { await helpers.wipeTables(['community']); });

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

describe('community wiki', () => {
  beforeAll(async () => {
    await helpers.wipeTables(['community']);
    await prisma.community.create({
      data: {
        urlName: 'comm',
        canonicalName: 'Community',
        description: 'This is an ordinary community.',
        adminId: 1,
        moderators: {
          connect: { id: 2 },
        },
      },
    });
  });

  test('PUT /community/:communityId/wiki - 403 if not mod or admin', async () => {
    const { token } = await helpers.getUser('demo-3', 'password');
    const response = await helpers.req('PUT', '/community/comm/wiki', { wiki: 'Hi there!' }, token);
    expect(response.status).toBe(403);
  });

  test('PUT /community/:communityId/wiki - 200 and edits wiki', async () => {
    const { token } = await helpers.getUser('demo-1', 'password');
    const response = await helpers.req('PUT', '/community/comm/wiki', { wiki: 'Hi there!' }, token);
    expect(response.status).toBe(200);

    const comm = await prisma.community.findFirst({
      where: { wiki: 'Hi there!' },
    });
    expect(comm).toBeDefined();
  });
});

// todo: prevent passwords from showing up...
