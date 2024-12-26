import { req, assertCode, assertInputErrors, token, logBody } from '../helpers';
import { seed } from '../../prisma/seed';
import { create } from '../../prisma/queries/user';
import { vote } from '../../prisma/queries/reply';

let adminToken: string = '';
let postId: string = '';
const userIds: number[] = [];

let replyId: string = '';
let childReplyId: string = '';

const wrongInputs = [
  { content: '' },
  { content: Array(10001).fill('A').join('') },
  { parent: 'owo' },
];

beforeAll(async () => {
  const { postIds } = await seed({
    userCount: 1,
    comms: { count: 1 },
    posts: { perComm: { min: 1, max: 1 } },
  });
  adminToken = await token(1);
  postId = postIds[0];
});

describe('POST /post/:post/replies', () => {
  test('400 and errors', async () => {
    await assertInputErrors({
      reqArgs: [`POST /post/${postId}/replies`, adminToken],
      correctInputs: { content: 'This is a reply.' },
      wrongInputs,
    });
  });

  test('200 and creates reply', async () => {
    const response = await req(`POST /post/${postId}/replies`, adminToken, {
      content: 'This is a reply.',
    });
    assertCode(response, 200);
    expect(response.body.id).not.toBeUndefined();
    replyId = response.body.id;
  });

  test('200 and creates reply with parent', async () => {
    const response = await req(`POST /post/${postId}/replies`, adminToken, {
      content: 'This is a reply.',
      parent: replyId,
    });
    assertCode(response, 200);
    expect(response.body.id).not.toBeUndefined();
    childReplyId = response.body.id;
  });
});

describe('GET /reply/:reply', async () => {
  test('404 if not found', async () => {
    const response = await req('GET /reply/owo');
    assertCode(response, 404, 'Reply could not be found.');
  });

  test('200 and views reply, parentless and with child', async () => {
    const response = await req(`GET /reply/${replyId}`);
    assertCode(response, 200);
    // KEEP
    logBody(response);
    expect(response.body.parentId).toBeNull();
    expect(response.body._count.children).toBe(1);
  });

  test('200 and views reply, with parent id', async () => {
    const response = await req(`GET /reply/${childReplyId}`);
    assertCode(response, 200);
    expect(response.body.parentId).not.toBeNull();
  });
});

describe('PUT reply/:reply/vote', () => {
  beforeAll(async () => {
    // create three demo users *in order* using a for loop
    for (const username of ['demo-1', 'demo-2']) {
      userIds.push(await create({ username }));
    }
    await vote(replyId, userIds[0], 'upvote', 'add');
  });

  test('403 if own reply', async () => {
    const response = await req(`PUT /reply/${replyId}/vote`, adminToken);
    assertCode(response, 403, 'You cannot vote on your own content.');
  });

  test('400 if doubling', async () => {
    const text = 'You cannot double-vote or remove a nonexistent vote.';
    let response = await req(
      `PUT /reply/${replyId}/vote`,
      await token(userIds[1]),
      { type: 'downvote', action: 'remove' },
    );
    assertCode(response, 403, text);
    response = await req(
      `PUT /reply/${replyId}/vote`,
      await token(userIds[0]),
      { type: 'downvote', action: 'add' },
    );
    assertCode(response, 403, text);
  });

  test('200 and adds vote', async () => {
    let response = await req(
      `PUT /reply/${replyId}/vote`,
      await token(userIds[1]),
      { type: 'upvote', action: 'add' },
    );
    assertCode(response, 200);
    response = await req(`GET /reply/${replyId}`, await token(userIds[1]));
    expect(response.body._count.upvotes).toBe(2);
    expect(response.body.context.isVoted).toEqual({
      upvoted: true,
      downvoted: false,
    });
  });

  test('200 and removes vote', async () => {
    let response = await req(
      `PUT /reply/${replyId}/vote`,
      await token(userIds[1]),
      { type: 'upvote', action: 'remove' },
    );
    assertCode(response, 200);
    response = await req(`GET /reply/${replyId}`, await token(userIds[1]));
    expect(response.body._count.upvotes).toBe(1);
    expect(response.body.context.isVoted).toEqual({
      upvoted: false,
      downvoted: false,
    });
  });
});

describe('PUT /reply/:reply/status', () => {
  test('400 if double unhide', async () => {
    const response = await req(`PUT /reply/${replyId}/status`, adminToken, {
      hidden: 'false',
    });
    assertCode(response, 400, 'This reply is not hidden.');
  });

  test('200 and hides', async () => {
    let response = await req(`PUT /reply/${replyId}/status`, adminToken, {
      hidden: 'true',
    });
    assertCode(response, 200);
    response = await req(`GET /reply/${replyId}`);
    assertCode(response, 200);
    // logBody(response);
    expect(response.body.author).toBeNull();
    expect(response.body.content).toBeNull();
    expect(response.body._count.upvotes).toBeNull();
    expect(response.body._count.downvotes).toBeNull();
  });

  test('400 if double hide', async () => {
    const response = await req(`PUT /reply/${replyId}/status`, adminToken, {
      hidden: 'true',
    });
    assertCode(response, 400, 'This reply is already hidden.');
  });

  test('200 and unhides', async () => {
    let response = await req(`PUT /reply/${replyId}/status`, adminToken, {
      hidden: 'false',
    });
    assertCode(response, 200);
    response = await req(`GET /reply/${replyId}`);
    expect(response.body.author).not.toBeNull();
    expect(response.body.content).not.toBeNull();
  });
});
