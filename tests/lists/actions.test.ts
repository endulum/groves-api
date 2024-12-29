import { assertCode, logBody, req, token } from '../helpers';
import { seed } from '../../prisma/seed';
import { actionTests } from '../actions/actionHelper';
import { assertPagination } from './_listHelpers';

let adminToken: string = '';
let community: number = 0;
// let post: string = '';
// let reply: string = '';
const users: Array<{ username: string; id: number }> = [];

beforeAll(async () => {
  const { users: seedUsers } = await seed({
    userCount: 1,
  });
  adminToken = await token(1);
  users.push(...seedUsers);

  const { commId } = await actionTests(adminToken, users);
  community = commId;
  // post = postId;
  // reply = replyId;
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

  test('query param: type (full)', async () => {
    const response = await req(
      `GET /community/${community}/actions?type=Post_Unfreeze`,
    );
    assertCode(response, 200);
    expect(
      response.body.actions.every(
        (action: { type: string }) => action.type === 'Post_Unfreeze',
      ),
    );
  });

  test('query param: type (partial)', async () => {
    // valid - should get results
    await Promise.all(
      ['User', 'Post', 'Reply'].map(async (type) => {
        const response = await req(
          `GET /community/${community}/actions?type=${type}`,
        );
        assertCode(response, 200);
        // logBody(response);
        expect(response.body.actions.length).toBeGreaterThanOrEqual(1);
        expect(
          response.body.actions.every((action: { type: string }) =>
            action.type.includes(type),
          ),
        );
      }),
    );

    // invalid - don't make an error, just ignore
    const response = await req(`GET /community/${community}/actions?type=$owo`);
    assertCode(response, 200);
  });

  test('pagination', async () => {
    // re-seed so we get lots of actions
    const { commIds } = await seed({
      userCount: 10,
      comms: { count: 1 },
      posts: { perComm: { max: 10, min: 10 } },
      replies: { perPost: { max: 10, min: 10 } },
    }); // 111 total actions should be recorded
    community = commIds[0];

    // without param
    await assertPagination({
      url: `/community/${community}/actions`,
      resultsProperty: 'actions',
      resultsTotal: 111,
      resultsPerPage: 30,
    });

    // with param
    await assertPagination({
      url: `/community/${community}/actions?type=Reply_Create`,
      resultsProperty: 'actions',
      resultsTotal: 100,
      resultsPerPage: 30,
      perPageAssertion: (response) => {
        expect(
          response.body.actions.every(
            (action: { type: string }) => action.type === 'Reply_Create',
          ),
        );
      },
    });
  });
});
