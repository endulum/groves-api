import { req, assertCode, token } from '../helpers';
import { seed } from '../../prisma/seed';
import { toggleReadonly as toggleCommReadonly } from '../../prisma/queries/community';
import { toggleReadonly as togglePostReadonly } from '../../prisma/queries/post';
import { toggleHidden } from '../../prisma/queries/reply';

let adminToken: string = '';
let commId: number = 0;
let postId: string = '';
let replyId: string = '';

beforeAll(async () => {
  const { commIds, postIds, replyIds } = await seed({
    userCount: 1,
    comms: { count: 1 },
    posts: { perComm: { min: 1, max: 1 } },
    replies: { perPost: { min: 1, max: 1 } },
  });
  commId = commIds[0];
  postId = postIds[0];
  replyId = replyIds[0];
  adminToken = await token(1);
});

describe('readonly community', () => {
  beforeAll(async () => await toggleCommReadonly(commId, 'true'));
  afterAll(async () => await toggleCommReadonly(commId, 'false'));

  test('does not show up in community search', async () => {
    const response = await req('GET /communities');
    expect(response.body.communities.length).toBe(0);
  });

  test('no interaction', async () => {
    await Promise.all(
      [
        `PUT /community/${commId}`,
        `PUT /community/${commId}/wiki`,
        `PUT /community/${commId}/moderators`,
        `PUT /community/${commId}/followers`,
        `POST /community/${commId}/posts`,
        `PUT /post/${postId}`,
        `PUT /post/${postId}/vote`,
        `PUT /post/${postId}/status`,
        `POST /post/${postId}/replies`,
        `PUT /reply/${replyId}/vote`,
        `PUT /reply/${replyId}/status`,
      ].map(async (url) => {
        try {
          const response = await req(url, adminToken);
          assertCode(response, 403, 'This community is read-only.');
        } catch (e) {
          console.error(url);
          throw e;
        }
      }),
    );
  });
});

describe('readonly post', async () => {
  beforeAll(async () => await togglePostReadonly(postId, 'true'));
  afterAll(async () => await togglePostReadonly(postId, 'false'));

  test('does not show up in community post search', async () => {
    const response = await req(`GET /community/${commId}/posts`);
    expect(response.body.posts.length).toBe(0);
  });

  test('no interaction when post is readonly', async () => {
    await Promise.all(
      [
        `PUT /post/${postId}`,
        `PUT /post/${postId}/vote`,
        `POST /post/${postId}/replies`,
        `PUT /reply/${replyId}/vote`,
        `PUT /reply/${replyId}/status`,
      ].map(async (url) => {
        try {
          const response = await req(url, adminToken);
          assertCode(response, 403, 'This post is read-only.');
        } catch (e) {
          console.error(url);
          throw e;
        }
      }),
    );
  });
});

describe('hidden reply', () => {
  beforeAll(async () => await toggleHidden(replyId, 'true'));
  afterAll(async () => await toggleHidden(replyId, 'false'));

  test('content nullified in list view', async () => {
    const response = await req(`GET /post/${postId}/replies`);
    assertCode(response, 200);
    const reply = response.body.children[0];
    expect(reply.author).toBeNull();
    expect(reply.content).toBeNull();
    expect(reply.voted).toBeNull();
  });

  test('no interaction when reply is hidden', async () => {
    const response = await req(`PUT /reply/${replyId}/vote`, adminToken);
    assertCode(response, 404, 'Reply could not be found.');
  });
});
