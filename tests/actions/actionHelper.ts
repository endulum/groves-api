import { ActionType } from '@prisma/client';
import { req, assertCode } from '../helpers';

/*
  helper particularly for performing all activity that is recorded as an Action.
*/
export function actionTests(
  adminToken: string,
  users: Array<{ username: string; id: number }>,
): Array<{ type: ActionType; func: () => Promise<void> }> {
  let commId: number = 0;
  let postId: string = '';
  let replyId: string = '';

  return [
    {
      type: 'Community_Create',
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
      type: 'Community_Edit',
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
      type: 'Community_EditWiki',
      func: async () => {
        const response = await req(
          `PUT /community/${commId}/wiki`,
          adminToken,
          {
            content: 'Wiki text.',
          },
        );
        assertCode(response, 200);
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
        assertCode(response, 200);
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
        assertCode(response, 200);
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
        assertCode(response, 200);
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
        assertCode(response, 200);
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
        assertCode(response, 200);
        postId = response.body.id;
      },
    },
    {
      type: 'Post_Edit',
      func: async () => {
        const response = await req(`PUT /post/${postId}`, adminToken, {
          title: 'Post',
          content: 'Post content, changed.',
        });
        assertCode(response, 200);
      },
    },
    {
      type: 'Post_Freeze',
      func: async () => {
        const response = await req(`PUT /post/${postId}/status`, adminToken, {
          readonly: 'true',
        });
        assertCode(response, 200);
      },
    },
    {
      type: 'Post_Unfreeze',
      func: async () => {
        const response = await req(`PUT /post/${postId}/status`, adminToken, {
          readonly: 'false',
        });
        assertCode(response, 200);
      },
    },
    {
      type: 'Reply_Create',
      func: async () => {
        const response = await req(`POST /post/${postId}/replies`, adminToken, {
          content: 'Reply content.',
        });
        assertCode(response, 200);
        replyId = response.body.id;
      },
    },
    {
      type: 'Reply_Hide',
      func: async () => {
        const response = await req(`PUT /reply/${replyId}/status`, adminToken, {
          hidden: 'true',
        });
        assertCode(response, 200);
      },
    },
    {
      type: 'Reply_Unhide',
      func: async () => {
        const response = await req(`PUT /reply/${replyId}/status`, adminToken, {
          hidden: 'false',
        });
        assertCode(response, 200);
      },
    },
  ];
}
