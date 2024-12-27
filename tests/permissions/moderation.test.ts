import { req, assertCode, token } from '../helpers';
import { seed } from '../../prisma/seed';
import { create as createUser } from '../../prisma/queries/user';
import { create as createComm } from '../../prisma/queries/community';
import { create as createPost } from '../../prisma/queries/post';
import { create as createReply } from '../../prisma/queries/reply';
import * as devQueries from '../../prisma/queries/dev';

let commId: number = 0;
let postId: string = '';
let replyId: string = '';
const tokens: Record<string, string> = {};

beforeAll(async () => {
  await seed({});
  const userId = await createUser({ username: 'demo-1' });
  commId = await createComm({
    urlName: 'comm',
    canonicalName: 'Community',
    description: 'This is an ordinary community.',
    adminId: 1,
  });
  await devQueries.distributeCommModerators(commId, [userId]);
  const userIds = await devQueries.createBulkUsers([
    { username: 'demo-2' },
    { username: 'demo-3' },
  ]);
  for (const username of ['demo-1', 'demo-2', 'demo-3']) {
    tokens[username] = await token(username);
  }
  postId = await createPost(commId, userIds[0].id, {
    title: 'Post',
    content: 'Post content.',
  });
  const reply = await createReply(
    userIds[1].id,
    postId,
    null,
    'Reply content.',
  );
  replyId = reply.id;
});

/*
  situation:
  - demo-1 is a moderator
  - demo-2 is the author of a post
  - demo-3 is the author of a reply to demo-2's post
*/

test('moderator-only action', async () => {
  await Promise.all(
    [
      `PUT /community/${commId}/wiki`,
      `PUT /post/${postId}/status`,
      `PUT /reply/${replyId}/status`,
    ].map(async (url) => {
      try {
        const response = await req(url, tokens['demo-3']);
        assertCode(
          response,
          403,
          'Only a community moderator can perform this action.',
        );
      } catch (e) {
        console.error(url);
        throw e;
      }
    }),
  );
});

test('admin-only action', async () => {
  await Promise.all(
    [`PUT /community/${commId}`, `PUT /community/${commId}/status`].map(
      async (url) => {
        try {
          const response = await req(url, tokens['demo-1']);
          assertCode(
            response,
            403,
            'Only the community admin can perform this action.',
          );
        } catch (e) {
          console.error(url);
          throw e;
        }
      },
    ),
  );
});
