import { token } from '../helpers';
import { actionTests } from './actionHelper';
import { seed } from '../../prisma/seed';
import { client } from '../../prisma/client';

let adminToken: string = '';
const users: Array<{ username: string; id: number }> = [];

beforeAll(async () => {
  const { users: seedUsers } = await seed({
    userCount: 1,
  });
  adminToken = await token(1);
  users.push(...seedUsers);
});

test('all possible action types', async () => {
  const tests = actionTests(adminToken, users);
  for (const test of tests) {
    // needs to be sequential
    await test.func();
    const action = await client.action.findFirst({
      where: { type: test.type },
    });
    expect(action).not.toBeNull();
    expect(action?.actorId).toBe(1);
  }
});
