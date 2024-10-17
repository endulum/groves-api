import * as helpers from '../test_helpers/helpers';

beforeAll(async () => {
  await helpers.wipeTables(['user']);
  await helpers.createUsers(['basic']);
});

afterAll(async () => {
  await helpers.wipeTables(['user']);
});

describe('get user', () => {
  test('GET /user/:userNameOrId - 404 if user not found', async () => {
    const response = await helpers.req('GET', '/user/owo', null, null);
    expect(response.status).toBe(404);
  });

  test('GET /user/:userNameOrId - 200 and user details with id', async () => {
    const response = await helpers.req('GET', '/user/1', null, null);
    expect(response.status).toBe(200);
  });

  test('GET /user/:userNameOrId - 200 and user details with username', async () => {
    const response = await helpers.req('GET', '/user/admin', null, null);
    expect(response.status).toBe(200);
  });
});

describe('get self', () => {
  test('GET /me - 401 if not logged in', async () => {
    const response = await helpers.req('GET', '/me', null, null);
    expect(response.status).toBe(401);
  });

  test('GET /me - 200 and user details', async () => {
    const { token } = await helpers.getUser('admin', 'password');
    const response = await helpers.req('GET', '/me', null, token);
    expect(response.status).toBe(200);
    expect(response.body.username).toBe('admin');
  });
});

describe('change account details of self', () => {
  const correctInputs = {
    username: 'admin',
    bio: 'Snazzy bio here.',
    password: 'new-password',
    confirmPassword: 'new-password',
    currentPassword: 'password',
  };

  test('PUT /me - 401 without token', async () => {
    const response = await helpers.req('PUT', '/me', null, null);
    expect(response.status).toBe(401);
  });

  test('PUT /me - 400 and errors (with password)', async () => {
    const { token } = await helpers.getUser('admin', 'password');

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
      const response = await helpers.req('PUT', '/me', { ...correctInputs, ...wrongInputs }, token);
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
    }));
  });

  test('PUT /me - 200 and changes account details (with password)', async () => {
    const { token } = await helpers.getUser('admin', 'password');
    const response = await helpers.req('PUT', '/me', correctInputs, token);
    expect(response.status).toBe(200);
    await helpers.req('PUT', '/me', {
      ...correctInputs,
      password: 'password',
      confirmPassword: 'password',
      currentPassword: correctInputs.password,
    }, token);
  });

  test('PUT /me - 200 and changes account details (without password)', async () => {
    const { token } = await helpers.getUser('admin', 'password');
    const response = await helpers.req('PUT', '/me', { username: 'owo', bio: 'Snazzy bio here.' }, token);
    expect(response.status).toBe(200);
    await helpers.req('POST', '/account', { username: 'admin', bio: '' }, token);
  });
});
