import * as helpers from './helpers';

beforeAll(async () => {
  await helpers.wipeTables(['user', 'community']);
  await helpers.createUsers();
  await helpers.createDummyCommunities();
});

afterAll(async () => {
  await helpers.wipeTables(['user', 'community']);
});

describe('seeing communities', () => {
  test('GET /communities - 200 and all active communities', async () => {
    const response = await helpers.req('GET', '/communities', null, null);
    expect(response.status).toEqual(200);
    response.body.forEach((community: { status: string }) => {
      expect(community.status).toEqual('ACTIVE');
    });
    // console.log(response.body);
  });

  test('GET /community/:communityNameOrId - 404 if community not found', async () => {
    const response = await helpers.req('GET', '/community/owo', null, null);
    expect(response.status).toEqual(404);
  });

  test('GET /community/:communityNameOrId - 200 and community details', async () => {
    const response = await helpers.req('GET', '/community/askgroves', null, null);
    expect(response.status).toEqual(200);
    await Promise.all(['urlName', 'canonicalName', 'id', 'description', 'wiki', 'status', 'followers', 'admin', 'moderators', 'posts'].map(async (property) => {
      expect(response.body).toHaveProperty(property);
    }));
  });

  test('GET /community/:communityNameOrId - 404 if community is hidden', async () => {
    const response = await helpers.req('GET', '/community/hidden', null, null);
    expect(response.status).toEqual(404);
  });

  test('GET /community/:communityNameOrId - 200 if hidden and viewer is site admin', async () => {
    const siteAdmin = await helpers.getUser('admin', process.env.ADMIN_PASS as string);
    const response = await helpers.req('GET', '/community/hidden', null, siteAdmin.token);
    expect(response.status).toEqual(200);
  });
});

describe('creating communities', () => {
  const correctInputs = {
    urlName: 'uspolitics',
    canonicalName: 'U.S. Politics',
    description: 'News and discussion about U.S. politics.',
  };

  test('POST /communities - 400 if errors', async () => {
    const wrongInputsArray = [
      { urlName: '' },
      { canonicalName: '' },
      { description: '' },
      { urlName: 'a' },
      { urlName: Array(1000).fill('A').join('') },
      { urlName: '&&&' },
      { canonicalName: 'a' },
      { canonicalName: Array(1000).fill('A').join('') },
      { description: Array(1000).fill('A').join('') },
    ];

    await Promise.all(wrongInputsArray.map(async (wrongInputs) => {
      const user = await helpers.getUser('admin', process.env.ADMIN_PASS as string);
      const response = await helpers.req('POST', '/communities', { ...correctInputs, ...wrongInputs }, user.token);
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors.length).toEqual(1);
    }));
  });

  test('POST /communities - 200 and creates a community', async () => {
    const user = await helpers.getUser('admin', process.env.ADMIN_PASS as string);
    let response = await helpers.req('POST', '/communities', correctInputs, user.token);
    expect(response.status).toBe(200);
    response = await helpers.req('GET', `/community/${correctInputs.urlName}`, null, null);
    expect(response.status).toBe(200);
    // console.log(response.body);
  });
});

describe('editing a community', () => {
  const correctInputs = {
    urlName: 'politics',
    canonicalName: 'Politics',
    description: 'News and discussion about politics.',
  };

  test('PUT /community/:communityNameOrId - 403 if not admin or mod', async () => {
    const user = await helpers.getUser('basic', process.env.ADMIN_PASS as string);
    const response = await helpers.req('PUT', '/community/uspolitics', correctInputs, user.token);
    expect(response.status).toBe(403);
  });

  test('PUT /community/:communityNameOrId - 400 if errors', async () => {
    const wrongInputsArray = [
      { urlName: '' },
      { canonicalName: '' },
      { description: '' },
      { urlName: 'a' },
      { urlName: Array(1000).fill('A').join('') },
      { urlName: '&&&' },
      { canonicalName: 'a' },
      { canonicalName: Array(1000).fill('A').join('') },
      { description: Array(1000).fill('A').join('') },
    ];

    await Promise.all(wrongInputsArray.map(async (wrongInputs) => {
      const user = await helpers.getUser('admin', process.env.ADMIN_PASS as string);
      const response = await helpers.req('PUT', '/community/uspolitics', { ...correctInputs, ...wrongInputs }, user.token);
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors.length).toEqual(1);
    }));
  });

  test('PUT /community/:communityNameOrId - 200 and creates a community', async () => {
    const user = await helpers.getUser('admin', process.env.ADMIN_PASS as string);
    let response = await helpers.req('PUT', '/community/uspolitics', correctInputs, user.token);
    expect(response.status).toBe(200);
    response = await helpers.req('GET', `/community/${correctInputs.urlName}`, null, null);
    expect(response.status).toBe(200);
  });
});
