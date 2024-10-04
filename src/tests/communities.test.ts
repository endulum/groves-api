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

  test.skip('GET /community/:communityNameOrId - 200 if hidden and viewer is site admin', async () => {
    const siteAdmin = await helpers.getUser('admin', process.env.ADMIN_PASS as string);
    const response = await helpers.req('GET', '/community/hidden', null, siteAdmin.token);
    expect(response.status).toEqual(200);
  });
});
