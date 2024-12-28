import { type Response } from 'supertest';
import { ActionType } from '@prisma/client';
import { req } from '../helpers';

/*
  helper particularly for performing all activity that is recorded as an Action.
*/
export async function actionTests(
  adminToken: string,
  users: Array<{ username: string; id: number }>,
  testCallback?: (response: Response, type: ActionType) => Promise<void>,
): Promise<{
  commId: number;
  postId: string;
  replyId: string;
}> {
  let commId: number = 0;
  let postId: string = '';
  let replyId: string = '';

  const tests: Array<{ type: ActionType; func: () => Promise<Response> }> = [
    {
      type: 'Community_Create',
      func: async () => {
        const response = await req('POST /communities', adminToken, {
          urlName: 'comm',
          canonicalName: 'Community',
          description: 'Test community.',
        });
        // assertCode(response, 200);
        commId = response.body.id;
        return response;
      },
    },
    {
      type: 'Community_Edit',
      func: async () => {
        const response = await req(`PUT /community/${commId}`, adminToken, {
          urlName: 'comm',
          canonicalName: 'Community',
          description: 'Test community, with the description changed.',
        });
        // assertCode(response, 200);
        return response;
      },
    },
    {
      type: 'Community_EditWiki',
      func: async () => {
        const response = await req(
          `PUT /community/${commId}/wiki`,
          adminToken,
          {
            content: 'Wiki text.',
          },
        );
        // assertCode(response, 200);
        return response;
      },
    },
    {
      type: 'User_PromoteMod',
      func: async () => {
        const response = await req(
          `PUT /community/${commId}/moderators`,
          adminToken,
          {
            username: users[0].username,
            type: 'promote',
          },
        );
        // assertCode(response, 200);
        return response;
      },
    },
    {
      type: 'User_DemoteMod',
      func: async () => {
        const response = await req(
          `PUT /community/${commId}/moderators`,
          adminToken,
          {
            username: users[0].username,
            type: 'demote',
          },
        );
        // assertCode(response, 200);
        return response;
      },
    },
    {
      type: 'Community_Freeze',
      func: async () => {
        const response = await req(
          `PUT /community/${commId}/status`,
          adminToken,
          {
            readonly: 'true',
          },
        );
        // assertCode(response, 200);
        return response;
      },
    },
    {
      type: 'Community_Unfreeze',
      func: async () => {
        const response = await req(
          `PUT /community/${commId}/status`,
          adminToken,
          {
            readonly: 'false',
          },
        );
        // assertCode(response, 200);
        return response;
      },
    },
    {
      type: 'Post_Create',
      func: async () => {
        const response = await req(
          `POST /community/${commId}/posts`,
          adminToken,
          {
            title: 'Post',
            content: 'Post content.',
          },
        );
        // assertCode(response, 200);
        postId = response.body.id;
        return response;
      },
    },
    {
      type: 'Post_Edit',
      func: async () => {
        const response = await req(`PUT /post/${postId}`, adminToken, {
          title: 'Post',
          content: 'Post content, changed.',
        });
        // assertCode(response, 200);
        return response;
      },
    },
    {
      type: 'Post_Freeze',
      func: async () => {
        const response = await req(`PUT /post/${postId}/status`, adminToken, {
          readonly: 'true',
        });
        // assertCode(response, 200);
        return response;
      },
    },
    {
      type: 'Post_Unfreeze',
      func: async () => {
        const response = await req(`PUT /post/${postId}/status`, adminToken, {
          readonly: 'false',
        });
        // assertCode(response, 200);
        return response;
      },
    },
    {
      type: 'Reply_Create',
      func: async () => {
        const response = await req(`POST /post/${postId}/replies`, adminToken, {
          content: 'Reply content.',
        });
        // assertCode(response, 200);
        replyId = response.body.id;
        return response;
      },
    },
    {
      type: 'Reply_Hide',
      func: async () => {
        const response = await req(`PUT /reply/${replyId}/status`, adminToken, {
          hidden: 'true',
        });
        // assertCode(response, 200);
        return response;
      },
    },
    {
      type: 'Reply_Unhide',
      func: async () => {
        const response = await req(`PUT /reply/${replyId}/status`, adminToken, {
          hidden: 'false',
        });
        // assertCode(response, 200);
        return response;
      },
    },
  ];

  for (const test of tests) {
    const response = await test.func();
    if (testCallback) await testCallback(response, test.type);
  }

  return { commId, postId, replyId };
}
