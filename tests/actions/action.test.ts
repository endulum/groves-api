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
  await actionTests(adminToken, users, async (_response, type) => {
    const action = await client.action.findFirst({
      where: { type },
    });
    expect(action).not.toBeNull();
    expect(action?.actorId).toBe(1);
  });
});
