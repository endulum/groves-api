import * as helpers from './helpers';

beforeAll(async () => {
  await helpers.wipeTables(['user']);
  await helpers.createUsers();
});

afterAll(async () => {
  await helpers.wipeTables(['user']);
});

describe('logging in', () => {
  const correctInputs = {
    username: 'admin',
    password: process.env.ADMIN_PASS,
  };

  test('POST /login - 400 and errors', async () => {
    const wrongInputsArray = [
      { username: '' },
      { password: '' },
      { password: 'some wrong password' },
    ];

    await Promise.all(wrongInputsArray.map(async (wrongInputs) => {
      const response = await helpers.req('POST', '/login', { ...correctInputs, ...wrongInputs }, null);
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors.length).toEqual(1);
    }));
  });

  test('POST /login - 200 and token', async () => {
    const response = await helpers.req('POST', '/login', correctInputs, null);
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
  });
});

describe('signing up', () => {
  const correctInputs = {
    username: 'new-user',
    password: 'password',
    confirmPassword: 'password',
    deleteAfter: true,
  };

  test('POST /signup - 400 and errors', async () => {
    const wrongInputsArray = [
      { username: '' },
      { password: '' },
      { confirmPassword: '' },
      { username: 'admin' },
      { password: 'some mismatched password' },
      { confirmPassword: 'some mismatched password' },
    ];

    await Promise.all(wrongInputsArray.map(async (wrongInputs) => {
      const response = await helpers.req('POST', '/signup', { ...correctInputs, ...wrongInputs }, null);
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors.length).toEqual(1);
    }));
  });

  test('POST /signup - 200 and new user details returned', async () => {
    const response = await helpers.req('POST', '/signup', correctInputs, null);
    expect(response.status).toBe(200);
    const user = await helpers.getUser(correctInputs.username, correctInputs.password);
    expect(user).toBeDefined();
  });
});
