import { assertCode, logBody, req, token } from '../helpers';
import { seed } from '../../prisma/seed';
import { actionTests } from '../actions/actionHelper';

let adminToken: string = '';
let community: number = 0;
let post: string = '';
let reply: string = '';
const users: Array<{ username: string; id: number }> = [];

beforeAll(async () => {
  const { users: seedUsers } = await seed({
    userCount: 1,
  });
  adminToken = await token(1);
  users.push(...seedUsers);

  const { commId, postId, replyId } = await actionTests(adminToken, users);
  community = commId;
  post = postId;
  reply = replyId;
});

describe('GET /community/:community/actions', async () => {
  test('shows a list of actions', async () => {
    const response = await req(`GET /community/${community}/actions`);
    assertCode(response, 200);
    // logBody(response);

    // actions are sorted by date
    expect(
      response.body.actions.sort(
        (a: { date: string }, b: { date: string }) =>
          Date.parse(b.date) - Date.parse(a.date),
      ),
    ).toEqual(response.body.actions);

    // action types have proper objects attached
    await Promise.all(
      response.body.actions.map(
        async (action: {
          type: string;
          user: null | object;
          post: null | object;
          reply: null | object;
        }) => {
          if (action.type.startsWith('User')) {
            expect(action.user).not.toBeNull();
          }
          if (action.type.startsWith('Post')) {
            expect(action.post).not.toBeNull();
          }
          if (action.type.startsWith('Reply')) {
            expect(action.reply).not.toBeNull();
          }
        },
      ),
    );
  });
});
