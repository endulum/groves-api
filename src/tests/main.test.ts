import * as helpers from './helpers';

beforeAll(async () => {
  await helpers.wipeTables(['user']);
  await helpers.createUsers();
});

afterAll(async () => {
  await helpers.wipeTables(['user']);
});

describe('deserialize user', () => {
  test('GET / - 401 without token', async () => {
    const response = await helpers.req('GET', '/', null, null);
    expect(response.status).toBe(401);
  });

  test('GET / - 200 with token', async () => {
    const { token } = await helpers.getUser('admin', process.env.ADMIN_PASS as string);
    const response = await helpers.req('GET', '/', null, token);
    expect(response.status).toBe(200);
  });
});

describe('get user', () => {
  test('GET /user/:userNameOrId - 404 if user not found', async () => {
    const response = await helpers.req('GET', '/user/owo', null, null);
    expect(response.status).toBe(404);
  });

  test('GET /user/:userNameOrId - 200 and user details with id', async () => {
    const response = await helpers.req('GET', '/user/1', null, null);
    expect(response.status).toBe(200);
    await Promise.all(['username', 'id', 'role'].map(async (property) => {
      expect(response.body).toHaveProperty(property);
    }));
  });

  test('GET /user/:userNameOrId - 200 and user details with username', async () => {
    const response = await helpers.req('GET', '/user/admin', null, null);
    expect(response.status).toBe(200);
    await Promise.all(['username', 'id', 'bio', 'role'].map(async (property) => {
      expect(response.body).toHaveProperty(property);
    }));
  });
});

describe('change account details', () => {
  const correctInputs = {
    username: 'admin',
    bio: 'Snazzy bio here.',
    password: 'new-password',
    confirmPassword: 'new-password',
    currentPassword: process.env.ADMIN_PASS,
  };

  test('POST /account - 401 without token', async () => {
    const response = await helpers.req('POST', '/account', null, null);
    expect(response.status).toBe(401);
  });

  test('POST /account - 400 and errors (with password)', async () => {
    const { token } = await helpers.getUser('admin', process.env.ADMIN_PASS as string);

    const wrongInputsArray = [
      { username: '' },
      { confirmPassword: '' },
      { currentPassword: '' },
      { username: 'basic' },
      { username: 'a' },
      { username: '&&&&' },
      { bio: Array(1000).fill('A').join('') },
      { password: '.' },
      { password: 'some mismatched password' },
      { confirmPassword: 'some mismatched password' },
      { currentPassword: 'some mismatched password' },
    ];

    await Promise.all(wrongInputsArray.map(async (wrongInputs) => {
      const response = await helpers.req('POST', '/account', { ...correctInputs, ...wrongInputs }, token);
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
    }));
  });

  test('POST /account - 200 and changes account details (with password)', async () => {
    const { token } = await helpers.getUser('admin', process.env.ADMIN_PASS as string);
    const response = await helpers.req('POST', '/account', correctInputs, token);
    expect(response.status).toBe(200);
    await helpers.req('POST', '/account', {
      ...correctInputs,
      password: process.env.ADMIN_PASS,
      confirmPassword: process.env.ADMIN_PASS,
      currentPassword: correctInputs.password,
    }, token);
  });

  test('POST /account - 200 and changes account details (without password)', async () => {
    const { token } = await helpers.getUser('admin', process.env.ADMIN_PASS as string);
    const response = await helpers.req('POST', '/account', { username: 'owo', bio: 'Snazzy bio here.' }, token);
    expect(response.status).toBe(200);
    await helpers.req('POST', '/account', { username: 'admin', bio: '' }, token);
  });
});
