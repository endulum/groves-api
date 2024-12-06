import { req, assertCode, assertInputErrors, token } from '../helpers';
import { seed } from '../../prisma/seed';
import { create } from '../../prisma/queries/user';
import { vote } from '../../prisma/queries/post';

let adminToken: string = '';
let commId: number = 0;
let postId: string = '';
const userIds: number[] = [];

const correctInputs = {
  title: 'Another Post',
  content: 'This is another post. Lorem ipsum dolor sit amet.',
};

const wrongInputs = [
  { title: '' },
  { title: Array(1000).fill('A').join('') },
  { content: '' },
  { content: Array(100000).fill('A').join('') },
];

beforeAll(async () => {
  const { commIds } = await seed({
    comms: { count: 1 },
  });
  adminToken = await token(1);
  commId = commIds[0];
});

describe('POST /community/:community/posts', () => {
  test('400 and errors', async () => {
    await assertInputErrors({
      reqArgs: [`POST /community/${commId}/posts`, adminToken],
      wrongInputs,
      correctInputs,
    });
  });

  test('200 and creates post', async () => {
    const response = await req(
      `POST /community/${commId}/posts`,
      adminToken,
      correctInputs,
    );
    assertCode(response, 200);
    expect(response.body.id).not.toBeUndefined();
    postId = response.body.id;
  });
});

describe('GET /post/:post', () => {
  test('404 if not found', async () => {
    const response = await req('GET /post/owo');
    assertCode(response, 404, 'Post could not be found.');
  });

  test('200 and views a post', async () => {
    const response = await req(`GET /post/${postId}`);
    assertCode(response, 200);
    // logBody(response);
  });
});

describe('PUT /post/:post/votes', () => {
  beforeAll(async () => {
    // create three demo users *in order* using a for loop
    for (const username of ['demo-1', 'demo-2']) {
      userIds.push(await create({ username }));
    }
    await vote(postId, userIds[0], 'upvote', 'add');
  });

  test('403 if own post', async () => {
    const response = await req(`PUT /post/${postId}/vote`, adminToken);
    assertCode(response, 403, 'You cannot vote on your own content.');
  });

  test('400 if doubling', async () => {
    const text = 'You cannot double-vote or remove a nonexistent vote.';
    let response = await req(
      `PUT /post/${postId}/vote`,
      await token(userIds[1]),
      { type: 'upvote', action: 'remove' },
    );
    assertCode(response, 403, text);
    response = await req(`PUT /post/${postId}/vote`, await token(userIds[0]), {
      type: 'upvote',
      action: 'add',
    });
    assertCode(response, 403, text);
  });

  test('200 and adds vote', async () => {
    let response = await req(
      `PUT /post/${postId}/vote`,
      await token(userIds[1]),
      { type: 'upvote', action: 'add' },
    );
    assertCode(response, 200);
    response = await req(`GET /post/${postId}`);
    expect(response.body._count.upvotes).toBe(2);
  });

  test('200 and removes vote', async () => {
    let response = await req(
      `PUT /post/${postId}/vote`,
      await token(userIds[1]),
      { type: 'upvote', action: 'remove' },
    );
    assertCode(response, 200);
    response = await req(`GET /post/${postId}`);
    expect(response.body._count.upvotes).toBe(1);
  });
});

describe('PUT /post/:post/status', () => {
  test('400 if double freeze', async () => {
    const response = await req(`PUT /post/${postId}/status`, adminToken, {
      readonly: 'false',
    });
    assertCode(response, 400, 'This post is not readonly.');
  });

  test('200 and freezes', async () => {
    let response = await req(`PUT /post/${postId}/status`, adminToken, {
      readonly: 'true',
    });
    assertCode(response, 200);
    response = await req(`GET /post/${postId}`);
    expect(response.body.readonly).toBe(true);
  });

  test('400 if double unfreeze', async () => {
    const response = await req(`PUT /post/${postId}/status`, adminToken, {
      readonly: 'true',
    });
    assertCode(response, 400, 'This post is already readonly.');
  });

  test('200 and unfreezes', async () => {
    let response = await req(`PUT /post/${postId}/status`, adminToken, {
      readonly: 'false',
    });
    assertCode(response, 200);
    response = await req(`GET /post/${postId}`);
    expect(response.body.readonly).toBe(false);
  });
});
