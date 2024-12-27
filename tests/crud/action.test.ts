import { type ActionType } from '@prisma/client';
import { req, assertCode, token, logBody } from '../helpers';
import { seed } from '../../prisma/seed';
import { client } from '../../prisma/client';

let adminToken: string = '';
let commId: number = 0;
let postId: string = '';
let replyId: string = '';
const users: Array<{ username: string; id: number }> = [];

beforeAll(async () => {
  const { users: seedUsers } = await seed({
    userCount: 1,
  });
  adminToken = await token(1);
  users.push(...seedUsers);
});

const tests: Array<{ type: ActionType; func: () => Promise<void> }> = [
  {
    type: 'CreateCommunity',
    func: async () => {
      const response = await req('POST /communities', adminToken, {
        urlName: 'comm',
        canonicalName: 'Community',
        description: 'Test community.',
      });
      assertCode(response, 200);
      commId = response.body.id;
    },
  },
  {
    type: 'EditCommunity',
    func: async () => {
      const response = await req(`PUT /community/${commId}`, adminToken, {
        urlName: 'comm',
        canonicalName: 'Community',
        description: 'Test community, with the description changed.',
      });
      assertCode(response, 200);
    },
  },
  {
    type: 'EditWiki',
    func: async () => {
      const response = await req(`PUT /community/${commId}/wiki`, adminToken, {
        content: 'Wiki text.',
      });
      assertCode(response, 200);
    },
  },
  {
    type: 'PromoteMod',
    func: async () => {
      const response = await req(
        `PUT /community/${commId}/moderators`,
        adminToken,
        {
          username: users[0].username,
          type: 'promote',
        },
      );
      assertCode(response, 200);
    },
  },
  {
    type: 'DemoteMod',
    func: async () => {
      const response = await req(
        `PUT /community/${commId}/moderators`,
        adminToken,
        {
          username: users[0].username,
          type: 'demote',
        },
      );
      assertCode(response, 200);
    },
  },
  {
    type: 'FreezeCommunity',
    func: async () => {
      const response = await req(
        `PUT /community/${commId}/status`,
        adminToken,
        {
          readonly: 'true',
        },
      );
      assertCode(response, 200);
    },
  },
  {
    type: 'UnfreezeCommunity',
    func: async () => {
      const response = await req(
        `PUT /community/${commId}/status`,
        adminToken,
        {
          readonly: 'false',
        },
      );
      assertCode(response, 200);
    },
  },
  {
    type: 'CreatePost',
    func: async () => {
      const response = await req(
        `POST /community/${commId}/posts`,
        adminToken,
        {
          title: 'Post',
          content: 'Post content.',
        },
      );
      assertCode(response, 200);
      postId = response.body.id;
    },
  },
  {
    type: 'EditPost',
    func: async () => {
      const response = await req(`PUT /post/${postId}`, adminToken, {
        title: 'Post',
        content: 'Post content, changed.',
      });
      assertCode(response, 200);
    },
  },
  {
    type: 'FreezePost',
    func: async () => {
      const response = await req(`PUT /post/${postId}/status`, adminToken, {
        readonly: 'true',
      });
      assertCode(response, 200);
    },
  },
  {
    type: 'UnfreezePost',
    func: async () => {
      const response = await req(`PUT /post/${postId}/status`, adminToken, {
        readonly: 'false',
      });
      assertCode(response, 200);
    },
  },
  {
    type: 'CreateReply',
    func: async () => {
      const response = await req(`POST /post/${postId}/replies`, adminToken, {
        content: 'Reply content.',
      });
      assertCode(response, 200);
      replyId = response.body.id;
    },
  },
  {
    type: 'HideReply',
    func: async () => {
      const response = await req(`PUT /reply/${replyId}/status`, adminToken, {
        hidden: 'true',
      });
      assertCode(response, 200);
    },
  },
  {
    type: 'UnhideReply',
    func: async () => {
      const response = await req(`PUT /reply/${replyId}/status`, adminToken, {
        hidden: 'false',
      });
      assertCode(response, 200);
    },
  },
];

test('all possible action types', async () => {
  for (const test of tests) {
    // needs to be sequential
    await test.func();
    const action = await client.action.findFirst({
      where: { actionType: test.type },
    });
    expect(action).not.toBeNull();
    expect(action?.actorId).toBe(1);
  }
});

// todo: move this to lists
describe('GET /community/:community/actions', () => {
  test('200 and list of actions', async () => {
    const response = await req(`GET /community/${commId}/actions`);
    assertCode(response, 200);
    expect(response.body.actions.length).toEqual(tests.length);
    logBody(response);
  });
});
