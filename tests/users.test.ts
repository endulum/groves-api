import * as helpers from './helpers';
import * as devQueries from '../prisma/queries/dev';
import * as userQueries from '../prisma/queries/user';

beforeAll(async () => {
  await devQueries.truncateTable('User');
  await devQueries.createAdmin();
});

describe('get user', () => {
  test('GET /user/:user - 404 if user not found', async () => {
    const response = await helpers.req('GET', '/user/owo');
    helpers.check(response, 404, 'User could not be found.');
  });

  test('GET /user/:user - 200 and user details with id', async () => {
    const response = await helpers.req('GET', '/user/1');
    helpers.check(response, 200);
    expect(response.body).not.toHaveProperty('password');
  });

  test('GET /user/:user - 200 and user details with username', async () => {
    const response = await helpers.req('GET', '/user/admin');
    helpers.check(response, 200);
    expect(response.body).not.toHaveProperty('password');
    // console.dir(response.body, { depth: null });
  });
});

describe('get self', () => {
  test('GET /me - 401 if not logged in', async () => {
    const response = await helpers.req('GET', '/me');
    helpers.check(response, 401, 'Please log in.');
  });

  test('GET /me - 200 and user details', async () => {
    const token = await helpers.getToken('admin');
    const response = await helpers.req('GET', '/me', null, token);
    helpers.check(response, 200);
    expect(response.body.username).toBe('admin');
    expect(response.body).not.toHaveProperty('password');
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

  beforeAll(async () => {
    await userQueries.create({ username: 'basic' });
  });

  test('PUT /me - 401 without token', async () => {
    const response = await helpers.req('PUT', '/me');
    helpers.check(response, 401, 'Please log in.');
  });

  test('PUT /me - 400 and errors (with password)', async () => {
    const token = await helpers.getToken('admin');

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

    await Promise.all(
      wrongInputsArray.map(async (wrongInputs) => {
        const response = await helpers.req(
          'PUT',
          '/me',
          { ...correctInputs, ...wrongInputs },
          token,
        );
        helpers.check(response, 400);
        expect(response.body).toHaveProperty('errors');
      }),
    );
  });

  test('PUT /me - 200 and changes account details (without password)', async () => {
    const token = await helpers.getToken('admin');
    let response = await helpers.req(
      'PUT',
      '/me',
      { username: 'owo', bio: 'Snazzy bio here.' },
      token,
    );
    helpers.check(response, 200);

    // change it back
    response = await helpers.req(
      'PUT',
      '/me',
      { username: 'admin', bio: '' },
      token,
    );
    helpers.check(response, 200);
  });

  test('PUT /me - 200 and changes account details (with password)', async () => {
    const token = await helpers.getToken('admin');
    const response = await helpers.req('PUT', '/me', correctInputs, token);
    helpers.check(response, 200);
    await helpers.req(
      'PUT',
      '/me',
      {
        ...correctInputs,
        password: 'password',
        confirmPassword: 'password',
        currentPassword: correctInputs.password,
      },
      token,
    );
  });
});
