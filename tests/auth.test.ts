import * as helpers from './helpers';
import * as devQueries from '../prisma/queries/dev';
import * as userQueries from '../prisma/queries/user';

beforeAll(async () => {
  await devQueries.truncateTable('User');
  await devQueries.createAdmin();
});

describe('logging in', () => {
  const correctInputs = {
    username: 'admin',
    password: 'password',
  };

  test('POST /login - 400 and errors', async () => {
    const wrongInputsArray = [
      { username: '' },
      { password: '' },
      { password: 'some wrong password' },
    ];

    await Promise.all(
      wrongInputsArray.map(async (wrongInputs) => {
        const response = await helpers.req(
          'POST',
          '/login',
          { ...correctInputs, ...wrongInputs },
          null,
        );
        helpers.check(response, 400);
        expect(response.body).toHaveProperty('errors');
        expect(response.body.errors.length).toEqual(1);
      }),
    );
  });

  test('POST /login - 200 and token', async () => {
    const response = await helpers.req('POST', '/login', correctInputs, null);
    helpers.check(response, 200);
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

    await Promise.all(
      wrongInputsArray.map(async (wrongInputs) => {
        const response = await helpers.req(
          'POST',
          '/signup',
          { ...correctInputs, ...wrongInputs },
          null,
        );
        helpers.check(response, 400);
        expect(response.body).toHaveProperty('errors');
        expect(response.body.errors.length).toEqual(1);
      }),
    );
  });

  test('POST /signup - 200 and new user details returned', async () => {
    const response = await helpers.req('POST', '/signup', correctInputs, null);
    helpers.check(response, 200);
    const user = await userQueries.find({
      username: correctInputs.username,
    });
    expect(user).toBeDefined();
  });
});
