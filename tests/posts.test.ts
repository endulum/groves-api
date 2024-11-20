import * as helpers from './helpers';
import * as queries from '../prisma/queries';

let commId: number = 0;

beforeAll(async () => {
  await queries.truncateTable('User');
  await queries.createAdmin();
  commId = await queries.createCommunity({
    urlName: 'comm',
    canonicalName: 'Community',
    description: 'This is an ordinary community.',
    adminId: 1,
  });
});

describe('see a post', async () => {
  let postId: string = '';
  beforeAll(async () => {
    postId = await queries.createPost(1, 1, {
      title: 'Title of Post',
      content: 'This is a post. Lorem ipsum dolor sit amet.',
    });
  });

  test('GET /post/:postId - 404 if post does not exist', async () => {
    const response = await helpers.req('GET', `/post/owo`);
    expect(response.status).toBe(404);
  });

  test('GET /post/:postId - 200 and shows post data', async () => {
    const response = await helpers.req('GET', `/post/${postId}`);
    expect(response.status).toBe(200);
    // console.dir(response.body, { depth: null });
  });
});

describe('make and edit a post', () => {
  let postId: string = '';

  const correctInputs = {
    title: 'Another Post',
    content: 'This is another post. Lorem ipsum dolor sit amet.',
  };

  const wrongInputsArray = [
    { title: '' },
    { title: Array(1000).fill('A').join('') },
    { content: '' },
    { content: Array(100000).fill('A').join('') },
  ];

  beforeAll(async () => {
    await queries.createUser('basic');
  });

  test('POST /community/:communityId/posts - 400 and errors', async () => {
    await Promise.all(
      wrongInputsArray.map(async (wrongInputs) => {
        const response = await helpers.req(
          'POST',
          '/community/comm/posts',
          { ...correctInputs, ...wrongInputs },
          await helpers.getToken('admin'),
        );
        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('errors');
        expect(response.body.errors.length).toBe(1);
      }),
    );
  });

  test('POST /community/:communityId/posts - 200 and creates post', async () => {
    const response = await helpers.req(
      'POST',
      '/community/comm/posts',
      correctInputs,
      await helpers.getToken('admin'),
    );
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('postId');
    const post = await queries.findPost(response.body.postId);
    expect(post).not.toBeNull();
    postId = response.body.postId;
  });

  test('PUT /post/:postId - 404 if not found', async () => {
    const response = await helpers.req(
      'PUT',
      '/post/owo',
      null,
      await helpers.getToken('admin'),
    );
    expect(response.status).toBe(404);
  });

  test('PUT /post/:postId - 403 if post not yours', async () => {
    const response = await helpers.req(
      'PUT',
      `/post/${postId}`,
      null,
      await helpers.getToken('basic'),
    );
    expect(response.status).toBe(403);
  });

  test('PUT /post/:postId - 400 and errors', async () => {
    await Promise.all(
      wrongInputsArray.map(async (wrongInputs) => {
        const response = await helpers.req(
          'PUT',
          `/post/${postId}`,
          { ...correctInputs, ...wrongInputs },
          await helpers.getToken('admin'),
        );
        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('errors');
        expect(response.body.errors.length).toBe(1);
      }),
    );
  });

  test('PUT /post/:postId - 200 and edits post, with edit date recorded', async () => {
    const response = await helpers.req(
      'PUT',
      `/post/${postId}`,
      { ...correctInputs, title: 'Another Post, but Different Title' },
      await helpers.getToken('admin'),
    );
    expect(response.status).toBe(200);
    const post = await queries.findPost(postId);
    expect(post?.title).toEqual('Another Post, but Different Title');
    expect(post?.lastEdited).not.toBeNull();
  });
});

describe('hide and unhide, freeze and unfreeze a post', () => {
  let postId: string = '';
  let users: number[] = [];

  beforeAll(async () => {
    await queries.truncateTable('Post');
    users = await queries.createBulkUsers([
      { username: 'demo-1' },
      { username: 'demo-2' },
      { username: 'demo-3' },
    ]);
    await queries.distributeCommModerators(commId, [users[0]]);
    // users[0] is mod
    // users[1] is post author
    // users[2] is neither mod nor post author
    postId = await queries.createPost(commId, users[1], {
      title: 'Title of Post',
      content: 'This is a post. Lorem ipsum dolor sit amet.',
    });
  });

  test('POST /post/:postId/freeze - 403 if neither author nor mod', async () => {
    const response = await helpers.req(
      'POST',
      `/post/${postId}/freeze`,
      { freeze: true },
      await helpers.getToken(users[2]),
    );
    expect(response.status).toBe(403);
  });

  test('POST /post/:postId/freeze - 200 and freezes post (yourself)', async () => {
    let response = await helpers.req(
      'POST',
      `/post/${postId}/freeze`,
      { freeze: true },
      await helpers.getToken(users[1]),
    );
    expect(response.status).toBe(200);
    const post = await queries.findPost(postId);
    expect(post?.status).toBe('FROZEN');

    // cannot do things to post when frozen
    response = await helpers.req(
      'PUT',
      `/post/${postId}`,
      {
        title: 'This Post is Frozen',
        content: "I sure hope this post won't be edited.",
      },
      await helpers.getToken(users[1]),
    );
    expect(response.status).toBe(403);
  });

  test('POST /post/:postId/freeze - 200 and freezes post (mod)', async () => {
    const response = await helpers.req(
      'POST',
      `/post/${postId}/freeze`,
      { freeze: true },
      await helpers.getToken(users[0]),
    );
    expect(response.status).toBe(200);
    const post = await queries.findPost(postId);
    expect(post?.status).toBe('FROZEN');
  });

  test('POST /post/:postId/freeze - 200 and unfreezes post', async () => {
    const response = await helpers.req(
      'POST',
      `/post/${postId}/freeze`,
      { freeze: false },
      await helpers.getToken(users[1]),
    );
    expect(response.status).toBe(200);
    const post = await queries.findPost(postId);
    expect(post?.status).toBe('ACTIVE');
  });

  test('POST /post/:postId/hide - 403 if neither author nor mod', async () => {
    const response = await helpers.req(
      'POST',
      `/post/${postId}/hide`,
      { freeze: true },
      await helpers.getToken(users[2]),
    );
    expect(response.status).toBe(403);
  });

  test('POST /post/:postId/hide - 200 and hides post (yourself)', async () => {
    let response = await helpers.req(
      'POST',
      `/post/${postId}/hide`,
      { hide: true },
      await helpers.getToken(users[1]),
    );
    expect(response.status).toBe(200);
    const post = await queries.findPost(postId);
    expect(post?.status).toBe('HIDDEN');

    // cannot do things to post when hidden
    response = await helpers.req(
      'PUT',
      `/post/${postId}`,
      {
        title: 'This Post is Hidden',
        content: "I sure hope this post won't be edited.",
      },
      await helpers.getToken(users[1]),
    );
    expect(response.status).toBe(404);

    // cannot find post when hidden
    response = await helpers.req('GET', `/post/${postId}`);
    expect(response.status).toBe(404);
    // can find post if mod
    response = await helpers.req(
      'GET',
      `/post/${postId}`,
      {},
      await helpers.getToken(users[0]),
    );
    expect(response.status).toBe(200);
  });

  test('POST /post/:postId/hide - 200 and hides post (mod)', async () => {
    const response = await helpers.req(
      'POST',
      `/post/${postId}/hide`,
      { hide: true },
      await helpers.getToken(users[0]),
    );
    expect(response.status).toBe(200);
    const post = await queries.findPost(postId);
    expect(post?.status).toBe('HIDDEN');
  });

  test('POST /post/:postId/hide - 200 and unhides post', async () => {
    const response = await helpers.req(
      'POST',
      `/post/${postId}/hide`,
      { hide: false },
      await helpers.getToken(users[1]),
    );
    expect(response.status).toBe(200);
    const post = await queries.findPost(postId);
    expect(post?.status).toBe('ACTIVE');
  });
});

describe('vote on posts', () => {
  let postId: string = '';

  beforeAll(async () => {
    await queries.truncateTable('User');
    await queries.createAdmin();
    await queries.createUser('basic');
    await queries.createCommunity({
      urlName: 'comm',
      canonicalName: 'Community',
      description: 'This is an ordinary community.',
      adminId: 1,
    });
    postId = await queries.createPost(1, 1, {
      title: 'Post',
      content: 'Vote on me.',
    });
  });

  // this is not dry at all... we ball regardless.

  test('POST /post/:postId/upvote - 403 if own post', async () => {
    const response = await helpers.req(
      'POST',
      `/post/${postId}/upvote`,
      { upvote: true },
      await helpers.getToken('admin'),
    );
    expect(response.status).toBe(403);
  });

  test('POST /post/:postId/upvote - 200 and upvotes post', async () => {
    let response = await helpers.req(
      'POST',
      `/post/${postId}/upvote`,
      { upvote: true },
      await helpers.getToken('basic'),
    );
    expect(response.status).toBe(200);
    // doesn't stack
    response = await helpers.req(
      'POST',
      `/post/${postId}/upvote`,
      { upvote: true },
      await helpers.getToken('basic'),
    );
    expect(response.status).toBe(403);
    // doesn't let you downvote
    response = await helpers.req(
      'POST',
      `/post/${postId}/downvote`,
      { downvote: true },
      await helpers.getToken('admin'),
    );
    expect(response.status).toBe(403);
    const post = await queries.findPost(postId);
    expect(post?._count.upvotes).toBe(1);
    expect(post?._count.downvotes).toBe(0);
  });

  test('POST /post/:postId/upvote - 200 and removes upvote from post', async () => {
    const response = await helpers.req(
      'POST',
      `/post/${postId}/upvote`,
      { upvote: false },
      await helpers.getToken('basic'),
    );
    expect(response.status).toBe(200);
    const post = await queries.findPost(postId);
    expect(post?._count.upvotes).toBe(0);
  });

  test('POST /post/:postId/downvote - 400 if own post', async () => {
    const response = await helpers.req(
      'POST',
      `/post/${postId}/downvote`,
      { downvote: true },
      await helpers.getToken('admin'),
    );
    expect(response.status).toBe(403);
  });

  test('POST /post/:postId/downvote - 200 and downvotes post', async () => {
    let response = await helpers.req(
      'POST',
      `/post/${postId}/downvote`,
      { downvote: true },
      await helpers.getToken('basic'),
    );
    expect(response.status).toBe(200);
    // doesn't stack
    response = await helpers.req(
      'POST',
      `/post/${postId}/downvote`,
      { downvote: true },
      await helpers.getToken('basic'),
    );
    expect(response.status).toBe(403);
    // doesn't let you upvote
    response = await helpers.req(
      'POST',
      `/post/${postId}/upvote`,
      { upvote: true },
      await helpers.getToken('admin'),
    );
    expect(response.status).toBe(403);
    const post = await queries.findPost(postId);
    expect(post?._count.upvotes).toBe(0);
    expect(post?._count.downvotes).toBe(1);
  });

  test('POST /post/:postId/downvote - 200 and removes downvote from post', async () => {
    const response = await helpers.req(
      'POST',
      `/post/${postId}/downvote`,
      { downvote: false },
      await helpers.getToken('basic'),
    );
    expect(response.status).toBe(200);
    const post = await queries.findPost(postId);
    expect(post?._count.downvotes).toBe(0);
  });
});
