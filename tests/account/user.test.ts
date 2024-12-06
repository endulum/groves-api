import { req, assertCode, assertInputErrors, token } from '../helpers';
import { seed } from '../../prisma/seed';
import { create } from '../../prisma/queries/user';

let adminToken: string = '';

beforeAll(async () => {
  await seed({});
  adminToken = await token(1);
  await create({ username: 'basic' });
});

describe('GET /me', () => {
  test('401 if not logged in', async () => {
    const response = await req('GET /me');
    assertCode(response, 401, 'Please log in.');
  });

  test('200 and views own user details', async () => {
    const response = await req('GET /me', adminToken);
    assertCode(response, 200);
    expect(response.body.username).toBe('admin');
    expect(response.body).not.toHaveProperty('password');
    // logBody(response);
  });
});

describe('PUT /me', () => {
  const correctInputs = {
    username: 'admin',
    bio: 'Snazzy bio here.',
    password: 'new-password',
    confirmPassword: 'new-password',
    currentPassword: 'password',
  };

  test('400 and errors', async () => {
    await assertInputErrors({
      reqArgs: ['PUT /me', adminToken],
      correctInputs,
      wrongInputs: [
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
      ],
    });
  });

  test('200 and edits own user details (without password)', async () => {
    const response = await req('PUT /me', adminToken, {
      username: correctInputs.username,
      bio: correctInputs.bio,
    });
    assertCode(response, 200);
  });

  test('200 and edits own user details (with password', async () => {
    let response = await req('PUT /me', adminToken, correctInputs);
    assertCode(response, 200);
    // assert that login won't fail
    response = await req('POST /login', null, {
      username: correctInputs.username,
      password: correctInputs.password,
    });
    assertCode(response, 200);
  });
});

describe('GET /user/:user', async () => {
  test('404 if user not found', async () => {
    const response = await req('GET /user/owo');
    assertCode(response, 404, 'User could not be found.');
  });

  test('200 and user details (using id)', async () => {
    const response = await req('GET /user/1');
    assertCode(response, 200);
    expect(response.body).not.toHaveProperty('password');
  });

  test('200 and user details (using username)', async () => {
    const response = await req('GET /user/admin');
    assertCode(response, 200);
    expect(response.body).not.toHaveProperty('password');
  });
});
